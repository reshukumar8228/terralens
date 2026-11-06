"""HTTP boundary for the TerraLens study, interactive experiments and patch analysis."""

from __future__ import annotations

import csv
import asyncio
import io
import json
import logging
import os
import re
import threading
import time
import uuid
import warnings
from collections import defaultdict, deque
from concurrent.futures import ThreadPoolExecutor
from contextlib import asynccontextmanager
from functools import lru_cache
from pathlib import Path

from fastapi import FastAPI, File, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, Response
from PIL import Image, UnidentifiedImageError
from pydantic import BaseModel, ConfigDict, Field, field_validator
from threadpoolctl import threadpool_limits

from terralens import __version__
from terralens.store import ExperimentStore
from terralens.uploads import UploadBodyLimitMiddleware, analyze_upload

ROOT = Path(__file__).resolve().parents[2]
ARTIFACTS = Path(os.getenv("TERRALENS_ARTIFACTS", str(ROOT / "artifacts"))).resolve()
RUNTIME = Path(os.getenv("TERRALENS_RUNTIME", str(ROOT / "runtime"))).resolve()
FRONTEND = ROOT / "frontend" / "dist"
MAX_UPLOAD = 8 * 1024 * 1024
MAX_SAMPLES = max(200, min(3000, int(os.getenv("TERRALENS_MAX_SAMPLES", "1500"))))
SAFE_ID = re.compile(r"^[a-zA-Z0-9_-]{1,96}$")
log = logging.getLogger("terralens")


class ExperimentConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")
    k: int = Field(default=6, ge=2, le=15)
    variance: float = 0.95
    seed: int = Field(default=42, ge=0, le=9999)
    sample_size: int = Field(default=1000, ge=200, le=3000)

    @field_validator("variance")
    @classmethod
    def supported_variance(cls, value):
        if value not in (0.9, 0.95, 0.99):
            raise ValueError("Choose retained variance 0.90, 0.95 or 0.99.")
        return value


@lru_cache(maxsize=4)
def read_artifact(name: str, modified_ns: int) -> dict:
    del modified_ns  # The modification timestamp is a cache key, not scientific input.
    with (ARTIFACTS / name).open(encoding="utf-8") as handle:
        return json.load(handle)


def artifact(name: str) -> dict:
    path = ARTIFACTS / name
    if not path.is_file():
        raise HTTPException(503, "Reference study is not prepared. Follow the dataset/study setup in README.md.")
    return read_artifact(name, path.stat().st_mtime_ns)


class RequestLimits:
    """Bound costly anonymous actions without an external service or persistent identity."""

    def __init__(self):
        self.events = defaultdict(deque)
        self.lock = threading.Lock()

    def check(self, request: Request, action: str, maximum: int):
        key = (request.client.host if request.client else "unknown", action)
        now = time.monotonic()
        with self.lock:
            queue = self.events[key]
            while queue and now - queue[0] >= 60:
                queue.popleft()
            if len(queue) >= maximum:
                raise HTTPException(429, "Please wait a minute before starting another operation.", headers={"Retry-After": "60"})
            queue.append(now)
            if len(self.events) > 2000:
                self.events = defaultdict(deque, {k: v for k, v in self.events.items() if v and now - v[-1] < 60})


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.store = ExperimentStore(RUNTIME)
    app.state.executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="terralens-study")
    app.state.upload_executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="terralens-upload")
    app.state.limits = RequestLimits()
    app.state.submit_lock = threading.Lock()
    yield
    app.state.executor.shutdown(wait=False, cancel_futures=True)
    app.state.upload_executor.shutdown(wait=False, cancel_futures=True)


app = FastAPI(
    title="TerraLens API", version=__version__, lifespan=lifespan,
    description="Reproducible, label-blind EuroSAT exploration. Cluster assignments are not land-type probabilities.",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[x.strip() for x in os.getenv("TERRALENS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",")],
    allow_methods=["GET", "POST"], allow_headers=["Content-Type"],
)
app.add_middleware(UploadBodyLimitMiddleware, max_bytes=MAX_UPLOAD + 256 * 1024)


@app.middleware("http")
async def response_headers(request: Request, call_next):
    if request.url.path == "/api/analyze":
        try:
            content_length = int(request.headers.get("content-length", "0"))
        except ValueError:
            return JSONResponse({"detail": "Invalid upload length."}, status_code=400)
        if content_length > MAX_UPLOAD + 256 * 1024:
            return JSONResponse({"detail": "The image must be smaller than 8 MB."}, status_code=413)
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    if request.url.path.startswith("/api/analyze"):
        response.headers["Cache-Control"] = "no-store"
    return response


@app.get("/api/health")
def health():
    return {"status": "ok", "study_ready": (ARTIFACTS / "study.json").is_file(), "version": __version__}


@app.get("/api/capabilities")
def capabilities():
    study_path = ARTIFACTS / "study.json"
    return {
        "max_experiment_samples": MAX_SAMPLES, "live_tsne": False, "upload_max_bytes": MAX_UPLOAD,
        "storage": "Reference results are permanent. Live experiment history is temporary on free hosting; export important results.",
        "reference_run_id": artifact("study.json").get("selected_run_id") if study_path.exists() else None,
    }


@app.get("/api/study")
def study():
    return artifact("study.json")


@app.get("/api/audit")
def reference_audit():
    return artifact("audit.json")


@app.get("/api/features")
def feature_dictionary():
    from terralens.features import FEATURE_NAMES
    study = artifact("study.json")
    path = ARTIFACTS / "features.json"
    if path.exists():
        value = artifact("features.json")
        return value if isinstance(value, dict) else {"features": value}
    return {"features": [{"name": name, "family": name.split("_")[0], "description": name.replace("_", " ")} for name in FEATURE_NAMES], "families": study.get("feature_families", [])}


@app.get("/api/patches/{patch_id}.jpg")
def patch(patch_id: str):
    if not SAFE_ID.fullmatch(patch_id):
        raise HTTPException(404, "Patch not found.")
    path = ARTIFACTS / "thumbnails" / f"{patch_id}.jpg"
    if not path.is_file():
        raise HTTPException(404, "This patch is not part of the bundled preview cohort.")
    return FileResponse(path, media_type="image/jpeg", headers={"Cache-Control": "public, max-age=86400"})


def execute_experiment(app: FastAPI, experiment_id: str, config: dict):
    store = app.state.store
    store.update(experiment_id, "running", "Transforming the sample and fitting K-Means")
    try:
        from terralens.pipeline import run_experiment
        with threadpool_limits(limits=2):
            result = run_experiment(config, ARTIFACTS)
        store.update(experiment_id, "completed", "Results ready", result=result)
    except Exception:
        log.exception("Numerical experiment failed: %s", experiment_id)
        store.update(experiment_id, "failed", "Experiment failed", error="The numerical worker could not complete this experiment. Try a smaller sample or check server logs.")


@app.post("/api/experiments", status_code=202)
def create_experiment(config: ExperimentConfig, request: Request):
    artifact("study.json")
    request.app.state.limits.check(request, "experiment", 6)
    if config.sample_size > MAX_SAMPLES:
        raise HTTPException(422, f"This server allows at most {MAX_SAMPLES} patches per live experiment.")
    store = request.app.state.store
    with request.app.state.submit_lock:
        if store.active_count() >= 3:
            raise HTTPException(429, "The experiment queue is full. Wait for the current run to finish.", headers={"Retry-After": "10"})
        experiment_id = "live-" + uuid.uuid4().hex[:16]
        payload = config.model_dump()
        store.create(experiment_id, payload)
        request.app.state.executor.submit(execute_experiment, request.app, experiment_id, payload)
    return {"id": experiment_id, "status": "queued"}


@app.get("/api/experiments")
def list_experiments(request: Request):
    return {"experiments": request.app.state.store.list()}


@app.get("/api/experiments/{experiment_id}")
def get_experiment(experiment_id: str, request: Request):
    if not SAFE_ID.fullmatch(experiment_id):
        raise HTTPException(404, "Experiment not found.")
    value = request.app.state.store.get(experiment_id)
    if value is None:
        raise HTTPException(404, "Experiment not found. Temporary history may have reset on the hosting service.")
    return value


@app.get("/api/export/experiments/{experiment_id}.json")
def export_experiment(experiment_id: str, request: Request):
    value = get_experiment(experiment_id, request)
    return JSONResponse(value, headers={"Content-Disposition": f'attachment; filename="terralens-{experiment_id}.json"'})


@app.post("/api/analyze")
async def analyze(request: Request, file: UploadFile = File(...)):
    artifact("study.json")
    request.app.state.limits.check(request, "upload", 12)
    try:
        raw = await file.read(MAX_UPLOAD + 1)
    finally:
        await file.close()
    if not raw:
        raise HTTPException(422, "Choose a JPEG, PNG or WebP satellite patch.")
    if len(raw) > MAX_UPLOAD:
        raise HTTPException(413, "The image must be smaller than 8 MB.")
    try:
        return await asyncio.get_running_loop().run_in_executor(request.app.state.upload_executor, analyze_upload, raw, ARTIFACTS)
    except HTTPException:
        raise
    except Exception:
        log.exception("Patch analysis failed")
        raise HTTPException(500, "Image analysis failed. Confirm that the reference model artifacts are prepared.") from None


@app.get("/api/export/study.json")
def export_study():
    artifact("study.json")
    return FileResponse(ARTIFACTS / "study.json", media_type="application/json", filename="terralens-study.json")


@app.get("/api/export/config.json")
def export_config():
    data = artifact("study.json")
    config = {**artifact("config.json"), **{key: data.get(key) for key in ("project", "dataset", "split", "preprocessing", "provenance", "selected_run_id")}}
    return JSONResponse(config, headers={"Content-Disposition": 'attachment; filename="terralens-config.json"'})


@app.get("/api/export/metrics.csv")
def export_metrics():
    data = artifact("study.json")
    fields = ["id", "selected", "k", "variance", "components", "seed", "silhouette", "silhouette_original", "davies_bouldin", "calinski_harabasz", "inertia", "stability", "runtime_seconds"]
    output = io.StringIO(newline="")
    writer = csv.DictWriter(output, fieldnames=fields)
    writer.writeheader()
    for run in data["runs"]:
        row = {key: run.get(key) for key in fields}
        row.update({key: value for key, value in run.get("metrics", {}).items() if key in fields})
        row["selected"] = run["id"] == data["selected_run_id"]
        writer.writerow(row)
    return Response(output.getvalue(), media_type="text/csv", headers={"Content-Disposition": 'attachment; filename="terralens-metrics.csv"'})


@app.get("/{path:path}", include_in_schema=False)
def frontend(path: str):
    if path.startswith("api/"):
        raise HTTPException(404, "API route not found.")
    target = (FRONTEND / path).resolve()
    if target.is_relative_to(FRONTEND.resolve()) and target.is_file():
        return FileResponse(target)
    if "." not in Path(path).name and (FRONTEND / "index.html").is_file():
        return FileResponse(FRONTEND / "index.html", headers={"Cache-Control": "no-cache"})
    raise HTTPException(404, "Frontend is not built. Run the frontend build or use the Vite development server.")
