"""Compose the API routes, request policies and built React application."""

import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse

from terralens import __version__
from terralens.api import analyzer, experiments, reference
from terralens.api.resources import AppResources
from terralens.settings import ARTIFACTS, FRONTEND, MAX_UPLOAD_ENVELOPE, RUNTIME
from terralens.uploads import UploadBodyLimitMiddleware


@asynccontextmanager
async def lifespan(app: FastAPI):
    with AppResources.open(ARTIFACTS, RUNTIME) as resources:
        app.state.resources = resources
        yield


app = FastAPI(
    title="TerraLens API",
    version=__version__,
    lifespan=lifespan,
    description="Reproducible, label-blind EuroSAT exploration with fitted patch analysis and live experiments.",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in os.getenv("TERRALENS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",")],
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)
app.add_middleware(UploadBodyLimitMiddleware, max_bytes=MAX_UPLOAD_ENVELOPE)


@app.middleware("http")
async def response_headers(request: Request, call_next):
    is_upload = request.url.path == "/api/analyze"
    if is_upload and request.method == "POST":
        try:
            content_length = int(request.headers.get("content-length", "0"))
        except ValueError:
            return JSONResponse({"detail": "Invalid upload length."}, status_code=400)
        if content_length > MAX_UPLOAD_ENVELOPE:
            return JSONResponse({"detail": "The image must be smaller than 8 MB."}, status_code=413)
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    if is_upload:
        response.headers["Cache-Control"] = "no-store"
    return response


app.include_router(reference.router, prefix="/api")
app.include_router(experiments.router, prefix="/api")
app.include_router(analyzer.router, prefix="/api")


@app.api_route("/{path:path}", methods=["GET", "HEAD"], include_in_schema=False)
def frontend(path: str):
    if path == "api" or path.startswith("api/"):
        raise HTTPException(404, "API route not found.")
    target = (FRONTEND / path).resolve()
    if target.is_relative_to(FRONTEND.resolve()) and target.is_file():
        return FileResponse(target)
    if "." not in Path(path).name and (FRONTEND / "index.html").is_file():
        return FileResponse(FRONTEND / "index.html", headers={"Cache-Control": "no-cache"})
    raise HTTPException(404, "Frontend is not built. Run the frontend build or use the Vite development server.")
