"""Reproduce the complete, label-blind EuroSAT dimensionality-reduction study.

No reference label is read by model fitting or selection. The evaluation-only
annotation file is opened by ``write_audit`` after the frozen study is written.
"""
from __future__ import annotations

import argparse
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import hashlib
import importlib.metadata
import itertools
import json
import math
from pathlib import Path
import time
import urllib.request
import zipfile

import joblib
import numpy as np
from PIL import Image
from sklearn.cluster import KMeans
from sklearn.decomposition import PCA
from sklearn.impute import SimpleImputer
from sklearn.manifold import TSNE, trustworthiness
from sklearn.metrics import adjusted_rand_score, completeness_score, homogeneity_score, normalized_mutual_info_score
from sklearn.preprocessing import StandardScaler
from threadpoolctl import threadpool_limits

from .clustering import calculate_metrics, cluster_summaries
from .features import FEATURES, FEATURE_FAMILIES, FEATURE_NAMES, extract_features
from .settings import COMPARISON_AUDIT_FILENAME, COMPARISON_MODEL_FILENAME, COMPARISON_RUN_ID

SOURCE_URL = "https://zenodo.org/records/7711810"
ARCHIVE_URL = "https://zenodo.org/api/records/7711810/files/EuroSAT_RGB.zip/content"
EXPECTED_MD5 = "f46e308c4d50d4bf32fedad2d3d62f3b"
SEED = 42
VARIANCES = (0.9, 0.95, 0.99)
COMPARISON_K = 10
COMPARISON_VARIANCE = 0.95
SELECTION_RULE = "Stage 1: for each representation, choose K=2..15 maximizing silhouette in the common full standardized descriptor space on the fixed screening cohort. Stage 2: among promoted PCA90/95/99 runs, maximize the same-space silhouette on a fixed 1,500-patch study sample. Within 0.005 of the best score, prefer higher mean pairwise seed ARI, then fewer components. Unreduced and fixed K=10 comparisons do not select the reference. No reference labels are loaded until study/model artifacts and this decision are frozen."


def log(message: str) -> None:
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {message}", flush=True)


def write_json(path: Path, value: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(value, ensure_ascii=False, allow_nan=False, separators=(",", ":")), encoding="utf-8")
    temporary.replace(path)


def verify_archive(path: Path) -> str:
    md5, sha256 = hashlib.md5(), hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            md5.update(block)
            sha256.update(block)
    if md5.hexdigest() != EXPECTED_MD5:
        raise ValueError(f"Creator archive MD5 mismatch: {md5.hexdigest()}; expected {EXPECTED_MD5}. Remove the incomplete archive and retry.")
    return sha256.hexdigest()


def obtain_archive(data_dir: Path) -> tuple[Path, str]:
    data_dir.mkdir(parents=True, exist_ok=True)
    archive = data_dir / "EuroSAT_RGB.zip"
    if not archive.exists():
        partial = archive.with_suffix(".zip.part")
        log("Downloading creator's EuroSAT RGB archive from Zenodo")
        urllib.request.urlretrieve(ARCHIVE_URL, partial)
        partial.replace(archive)
    checksum = verify_archive(archive)
    log(f"Verified creator archive MD5; SHA256 {checksum}")
    return archive, checksum


def prepare_features(archive: Path, data_dir: Path, checksum: str) -> dict:
    extraction_started = time.perf_counter()
    feature_signature = hashlib.sha256(Path(__file__).with_name("features.py").read_bytes()).hexdigest()
    cache = data_dir / "features_v2.npz"
    cache_meta = data_dir / "quality_v2.json"
    if cache.exists() and cache_meta.exists():
        meta = json.loads(cache_meta.read_text())
        if meta["archive_sha256"] == checksum and meta["feature_names"] == FEATURE_NAMES and meta.get("feature_signature") == feature_signature:
            with np.load(cache, allow_pickle=False) as saved:
                result = {key: saved[key] for key in saved.files}
            result["quality"] = meta["quality"]
            result["total_images"] = meta["total_images"]
            result["valid_images"] = meta["valid_images"]
            result["feature_cache_reused"] = True
            result["feature_extraction_seconds"] = meta["feature_extraction_seconds"]
            result["feature_signature"] = feature_signature
            log(f"Loaded cached descriptors for {len(result['ids']):,} anonymous patches")
            return result
    extracted = data_dir / "rgb"
    if not extracted.exists():
        extracted.mkdir()
        with zipfile.ZipFile(archive) as bundle:
            for member in bundle.infolist():
                target = (extracted / member.filename).resolve()
                if not target.is_relative_to(extracted.resolve()):
                    raise ValueError("Unsafe dataset archive member")
            bundle.extractall(extracted)
    paths = sorted(extracted.rglob("*.jpg"))
    if len(paths) != 27000:
        raise ValueError(f"Expected 27,000 creator RGB images; found {len(paths)}")
    # Paths are used exclusively by this ingestion adapter, never as descriptor input.
    def process(path: Path) -> tuple[str, np.ndarray, str, str] | None:
        try:
            with Image.open(path) as image:
                image.load()
                if image.size != (64, 64):
                    raise ValueError("Unexpected EuroSAT image dimensions")
                rgb = image.convert("RGB")
                patch_id = "p" + hashlib.sha256(rgb.tobytes()).hexdigest()[:20]
                descriptor = extract_features(rgb)
            return patch_id, descriptor, str(path.relative_to(data_dir)), path.parent.name
        except (OSError, ValueError):
            return None
    rows, annotations, seen = [], {}, set()
    unreadable, duplicates = 0, 0
    log("Decoding, hashing and extracting 78 descriptors from all 27,000 real RGB patches")
    with threadpool_limits(limits=1), ThreadPoolExecutor(max_workers=3) as pool:
        for index, row in enumerate(pool.map(process, paths), start=1):
            if row is None:
                unreadable += 1
            else:
                patch_id, descriptor, path, label = row
                if patch_id in seen:
                    duplicates += 1
                else:
                    seen.add(patch_id)
                    rows.append((patch_id, descriptor, path))
                    annotations[patch_id] = label
            if index % 3000 == 0:
                log(f"Feature extraction {index:,}/27,000; unreadable {unreadable}; duplicate decoded images {duplicates}")
    rows.sort(key=lambda row: row[0])
    ids = np.array([row[0] for row in rows])
    matrix = np.stack([row[1] for row in rows])
    quality = {"unreadable_images": unreadable, "duplicate_images": duplicates, "missing_values": int(np.isnan(matrix).sum()), "constant_features": [FEATURE_NAMES[index] for index in np.flatnonzero(np.nanstd(matrix, axis=0) == 0)], "notes": ["Duplicate identity is based on SHA256 of decoded RGB pixels; duplicate copies are removed before the split.", "Invalid images are rejected, not replaced by synthetic examples."]}
    np.savez_compressed(cache, ids=ids, X=matrix)
    write_json(data_dir / "source_manifest_preview_only.json", {row[0]: row[2] for row in rows})
    write_json(data_dir / "reference_labels_evaluation_only.json", annotations)
    extraction_duration = time.perf_counter() - extraction_started
    write_json(cache_meta, {"archive_sha256": checksum, "feature_names": FEATURE_NAMES, "feature_signature": feature_signature, "feature_extraction_seconds": extraction_duration, "quality": quality, "total_images": len(paths), "valid_images": len(paths) - unreadable})
    return {"ids": ids, "X": matrix, "quality": quality, "total_images": len(paths), "valid_images": len(paths) - unreadable, "feature_cache_reused": False, "feature_extraction_seconds": extraction_duration, "feature_signature": feature_signature}


def write_model(path: Path, run: dict, fit: dict, transforms: dict, checksum: str) -> None:
    estimator, labels = fit["estimator"], fit["labels"]
    distances = np.linalg.norm(fit["space"] - estimator.cluster_centers_[labels], axis=1)
    model = {
        **transforms,
        "components": run["components"],
        "kmeans": estimator,
        "feature_names": FEATURE_NAMES,
        "reference_run_id": run["id"],
        "representatives": {cluster["id"]: cluster["representatives"] for cluster in run["clusters"]},
        "cluster_distances": {
            cluster: np.sort(distances[labels == cluster]) for cluster in range(run["k"])
        },
        "archive_sha256": checksum,
    }
    temporary = path.with_suffix(".joblib.tmp")
    joblib.dump(model, temporary, compress=3)
    temporary.replace(path)


def write_audit(data_dir: Path, artifacts_dir: Path, ids: np.ndarray, labels: np.ndarray, holdout_ids: np.ndarray, holdout_labels: np.ndarray, run_id: str, *, filename: str = "audit.json") -> None:
    """The only function that opens reference annotations after selection freezes."""
    annotations = json.loads((data_dir / "reference_labels_evaluation_only.json").read_text())
    truth = np.array([annotations[str(patch_id)] for patch_id in ids])
    holdout_truth = np.array([annotations[str(patch_id)] for patch_id in holdout_ids])
    classes = sorted(set(truth) | set(holdout_truth))
    def external(reference: np.ndarray, predicted: np.ndarray) -> dict:
        return {"adjusted_rand_index": float(adjusted_rand_score(reference, predicted)), "normalized_mutual_information": float(normalized_mutual_info_score(reference, predicted)), "homogeneity": float(homogeneity_score(reference, predicted)), "completeness": float(completeness_score(reference, predicted))}
    audit = {"reference_run_id": run_id, "disclosure": "Post-hoc evaluation only: these dataset reference labels were not inputs to feature extraction, scaling, PCA, K-Means, sampling, K selection, variance selection or cluster descriptions.", "metrics": external(truth, labels), "holdout_metrics": external(holdout_truth, holdout_labels), "reference_classes": classes, "contingency": [{"cluster": int(cluster), "counts": {name: int(np.sum(truth[labels == cluster] == name)) for name in classes}, "total": int(np.sum(labels == cluster))} for cluster in sorted(np.unique(labels))], "notes": ["Cluster numbers are arbitrary and are not ten-class predictions.", "ARI and NMI are agreement measures, not classification accuracy.", "The audit was generated only after the reference study and model were saved.", "No class-balanced sampling or class-informed tuning was performed."], "frozen_study_sha256": hashlib.sha256((artifacts_dir / "study.json").read_bytes()).hexdigest(), "created_at": datetime.now(timezone.utc).isoformat()}
    write_json(artifacts_dir / filename, audit)


def build_comparison(args: argparse.Namespace) -> None:
    """Regenerate the K=10 pair from an existing frozen study."""
    data_dir, artifacts_dir = Path(args.data_dir), Path(args.artifacts_dir)
    study = json.loads((artifacts_dir / "study.json").read_text())
    split = json.loads((artifacts_dir / "split_manifest.json").read_text())
    reference = joblib.load(artifacts_dir / "model.joblib")
    archive, checksum = obtain_archive(data_dir)
    if checksum != study["dataset"]["archive_sha256"] or checksum != reference["archive_sha256"]:
        raise ValueError("The data archive does not match the frozen study and model")
    if reference["reference_run_id"] != study["selected_run_id"] or reference["feature_names"] != FEATURE_NAMES:
        raise ValueError("The fitted model does not match the frozen study")

    prepared = prepare_features(archive, data_dir, checksum)
    ids = np.array(split["study_ids"])
    holdout_ids = np.array(split["holdout_ids"])
    split_ids = (("study_id_sha256", ids), ("holdout_id_sha256", holdout_ids))
    for key, values in split_ids:
        if hashlib.sha256("\n".join(values).encode()).hexdigest() != study["split"][key]:
            raise ValueError("The split manifest does not match the frozen study")

    positions = {patch_id: index for index, patch_id in enumerate(prepared["ids"])}
    raw = prepared["X"][[positions[patch_id] for patch_id in ids]]
    holdout_raw = prepared["X"][[positions[patch_id] for patch_id in holdout_ids]]
    transforms = {key: reference[key] for key in ("imputer", "scaler", "pca")}
    imputer, scaler, pca = (transforms[key] for key in ("imputer", "scaler", "pca"))
    standardized = scaler.transform(imputer.transform(raw))
    holdout_standardized = scaler.transform(imputer.transform(holdout_raw))
    run = next(candidate for candidate in study["runs"] if candidate["id"] == COMPARISON_RUN_ID)
    space = pca.transform(standardized)[:, :run["components"]]
    holdout_space = pca.transform(holdout_standardized)[:, :run["components"]]
    estimator = KMeans(n_clusters=run["k"], n_init=10, random_state=run["seed"]).fit(space)
    labels = estimator.labels_
    groups = cluster_summaries(raw, standardized, space, labels, estimator.cluster_centers_, ids)
    recorded_groups = [(group["id"], group["count"], group["representatives"]) for group in run["clusters"]]
    observed_groups = [(group["id"], group["count"], group["representatives"]) for group in groups]
    if not math.isclose(estimator.inertia_, run["metrics"]["inertia"], rel_tol=1e-9) or observed_groups != recorded_groups:
        raise ValueError("Refitted K=10 inertia or representatives do not match the frozen study")
    fit = {"space": space, "estimator": estimator, "labels": labels}
    write_model(artifacts_dir / COMPARISON_MODEL_FILENAME, run, fit, transforms, checksum)
    write_audit(
        data_dir, artifacts_dir, ids, labels, holdout_ids, estimator.predict(holdout_space),
        run["id"], filename=COMPARISON_AUDIT_FILENAME,
    )
    log(f"Regenerated {run['id']} model and post-selection audit")


def build_study(args: argparse.Namespace) -> dict:
    started = time.perf_counter()
    data_dir, artifacts_dir = Path(args.data_dir), Path(args.artifacts_dir)
    artifacts_dir.mkdir(parents=True, exist_ok=True)
    archive, checksum = obtain_archive(data_dir)
    prepared = prepare_features(archive, data_dir, checksum)
    ids_all, raw_all = prepared["ids"], prepared["X"]
    permutation = np.random.default_rng(SEED).permutation(len(ids_all))
    split_at = int(len(permutation) * 0.8)
    study_positions, holdout_positions = permutation[:split_at], permutation[split_at:]
    ids, raw = ids_all[study_positions], raw_all[study_positions]
    holdout_ids, holdout_raw = ids_all[holdout_positions], raw_all[holdout_positions]
    write_json(artifacts_dir / "split_manifest.json", {"seed": SEED, "study_ids": ids.tolist(), "holdout_ids": holdout_ids.tolist(), "policy": "Seeded random split after decoded-pixel deduplication; anonymous IDs only, no category information."})
    log(f"Frozen label-blind split: study {len(raw):,}; held-out {len(holdout_raw):,}")
    imputer = SimpleImputer(strategy="median")
    scaler = StandardScaler()
    standardized = scaler.fit_transform(imputer.fit_transform(raw))
    holdout_standardized = scaler.transform(imputer.transform(holdout_raw))
    pca = PCA(svd_solver="full")
    full_pca = pca.fit_transform(standardized)
    holdout_pca = pca.transform(holdout_standardized)
    cumulative = np.cumsum(pca.explained_variance_ratio_)
    dimensions = {variance: int(np.searchsorted(cumulative, variance) + 1) for variance in VARIANCES}
    dimensions[None] = standardized.shape[1]
    cohort = np.random.default_rng(SEED + 1).choice(len(raw), size=min(args.screen_samples, len(raw)), replace=False)
    metric_cohort = np.random.default_rng(SEED + 2).choice(len(raw), size=min(1500, len(raw)), replace=False)
    screen_rows, promoted = [], []
    log(f"PCA dimensions: {dimensions}; screening K=2..15 across four representations")
    for variance in (None, *VARIANCES):
        space = standardized if variance is None else full_pca[:, :dimensions[variance]]
        candidates = []
        for k in range(2, 16):
            tick = time.perf_counter()
            estimator = KMeans(n_clusters=k, n_init=5, random_state=SEED)
            predicted = estimator.fit_predict(space[cohort])
            metrics = calculate_metrics(space[cohort], predicted, standardized[cohort], SEED, limit=1000)
            metrics["inertia"] = float(estimator.inertia_)
            row = {"k": k, "variance": variance, "components": dimensions[variance], "seed": SEED, "metrics": metrics, "runtime_seconds": time.perf_counter() - tick, "sample_size": len(cohort)}
            screen_rows.append(row)
            candidates.append(row)
        winner = max(candidates, key=lambda row: (row["metrics"]["silhouette_original"], -row["k"]))
        promoted.append((variance, winner["k"]))
        log(f"Screen representation {variance}: promoted K={winner['k']}, common-space silhouette {winner['metrics']['silhouette_original']:.4f}")
    write_json(data_dir / "screening_results.json", {"runs": screen_rows})
    # A fixed-K contrast illustrates granularity without allowing reference labels to select the model.
    if (COMPARISON_VARIANCE, COMPARISON_K) not in promoted:
        promoted.append((COMPARISON_VARIANCE, COMPARISON_K))
    runs, fitted = [], {}
    for variance, k in promoted:
        tick = time.perf_counter()
        dimensions_kept = dimensions[variance]
        space = standardized if variance is None else full_pca[:, :dimensions_kept]
        holdout_space = holdout_standardized if variance is None else holdout_pca[:, :dimensions_kept]
        models, assignments = [], []
        for seed in (SEED, 17, 91):
            estimator = KMeans(n_clusters=k, n_init=10, random_state=seed)
            labels = estimator.fit_predict(space)
            models.append(estimator)
            assignments.append(labels)
        pairwise = [float(adjusted_rand_score(assignments[a], assignments[b])) for a, b in itertools.combinations(range(3), 2)]
        estimator, labels = models[0], assignments[0]
        metrics = calculate_metrics(space[metric_cohort], labels[metric_cohort], standardized[metric_cohort], SEED, limit=len(metric_cohort))
        metrics["inertia"] = float(estimator.inertia_)
        holdout_labels = estimator.predict(holdout_space)
        holdout_metrics = calculate_metrics(holdout_space, holdout_labels, holdout_standardized, SEED, limit=1000)
        holdout_metrics["inertia"] = float(np.square(holdout_space - estimator.cluster_centers_[holdout_labels]).sum())
        run_id = f"{'original' if variance is None else 'pca' + str(round(variance * 100))}-k{k}-s{SEED}"
        run = {"id": run_id, "k": k, "variance": variance, "components": dimensions_kept, "seed": SEED, "metrics": metrics, "holdout_metrics": holdout_metrics, "runtime_seconds": time.perf_counter() - tick, "stability": float(np.mean(pairwise)), "seed_stability": {"seeds": [SEED, 17, 91], "pairwise_ari": pairwise}, "clusters": cluster_summaries(raw, standardized, space, labels, estimator.cluster_centers_, ids), "selection_eligible": variance is not None and (variance, k) in promoted[:4]}
        runs.append(run)
        fitted[run_id] = {"estimator": estimator, "labels": labels, "holdout_labels": holdout_labels, "space": space}
        log(f"Full study {run_id}: common silhouette {metrics['silhouette_original']:.4f}; seed ARI {run['stability']:.4f}")
    eligible = [run for run in runs if run["selection_eligible"]]
    best_score = max(run["metrics"]["silhouette_original"] for run in eligible)
    finalists = [run for run in eligible if run["metrics"]["silhouette_original"] >= best_score - 0.005]
    selected = max(finalists, key=lambda run: (run["stability"], -run["components"]))
    selected["selection_reason"] = SELECTION_RULE
    selected_state = fitted[selected["id"]]
    comparison = next(run for run in runs if run["id"] == COMPARISON_RUN_ID)
    comparison_state = fitted[COMPARISON_RUN_ID]
    log(f"REFERENCE FROZEN before audit: {selected['id']}")
    # Freeze fitted state before the evaluation adapter can open reference labels.
    transforms = {"imputer": imputer, "scaler": scaler, "pca": pca}
    write_model(artifacts_dir / "model.joblib", selected, selected_state, transforms, checksum)
    write_model(artifacts_dir / COMPARISON_MODEL_FILENAME, comparison, comparison_state, transforms, checksum)
    visual_positions = np.random.default_rng(SEED + 3).choice(len(raw), size=min(args.visual_samples, 3000, len(raw)), replace=False)
    visual_ids = ids[visual_positions]
    np.savez_compressed(artifacts_dir / "compact_features.npz", X=raw[visual_positions], ids=visual_ids)
    visual_standardized = standardized[visual_positions]
    pre_dimensions = min(50, standardized.shape[1])
    tsne_input = full_pca[visual_positions, :pre_dimensions]
    trust_positions = np.random.default_rng(SEED + 4).choice(len(visual_ids), size=min(1000, len(visual_ids)), replace=False)
    tsne_runs = []
    tsne_cache_reused = 0
    cache_fingerprint = hashlib.sha256(tsne_input.tobytes() + visual_ids.tobytes() + str(args.tsne_iterations).encode() + importlib.metadata.version("scikit-learn").encode()).hexdigest()[:16]
    for perplexity, seed in itertools.product((10, 30, 50), (SEED, 17)):
        if perplexity >= len(visual_ids):
            continue
        cache_path = data_dir / f"tsne-{cache_fingerprint}-p{perplexity}-s{seed}.npz"
        if cache_path.exists():
            tsne_cache_reused += 1
            with np.load(cache_path, allow_pickle=False) as saved:
                coordinates, duration, trust = saved["points"], float(saved["duration"]), float(saved["trust"])
        else:
            tick = time.perf_counter()
            coordinates = TSNE(n_components=2, perplexity=perplexity, init="random", learning_rate="auto", max_iter=args.tsne_iterations, random_state=seed, n_jobs=2).fit_transform(tsne_input)
            duration = time.perf_counter() - tick
            trust = float(trustworthiness(visual_standardized[trust_positions], coordinates[trust_positions], n_neighbors=10))
            np.savez_compressed(cache_path, points=coordinates, duration=duration, trust=trust)
        tsne_runs.append({"id": f"tsne-p{perplexity}-s{seed}", "perplexity": perplexity, "seed": seed, "trustworthiness": trust, "runtime_seconds": duration, "points": coordinates.tolist(), "initialization": "random", "iterations": args.tsne_iterations, "learning_rate": "auto", "input_components": pre_dimensions})
        log(f"t-SNE p={perplexity}, seed={seed}: trustworthiness {trust:.4f}; {duration:.1f}s")
    reference_tsne = next(run for run in tsne_runs if run["perplexity"] == 30 and run["seed"] == SEED)
    ablations = []
    for name, ablation_space in (("Unscaled combined features", raw), ("Scaled colour-only features", standardized[:, :FEATURE_FAMILIES[0]["count"]])):
        tick = time.perf_counter()
        estimator = KMeans(n_clusters=selected["k"], n_init=10, random_state=SEED).fit(ablation_space)
        labels = estimator.labels_
        metrics = calculate_metrics(ablation_space[metric_cohort], labels[metric_cohort], standardized[metric_cohort], SEED, limit=len(metric_cohort))
        metrics["inertia"] = float(estimator.inertia_)
        ablations.append({"name": name, "k": selected["k"], "components": ablation_space.shape[1], "metrics": metrics, "runtime_seconds": time.perf_counter() - tick})
    reconstruction = []
    for variance in VARIANCES:
        count = dimensions[variance]
        reconstruction.append({"variance": variance, "components": count, "study_mse": float(np.mean(np.square(standardized - (full_pca[:, :count] @ pca.components_[:count] + pca.mean_)))), "holdout_mse": float(np.mean(np.square(holdout_standardized - (holdout_pca[:, :count] @ pca.components_[:count] + pca.mean_))))})
    pca2_trust = float(trustworthiness(visual_standardized[trust_positions], full_pca[visual_positions[trust_positions], :2], n_neighbors=10))
    preview_ids = set(map(str, visual_ids))
    for run in runs:
        for cluster in run["clusters"]:
            preview_ids.update(cluster["representatives"])
            preview_ids.update(cluster["boundary_samples"])
    thumbnails = artifacts_dir / "thumbnails"
    thumbnails.mkdir(exist_ok=True)
    # Source paths can contain reference class names, so the numerical feature
    # cache excludes them. This preview adapter opens them only after selection.
    path_lookup = json.loads((data_dir / "source_manifest_preview_only.json").read_text())
    for patch_id in sorted(preview_ids):
        target = thumbnails / f"{patch_id}.jpg"
        if not target.exists():
            with Image.open(data_dir / str(path_lookup[patch_id])) as image:
                image.convert("RGB").save(target, quality=86, optimize=True)
    for stale_preview in thumbnails.glob("p*.jpg"):
        if stale_preview.stem not in preview_ids:
            stale_preview.unlink()
    study = {
        "project": {"name": "TerraLens", "title": "Unsupervised Land-Type Grouping of Satellite Image Patches Using Clustering", "problem_id": "SIH26142", "course": "INT396 · Unsupervised Learning"},
        "dataset": {"name": "EuroSAT RGB", "source_url": SOURCE_URL, "doi": "10.5281/zenodo.7711810", "license": "MIT (as recorded by the creator's Zenodo deposit)", "total_images": prepared["total_images"], "valid_images": prepared["valid_images"], "image_width": 64, "image_height": 64, "channels": 3, "archive_sha256": checksum, "archive_md5": EXPECTED_MD5, "unique_images": len(ids_all)},
        "preprocessing": {"description": "Decode RGB → reject unreadable patches → deduplicate decoded pixels → anonymous IDs → seeded 80/20 split → 78 deterministic descriptors → study-fitted median imputer and StandardScaler → study-fitted PCA → K-Means.", "scaling": "StandardScaler, fitted only on study rows; feature means 0 and unit variance for nonconstant columns.", "missing_value_policy": "Reject invalid decoded images; finite descriptors checked. A median imputer fitted only on study rows protects the reusable numeric pipeline; no missing descriptors were fabricated.", "categorical_encoding": "Not applicable: all image descriptors are numerical. Paths, IDs and reference categories are excluded.", "label_policy": "Reference labels physically isolated in an evaluation-only annotation file; opened only after reference selection and artifact freeze."},
        "split": {"study_count": len(raw), "holdout_count": len(holdout_raw), "seed": SEED, "study_id_sha256": hashlib.sha256("\n".join(map(str, ids)).encode()).hexdigest(), "holdout_id_sha256": hashlib.sha256("\n".join(map(str, holdout_ids)).encode()).hexdigest()},
        "quality": prepared["quality"], "feature_names": FEATURE_NAMES, "feature_families": FEATURE_FAMILIES,
        "pca": {"explained_variance_ratio": pca.explained_variance_ratio_.tolist(), "cumulative_variance": cumulative.tolist(), "thresholds": [{"variance": variance, "components": dimensions[variance]} for variance in VARIANCES], "loadings": [{"component": component + 1, "features": [{"name": FEATURE_NAMES[index], "loading": float(pca.components_[component, index])} for index in np.argsort(np.abs(pca.components_[component]))[::-1][:10]]} for component in range(6)], "pca2_trustworthiness": pca2_trust},
        "selected_run_id": selected["id"], "runs": runs,
        "points": [{"id": str(patch_id), "pca": full_pca[position, :2].tolist(), "tsne": coordinate, "cluster": int(selected_state["labels"][position])} for patch_id, position, coordinate in zip(visual_ids, visual_positions, reference_tsne["points"], strict=True)],
        "tsne_runs": tsne_runs,
        "experiments": {"screening": screen_rows, "screening_sample_size": len(cohort), "full_metric_sample_size": len(metric_cohort), "ablations": ablations, "reconstruction": reconstruction, "comparison_rules": ["Compare silhouette_original across representations using the identical full standardized descriptor reference space.", "Inertia is an unnormalized sum of squared distances; compare it only within the same representation and cohort.", "Silhouette metrics use bounded fixed seeded samples; DB and CH for promoted runs use the same recorded 1,500-patch sample.", "t-SNE trustworthiness and PCA2 trustworthiness use the same 1,000-patch subset, 10 neighbors and full standardized descriptors as reference.", "Screening K selection, variance selection and ablations never consume reference class labels."], "units": {"silhouette": "dimensionless [-1, 1]; higher is more compact/separated", "davies_bouldin": "dimensionless; lower is better under centroid geometry", "calinski_harabasz": "dimensionless; higher is better under variance geometry", "inertia": "sum of squared distances in the stated representation", "reconstruction_mse": "mean squared error in standardized descriptor units", "stability": "mean pairwise adjusted Rand index over seeds 42,17,91", "trustworthiness": "dimensionless [0,1]; local-neighbor preservation, not accuracy", "runtime_seconds": "wall-clock seconds on this generating machine"}},
        "limitations": ["RGB omits near-infrared and other spectral bands; NDVI cannot be computed from this version.", "Descriptors capture colour and texture, which can also reflect illumination, season and acquisition conditions.", "K-Means favors compact Euclidean groups and can yield coarse partitions; groups need not match the ten reference classes.", "PCA preserves variance, which is not necessarily the most meaningful land-cover information.", "t-SNE is parameter-sensitive and emphasizes neighborhoods; its axes, island sizes and gaps are not physical geography or class evidence.", "European training imagery does not establish performance in India or other regions.", "A random patch holdout is not a geographically separated evaluation; nearby or related locations may remain correlated.", "Feature families contain different numbers of correlated descriptors, affecting Euclidean distances after scaling.", "Uploaded images may have a different scale, season, sensor or content; centroid distance is not calibrated confidence.", "The tool is an educational exploratory study and cannot establish legal boundaries, ownership, land-use decisions or causal conclusions."],
        "provenance": {"created_at": datetime.now(timezone.utc).isoformat(), "seed": SEED, "versions": {name: importlib.metadata.version(name) for name in ("numpy", "scipy", "scikit-learn", "scikit-image", "Pillow")}, "selection_rule": SELECTION_RULE, "metric_space": "Run-retained PCA components; silhouette_original is always measured in all 78 study-standardized descriptors. Promoted metric samples are identical.", "visual_sample_size": len(visual_ids), "trustworthiness_sample_size": len(trust_positions), "feature_count": len(FEATURE_NAMES), "thumbnail_count": len(preview_ids), "total_runtime_seconds": time.perf_counter() - started, "notes": ["Real creator-provided EuroSAT RGB archive verified against its published MD5 and recorded SHA256.", "No synthetic fallback, manually assigned clusters or invented metrics.", "Model preprocessing is fitted on study rows only; the holdout is transformed without refitting.", "Compact runtime feature cohort contains only anonymous study rows and no source paths or reference labels.", "t-SNE uses random initialization so the recorded seed comparison changes the initial state.", "Only the separate post-hoc audit exposes reference classes; labels never enter clustering.", "Exact floating-point results and timings may vary slightly with hardware and numerical libraries."]},
    }
    study["provenance"]["cache_reuse"] = {"features": prepared["feature_cache_reused"], "tsne_runs": tsne_cache_reused}
    study["provenance"]["feature_extraction_seconds"] = prepared["feature_extraction_seconds"]
    study["provenance"]["feature_definition_sha256"] = prepared["feature_signature"]
    study["provenance"]["notes"].append("total_runtime_seconds measures this invocation and may reuse validated feature/t-SNE caches; individual t-SNE and feature-extraction durations retain their measured computation times.")
    write_json(artifacts_dir / "features.json", {"features": FEATURES, "count": len(FEATURE_NAMES), "resize": "64×64 RGB; bilinear", "families": FEATURE_FAMILIES})
    write_json(artifacts_dir / "study.json", study)
    write_json(artifacts_dir / "config.json", {"seed": SEED, "split": "80/20 label-blind random; deduplicated anonymous IDs", "feature_version": 1, "feature_count": len(FEATURE_NAMES), "pca_variances": list(VARIANCES), "k_range": [2, 15], "kmeans_n_init_screen": 5, "kmeans_n_init_full": 10, "full_seeds": [SEED, 17, 91], "screen_samples": len(cohort), "metric_samples": len(metric_cohort), "visual_samples": len(visual_ids), "trustworthiness_samples": len(trust_positions), "tsne_perplexities": [10, 30, 50], "tsne_seeds": [SEED, 17], "tsne_iterations": args.tsne_iterations, "tsne_initialization": "random", "tsne_pre_pca_components": pre_dimensions, "tsne_learning_rate": "auto", "selected_run_id": selected["id"], "selection_rule": SELECTION_RULE, "archive_sha256": checksum})
    write_audit(data_dir, artifacts_dir, ids, selected_state["labels"], holdout_ids, selected_state["holdout_labels"], selected["id"])
    write_audit(
        data_dir, artifacts_dir, ids, comparison_state["labels"], holdout_ids, comparison_state["holdout_labels"],
        comparison["id"], filename=COMPARISON_AUDIT_FILENAME,
    )
    log(f"Complete: real frozen study, model, {len(preview_ids):,} previews and separate audit; {time.perf_counter() - started:.1f}s total")
    return study


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data-dir", default=".data")
    parser.add_argument("--artifacts-dir", default="artifacts")
    parser.add_argument("--screen-samples", type=int, default=5000)
    parser.add_argument("--visual-samples", type=int, default=3000)
    parser.add_argument("--tsne-iterations", type=int, default=750)
    parser.add_argument("--comparison-only", action="store_true", help="Regenerate the K=10 artifacts without overwriting the frozen study.")
    args = parser.parse_args()
    if not 200 <= args.screen_samples <= 10000 or not 100 <= args.visual_samples <= 3000 or not 250 <= args.tsne_iterations <= 3000:
        parser.error("Bounds: screen samples 200..10000; visual samples 100..3000; t-SNE iterations 250..3000")
    with threadpool_limits(limits=3):
        if args.comparison_only:
            build_comparison(args)
        else:
            build_study(args)


if __name__ == "__main__":
    main()
