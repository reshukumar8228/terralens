"""Read-only study evidence, thumbnails, and exports."""

import csv
import io

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse, JSONResponse, Response

from terralens import __version__
from terralens.api.resources import SAFE_ID, Resources
from terralens.settings import MAX_LIVE_TSNE_SAMPLES, MAX_SAMPLES, MAX_UPLOAD

router = APIRouter(tags=["Reference study"])


@router.get("/health")
def health(resources: Resources):
    return {"status": "ok", "study_ready": resources.study_ready, "version": __version__}


@router.get("/capabilities")
def capabilities(resources: Resources):
    return {
        "max_experiment_samples": MAX_SAMPLES,
        "live_tsne": True,
        "max_live_tsne_samples": min(MAX_SAMPLES, MAX_LIVE_TSNE_SAMPLES),
        "upload_max_bytes": MAX_UPLOAD,
        "storage": "Reference results are permanent. Live experiment history is temporary on free hosting. Export important results.",
        "reference_run_id": resources.require_artifact("study.json").get("selected_run_id") if resources.study_ready else None,
    }


@router.get("/study")
def study(resources: Resources):
    return resources.require_artifact("study.json")


@router.get("/audit")
def reference_audit(resources: Resources):
    return resources.require_artifact("audit.json")


@router.get("/features")
def feature_dictionary(resources: Resources):
    if (resources.artifacts / "features.json").is_file():
        value = resources.require_artifact("features.json")
        return value if isinstance(value, dict) else {"features": value}
    study = resources.require_artifact("study.json")
    return {
        "features": [
            {"name": name, "family": name.split("_")[0], "description": name.replace("_", " ")}
            for name in study["feature_names"]
        ],
        "families": study.get("feature_families", []),
    }


@router.get("/patches/{patch_id}.jpg")
def patch(patch_id: str, resources: Resources):
    if not SAFE_ID.fullmatch(patch_id):
        raise HTTPException(404, "Patch not found.")
    path = resources.artifacts / "thumbnails" / f"{patch_id}.jpg"
    if not path.is_file():
        raise HTTPException(404, "This patch is not part of the bundled preview cohort.")
    return FileResponse(path, media_type="image/jpeg", headers={"Cache-Control": "public, max-age=86400"})


@router.get("/export/study.json")
def export_study(resources: Resources):
    resources.require_artifact("study.json")
    return FileResponse(resources.artifacts / "study.json", media_type="application/json", filename="terralens-study.json")


@router.get("/export/config.json")
def export_config(resources: Resources):
    data = resources.require_artifact("study.json")
    fields = ("project", "dataset", "split", "preprocessing", "provenance", "selected_run_id")
    config = {**resources.require_artifact("config.json"), **{key: data.get(key) for key in fields}}
    return JSONResponse(config, headers={"Content-Disposition": 'attachment; filename="terralens-config.json"'})


@router.get("/export/metrics.csv")
def export_metrics(resources: Resources):
    data = resources.require_artifact("study.json")
    fields = (
        "id", "selected", "k", "variance", "components", "seed", "silhouette", "silhouette_original",
        "davies_bouldin", "calinski_harabasz", "inertia", "stability", "runtime_seconds",
    )
    output = io.StringIO(newline="")
    writer = csv.DictWriter(output, fieldnames=fields)
    writer.writeheader()
    for run in data["runs"]:
        row = {key: run.get(key) for key in fields}
        row.update({key: value for key, value in run.get("metrics", {}).items() if key in fields})
        row["selected"] = run["id"] == data["selected_run_id"]
        writer.writerow(row)
    return Response(output.getvalue(), media_type="text/csv", headers={"Content-Disposition": 'attachment; filename="terralens-metrics.csv"'})
