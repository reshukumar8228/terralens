"""Boundary tests against the bundled reference study, without fake research results."""

import csv
import asyncio
import io
import json
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from PIL import Image

from terralens import app as app_module
from terralens.settings import COMPARISON_MODEL_FILENAME, COMPARISON_RUN_ID, MAX_UPLOAD_ENVELOPE
from terralens.store import ExperimentStore

DEMO_PATCH = Path(__file__).resolve().parents[1] / "examples" / "demo-patch-02.jpg"
DEMO_PATCH_01 = Path(__file__).resolve().parents[1] / "examples" / "demo-patch-01.jpg"


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setattr(app_module, "RUNTIME", tmp_path / "runtime")
    with TestClient(app_module.app) as value:
        yield value


@pytest.fixture
def prepared(client):
    if not client.get("/api/health").json()["study_ready"]:
        pytest.skip("Generate or include the genuine reference study first.")
    return client


def test_health_is_available_without_dataset(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"
    assert response.headers["x-content-type-options"] == "nosniff"


def test_exports_match_recorded_runs(prepared):
    study = prepared.get("/api/study").json()
    exported = prepared.get("/api/export/study.json")
    assert exported.json() == study
    rows = list(csv.DictReader(io.StringIO(prepared.get("/api/export/metrics.csv").text)))
    assert len(rows) == len(study["runs"])
    selected = next(row for row in rows if row["selected"] == "True")
    assert selected["id"] == study["selected_run_id"]
    assert "attachment" in exported.headers["content-disposition"]


def test_config_export_contains_the_actual_reproduction_settings(prepared):
    recorded = json.loads((app_module.ARTIFACTS / "config.json").read_text())
    exported = prepared.get("/api/export/config.json").json()
    for key in ("k_range", "full_seeds", "tsne_perplexities", "tsne_iterations", "screen_samples", "kmeans_n_init_full"):
        assert exported[key] == recorded[key]


def test_anonymous_previews_and_traversal(prepared):
    patch_id = prepared.get("/api/study").json()["points"][0]["id"]
    response = prepared.get(f"/api/patches/{patch_id}.jpg")
    assert response.status_code == 200 and response.headers["content-type"] == "image/jpeg"
    assert prepared.get("/api/patches/not-present.jpg").status_code == 404
    assert prepared.get("/api/patches/..%2F..%2Fteam.json.jpg").status_code == 404


@pytest.mark.parametrize("body", [
    {"k": 1}, {"k": 16}, {"variance": 0.5}, {"sample_size": 10},
    {"seed": -1}, {"k": 4, "reference_class": "Forest"},
])
def test_bad_experiment_configuration(client, body):
    assert client.post("/api/experiments", json=body).status_code == 422


def test_invalid_upload_is_rejected(prepared):
    response = prepared.post("/api/analyze", files={"file": ("fake.jpg", b"not an image", "image/jpeg")})
    assert response.status_code == 422
    assert prepared.post("/api/analyze", files={"file": ("empty.png", b"", "image/png")}).status_code == 422


def test_chunked_upload_is_bounded_before_multipart_parsing(client):
    boundary = "terralens-test-boundary"
    header = f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="large.jpg"\r\nContent-Type: image/jpeg\r\n\r\n'.encode()
    payload = [header] + [b"x" * 65536] * 144 + [f"\r\n--{boundary}--\r\n".encode()]
    chunks = iter(enumerate(payload))
    consumed = 0
    messages = []

    async def receive():
        nonlocal consumed
        try:
            index, chunk = next(chunks)
        except StopIteration:
            await asyncio.Future()
        consumed += len(chunk)
        return {"type": "http.request", "body": chunk, "more_body": index < len(payload) - 1}

    async def send(message):
        messages.append(message)

    scope = {
        "type": "http", "asgi": {"version": "3.0", "spec_version": "2.3"},
        "http_version": "1.1", "method": "POST", "scheme": "http", "path": "/api/analyze",
        "raw_path": b"/api/analyze", "query_string": b"", "root_path": "",
        "headers": [(b"content-type", f"multipart/form-data; boundary={boundary}".encode())],
        "client": ("127.0.0.1", 1234), "server": ("testserver", 80),
    }
    asyncio.run(asyncio.wait_for(app_module.app(scope, receive, send), timeout=10))
    assert next(message for message in messages if message["type"] == "http.response.start")["status"] == 413
    assert consumed <= MAX_UPLOAD_ENVELOPE + 65536


def test_image_decode_does_not_block_health_requests(prepared, monkeypatch):
    patch_id = prepared.get("/api/study").json()["points"][0]["id"]
    content = prepared.get(f"/api/patches/{patch_id}.jpg").content
    decode_started = threading.Event()
    real_open = Image.open

    def slow_open(*args, **kwargs):
        decode_started.set()
        time.sleep(0.8)
        return real_open(*args, **kwargs)

    monkeypatch.setattr(Image, "open", slow_open)
    with ThreadPoolExecutor(max_workers=1) as pool:
        future = pool.submit(prepared.post, "/api/analyze", files={"file": ("patch.jpg", content, "image/jpeg")})
        assert decode_started.wait(timeout=5)
        started = time.monotonic()
        assert prepared.get("/api/health").status_code == 200
        latency = time.monotonic() - started
        assert future.result(timeout=10).status_code == 200
    assert latency < 0.4, f"Health request stalled for {latency:.3f}s during image decode"


def test_reference_upload_uses_saved_pipeline(prepared):
    study = prepared.get("/api/study").json()
    selected = next(run for run in study["runs"] if run["id"] == study["selected_run_id"])
    patch_id = selected["clusters"][0]["representatives"][0]
    content = prepared.get(f"/api/patches/{patch_id}.jpg").content
    first = prepared.post("/api/analyze", files={"file": ("patch.jpg", content, "image/jpeg")})
    second = prepared.post("/api/analyze", files={"file": ("patch.jpg", content, "image/jpeg")})
    assert first.status_code == second.status_code == 200
    result = first.json()
    assert result["cluster"] == second.json()["cluster"]
    assert result["pca"] == second.json()["pca"]
    assert "confidence" not in result and "tsne" not in result
    assert 0 <= result["reference_percentile"] <= 100
    assert len(result["features"]) == len(study["feature_names"])
    assert "not retained" in result["retention"]
    assert result["run_id"] == study["selected_run_id"]
    assert result["alternate_cluster"] != result["cluster"]
    assert result["margin"] == pytest.approx(result["alternate_distance"] - result["distance"])
    assert result["neighbor_scope"] >= len(result["neighbors"]) > 0
    assert first.headers["cache-control"] == "no-store"


def test_comparison_upload_uses_its_own_groups_on_the_shared_pca(prepared):
    study = prepared.get("/api/study").json()
    primary_id = study["selected_run_id"]
    assert primary_id == COMPARISON_RUN_ID

    files_02 = {"file": (DEMO_PATCH.name, DEMO_PATCH.read_bytes(), "image/jpeg")}
    res_02 = prepared.post("/api/analyze", files=files_02)
    assert res_02.status_code == 200
    assert res_02.headers["cache-control"] == "no-store"
    data_02 = res_02.json()
    assert data_02["run_id"] == COMPARISON_RUN_ID
    assert data_02["cluster"] == 3
    assert data_02["margin"] == pytest.approx(data_02["alternate_distance"] - data_02["distance"])
    assert data_02["cluster"] != data_02["alternate_cluster"]
    assert "tsne" not in data_02 and "confidence" not in data_02
    assert len(data_02["neighbors"]) == 8

    files_01 = {"file": (DEMO_PATCH_01.name, DEMO_PATCH_01.read_bytes(), "image/jpeg")}
    res_01 = prepared.post("/api/analyze", files=files_01)
    assert res_01.status_code == 200
    data_01 = res_01.json()
    assert data_01["cluster"] == 9

    audit = prepared.get("/api/audit").json()
    assert audit["reference_run_id"] == primary_id
    assert len(audit["reference_classes"]) == 10
    assert len(audit["contingency"]) == 10


def test_analysis_rejects_unknown_run_ids(prepared):
    files = {"file": ("fake.jpg", b"not an image", "image/jpeg")}
    params = {"run_id": "../model"}
    assert prepared.post("/api/analyze", params=params, files=files).status_code == 404
    assert prepared.get("/api/audit", params=params).status_code == 404


def test_optional_comparison_artifacts(tmp_path, monkeypatch):
    artifacts = tmp_path / "artifacts"
    artifacts.mkdir()
    source = app_module.ARTIFACTS
    if not (source / "study.json").is_file():
        pytest.skip("Generate or include the genuine reference study first.")
    for filename in ("study.json", "model.joblib", "compact_features.npz"):
        (artifacts / filename).symlink_to(source / filename)
    monkeypatch.setattr(app_module, "ARTIFACTS", artifacts)
    monkeypatch.setattr(app_module, "RUNTIME", tmp_path / "runtime")
    files = {"file": (DEMO_PATCH.name, DEMO_PATCH.read_bytes(), "image/jpeg")}
    params = {"run_id": "nonexistent-run-id"}
    with TestClient(app_module.app) as custom:
        capabilities = custom.get("/api/capabilities").json()
        assert capabilities["analysis_runs"] == [capabilities["reference_run_id"]]
        assert custom.post("/api/analyze", params=params, files=files).status_code == 404
        assert custom.post("/api/analyze", files=files).status_code == 200


@pytest.mark.parametrize("perplexity", [None, 30])
def test_live_experiment_reaches_a_real_result(prepared, perplexity):
    config = {"k": 3, "variance": 0.95, "seed": 19, "sample_size": 200}
    if perplexity is not None:
        config["tsne_perplexity"] = perplexity
    created = prepared.post("/api/experiments", json=config)
    assert created.status_code == 202
    experiment_id = created.json()["id"]
    deadline = time.monotonic() + 40
    while time.monotonic() < deadline:
        job = prepared.get(f"/api/experiments/{experiment_id}").json()
        if job["status"] in ("completed", "failed"):
            break
        time.sleep(0.1)
    assert job["status"] == "completed", job
    assert len(job["result"]["points"]) == 200
    assert len(set(point["cluster"] for point in job["result"]["points"])) == 3
    assert job["result"]["metrics"]["silhouette"] is not None
    if perplexity is not None:
        assert job["result"]["tsne"]["perplexity"] == perplexity
        assert 0 <= job["result"]["tsne"]["trustworthiness"] <= 1
        assert all(len(point["tsne"]) == 2 for point in job["result"]["points"])
    else:
        assert "tsne" not in job["result"]
    assert prepared.get(f"/api/export/experiments/{experiment_id}.json").json()["result"] == job["result"]


def test_live_tsne_respects_advertised_sample_limit(client):
    capabilities = client.get("/api/capabilities").json()
    assert capabilities["live_tsne"] is True
    maximum = capabilities["max_live_tsne_samples"]
    rejected = client.post("/api/experiments", json={"sample_size": maximum + 1, "tsne_perplexity": 30})
    assert rejected.status_code == 422
    assert str(maximum) in rejected.json()["detail"]


def test_restart_marks_incomplete_job_as_interrupted(tmp_path):
    store = ExperimentStore(tmp_path)
    store.create("test-job", {"k": 4})
    restarted = ExperimentStore(tmp_path)
    assert restarted.get("test-job")["status"] == "failed"
    assert "restarted" in restarted.get("test-job")["error"]
