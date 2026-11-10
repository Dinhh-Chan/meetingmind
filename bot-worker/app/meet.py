"""Điều khiển một phiên bot trong Google Meet bằng Playwright.

Bot vào phòng như một khách tên "MeetingMind Bot", không bật mic/camera, chờ chủ
phòng cho vào rồi ghi âm thanh Meet phát ra loa ảo PulseAudio của container
(entrypoint.sh), tức giọng những người khác. Bot tự rời khi chỉ còn một mình, khi
cuộc họp kết thúc, khi bị mời ra, hoặc khi Core yêu cầu dừng.

Không vượt rào kiểm soát của Meet: bot hiện đúng tên, phải được chủ phòng
duyệt, và dừng nếu Meet từ chối.
"""

import asyncio
import logging
import re
import signal
import time
from dataclasses import dataclass, field
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit
from enum import Enum
from pathlib import Path
from typing import Awaitable, Callable

from playwright.async_api import BrowserContext, Page, async_playwright

log = logging.getLogger("bot-worker")

RECORDER_JS = (Path(__file__).parent / "recorder.js").read_text(encoding="utf-8")


class Status(str, Enum):
    """Trùng BotSessionStatus của Core."""

    JOINING = "joining"
    WAITING_ADMISSION = "waiting_admission"
    RECORDING = "recording"
    LEFT = "left"
    FAILED = "failed"


class EndReason(str, Enum):
    ALONE = "alone"
    MEETING_ENDED = "meeting_ended"
    REMOVED = "removed"
    STOP_REQUESTED = "stop_requested"
    MAX_DURATION = "max_duration"


class JoinError(Exception):
    """Không vào được phòng: bị chặn, bị từ chối, hoặc chờ duyệt quá lâu."""


@dataclass
class BotOptions:
    name: str = "MeetingMind Bot"
    admission_timeout_s: float = 300
    # Còn một mình bao lâu thì rời (người cuối cùng đã ra về).
    alone_timeout_s: float = 60
    max_duration_s: float = 4 * 3600
    # Nguồn thu: "monitor" của loa ảo mm_null mà Chromium phát âm thanh Meet ra.
    pulse_source: str = "mm_null.monitor"
    headless: bool = False
    debug_dir: Path | None = None
    # Hồ sơ Chromium đã đăng nhập tài khoản Google của bot (login.sh). Meet chặn
    # khách ẩn danh dùng trình duyệt tự động, nên chạy thật cần hồ sơ này.
    profile_dir: Path | None = None


@dataclass
class RecordingResult:
    path: Path
    bytes: int
    duration_ms: int
    end_reason: EndReason
    started_at: float = 0
    stats: dict = field(default_factory=dict)


# Chuỗi trên giao diện Meet tiếng Anh (context đặt locale en-US).
TEXT_BLOCKED = ["You can't join this video call", "You can’t join this video call"]
TEXT_DENIED = ["Someone in the call denied your request", "You can't join this call", "denied your request"]
TEXT_WAITING = ["Asking to be let in", "Please wait until a meeting host brings you into the call"]
TEXT_ENDED = ["You left the meeting", "You've left the meeting", "The call has ended", "This call has ended", "Return to home screen"]
TEXT_REMOVED = ["You've been removed from the meeting", "removed you from the meeting"]
TEXT_ALONE = ["You're the only one here", "No one else is here"]
# Hồ sơ bot đăng nhập cùng tài khoản với một người đang trong phòng: Meet đề
# nghị "chuyển" phiên của người đó sang đây. Bấm vào là đá người thật ra.
TEXT_SAME_ACCOUNT = ["Switch here", "Chuyển sang đây"]


# Nhãn nút: tiếng Anh trước (ép bằng hl=en), tiếng Việt dự phòng khi Meet vẫn
# theo ngôn ngữ tài khoản.
# So khớp phần đầu tên truy cập: nút thật tên "Ask to join without microphone &
# camera", còn "Join" trơn sẽ khớp nhầm "Other ways to join".
LABEL_JOIN = ["Ask to join", "Join now", "Yêu cầu tham gia", "Tham gia ngay"]
LABEL_LEAVE = ["Leave call", "Rời khỏi cuộc gọi"]
LABEL_NO_DEVICES = [
    "Continue without microphone and camera",
    "Continue without microphone",
    "Tiếp tục mà không có micrô và máy ảnh",
]


def with_english_ui(url: str) -> str:
    """Meet hiển thị theo ngôn ngữ tài khoản Google, không theo locale trình
    duyệt; hl=en ép giao diện tiếng Anh để nhận diện nút ổn định."""
    parts = urlsplit(url)
    query = dict(parse_qsl(parts.query))
    query["hl"] = "en"
    return urlunsplit(parts._replace(query=urlencode(query)))


async def _has_text(page: Page, texts: list[str]) -> bool:
    for t in texts:
        if await page.get_by_text(t, exact=False).first.is_visible():
            return True
    return False


async def _click_first(page: Page, names: list[str], role: str = "button", timeout: float = 2000) -> bool:
    for name in names:
        loc = page.get_by_role(role, name=re.compile(rf"^{re.escape(name)}", re.IGNORECASE))
        try:
            await loc.first.click(timeout=timeout)
            return True
        except Exception:  # noqa: BLE001 - thử nhãn kế tiếp
            continue
    return False


class MeetBot:
    def __init__(
        self,
        join_url: str,
        output: Path,
        options: BotOptions | None = None,
        on_status: Callable[[Status, str | None], Awaitable[None]] | None = None,
        stop_event: asyncio.Event | None = None,
    ) -> None:
        self.join_url = join_url
        self.output = output
        self.options = options or BotOptions()
        self.on_status = on_status
        self.stop_event = stop_event or asyncio.Event()
        self._shot = 0

    async def _status(self, status: Status, detail: str | None = None) -> None:
        log.info("Bot %s%s", status.value, f": {detail}" if detail else "")
        if self.on_status:
            await self.on_status(status, detail)

    async def _debug(self, page: Page, name: str) -> None:
        if not self.options.debug_dir:
            return
        self._shot += 1
        self.options.debug_dir.mkdir(parents=True, exist_ok=True)
        try:
            await page.screenshot(path=self.options.debug_dir / f"{self._shot:02d}-{name}.png")
        except Exception:  # noqa: BLE001 - ảnh dò lỗi không được làm hỏng phiên
            pass

    async def _start_recording(self) -> asyncio.subprocess.Process:
        """Thu âm thanh Meet phát ra loa ảo thành FLAC mono 16 kHz (tần số Whisper dùng)."""
        return await asyncio.create_subprocess_exec(
            "parecord",
            f"--device={self.options.pulse_source}",
            "--file-format=flac",
            "--rate=16000",
            "--channels=1",
            str(self.output),
            stdout=asyncio.subprocess.DEVNULL,
            stderr=asyncio.subprocess.PIPE,
        )

    @staticmethod
    async def _stop_recording(proc: asyncio.subprocess.Process) -> None:
        if proc.returncode is not None:
            return
        # SIGINT để parecord ghi nốt và đóng tệp FLAC đúng chuẩn.
        proc.send_signal(signal.SIGINT)
        try:
            await asyncio.wait_for(proc.wait(), 15)
        except asyncio.TimeoutError:
            proc.kill()
            await proc.wait()

    def _recorded_bytes(self) -> int:
        return self.output.stat().st_size if self.output.exists() else 0

    async def run(self) -> RecordingResult:
        args = [
            "--autoplay-policy=no-user-gesture-required",
            "--disable-dev-shm-usage",
            "--no-sandbox",
            # Cùng kho mật khẩu với login.sh, không thì không đọc được cookie đăng nhập.
            "--password-store=basic",
            # Hồ sơ của bot không kéo dữ liệu đồng bộ (extension, tab) giữa phiên.
            "--disable-sync",
        ]
        # Không cấp quyền mic/camera: bot chỉ nghe, Meet sẽ hỏi "tiếp tục không
        # có mic và camera".
        context_opts = {"locale": "en-US", "viewport": {"width": 1280, "height": 800}}
        async with async_playwright() as pw:
            if self.options.profile_dir:
                context = await pw.chromium.launch_persistent_context(
                    str(self.options.profile_dir), headless=self.options.headless, args=args, **context_opts
                )
            else:
                browser = await pw.chromium.launch(headless=self.options.headless, args=args)
                context = await browser.new_context(**context_opts)
            try:
                return await self._session(context)
            finally:
                await context.close()

    async def _session(self, context: BrowserContext) -> RecordingResult:
        page = context.pages[0] if context.pages else await context.new_page()
        await page.add_init_script(RECORDER_JS)

        await self._status(Status.JOINING)
        await page.goto(with_english_ui(self.join_url), wait_until="domcontentloaded")
        await self._join(page)
        await self._wait_admission(page)

        self.output.parent.mkdir(parents=True, exist_ok=True)
        recorder = await self._start_recording()
        started = time.monotonic()
        try:
            await self._status(Status.RECORDING)
            await self._debug(page, "recording")
            reason, stats = await self._watch(page, started, recorder)
            await _click_first(page, LABEL_LEAVE, timeout=3000)
        finally:
            await self._stop_recording(recorder)
        total = self._recorded_bytes()
        duration_ms = int((time.monotonic() - started) * 1000)
        await self._status(Status.LEFT, reason.value)
        return RecordingResult(self.output, total, duration_ms, reason, started, stats)

    async def _join(self, page: Page) -> None:
        # Hộp thoại hỏi quyền mic/camera xuất hiện vài giây sau khi trang tải.
        await page.wait_for_timeout(4000)
        await self._debug(page, "loaded")
        if await _has_text(page, TEXT_BLOCKED):
            await self._debug(page, "blocked")
            raise JoinError("Meet từ chối khách này (You can't join this video call)")

        await _click_first(page, LABEL_NO_DEVICES, timeout=3000)
        await page.wait_for_timeout(1000)

        # Khách ẩn danh phải nhập tên; đã đăng nhập thì Meet dùng tên tài khoản.
        name_box = page.get_by_role("textbox", name="Your name")
        if await name_box.count():
            await name_box.fill(self.options.name, timeout=10_000)

        await self._debug(page, "prejoin")
        if any([await page.get_by_role("button", name=t, exact=True).count() for t in TEXT_SAME_ACCOUNT]):
            raise JoinError(
                "Hồ sơ bot đang đăng nhập cùng tài khoản Google với một người trong phòng; "
                "bot phải dùng tài khoản riêng"
            )
        if not await _click_first(page, LABEL_JOIN, timeout=3000):
            await self._debug(page, "no-join-button")
            raise JoinError("Không thấy nút Ask to join")

    async def _in_call(self, page: Page) -> bool:
        # Phòng chờ kiểu mới của Meet cũng có đủ thanh công cụ và nút "Leave
        # call"; chỉ coi là đã vào khi dòng chờ duyệt không còn.
        if await _has_text(page, TEXT_WAITING):
            return False
        for label in LABEL_LEAVE:
            if await page.get_by_role("button", name=label).first.is_visible():
                return True
        return False

    async def _wait_admission(self, page: Page) -> None:
        deadline = time.monotonic() + self.options.admission_timeout_s
        announced = False
        while time.monotonic() < deadline:
            if await self._in_call(page):
                return
            if await _has_text(page, TEXT_DENIED):
                await self._debug(page, "denied")
                raise JoinError("Chủ phòng từ chối cho bot vào")
            if not announced and await _has_text(page, TEXT_WAITING):
                announced = True
                await self._status(Status.WAITING_ADMISSION)
                await self._debug(page, "waiting")
            if self.stop_event.is_set():
                raise JoinError("Đã huỷ trước khi được cho vào")
            await page.wait_for_timeout(1000)
        await self._debug(page, "admission-timeout")
        raise JoinError("Chờ chủ phòng duyệt quá lâu")

    async def _watch(self, page: Page, started: float, recorder: asyncio.subprocess.Process) -> tuple[EndReason, dict]:
        alone_since: float | None = None
        stats: dict = {}
        while True:
            await asyncio.sleep(2)
            if recorder.returncode is not None:
                err = (await recorder.stderr.read()).decode(errors="replace").strip()
                raise RuntimeError(f"parecord dừng giữa chừng (mã {recorder.returncode}): {err}")
            elapsed = time.monotonic() - started
            if self.stop_event.is_set():
                return EndReason.STOP_REQUESTED, stats
            if elapsed > self.options.max_duration_s:
                return EndReason.MAX_DURATION, stats
            if await _has_text(page, TEXT_REMOVED):
                return EndReason.REMOVED, stats
            if not await self._in_call(page) or await _has_text(page, TEXT_ENDED):
                await self._debug(page, "ended")
                return EndReason.MEETING_ENDED, stats
            # Tệp FLAC lớn dần rõ khi có người nói (im lặng nén còn rất ít byte).
            stats = {**await page.evaluate("() => window.__mmRecorder.stats()"), "bytes": self._recorded_bytes()}
            if await _has_text(page, TEXT_ALONE):
                alone_since = alone_since or time.monotonic()
                if time.monotonic() - alone_since > self.options.alone_timeout_s:
                    return EndReason.ALONE, stats
            else:
                alone_since = None
            if int(elapsed) % 30 < 2:
                log.info("Đang ghi %.0fs: %s", elapsed, stats)
