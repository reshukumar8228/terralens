"""Validate requests, queue live experiments, and return their journal entries."""

import logging
import uuid
from typing import Literal

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field

from terralens.api.resources import SAFE_ID, AppResources, Resources
from terralens.settings import MAX_LIVE_TSNE_SAMPLES, MAX_SAMPLES

router = APIRouter(tags=["Live experiments"])
log = logging.getLogger(__name__)


class ExperimentConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")

    k: int = Field(default=6, ge=2, le=15)
    variance: Literal[0.90, 0.95, 0.99] = 0.95
    seed: int = Field(default=42, ge=0, le=9999)
    sample_size: int = Field(default=1000, ge=200, le=3000)
    tsne_perplexity: Literal[10, 30, 50] | None = None


def execute_experiment(resources: AppResources, experiment_id: str, config: dict) -> None:
    stage = "Fitting PCA and K-Means"
    if config.get("tsne_perplexity") is not None:
        stage = "Fitting PCA, K-Means and t-SNE"
    resources.store.update(experiment_id, "running", stage)
    try:
        # Import numerical dependencies only when a worker needs them.
        from terralens.experiments import run_experiment

        result = run_experiment(config, resources.artifacts)
        resources.store.update(experiment_id, "completed", "Results ready", result=result)
    except Exception:
        log.exception("Numerical experiment failed: %s", experiment_id)
        resources.store.update(
            experiment_id,
            "failed",
            "Experiment failed",
            error="The numerical worker could not complete this experiment. Try a smaller sample or check server logs.",
        )


@router.post("/experiments", status_code=202)
def create_experiment(config: ExperimentConfig, request: Request, resources: Resources):
    maximum = MAX_SAMPLES
    if config.tsne_perplexity is not None:
        maximum = min(maximum, MAX_LIVE_TSNE_SAMPLES)
    if config.sample_size > maximum:
        mode = " with t-SNE" if config.tsne_perplexity is not None else ""
        raise HTTPException(422, f"This server allows at most {maximum} patches per live experiment{mode}.")
    resources.require_artifact("study.json")
    resources.limits.check(request, "experiment", 6)
    with resources.submit_lock:
        if resources.store.active_count() >= 3:
            raise HTTPException(
                429, "The experiment queue is full. Wait for the current run to finish.", headers={"Retry-After": "10"}
            )
        experiment_id = "live-" + uuid.uuid4().hex[:16]
        payload = config.model_dump(exclude_none=True)
        resources.store.create(experiment_id, payload)
        resources.experiment_worker.submit(execute_experiment, resources, experiment_id, payload)
    return {"id": experiment_id, "status": "queued"}


@router.get("/experiments")
def list_experiments(resources: Resources):
    return {"experiments": resources.store.list()}


@router.get("/experiments/{experiment_id}")
def get_experiment(experiment_id: str, resources: Resources):
    if not SAFE_ID.fullmatch(experiment_id):
        raise HTTPException(404, "Experiment not found.")
    value = resources.store.get(experiment_id)
    if value is None:
        raise HTTPException(404, "Experiment not found. Temporary history may have reset on the hosting service.")
    return value


@router.get("/export/experiments/{experiment_id}.json")
def export_experiment(experiment_id: str, resources: Resources):
    value = get_experiment(experiment_id, resources)
    return JSONResponse(value, headers={"Content-Disposition": f'attachment; filename="terralens-{experiment_id}.json"'})
