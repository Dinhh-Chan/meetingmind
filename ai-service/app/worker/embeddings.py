"""Nhúng vector qua API kiểu OpenAI (mặc định FPT AI Factory, model Vietnamese_Embedding).

Vietnamese_Embedding (1024 chiều) do FPT tự host nên nội dung họp không đi ra
ngoài FPT, và tìm câu tiếng Việt sát nghĩa hơn model đa ngữ chung chung.
Đổi model khác số chiều thì phải đổi cột vector trong knowledge_store.py và
lập chỉ mục lại toàn bộ.
"""

import asyncio
import logging
import os
from dataclasses import dataclass

import httpx

log = logging.getLogger("app.knowledge")

EMBEDDING_DIM = 1024


class EmbeddingError(Exception):
    """Không lấy được vector dùng được."""


@dataclass(frozen=True)
class EmbeddingSettings:
    base_url: str = "https://token-api.fpt.ai/v1"
    api_key: str = ""
    model: str = "Vietnamese_Embedding"
    batch_size: int = 32
    timeout_s: float = 60.0
    retry_delay_s: float = 1.0
    # Cắt bớt chữ quá dài: gateway từ chối cả lô nếu một đầu vào vượt giới hạn
    # token của model. Đoạn bình thường chỉ ~1000 ký tự.
    max_input_chars: int = 4000

    @classmethod
    def from_env(cls) -> "EmbeddingSettings":
        env = os.environ.get
        return cls(
            base_url=env("AI_LLM_BASE_URL", cls.base_url).rstrip("/"),
            api_key=env("AI_LLM_API_KEY", cls.api_key),
            model=env("AI_EMBEDDING_MODEL", cls.model),
            batch_size=int(env("AI_EMBEDDING_BATCH_SIZE", str(cls.batch_size))),
        )


class EmbeddingClient:
    def __init__(self, settings: EmbeddingSettings | None = None, transport: httpx.AsyncBaseTransport | None = None) -> None:
        self.settings = settings or EmbeddingSettings.from_env()
        self._transport = transport

    @property
    def model(self) -> str:
        return self.settings.model

    async def embed(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []
        if not self.settings.api_key:
            raise EmbeddingError("chưa cấu hình AI_LLM_API_KEY")
        inputs = [t[: self.settings.max_input_chars] for t in texts]
        vectors: list[list[float]] = []
        async with httpx.AsyncClient(
            base_url=self.settings.base_url,
            headers={"Authorization": f"Bearer {self.settings.api_key}"},
            timeout=httpx.Timeout(self.settings.timeout_s, connect=10.0),
            transport=self._transport,
        ) as client:
            size = max(1, self.settings.batch_size)
            for start in range(0, len(inputs), size):
                vectors.extend(await self._batch(client, inputs[start : start + size]))
        return vectors

    async def _batch(self, client: httpx.AsyncClient, batch: list[str]) -> list[list[float]]:
        # Thử lại đúng một lần với lỗi tạm thời (5xx, hết giờ, rớt mạng); lỗi
        # 4xx (sai key, sai tên model) thử lại cũng vô ích.
        for attempt in (1, 2):
            try:
                response = await client.post("/embeddings", json={"model": self.settings.model, "input": batch})
            except httpx.TransportError as err:
                if attempt == 2:
                    raise EmbeddingError(f"không gọi được API nhúng: {type(err).__name__}") from None
                log.warning("Gọi API nhúng lỗi (%s), thử lại", type(err).__name__)
                await asyncio.sleep(self.settings.retry_delay_s)
                continue
            if response.status_code >= 500 and attempt == 1:
                log.warning("API nhúng trả HTTP %d, thử lại", response.status_code)
                await asyncio.sleep(self.settings.retry_delay_s)
                continue
            if response.status_code != 200:
                raise EmbeddingError(f"HTTP {response.status_code}: {response.text[:300]}")
            return self._parse(response, len(batch))
        raise EmbeddingError("hết lượt thử")  # không tới được, cho mypy yên tâm

    @staticmethod
    def _parse(response: httpx.Response, expected: int) -> list[list[float]]:
        try:
            data = sorted(response.json()["data"], key=lambda d: d.get("index", 0))
            vectors = [[float(x) for x in d["embedding"]] for d in data]
        except (ValueError, KeyError, TypeError) as err:
            raise EmbeddingError(f"phản hồi nhúng không đúng dạng: {err}") from None
        if len(vectors) != expected:
            raise EmbeddingError(f"nhận {len(vectors)} vector cho {expected} đầu vào")
        if any(len(v) != EMBEDDING_DIM for v in vectors):
            raise EmbeddingError(f"vector không đủ {EMBEDDING_DIM} chiều, kiểm tra AI_EMBEDDING_MODEL")
        return vectors
