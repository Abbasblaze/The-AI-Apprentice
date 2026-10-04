from __future__ import annotations

import asyncio
import logging
from pathlib import Path
from typing import Optional

from app.schemas import MaskRegion

logger = logging.getLogger("image_redactor")

try:
    from PIL import Image, ImageDraw

    _PIL_AVAILABLE = True
except ImportError:
    _PIL_AVAILABLE = False

try:
    from presidio_image_redactor import ImageRedactorEngine

    _PRESIDIO_IMAGE_AVAILABLE = True
except ImportError:
    _PRESIDIO_IMAGE_AVAILABLE = False


def image_redaction_available() -> bool:
    return _PRESIDIO_IMAGE_AVAILABLE and _PIL_AVAILABLE


def check_tesseract_or_raise() -> None:
    if not _PRESIDIO_IMAGE_AVAILABLE:
        return
    import pytesseract

    try:
        pytesseract.get_tesseract_version()
    except Exception as exc:
        raise RuntimeError(
            "Tesseract OCR is not installed. Install it with your system package "
            "manager (for example: pacman -S tesseract tesseract-data-eng)."
        ) from exc


def _apply_mask_rectangles(image: "Image.Image", mask_regions: list[MaskRegion]) -> None:
    if not mask_regions:
        return
    draw = ImageDraw.Draw(image)
    width, height = image.size
    for region in mask_regions:
        left = int(region.x * width)
        top = int(region.y * height)
        right = int((region.x + region.width) * width)
        bottom = int((region.y + region.height) * height)
        draw.rectangle([left, top, right, bottom], fill="black")


class ImageRedactor:
    def __init__(self) -> None:
        self._engine: Optional["ImageRedactorEngine"] = None
        if _PRESIDIO_IMAGE_AVAILABLE:
            self._engine = ImageRedactorEngine()

    def redact_image_file(self, path: Path, mask_regions: list[MaskRegion]) -> None:
        if not _PIL_AVAILABLE or not path.exists():
            return
        image = Image.open(path).convert("RGB")
        if self._engine is not None:
            try:
                image = self._engine.redact(image, fill=(0, 0, 0))
            except Exception as exc:
                logger.warning("Presidio image redaction failed for %s: %s", path, exc)
        _apply_mask_rectangles(image, mask_regions)
        image.save(path, format="JPEG")


class _Job:
    def __init__(
        self,
        session_id: str,
        t: float,
        path: Path,
        mask_regions: list[MaskRegion],
    ) -> None:
        self.session_id = session_id
        self.t = t
        self.path = path
        self.mask_regions = mask_regions


class AsyncRedactionQueue:
    def __init__(self) -> None:
        self._queue: asyncio.Queue[_Job] = asyncio.Queue()

    def submit(
        self,
        session_id: str,
        t: float,
        path: Path,
        mask_regions: list[MaskRegion],
    ) -> None:
        self._queue.put_nowait(_Job(session_id, t, path, mask_regions))

    async def start_worker(self, image_redactor: ImageRedactor) -> None:
        while True:
            job = await self._queue.get()
            try:
                await asyncio.to_thread(
                    image_redactor.redact_image_file, job.path, job.mask_regions
                )
            except Exception as exc:
                logger.warning(
                    "Redaction job failed (%s @ %.3f): %s", job.session_id, job.t, exc
                )
            finally:
                self._queue.task_done()


redaction_queue = AsyncRedactionQueue()
