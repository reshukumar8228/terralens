"""Bound the request before multipart parsing and isolate image work from the event loop."""

from __future__ import annotations

import asyncio
import io
import warnings
from pathlib import Path

from fastapi import HTTPException
from PIL import Image, UnidentifiedImageError
from starlette.responses import JSONResponse


class UploadBodyLimitMiddleware:
    """Buffer at most two small request envelopes before the multipart parser sees them.

    Counting received bytes also covers chunked HTTP requests without Content-Length.
    An oversized stream is stopped before any UploadFile is created or spooled.
    """

    def __init__(self, app, max_bytes: int):
        self.app = app
        self.max_bytes = max_bytes
        self.slots = asyncio.Semaphore(2)

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http" or scope.get("path") != "/api/analyze" or scope.get("method") != "POST":
            await self.app(scope, receive, send)
            return
        if self.slots.locked():
            await JSONResponse({"detail": "Image analysis is busy. Please try again shortly."}, status_code=429)(scope, receive, send)
            return
        async with self.slots:
            chunks, received = [], 0
            while True:
                message = await receive()
                if message["type"] == "http.disconnect":
                    return
                chunk = message.get("body", b"")
                received += len(chunk)
                if received > self.max_bytes:
                    await JSONResponse({"detail": "The image must be smaller than 8 MB."}, status_code=413)(scope, receive, send)
                    return
                if chunk:
                    chunks.append(chunk)
                if not message.get("more_body", False):
                    break
            body = b"".join(chunks)
            chunks.clear()
            replayed = False

            async def bounded_receive():
                nonlocal replayed
                if not replayed:
                    replayed = True
                    return {"type": "http.request", "body": body, "more_body": False}
                return await receive()

            await self.app(scope, bounded_receive, send)


def analyze_upload(raw: bytes, artifacts_dir: Path, comparison: bool = False) -> dict:
    """Decode, validate, resize and infer in the single bounded image worker."""
    notices = []
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(io.BytesIO(raw)) as source:
                if source.format not in ("JPEG", "PNG", "WEBP"):
                    raise HTTPException(415, "Supported image formats are JPEG, PNG and WebP.")
                width, height = source.size
                if min(width, height) < 16 or max(width, height) > 4096:
                    raise HTTPException(422, "Choose an image between 16 and 4096 pixels on each side.")
                if width != height:
                    notices.append("A non-square image is resized to a square patch; this may alter its texture.")
                if source.mode != "RGB":
                    notices.append("The image was converted to RGB; transparency and extra bands are not model inputs.")
                source.load()
                image = source.convert("RGB").resize((64, 64), Image.Resampling.BILINEAR)
                if (width, height) != (64, 64):
                    notices.append(f"Image resized from {width}×{height} to the study's 64×64 patch format; scale may differ from EuroSAT.")
    except HTTPException:
        raise
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError, Image.DecompressionBombWarning):
        raise HTTPException(422, "The file could not be decoded as a safe image.") from None
    from terralens.inference import analyze_image
    result = analyze_image(image, artifacts_dir, comparison=comparison)
    result["warnings"] = notices + result.get("warnings", [])
    result["input_size"] = [width, height]
    result["retention"] = "The uploaded image is not retained after this request; temporary upload buffers are closed."
    return result
