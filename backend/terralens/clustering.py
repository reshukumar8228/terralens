"""Clustering metrics and summaries shared by the frozen study and live experiments."""
from __future__ import annotations

import numpy as np
from scipy.spatial.distance import cdist
from sklearn.metrics import calinski_harabasz_score, davies_bouldin_score, silhouette_score

from .features import FEATURE_NAMES


def calculate_metrics(space: np.ndarray, labels: np.ndarray, original: np.ndarray, seed: int = 42, limit: int = 1000) -> dict:
    """Internal metrics with a bounded, seeded silhouette sample in both spaces."""
    if not 2 <= len(np.unique(labels)) < len(labels):
        return dict.fromkeys(("silhouette", "davies_bouldin", "calinski_harabasz", "silhouette_original", "inertia"))
    sample_size = min(len(labels), limit)
    return {
        "silhouette": float(silhouette_score(space, labels, sample_size=sample_size, random_state=seed)),
        "davies_bouldin": float(davies_bouldin_score(space, labels)),
        "calinski_harabasz": float(calinski_harabasz_score(space, labels)),
        "silhouette_original": float(silhouette_score(original, labels, sample_size=sample_size, random_state=seed)),
        "inertia": None,
    }


def cluster_summaries(
    raw: np.ndarray,
    standardized: np.ndarray,
    space: np.ndarray,
    labels: np.ndarray,
    centers: np.ndarray,
    ids: np.ndarray,
) -> list[dict]:
    summaries = []
    all_distances = cdist(space, centers)
    for cluster_id in range(len(centers)):
        positions = np.flatnonzero(labels == cluster_id)
        if not len(positions):
            summaries.append({
                "id": cluster_id,
                "count": 0,
                "description": "Empty group",
                "representatives": [],
                "boundary_samples": [],
                "feature_profile": [],
            })
            continue

        distances = all_distances[positions, cluster_id]
        order = np.argsort(distances, kind="stable")
        alternate_distances = all_distances[positions].copy()
        alternate_distances[:, cluster_id] = np.inf
        margins = alternate_distances.min(axis=1) - distances
        boundary_order = np.argsort(margins, kind="stable")
        profile = standardized[positions].mean(axis=0)
        dominant = np.argsort(np.abs(profile))[::-1][:8]
        description = "; ".join(
            ("Higher " if profile[index] >= 0 else "Lower ") + FEATURE_NAMES[index].replace("_", " ")
            for index in dominant[:2]
        )
        summaries.append({
            "id": cluster_id,
            "count": int(len(positions)),
            "description": description,
            "representatives": ids[positions[order[:9]]].tolist(),
            "boundary_samples": ids[positions[boundary_order[:4]]].tolist(),
            "feature_profile": [
                {
                    "name": FEATURE_NAMES[index],
                    "value": float(raw[positions, index].mean()),
                    "zscore": float(profile[index]),
                }
                for index in dominant
            ],
        })
    return summaries
