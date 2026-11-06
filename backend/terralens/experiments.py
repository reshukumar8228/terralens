"""Fit bounded experiments using the bundled anonymous study cohort."""
from __future__ import annotations

from pathlib import Path
import time

import numpy as np
from sklearn.cluster import KMeans
from sklearn.decomposition import PCA
from sklearn.impute import SimpleImputer
from sklearn.manifold import TSNE, trustworthiness
from sklearn.preprocessing import StandardScaler
from threadpoolctl import threadpool_limits

from .clustering import calculate_metrics, cluster_summaries
from .settings import MAX_LIVE_TSNE_SAMPLES

TSNE_ITERATIONS = 600
TRUSTWORTHINESS_NEIGHBORS = 10


def run_experiment(config: dict, artifacts_dir: Path) -> dict:
    started = time.perf_counter()
    k = int(config["k"])
    seed = int(config["seed"])
    variance = float(config["variance"])
    sample_size = int(config["sample_size"])
    perplexity = config.get("tsne_perplexity")
    if not 2 <= k <= 15 or variance not in (0.9, 0.95, 0.99) or not 0 <= seed <= 9999 or not 200 <= sample_size <= 3000:
        raise ValueError("Experiment parameters exceed the documented study bounds")
    if perplexity is not None:
        if perplexity not in (10, 30, 50):
            raise ValueError("Choose t-SNE perplexity 10, 30 or 50")
        if sample_size > MAX_LIVE_TSNE_SAMPLES:
            raise ValueError(f"Live t-SNE supports at most {MAX_LIVE_TSNE_SAMPLES} patches")

    with np.load(Path(artifacts_dir) / "compact_features.npz", allow_pickle=False) as bundle:
        raw_all, ids_all = bundle["X"], bundle["ids"]
    positions = np.random.default_rng(seed).choice(len(raw_all), size=min(sample_size, len(raw_all)), replace=False)
    raw, ids = raw_all[positions], ids_all[positions]
    if perplexity is not None and perplexity >= len(raw):
        raise ValueError("t-SNE perplexity must be lower than the number of available patches")

    tsne_coordinates = None
    tsne_result = None
    with threadpool_limits(limits=2):
        imputed = SimpleImputer(strategy="median").fit_transform(raw)
        standardized = StandardScaler().fit_transform(imputed)
        pca = PCA(svd_solver="full")
        coordinates = pca.fit_transform(standardized)
        retained_variance = np.cumsum(pca.explained_variance_ratio_)
        components = int(np.searchsorted(retained_variance, variance, side="right") + 1)
        space = coordinates[:, :components]
        kmeans = KMeans(n_clusters=k, n_init=10, random_state=seed)
        labels = kmeans.fit_predict(space)
        metrics = calculate_metrics(space, labels, standardized, seed)
        metrics["inertia"] = float(kmeans.inertia_)

        if perplexity is not None:
            tsne_started = time.perf_counter()
            tsne_coordinates = TSNE(
                n_components=2,
                perplexity=int(perplexity),
                init="random",
                learning_rate="auto",
                max_iter=TSNE_ITERATIONS,
                random_state=seed,
                n_jobs=2,
            ).fit_transform(space)
            tsne_duration = time.perf_counter() - tsne_started
            tsne_result = {
                "perplexity": int(perplexity),
                "trustworthiness": float(trustworthiness(
                    standardized, tsne_coordinates, n_neighbors=TRUSTWORTHINESS_NEIGHBORS
                )),
                "runtime_seconds": tsne_duration,
            }

    points = []
    for index, patch_id in enumerate(ids):
        point = {"id": str(patch_id), "pca": coordinates[index, :2].tolist(), "cluster": int(labels[index])}
        if tsne_coordinates is not None:
            point["tsne"] = tsne_coordinates[index].tolist()
        points.append(point)

    run_id = f"live-k{k}-v{int(variance * 100)}-s{seed}"
    notes = [
        "This independent run uses only anonymous study-cohort descriptors.",
        "PCA axes and cluster IDs belong to this run and can differ from the frozen reference study.",
        "Overall runtime covers feature bundle loading, numerical work and preparation of the result, excluding queue and transfer time.",
    ]
    if tsne_result is not None:
        run_id += f"-p{int(perplexity)}"
        notes.extend([
            "t-SNE uses the same PCA-reduced cohort as K-Means and displays its existing cluster assignments.",
            "t-SNE runtime covers the embedding fit. Trustworthiness uses ten neighbors in the full standardized feature space.",
        ])
    result = {
        "id": run_id,
        "k": k,
        "variance": variance,
        "components": components,
        "seed": seed,
        "metrics": metrics,
        "stability": None,
        "clusters": cluster_summaries(raw, standardized, space, labels, kmeans.cluster_centers_, ids),
        "points": points,
        "sample_size": len(raw),
        "retained_variance": float(retained_variance[components - 1]),
        "metric_space": "Run-fitted standardized descriptors and retained PCA components. Common-space silhouette uses all standardized descriptors.",
        "notes": notes,
    }
    if tsne_result is not None:
        result["tsne"] = tsne_result
    result["runtime_seconds"] = time.perf_counter() - started
    return result
