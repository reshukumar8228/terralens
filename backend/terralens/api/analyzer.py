"""Accept one bounded upload and return the fitted model's evidence."""

import asyncio
import logging
from typing import Annotated

from fastapi import APIRouter, File, HTTPException, Request, UploadFile

from terralens.api.resources import Resources
from terralens.settings import MAX_UPLOAD
from terralens.uploads import analyze_upload

router = APIRouter(tags=["Patch analysis"])
log = logging.getLogger(__name__)


@router.post("/analyze")
async def analyze(request: Request, resources: Resources, file: Annotated[UploadFile, File()], run_id: str | None = None):
    try:
        comparison = resources.uses_comparison(run_id)
        resources.limits.check(request, "upload", 12)
        raw = await file.read(MAX_UPLOAD + 1)
    finally:
        await file.close()
    if not raw:
        raise HTTPException(422, "Choose a JPEG, PNG or WebP satellite patch.")
    if len(raw) > MAX_UPLOAD:
        raise HTTPException(413, "The image must be smaller than 8 MB.")
    try:
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(resources.upload_worker, analyze_upload, raw, resources.artifacts, comparison)
    except HTTPException:
        raise
    except FileNotFoundError:
        raise HTTPException(503, "Reference model artifacts are missing. Follow the study setup in README.md.") from None
    except Exception:
        log.exception("Patch analysis failed")
        raise HTTPException(500, "Image analysis failed. Confirm that the reference model artifacts are prepared.") from None
