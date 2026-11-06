# TerraLens codebase guide

Start with a patch in the application, then follow its request through the files below. TerraLens has three numerical workflows with different fitting rules. The offline study fits and selects a reference model. Patch Analyzer applies the reference or the saved ten-group comparison to one image. Experiment Bench fits a new model on a bounded sample of study descriptors.

## Where to start

| Location | What it owns |
| --- | --- |
| [`frontend/src/main.tsx`](../frontend/src/main.tsx), [`App.tsx`](../frontend/src/App.tsx) | Start React, load the reference and capabilities, navigate between views and open patch details. |
| [`frontend/src/Analyzer.tsx`](../frontend/src/Analyzer.tsx), [`Experiments.tsx`](../frontend/src/Experiments.tsx) | Patch upload and live experiment workspaces. Shared charts render API data. [`api.ts`](../frontend/src/api.ts) wraps requests and JSON downloads. |
| [`backend/terralens/app.py`](../backend/terralens/app.py) | Assemble FastAPI, start workers, install middleware, mount API routes and serve the built frontend. |
| [`backend/terralens/api/`](../backend/terralens/api/) | `reference.py` serves study data and exports. `experiments.py` accepts and polls jobs. `analyzer.py` accepts uploads. `resources.py` holds the shared resources for those routes. |
| [`backend/terralens/`](../backend/terralens/) | `features.py` extracts descriptors. `inference.py` applies frozen transforms and explains assignments. `clustering.py` computes shared metrics and cluster summaries. `experiments.py` fits bounded live runs. `store.py` journals jobs in SQLite. |
| [`scripts/prepare_study.py`](../scripts/prepare_study.py), [`backend/terralens/study.py`](../backend/terralens/study.py) | Download and verify EuroSAT, prepare the features and split, fit candidate models, freeze the selected model and generate reference evidence. |
| [`artifacts/`](../artifacts/), [`tests/`](../tests/) | Saved models and numerical evidence, plus tests for the scientific pipeline and API. |

## Trace one uploaded image

1. Choose a satellite RGB patch and a visual grouping in **Patch Analyzer**, then click **Analyze patch**. The frontend sends the file as multipart form data to `POST /api/analyze` with the selected run ID.
2. The analyzer route and `uploads.py` enforce the upload limits, decode the actual image, convert it to RGB and resize it to 64 × 64. The image worker passes the decoded patch to the numerical code and releases the upload buffer after processing.
3. `features.py` computes the same 78 colour, texture and edge descriptors used offline. `inference.py` applies the fitted imputer, scaler and PCA from the fitted model bundle. `model.joblib` holds the study reference, and `comparison-model.joblib` holds the ten-group fit. The 2D marker uses the first two PCA coordinates. The centroid comparison uses the full retained PCA vector.
4. The frozen K-Means model supplies the group and distances to the assigned and runner-up centroids. The gap is `runner-up distance - assigned distance`. A small gap means those two distances are similar. The reference percentile compares the assigned distance with recorded distances for that group, which helps distinguish a typical assignment from a patch far from its centroid.
5. The backend ranks compact study patches from the assigned group by their distances to the uploaded patch in retained PCA space and returns up to eight neighbours. `neighbor_scope` records how many candidates it searched. These query-specific neighbours can change when the image changes. The fixed representatives are the patches nearest the group's centroid. The response includes `run_id` so the displayed distances and examples can be traced to that reference.
6. Open the group category mix separately if asked about land cover. It describes the proportions of EuroSAT reference categories within the **whole assigned group** after the model was frozen. The audit and neighbor list follow the selected run. Use them to discuss overlap between visual groups and annotated classes. The percentage refers to the group aggregate and cannot establish the uploaded patch's category.
7. Export the analysis JSON. It records the returned coordinates, distances, neighbours, run ID and feature measurements. The export uses the numerical response and excludes the uploaded image bytes.

For a demo, show two different patches and point to the changing neighbour order. Explain the runner-up gap, then open the aggregate category mix to show why a visual group can contain multiple annotated classes. In the browser's network view, match `run_id`, `cluster`, `pca`, `distance`, `alternate_distance`, `margin` and `neighbors` in the `POST /api/analyze` response with the JSON download.

## Trace one fresh experiment

1. In **Experiment Bench**, choose a sample size, K, variance target and seed. Enable fresh t-SNE if you want the second projection. Use the browser's network view to inspect the settings sent to `POST /api/experiments`.
2. `api/experiments.py` validates the settings and queues work. The frontend polls `GET /api/experiments/{id}` while the worker runs. `store.py` records the settings, status and result in SQLite. Export the result when you need to keep it across hosting restarts.
3. `experiments.py` uses the seed to sample anonymous study descriptors from `compact_features.npz`. It fits a fresh imputer, scaler and PCA on those rows, then fits K-Means in the retained PCA space. `clustering.py` calculates metrics and examples using that run's geometry. Reference categories stay outside the computation.
4. When requested, the worker fits a fresh t-SNE layout on the **same selected patches**. The two plots can link the same anonymous IDs. Each point keeps the K-Means assignment from retained PCA space. Changing t-SNE settings changes the layout, while the K-Means result comes from the separate PCA-space fit.
5. Compare the result with the recorded reference using the run ID and metric-space notes. A fresh PCA basis and cluster numbers belong to that run. Use the recorded silhouette space and sample when comparing scores. A centroid may have a different cluster number in another fit even if the groups are similar.

PCA stores a linear transformation that applies to one new feature vector. The saved t-SNE plots record coordinates from fits on specific cohorts. A new t-SNE fit has its own layout, so the app uses the fitted PCA transform for a lone uploaded image and uses a fresh cohort fit for live t-SNE.

## What comes from disk

| Artifact | When it is produced | Where it is used |
| --- | --- | --- |
| `study.json` and `config.json` | Offline study with fixed seeds and a recorded selection rule | Reference metrics, PCA axes, saved t-SNE comparison, settings and provenance. |
| `model.joblib` and `comparison-model.joblib` | Offline two-group reference and ten-group comparison fits on study rows | Saved imputer, scaler, PCA, K-Means and distance distributions for uploaded patches. |
| `compact_features.npz` and `thumbnails/` | Offline selection of anonymous study descriptors and preview images | Bounded live experiments, query-specific neighbour lookup and patch inspection. The raw dataset archive is unnecessary for this demonstration. |
| `split_manifest.json`, `features.json` and `audit.json` | Offline preparation and post-selection audit | Check the anonymous study/holdout boundary and descriptor definitions. The reference audit and separate `comparison-audit.json` describe category agreement and group proportions after fitting. |
| Runtime SQLite journal | When the user starts a live experiment | Job history and results. A free host can reset runtime storage. |

The larger offline study precomputes the reference comparisons so opening the site does not download EuroSAT or refit the models. Upload analysis and fresh experiments execute on demand. The reference `study.json` remains the source for the report and the saved study screens.

## What each member should read before the viva

| Assignment | Read these files together | Be ready to show |
| --- | --- | --- |
| Data and ML reproducibility | `prepare_study.py`, `study.py`, `features.py` and `clustering.py` | Find the seed, 80/20 split and label boundary. Explain a feature loading, a variance target and the K selection rule. |
| Application verification and demonstration | `App.tsx`, `Analyzer.tsx`, `Experiments.tsx`, `api/analyzer.py`, `api/experiments.py`, `store.py` | Match a browser action to an API response. Demonstrate a valid upload, an invalid file and a completed experiment. |
| Results interpretation and documentation | `inference.py`, `study.json`, `audit.json`, `build_deliverables.py` and `build_presentation.mjs` | Explain the query neighbours, runner-up gap and category mix. Match the slide's measured numbers with their artifact entries. |

For the code explanation, answer four questions for each example. What did we send? Which code ran? Where did it obtain fitted parameters or data? What can the response support scientifically?

## Reproduce and verify

Run from the project directory. [README](../README.md) lists prerequisites and deployment settings.

```bash
./scripts/setup.sh
./scripts/start.sh
```

Open `http://127.0.0.1:8000`. Run the scientific and API checks and build the frontend from a second terminal:

```bash
.venv/bin/python -m pytest -q
npm --prefix frontend run build
```

To reproduce the full offline study separately from the published artifacts, run:

```bash
.venv/bin/python scripts/prepare_study.py --artifacts-dir tmp/terralens-reproduction
```

The study command uses the documented EuroSAT download and checksum. Compare the generated settings, anonymous split, metrics and model ID with the recorded artifacts. Timing depends on the machine. Use the [walkthrough](DEMO_WALKTHROUGH.md) and [viva questions](VIVA_40.md) to practise explaining the results.
