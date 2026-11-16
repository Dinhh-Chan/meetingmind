/**
 * Chèn vào trang Meet trước mọi script của trang (Playwright add_init_script).
 *
 * Chỉ để theo dõi: bọc RTCPeerConnection để đếm audio track từ xa Meet đang
 * nhận, ghi vào log khi bot chạy. Việc ghi âm do meet.py làm: thu thẳng từ loa
 * ảo PulseAudio mà Meet phát ra. Trước đây bot ghi bằng Web Audio + MediaRecorder
 * trên chính các track này, nhưng từ Chromium 156 luồng WebRTC từ xa đi vào Web
 * Audio toàn số 0 (dù Meet vẫn phát ra loa đủ tiếng), nên bản ghi bị câm.
 *
 * rtp(): chất lượng âm thanh Meet gửi về (codec, bitrate, mất gói, mẫu bị che
 * lấp do mất gói), để biết bản ghi kém do đường truyền hay do người nói. Bản ghi
 * thật từng chỉ có tiếng dưới 4 kHz (như điện thoại) dù loa ảo chạy 44,1 kHz.
 */
(() => {
    if (window.__mmRecorder) return;

    const tracks = new Map();
    const peers = new Set();
    let last = null;

    const Original = window.RTCPeerConnection;
    if (Original) {
        window.RTCPeerConnection = new Proxy(Original, {
            construct(target, args) {
                const pc = Reflect.construct(target, args);
                peers.add(pc);
                pc.addEventListener("track", (event) => {
                    const track = event.track;
                    if (track && track.kind === "audio") tracks.set(track.id, track);
                });
                return pc;
            },
        });
    }

    window.__mmRecorder = {
        /** Số audio track từ xa và số track đang có tiếng truyền tới. */
        stats() {
            const all = [...tracks.values()];
            return {
                tracks: all.length,
                live: all.filter((t) => t.readyState === "live" && !t.muted).length,
            };
        },
        /** Gộp các luồng âm thanh nhận về: kbps từ lần gọi trước, % mất gói, % mẫu bị che lấp, codec. */
        async rtp() {
            let bytes = 0, packets = 0, lost = 0, concealed = 0, samples = 0;
            const codecs = new Set();
            for (const pc of peers) {
                if (pc.connectionState === "closed") continue;
                let report;
                try {
                    report = await pc.getStats();
                } catch {
                    continue;
                }
                const byId = new Map();
                report.forEach((s) => byId.set(s.id, s));
                report.forEach((s) => {
                    if (s.type !== "inbound-rtp" || s.kind !== "audio") return;
                    bytes += s.bytesReceived || 0;
                    packets += s.packetsReceived || 0;
                    lost += Math.max(0, s.packetsLost || 0);
                    concealed += s.concealedSamples || 0;
                    samples += s.totalSamplesReceived || 0;
                    const c = s.codecId && byId.get(s.codecId);
                    if (c) codecs.add(`${c.mimeType}/${c.clockRate}${c.sdpFmtpLine ? " " + c.sdpFmtpLine : ""}`);
                });
            }
            const now = performance.now();
            // byte * 8 / ms = kbit/s
            const kbps = last && now > last.at ? Math.round(((bytes - last.bytes) * 8) / (now - last.at)) : null;
            last = { bytes, at: now };
            return {
                kbps,
                lossPct: packets + lost ? Math.round((1000 * lost) / (packets + lost)) / 10 : 0,
                concealedPct: samples ? Math.round((1000 * concealed) / samples) / 10 : 0,
                codecs: [...codecs],
            };
        },
    };
})();
