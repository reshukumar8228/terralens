"""Application resources shared by the reference, experiment and upload routes."""

from __future__ import annotations

import json
import re
import threading
import time
from collections import defaultdict, deque
from concurrent.futures import ThreadPoolExecutor
from contextlib import contextmanager
from functools import lru_cache
from pathlib import Path
from typing import Annotated

from fastapi import Depends, HTTPException, Request

from terralens.settings import COMPARISON_MODEL_FILENAME, COMPARISON_RUN_ID
from terralens.store import ExperimentStore

SAFE_ID = re.compile(r"^[a-zA-Z0-9_-]{1,96}$")


class RequestLimits:
    """Apply a short per-client budget to expensive anonymous operations."""

    def __init__(self):
        self.events = defaultdict(deque)
        self.lock = threading.Lock()

    def check(self, request: Request, action: str, maximum: int) -> None:
        key = (request.client.host if request.client else "unknown", action)
        now = time.monotonic()
        with self.lock:
            queue = self.events[key]
            while queue and now - queue[0] >= 60:
                queue.popleft()
            if len(queue) >= maximum:
                raise HTTPException(
                    429,
                    "Please wait a minute before starting another operation.",
                    headers={"Retry-After": "60"},
                )
            queue.append(now)
            if len(self.events) > 2000:
                self.events = defaultdict(
                    deque,
                    {key: values for key, values in self.events.items() if values and now - values[-1] < 60},
                )


class AppResources:
    """Own the artifact directory, journal and two bounded workers for one process."""

    def __init__(self, artifacts: Path, runtime: Path):
        self.artifacts = artifacts
        self.store = ExperimentStore(runtime)
        self.limits = RequestLimits()
        self.submit_lock = threading.Lock()
        self.experiment_worker = ThreadPoolExecutor(max_workers=1, thread_name_prefix="terralens-study")
        self.upload_worker = ThreadPoolExecutor(max_workers=1, thread_name_prefix="terralens-upload")

    @classmethod
    @contextmanager
    def open(cls, artifacts: Path, runtime: Path):
        resources = cls(artifacts, runtime)
        try:
            yield resources
        finally:
            resources.experiment_worker.shutdown(wait=False, cancel_futures=True)
            resources.upload_worker.shutdown(wait=False, cancel_futures=True)

    @property
    def study_ready(self) -> bool:
        return (self.artifacts / "study.json").is_file()

    def analysis_run_ids(self) -> list[str]:
        study = self.require_artifact("study.json")
        selected = study["selected_run_id"]
        runs = [selected]
        if (
            selected != COMPARISON_RUN_ID
            and (self.artifacts / COMPARISON_MODEL_FILENAME).is_file()
            and any(run["id"] == COMPARISON_RUN_ID for run in study["runs"])
        ):
            runs.append(COMPARISON_RUN_ID)
        return runs

    def uses_comparison(self, run_id: str | None) -> bool:
        runs = self.analysis_run_ids()
        if run_id is None:
            return False
        if run_id not in runs:
            raise HTTPException(404, "This patch analysis run is not available.")
        return run_id != runs[0]

    def require_artifact(self, name: str) -> dict:
        # Only route-defined artifact names reach this method.
        path = self.artifacts / name
        try:
            return _read_json(path, path.stat().st_mtime_ns)
        except FileNotFoundError:
            raise HTTPException(
                503, "Reference study is not prepared. Follow the dataset/study setup in README.md."
            ) from None


@lru_cache(maxsize=8)
def _read_json(path: Path, modified_ns: int) -> dict:
    """Cache immutable artifacts by path and revision."""
    del modified_ns
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def get_resources(request: Request) -> AppResources:
    return request.app.state.resources


Resources = Annotated[AppResources, Depends(get_resources)]
