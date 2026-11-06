"""Filesystem paths and shared resource limits for the application."""

import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ARTIFACTS = Path(os.getenv("TERRALENS_ARTIFACTS", str(ROOT / "artifacts"))).resolve()
RUNTIME = Path(os.getenv("TERRALENS_RUNTIME", str(ROOT / "runtime"))).resolve()
FRONTEND = ROOT / "frontend" / "dist"

MAX_UPLOAD = 8 * 1024 * 1024
MAX_UPLOAD_ENVELOPE = MAX_UPLOAD + 256 * 1024
MAX_SAMPLES = max(200, min(3000, int(os.getenv("TERRALENS_MAX_SAMPLES", "1500"))))
MAX_LIVE_TSNE_SAMPLES = 500
