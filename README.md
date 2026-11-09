# TerraLens

**Unsupervised Land-Type Grouping of Satellite Image Patches Using Clustering**

INT396 · SIH26142 · B.Tech project

An interactive research workbench for a reproducible, label-blind EuroSAT study. Colour and texture features become PCA representations; K-Means discovers visual groups; PCA and t-SNE views expose what the representations preserve and distort. Reference land-type labels are isolated from fitting and model selection, then used only in a separate frozen-study audit.

## What is included

- React/TypeScript research interface with linked patch selection, projections, cluster galleries and experiment comparison.
- Python/FastAPI backend, bounded live PCA and K-Means jobs with optional t-SNE, SQLite experiment history and validated image uploads.
- Actual recorded EuroSAT experiments, fitted model artifacts and anonymous preview patches for an immediate local demonstration.
- Full dataset download and study reproduction script, numerical tests, API tests and configuration exports.
- Report PDF, editable presentation and PDF slides, learning guides and submission packager.

## Prerequisites

- Python 3.12 (or `uv`, which can provision it), Node.js 24 LTS and npm, Git.
- Approximately 1 GB free space for setup; additional working space for the full dataset and study. Internet is required for dependencies and the original dataset download. The installed local application uses bundled reference artifacts without external APIs.
- macOS, Linux, or Windows (WSL or native). On native Windows, you can run `scripts\setup.bat` and `scripts\start.bat` directly.

## Install and run

macOS / Linux / WSL:

```bash
./scripts/setup.sh
./scripts/start.sh
```

Windows (Command Prompt / PowerShell):

```cmd
scripts\setup.bat
scripts\start.bat
```

Open <http://127.0.0.1:8000>. Interactive API documentation: <http://127.0.0.1:8000/docs>.

Manual setup:

```bash
uv venv --python 3.12 .venv
uv pip install --python .venv/bin/python -r requirements-dev.lock.txt
npm --prefix frontend ci
npm --prefix frontend run build
PYTHONPATH=backend .venv/bin/python -m uvicorn terralens.app:app --host 127.0.0.1 --port 8000
```

For frontend development, start the API as above, then run `npm --prefix frontend run dev`. Vite proxies `/api` to the Python service. The production backend serves the compiled frontend from `frontend/dist`.

## Dataset and reproduction

EuroSAT RGB contains 27,000 64×64 RGB Sentinel-2 patches. The creator's versioned source, license and published archive checksum are recorded by the study downloader. The raw archive and extracted data live in `.data/`, outside the source submission and Git repository. Follow the source link in `artifacts/study.json` or the study script; do not substitute a class-balanced sample or a differently split mirror without documenting the change.

```bash
PYTHONPATH=backend .venv/bin/python scripts/prepare_study.py --help
PYTHONPATH=backend .venv/bin/python scripts/prepare_study.py
```

The full run downloads/verifies the original archive, validates and hashes images, extracts documented features, makes a seeded anonymous split, fits numerical transformations on study rows, executes the comparison study, freezes selection and writes a separate reference audit. It can take several minutes or longer depending on the machine and download connection. Read the script's help for performance bounds. Back up `artifacts/` before deliberately replacing a published reference study.

To rebuild just the ten-group model and its separate audit against the recorded study, run `.venv/bin/python scripts/prepare_study.py --comparison-only`.

Precomputed reference results are explicitly identified in the interface; they are measurements, not simulated responses. Live experiments fit an independent bounded sample of anonymous study descriptors. Their PCA axes and cluster IDs belong to that run and are not automatically aligned with the reference view.

## Try the live workflows

- In **Patch Analyzer**, upload the two [held-out example patches](examples/README.md) one at a time. Analyze each image with the ten-group model. Compare its assigned visual group (such as Group 10 for residential or Group 04 for waterways), runner-up centroid gap, ranked neighbors and the separate category mix.
- In **Experiment Bench**, select K=3, 95% PCA, seed 42, 200 patches and t-SNE perplexity 30. The backend fits a fresh run and returns matched PCA and t-SNE views. The run has its own cluster numbering.
- Read the [codebase walkthrough](docs/CODEBASE_GUIDE.md) to trace each request through the frontend, API and numerical modules.

## Scientific interpretation

- Cluster IDs are discovered groups, not known land-type classes or calibrated probabilities.
- PCA retained variance describes numerical feature variation, not classification accuracy.
- t-SNE supplies no explained-variance percentage. Its islands, sizes and gaps are not proof of natural classes.
- K-Means fits the selected multi-component PCA representation; the two-dimensional plots are visual summaries.
- Live uploads use the saved extractor, imputer, scaler, PCA and K-Means. No refitting occurs on an uploaded image, and no new t-SNE position is fabricated.
- Internal metrics guide the study; ARI/NMI with reference categories appear only in the post-hoc audit. Repeated-seed ARI is separately used for clustering stability.
- A random holdout checks unseen patches from this dataset; it does not prove geographic or India-specific generalisation.

## Verify

```bash
PYTHONPATH=backend .venv/bin/python -m pytest -q
npm --prefix frontend run build
```

Numerical tests cover feature determinism and important label/transform invariants. API checks cover validation, file rejection, immutable exports and live jobs. See `docs/VERIFICATION.md` for the verification actually performed on the delivered release.

## Free deployment

`Dockerfile` builds the React interface and serves it through one Python service. `render.yaml` declares a free Render service. Connect the GitHub repository in Render, choose the free plan and deploy the repository's Dockerfile. Health check: `/api/health`. The app needs no external API key or account to explore its scientific data.

The default hosted live-experiment cap is 1,000 patches; local cap is 1,500. Override `TERRALENS_MAX_SAMPLES` within 200–3,000 after benchmarking. Jobs that include a new t-SNE fit are capped at 500 patches or the host cap if lower. Only one numerical experiment and one image-analysis worker run at a time. At most two upload requests are accepted simultaneously. Image uploads are limited to 8 MB and decoded dimensions of 16–4096 pixels. Accepted formats: JPEG, PNG and WebP. A received-byte limit is enforced before multipart parsing, including for chunked requests. Images are not retained after the request; temporary upload buffers are closed.

Free Render instances can sleep and restart; runtime experiment history is temporary. Bundled reference artifacts are part of the deployment and remain available after restart. Export important live runs. Keep the installed local build ready for the presentation. See [Render's current limitations](https://render.com/docs/free).

## Team details and submission

Fill `team.json` with the real names, registration numbers, institution and actual completed work. Fill `links.json` with the verified GitHub/deployment URLs. No individual contribution is represented as completed until recorded by the team. The project was developed with Codex assistance; the team must understand, validate and present it in accordance with institutional policy.

The GitHub repository contains anonymous research data and source. Personalised team details and generated submission documents are kept in the local ZIP. When cloning the public repository, copy `team.example.json` to `team.json` and `PROJECT_LINKS.example.txt` to `PROJECT_LINKS.txt` before generating personalised documents.

Follow `docs/TEAM_REHEARSAL.md` for the assigned roles and practice tasks. After the team records completed work, regenerate the report and slides using `docs/DELIVERABLES.md`. Run `.venv/bin/python scripts/package_submission.py --final` to create three identical archives with the confirmed `INT396_RegNo.zip` filenames. Each member uploads the copy bearing their registration number.

Presentation: **10 November 2026**. Internal freeze: **9 November 2026**. Teacher's stated UMS deadline: **15 November 2026**.

## Layout

```text
backend/terralens/   Feature extraction, scientific pipeline, HTTP API, run journal
frontend/           React research workbench
scripts/            Setup, launch, study reproduction, documents and packaging
artifacts/          Recorded study, frozen model and anonymous previews
examples/           Two held-out EuroSAT uploads for the demo
tests/              Scientific and API checks
docs/               Methodology, architecture, walkthrough, viva and verification
output/             Generated report, presentation and submission archive
team.json           Editable identities and actual contributions
links.json          Verified external project links
```

## References and licensing

- Helber et al., *EuroSAT: A Novel Dataset and Deep Learning Benchmark for Land Use and Land Cover Classification*. [Creator repository](https://github.com/phelber/EuroSAT), [dataset record](https://zenodo.org/records/7711097), [paper](https://arxiv.org/abs/1709.00029).
- [scikit-learn PCA](https://scikit-learn.org/stable/modules/generated/sklearn.decomposition.PCA.html), [t-SNE](https://scikit-learn.org/stable/modules/generated/sklearn.manifold.TSNE.html), [clustering evaluation](https://scikit-learn.org/stable/modules/clustering.html).
- [Original t-SNE author's FAQ](https://lvdmaaten.github.io/tsne/).

EuroSAT's creator repository specifies MIT licensing and the relevant Copernicus Sentinel data terms. Retain dataset attribution and third-party notices. This application uses established open-source libraries; their algorithms are not claimed as original inventions. The project contribution is its documented pipeline, experiments, interpretation and application.
