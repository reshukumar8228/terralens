"""Saved-model analysis and bounded label-free experiments used by the web API."""
from __future__ import annotations

from functools import lru_cache
from pathlib import Path
import time

import joblib
import numpy as np
from PIL import Image
from scipy.spatial.distance import cdist
from sklearn.cluster import KMeans
from sklearn.decomposition import PCA
from sklearn.impute import SimpleImputer
from sklearn.metrics import calinski_harabasz_score, davies_bouldin_score, silhouette_score
from sklearn.preprocessing import StandardScaler
from threadpoolctl import threadpool_limits

from .features import FEATURE_NAMES, extract_features


@lru_cache(maxsize=4)
def _load_model(path: str, modification_time: int) -> dict:
    # This application only loads its own generated artifact, never uploaded pickle files.
    return joblib.load(path)


def load_model(artifacts_dir: Path) -> dict:
    path = Path(artifacts_dir) / "model.joblib"
    return _load_model(str(path.resolve()), path.stat().st_mtime_ns)


def calculate_metrics(space: np.ndarray, labels: np.ndarray, original: np.ndarray, seed: int = 42, limit: int = 1000) -> dict:
    """Internal metrics; silhouette sampling is bounded and seeded in each stated space."""
    if len(np.unique(labels)) < 2 or len(np.unique(labels)) >= len(labels):
        return {key: None for key in ("silhouette", "davies_bouldin", "calinski_harabasz", "silhouette_original", "inertia")}
    sample_size = min(len(labels), limit)
    return {
        "silhouette": float(silhouette_score(space, labels, sample_size=sample_size, random_state=seed)),
        "davies_bouldin": float(davies_bouldin_score(space, labels)),
        "calinski_harabasz": float(calinski_harabasz_score(space, labels)),
        "silhouette_original": float(silhouette_score(original, labels, sample_size=sample_size, random_state=seed)),
        "inertia": None,
    }


def cluster_summaries(raw: np.ndarray, standardized: np.ndarray, space: np.ndarray, labels: np.ndarray, centers: np.ndarray, ids: np.ndarray) -> list[dict]:
    summaries = []
    all_distances = cdist(space, centers)
    for cluster_id in range(len(centers)):
        positions = np.flatnonzero(labels == cluster_id)
        if not len(positions):
            summaries.append({"id": cluster_id, "count": 0, "description": "Empty group", "representatives": [], "boundary_samples": [], "feature_profile": []})
            continue
        distances = all_distances[positions, cluster_id]
        order = np.argsort(distances, kind="stable")
        alternate_distances = all_distances[positions].copy()
        alternate_distances[:, cluster_id] = np.inf
        margins = alternate_distances.min(axis=1) - distances
        boundary_order = np.argsort(margins, kind="stable")
        profile = standardized[positions].mean(axis=0)
        dominant = np.argsort(np.abs(profile))[::-1][:8]
        description = "; ".join(("Higher " if profile[index] >= 0 else "Lower ") + FEATURE_NAMES[index].replace("_", " ") for index in dominant[:2])
        summaries.append({
            "id": cluster_id,
            "count": int(len(positions)),
            "description": description,
            "representatives": [str(value) for value in ids[positions[order[:9]]]],
            "boundary_samples": [str(value) for value in ids[positions[boundary_order[:4]]]],
            "feature_profile": [{"name": FEATURE_NAMES[index], "value": float(raw[positions, index].mean()), "zscore": float(profile[index])} for index in dominant],
        })
    return summaries


def analyze_image(image: Image.Image, artifacts_dir: Path) -> dict:
    model = load_model(artifacts_dir)
    original_size = image.size
    raw = extract_features(image)[None, :]
    standardized = model["scaler"].transform(model["imputer"].transform(raw))
    transformed = model["pca"].transform(standardized)
    space = transformed[:, :model["components"]]
    cluster_id = int(model["kmeans"].predict(space)[0])
    distance = float(np.linalg.norm(space[0] - model["kmeans"].cluster_centers_[cluster_id]))
    reference = model["cluster_distances"][cluster_id]
    percentile = float(100 * np.searchsorted(reference, distance, side="right") / max(len(reference), 1))
    median = float(np.median(reference)) if len(reference) else 0
    warnings = ["Cluster membership expresses visual similarity; it is not a verified land-cover label or a probability."]
    if original_size != (64, 64):
        warnings.append(f"Image resized from {original_size[0]}×{original_size[1]} to the study's 64×64 patch format; scale may differ from EuroSAT.")
    if percentile >= 95:
        warnings.append("This patch is unusually far from its assigned centroid compared with the reference group (at or above the 95th percentile).")
    return {
        "cluster": cluster_id,
        "pca": transformed[0, :2].tolist(),
        "distance": distance,
        "relative_distance": distance / median if median > 0 else None,
        "reference_percentile": percentile,
        "representatives": model["representatives"][cluster_id],
        "features": [{"name": name, "value": float(raw[0, index]), "zscore": float(standardized[0, index])} for index, name in enumerate(FEATURE_NAMES)],
        "warnings": warnings,
    }


def run_experiment(config: dict, artifacts_dir: Path) -> dict:
    started = time.perf_counter()
    k, seed, variance = int(config["k"]), int(config["seed"]), float(config["variance"])
    sample_size = int(config["sample_size"])
    if not 2 <= k <= 15 or variance not in (0.9, 0.95, 0.99) or not 0 <= seed <= 9999 or not 200 <= sample_size <= 3000:
        raise ValueError("Experiment parameters exceed the documented study bounds")
    with np.load(Path(artifacts_dir) / "compact_features.npz", allow_pickle=False) as bundle:
        raw_all, ids_all = bundle["X"], bundle["ids"]
    positions = np.random.default_rng(seed).choice(len(raw_all), size=min(sample_size, len(raw_all)), replace=False)
    raw, ids = raw_all[positions], ids_all[positions]
    with threadpool_limits(limits=2):
        imputer = SimpleImputer(strategy="median")
        scaler = StandardScaler()
        standardized = scaler.fit_transform(imputer.fit_transform(raw))
        pca = PCA(n_components=variance, svd_solver="full")
        space = pca.fit_transform(standardized)
        kmeans = KMeans(n_clusters=k, n_init=10, random_state=seed)
        labels = kmeans.fit_predict(space)
        metrics = calculate_metrics(space, labels, standardized, seed)
        metrics["inertia"] = float(kmeans.inertia_)
    return {
        "id": f"live-k{k}-v{int(variance * 100)}-s{seed}", "k": k, "variance": variance,
        "components": int(pca.n_components_), "seed": seed, "metrics": metrics,
        "runtime_seconds": time.perf_counter() - started, "stability": None,
        "clusters": cluster_summaries(raw, standardized, space, labels, kmeans.cluster_centers_, ids),
        "points": [{"id": str(patch_id), "pca": coordinate[:2].tolist(), "cluster": int(label)} for patch_id, coordinate, label in zip(ids, space, labels, strict=True)],
        "sample_size": int(len(raw)), "retained_variance": float(pca.explained_variance_ratio_.sum()),
        "metric_space": "Run-fitted standardized descriptors and retained PCA components; silhouette_original uses all standardized descriptors.",
        "notes": ["Independent bounded experiment fitted only to anonymous study-cohort descriptors; reference labels are not loaded.", "Its PCA axes and cluster IDs are specific to this run and need not align with the frozen reference run."],
    }
