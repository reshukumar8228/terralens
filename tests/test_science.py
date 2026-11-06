"""Numerical and leakage invariants; synthetic fixtures are tests, never study data."""
from __future__ import annotations

import hashlib
import json
from pathlib import Path
import sys

import numpy as np
from PIL import Image
import pytest
from sklearn.decomposition import PCA
from sklearn.preprocessing import StandardScaler

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))
from terralens.experiments import run_experiment
from terralens.features import FEATURES, FEATURE_FAMILIES, FEATURE_NAMES, extract_features
from terralens.inference import analyze_image, load_model

ARTIFACTS = Path(__file__).resolve().parents[1] / "artifacts"


def test_feature_dictionary_and_constant_patch_are_finite():
    assert len(FEATURE_NAMES) == len(set(FEATURE_NAMES)) == 78
    assert sum(family["count"] for family in FEATURE_FAMILIES) == 78
    assert all(feature["description"] and feature["family"] for feature in FEATURES)
    vector = extract_features(Image.new("RGB", (64, 64), (0, 0, 0)))
    assert vector.shape == (78,)
    assert np.isfinite(vector).all()
    assert vector[FEATURE_NAMES.index("red_mean")] == 0
    assert vector[FEATURE_NAMES.index("edge_density")] == 0
    for prefix in ("hue_bin_", "saturation_bin_", "value_bin_", "lbp_bin_"):
        assert np.isclose(sum(value for name, value in zip(FEATURE_NAMES, vector, strict=True) if name.startswith(prefix)), 1)


def test_features_are_deterministic_and_do_not_depend_on_image_filename():
    pixels = np.random.default_rng(9).integers(0, 256, (64, 64, 3), dtype=np.uint8)
    first, second = Image.fromarray(pixels), Image.fromarray(pixels)
    first.filename, second.filename = "Forest/forest_1.jpg", "River/river_9.jpg"
    assert np.array_equal(extract_features(first), extract_features(second))
    assert np.isclose(extract_features(Image.new("RGB", (64, 64), (255, 0, 0)))[0], 1)


@pytest.fixture(scope="module")
def study():
    if not (ARTIFACTS / "study.json").exists():
        pytest.skip("Run scripts/prepare_study.py to generate the real reference study first")
    return json.loads((ARTIFACTS / "study.json").read_text())


def test_reference_is_real_consistent_pca_study(study):
    assert study["dataset"]["total_images"] == 27000
    assert study["dataset"]["archive_md5"] == "f46e308c4d50d4bf32fedad2d3d62f3b"
    assert len(study["dataset"]["archive_sha256"]) == 64
    assert study["split"]["study_count"] + study["split"]["holdout_count"] == study["dataset"]["unique_images"]
    selected = next(run for run in study["runs"] if run["id"] == study["selected_run_id"])
    assert selected["variance"] in (0.9, 0.95, 0.99)
    assert sum(cluster["count"] for cluster in selected["clusters"]) == study["split"]["study_count"]
    assert -1 <= selected["metrics"]["silhouette"] <= 1
    assert -1 <= selected["stability"] <= 1
    cumulative = np.array(study["pca"]["cumulative_variance"])
    assert np.all(np.diff(cumulative) >= -1e-12)
    assert np.isclose(cumulative[-1], 1)
    for threshold in study["pca"]["thresholds"]:
        index = threshold["components"] - 1
        assert cumulative[index] >= threshold["variance"]
        assert index == 0 or cumulative[index - 1] < threshold["variance"]


def test_reference_labels_are_separate_and_split_is_disjoint(study):
    serialized = json.dumps(study)
    for class_name in ("AnnualCrop", "Forest", "SeaLake", "Residential", "PermanentCrop"):
        assert class_name not in serialized
    manifest = json.loads((ARTIFACTS / "split_manifest.json").read_text())
    study_ids, holdout_ids = set(manifest["study_ids"]), set(manifest["holdout_ids"])
    assert study_ids.isdisjoint(holdout_ids)
    assert len(study_ids) == study["split"]["study_count"]
    assert len(holdout_ids) == study["split"]["holdout_count"]
    with np.load(ARTIFACTS / "compact_features.npz", allow_pickle=False) as bundle:
        assert set(bundle.files) == {"X", "ids"}
        assert set(bundle["ids"]).issubset(study_ids)
        assert bundle["X"].shape[1] == 78
    audit = json.loads((ARTIFACTS / "audit.json").read_text())
    assert audit["frozen_study_sha256"] == hashlib.sha256((ARTIFACTS / "study.json").read_bytes()).hexdigest()


def test_shared_projection_cohort_and_thumbnails(study):
    points = study["points"]
    assert len({point["id"] for point in points}) == len(points) <= 3000
    assert len(study["tsne_runs"]) == 6
    for run in study["tsne_runs"]:
        assert len(run["points"]) == len(points)
        assert 0 <= run["trustworthiness"] <= 1
        assert np.isfinite(run["points"]).all()
    all_ids = {point["id"] for point in points}
    for run in study["runs"]:
        for cluster in run["clusters"]:
            all_ids.update(cluster["representatives"])
            all_ids.update(cluster["boundary_samples"])
    assert all((ARTIFACTS / "thumbnails" / f"{patch_id}.jpg").exists() for patch_id in all_ids)


def test_bundled_model_reproduces_reference_points(study):
    model = load_model(ARTIFACTS)
    with np.load(ARTIFACTS / "compact_features.npz", allow_pickle=False) as bundle:
        assert bundle["ids"].tolist() == [point["id"] for point in study["points"]]
        standardized = model["scaler"].transform(model["imputer"].transform(bundle["X"]))
        coordinates = model["pca"].transform(standardized)
    labels = model["kmeans"].predict(coordinates[:, :model["components"]])
    assert labels.tolist() == [point["cluster"] for point in study["points"]]
    assert np.allclose(coordinates[:, :2], [point["pca"] for point in study["points"]], atol=1e-9)
    assert model["reference_run_id"] == study["selected_run_id"]


def test_upload_transforms_saved_state_without_fitting_or_tsne(study, monkeypatch):
    def forbidden(*args, **kwargs):
        raise AssertionError("Upload inference must never fit preprocessing")
    monkeypatch.setattr(StandardScaler, "fit", forbidden)
    monkeypatch.setattr(PCA, "fit", forbidden)
    monkeypatch.setattr(PCA, "fit_transform", forbidden)
    patch = Image.open(ARTIFACTS / "thumbnails" / f"{study['points'][0]['id']}.jpg")
    result = analyze_image(patch, ARTIFACTS)
    assert len(result["pca"]) == 2
    assert "tsne" not in result and "confidence" not in result
    assert 0 <= result["reference_percentile"] <= 100
    assert np.isfinite(result["distance"])
    assert len(result["features"]) == 78
    assert result["representatives"]


def test_live_experiment_is_bounded_label_free_and_preserves_reference(study, monkeypatch):
    model_digest = hashlib.sha256((ARTIFACTS / "model.joblib").read_bytes()).hexdigest()
    original_read = Path.read_text
    def checked_read(path, *args, **kwargs):
        assert "audit" not in path.name and "reference_labels" not in path.name
        return original_read(path, *args, **kwargs)
    monkeypatch.setattr(Path, "read_text", checked_read)
    result = run_experiment({"k": 3, "variance": 0.95, "seed": 8, "sample_size": 200}, ARTIFACTS)
    assert result["sample_size"] == len(result["points"]) == 200
    assert sum(cluster["count"] for cluster in result["clusters"]) == 200
    assert model_digest == hashlib.sha256((ARTIFACTS / "model.joblib").read_bytes()).hexdigest()
    with pytest.raises(ValueError):
        run_experiment({"k": 100, "variance": 0.95, "seed": 8, "sample_size": 200}, ARTIFACTS)
