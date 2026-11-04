/**
 * Chèn vào trang Meet trước mọi script của trang (Playwright add_init_script).
 *
 * Meet nhận giọng người khác qua WebRTC. Bọc RTCPeerConnection để bắt mọi
 * audio track từ xa, trộn chung vào một AudioContext rồi ghi bằng MediaRecorder.
 * Cách này không cần card âm thanh ảo trong container: bot ghi đúng thứ nó
 * nhận, kể cả khi chạy không có loa.
 *
 * Mỗi khúc ghi được đẩy về Python qua window.__mmOnChunk (expose_function),
 * dạng base64, theo đúng thứ tự.
 */
(() => {
    if (window.__mmRecorder) return;

    const state = {
        ctx: null,
        dest: null,
        analyser: null,
        recorder: null,
        trackIds: new Set(),
        tracks: [],
        // Mức âm đỉnh giữa hai lần gọi stats(): mức tức thời hay rơi vào khoảng nghỉ.
        peak: 0,
        sampler: null,
        // Giữ tham chiếu để thẻ <audio> không bị thu gom.
        sinks: [],
        // Chuỗi promise giữ thứ tự khúc ghi: arrayBuffer() là bất đồng bộ.
        queue: Promise.resolve(),
        bytes: 0,
    };

    function ensureContext() {
        if (state.ctx) return;
        state.ctx = new AudioContext({ sampleRate: 48000 });
        state.dest = state.ctx.createMediaStreamDestination();
        state.analyser = state.ctx.createAnalyser();
        state.analyser.fftSize = 2048;
        const buffer = new Float32Array(state.analyser.fftSize);
        state.sampler = setInterval(() => {
            state.analyser.getFloatTimeDomainData(buffer);
            for (const v of buffer) state.peak = Math.max(state.peak, Math.abs(v));
        }, 100);
    }

    function attach(track) {
        if (!track || track.kind !== "audio" || state.trackIds.has(track.id)) return;
        state.trackIds.add(track.id);
        state.tracks.push(track);
        ensureContext();
        const stream = new MediaStream([track]);
        // Lỗi đã biết của Chromium: âm thanh WebRTC từ xa không vào Web Audio nếu
        // luồng chưa gắn vào một phần tử media. Gắn vào <audio> tắt tiếng.
        const sink = new Audio();
        sink.muted = true;
        sink.srcObject = stream;
        sink.play().catch(() => {});
        state.sinks.push(sink);
        const source = state.ctx.createMediaStreamSource(stream);
        source.connect(state.dest);
        source.connect(state.analyser);
        track.addEventListener("ended", () => {
            try {
                source.disconnect();
            } catch {}
        });
    }

    const Original = window.RTCPeerConnection;
    if (Original) {
        window.RTCPeerConnection = new Proxy(Original, {
            construct(target, args) {
                const pc = Reflect.construct(target, args);
                pc.addEventListener("track", (event) => attach(event.track));
                return pc;
            },
        });
    }

    function toBase64(bytes) {
        let binary = "";
        for (let i = 0; i < bytes.length; i += 0x8000) {
            binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
        }
        return btoa(binary);
    }

    window.__mmRecorder = {
        start(timesliceMs) {
            ensureContext();
            state.ctx.resume();
            const recorder = new MediaRecorder(state.dest.stream, {
                mimeType: "audio/webm;codecs=opus",
                audioBitsPerSecond: 64000,
            });
            recorder.ondataavailable = (event) => {
                if (!event.data || !event.data.size) return;
                state.queue = state.queue.then(async () => {
                    const bytes = new Uint8Array(await event.data.arrayBuffer());
                    state.bytes += bytes.length;
                    await window.__mmOnChunk(toBase64(bytes));
                });
            };
            recorder.start(timesliceMs);
            state.recorder = recorder;
            return true;
        },

        /** Dừng và chờ khúc cuối được đẩy về xong. */
        async stop() {
            const recorder = state.recorder;
            if (recorder && recorder.state !== "inactive") {
                await new Promise((resolve) => {
                    recorder.onstop = resolve;
                    recorder.stop();
                });
            }
            await state.queue;
            return state.bytes;
        },

        /** Số audio track từ xa đã bắt được và mức âm hiện tại (0..1). */
        stats() {
            const peak = Math.round(state.peak * 1000) / 1000;
            state.peak = 0;
            return {
                tracks: state.trackIds.size,
                live: state.tracks.filter((t) => t.readyState === "live" && !t.muted).length,
                context: state.ctx ? state.ctx.state : "none",
                peak,
                bytes: state.bytes,
                recording: !!state.recorder && state.recorder.state === "recording",
            };
        },
    };
})();
