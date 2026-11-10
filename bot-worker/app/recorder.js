/**
 * Chèn vào trang Meet trước mọi script của trang (Playwright add_init_script).
 *
 * Chỉ để theo dõi: bọc RTCPeerConnection để đếm audio track từ xa Meet đang
 * nhận, ghi vào log khi bot chạy. Việc ghi âm do meet.py làm: thu thẳng từ loa
 * ảo PulseAudio mà Meet phát ra. Trước đây bot ghi bằng Web Audio + MediaRecorder
 * trên chính các track này, nhưng từ Chromium 156 luồng WebRTC từ xa đi vào Web
 * Audio toàn số 0 (dù Meet vẫn phát ra loa đủ tiếng), nên bản ghi bị câm.
 */
(() => {
    if (window.__mmRecorder) return;

    const tracks = new Map();

    const Original = window.RTCPeerConnection;
    if (Original) {
        window.RTCPeerConnection = new Proxy(Original, {
            construct(target, args) {
                const pc = Reflect.construct(target, args);
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
    };
})();
