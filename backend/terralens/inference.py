"""Apply the frozen model and retrieve anonymous examples from the bundled cohort."""
from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache
import json
from pathlib import Path

import joblib
import numpy as np
from PIL import Image

from .features import FEATURE_NAMES, extract_features
from .settings import COMPARISON_MODEL_FILENAME, COMPARISON_RUN_ID

NEIGHBOR_COUNT = 8


@dataclass(frozen=True)
class ArtifactVersion:
    path: Path
    inode: int
    size: int
    modified_ns: int

    @classmethod
    def read(cls, path: Path) -> ArtifactVersion:
        stat = path.stat()
        return cls(path.resolve(), stat.st_ino, stat.st_size, stat.st_mtime_ns)


@dataclass(frozen=True)
class NeighborGroup:
    ids: np.ndarray
    coordinates: np.ndarray
    description: str


@lru_cache(maxsize=2)
def _load_model(version: ArtifactVersion) -> dict:
    # Only the application-generated model is loaded. Uploads are decoded as images.
    return joblib.load(version.path)


def load_model(artifacts_dir: Path) -> dict:
    return _load_model(ArtifactVersion.read(Path(artifacts_dir) / "model.joblib"))


def _project(model: dict, raw: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    standardized = model["scaler"].transform(model["imputer"].transform(raw))
    coordinates = model["pca"].transform(standardized)[:, :model["components"]]
    return standardized, coordinates


def _describe_group(raw: np.ndarray, standardized: np.ndarray) -> str:
    brightness_column = FEATURE_NAMES.index("value_mean")
    contrast_column = FEATURE_NAMES.index("texture_contrast_d1")
    mean_brightness, mean_contrast = raw[:, [brightness_column, contrast_column]].mean(axis=0)
    brightness_z, contrast_z = standardized[:, [brightness_column, contrast_column]].mean(axis=0)
    brightness = "brighter" if brightness_z > 0.1 else "darker" if brightness_z < -0.1 else "typical brightness"
    contrast = "stronger" if contrast_z > 0.1 else "weaker" if contrast_z < -0.1 else "typical"
    return (
        f"{brightness.capitalize()} patches with {contrast} local contrast compared with the study average. "
        f"In this preview group, mean brightness (HSV value) is {mean_brightness:.2f} on a 0–1 scale "
        f"and mean one-pixel texture contrast (GLCM) is {mean_contrast:.2f}."
    )


@lru_cache(maxsize=2)
def _load_neighbor_groups(
    model_version: ArtifactVersion,
    compact_version: ArtifactVersion,
    study_version: ArtifactVersion,
    comparison: bool,
) -> tuple[dict[int, NeighborGroup], np.ndarray]:
    """Read and verify the cohort once per version of the three bundled artifacts."""
    model = _load_model(model_version)
    study = json.loads(study_version.path.read_text(encoding="utf-8"))
    with np.load(compact_version.path, allow_pickle=False) as bundle:
        if set(bundle.files) != {"X", "ids"}:
            raise ValueError("Expected an anonymous preview feature bundle")
        raw = bundle["X"]
        ids = bundle["ids"]
    points = study["points"]
    expected_id = COMPARISON_RUN_ID if comparison else study["selected_run_id"]
    run = next((run for run in study["runs"] if run["id"] == expected_id), None)
    if (
        run is None
        or model["reference_run_id"] != expected_id
        or model["components"] != run["components"]
        or model["kmeans"].cluster_centers_.shape != (run["k"], run["components"])
        or model["archive_sha256"] != study["dataset"]["archive_sha256"]
        or model["feature_names"] != FEATURE_NAMES
        or ids.tolist() != [point["id"] for point in points]
        or raw.shape != (len(points), len(FEATURE_NAMES))
    ):
        raise ValueError("The bundled preview cohort does not match the frozen study model")

    standardized, coordinates = _project(model, raw)
    clusters = model["kmeans"].predict(coordinates)
    if (
        not np.allclose(coordinates[:, :2], [point["pca"] for point in points], atol=1e-8, rtol=1e-8)
        or (not comparison and clusters.tolist() != [point["cluster"] for point in points])
    ):
        raise ValueError("Frozen model and preview coordinates disagree")

    groups = {}
    for cluster in np.unique(clusters):
        positions = clusters == cluster
        groups[int(cluster)] = NeighborGroup(
            ids[positions],
            coordinates[positions],
            _describe_group(raw[positions], standardized[positions]),
        )
    return groups, clusters


def analyze_image(image: Image.Image, artifacts_dir: Path, *, comparison: bool = False) -> dict:
    artifacts_dir = Path(artifacts_dir)
    model_filename = COMPARISON_MODEL_FILENAME if comparison else "model.joblib"
    model_version = ArtifactVersion.read(artifacts_dir / model_filename)
    model = _load_model(model_version)
    groups, cohort_clusters = _load_neighbor_groups(
        model_version,
        ArtifactVersion.read(artifacts_dir / "compact_features.npz"),
        ArtifactVersion.read(artifacts_dir / "study.json"),
        comparison,
    )

    raw = extract_features(image)[None, :]
    standardized, space = _project(model, raw)
    point = space[0]
    cluster_id = int(model["kmeans"].predict(space)[0])
    distances = np.linalg.norm(point - model["kmeans"].cluster_centers_, axis=1)
    distance = float(distances[cluster_id])
    runner_ups = np.argsort(distances, kind="stable")
    alternate = next((int(index) for index in runner_ups if index != cluster_id), None)
    alternate_distance = float(distances[alternate]) if alternate is not None else None

    reference = model["cluster_distances"][cluster_id]
    percentile = float(100 * np.searchsorted(reference, distance, side="right") / max(len(reference), 1))
    median = float(np.median(reference)) if len(reference) else 0
    group = groups.get(cluster_id)
    neighbors = []
    if group is not None:
        neighbor_distances = np.linalg.norm(group.coordinates - point, axis=1)
        neighbor_indices = np.argsort(neighbor_distances, kind="stable")[:NEIGHBOR_COUNT]
        neighbors = [
            {"id": str(group.ids[index]), "distance": float(neighbor_distances[index])}
            for index in neighbor_indices
        ]

    warnings = ["Cluster membership describes visual similarity in the frozen study. Land cover requires separate evidence."]
    if image.size != (64, 64):
        width, height = image.size
        warnings.append(f"Image resized from {width}×{height} to the study's 64×64 patch format. Its scale may differ from EuroSAT.")
    if percentile >= 95:
        warnings.append("This patch is unusually far from its assigned centroid compared with the reference group (at or above the 95th percentile).")

    result = {
        "run_id": model["reference_run_id"],
        "cluster": cluster_id,
        "cluster_description": group.description if group is not None else "The bundled preview cohort has no patches from this group.",
        "pca": point[:2].tolist(),
        "distance": distance,
        "alternate_cluster": alternate,
        "alternate_distance": alternate_distance,
        "margin": alternate_distance - distance if alternate_distance is not None else None,
        "relative_distance": distance / median if median > 0 else None,
        "reference_percentile": percentile,
        "representatives": model["representatives"][cluster_id],
        "neighbors": neighbors,
        "neighbor_scope": len(group.ids) if group is not None else 0,
        "features": [
            {"name": name, "value": float(raw[0, index]), "zscore": float(standardized[0, index])}
            for index, name in enumerate(FEATURE_NAMES)
        ],
        "warnings": warnings,
    }
    if comparison:
        result["cohort_clusters"] = cohort_clusters.tolist()
    return result
