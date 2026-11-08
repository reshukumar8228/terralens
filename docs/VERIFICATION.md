# Verification record

## Ten-group land-cover model

TerraLens standardizes on the 10-group land-cover model (`pca95-k10-s42`), aligning unsupervised clustering directly with EuroSAT's 10 ground-truth classes. Both example patches reuse the 28-component PCA representation (95.34% explained variance). Fitted centroids, neighbor ranking, and the group-level category audit follow this 10-group model.

| Held-out upload | Discovered Group | Dominant Land Cover |
| --- | --- | --- |
| `demo-patch-01.jpg` | Group 10 | Residential neighborhoods & built-up areas |
| `demo-patch-02.jpg` | Group 04 | Rivers, waterways, and transport paths |

The 29-test suite passed, including 10-group assignment, shared PCA coordinates, ordered cohort groups, run selection validation, and reference-only artifact compatibility. The production frontend build passed with zero errors. On Render, both held-out images returned the expected results. In the deployed browser, uploads display the assigned group, its matching nearest neighbors, and its separately loaded category mix. The deployed result fits a 375 px viewport. Full study reproduction produces the ten-group model and audit.

## Application checks

| Check | Observed result |
| --- | --- |
| `.venv/bin/python -m pytest -q` | 26 tests passed. Starlette's test client emitted one dependency deprecation warning. |
| `npm --prefix frontend run build` | TypeScript and Vite production build passed. |
| Patch Analyzer browser flow | Selected both held-out examples through the file picker. The results showed different groups and different nearest reference patches. Expanded the separate category mix and downloaded an analysis JSON containing the run ID, eight neighbors and 78 descriptors. |
| Experiment Bench browser flow | Fitted a 200-patch run with K=3, 95% PCA, seed 42 and perplexity 30. Displayed both projections. Reopened the completed hosted result from history. |
| Responsive layout | Patch Analyzer with a result and Experiment Bench fit a 375 px browser viewport without page-level horizontal overflow. |
| CI | GitHub Actions passed for the 1.1 runtime commit `f07227d` and UI follow-up `9c14fce`. |

## Hosted runs

Verified on [TerraLens on Render](https://terralens-f0sn.onrender.com/). The two image files are in [examples](../examples/README.md).

| Input | Assignment | Centroid gap | Candidate count | Ranked neighbors |
| --- | --- | --- | --- | --- |
| `demo-patch-01.jpg` | Group 01 | 7.216 | 1,462 | 8 |
| `demo-patch-02.jpg` | Group 02 | 7.900 | 1,538 | 8 |

The live job `live-a5de07cf753040e5` returned 200 distinct patch IDs with paired PCA and t-SNE coordinates. It retained 22 PCs, explaining 95.34% of descriptor variance. t-SNE trustworthiness was 0.9408 with 10 neighbors in the full standardized descriptor space. The t-SNE fit took 7.20 s and total measured numerical runtime was 7.90 s. The job's JSON export matched the polled result. Runtime is specific to that host and run. A second run submitted through the final deployed interface displayed the same settings, retained variance and trustworthiness. The screenshot records that second run.

The release also retains the reference study's prior checks. All six original workspaces were exercised at 320, 375, 414 and 768 px. Projection settings, the K=10 atlas inspection, keyboard dismissal, skip navigation and the post-selection audit were verified in the browser.

Current application screenshots are in `docs/screenshots/`. Reference evidence remains in `artifacts/study.json` and `artifacts/audit.json`.

## End-to-end recheck

- A clean extraction of the review ZIP installed from the lockfiles, built the frontend, passed all 26 tests and launched with the documented commands. The extracted app analysed both included holdout images.
- In the deployed browser, all six workspaces rendered and fit a 375 px viewport. The checks covered the reference patch inspector, a change to a saved t-SNE setting, the K=10 atlas, the separate audit, both uploads and the downloaded analysis JSON. One Projection Lab transition in an already-open tab stayed on its loading view until a reload. Subsequent navigation checks passed.
- Render rejected an invalid JPEG and a 501-patch t-SNE request with HTTP 422. Fresh job `live-94fcb2d1735b48a2` completed with 200 paired points, 22 retained components, 95.34% explained variance and 0.9408 t-SNE trustworthiness. Its API export matched the polled result. Its plots and JSON download also worked through the browser.
- The review ZIP contained the required code, fitted artifacts, examples, links, report and presentation. Final packaging correctly flagged the three pending contribution entries.

## Ten groups and reference categories evaluation

| Holdout measure | Value (K=10 model) |
| --- | --- |
| Silhouette in the common standardized descriptor space | 0.157 |
| Adjusted Rand index against EuroSAT labels | 0.322 |
| Normalized mutual information against EuroSAT labels | 0.442 |

For this audit, the original split IDs were matched to the full descriptor cache. The frozen imputer, scaler and first 28 PCA components transformed the study and holdout rows. The model used `KMeans(n_clusters=10, n_init=10, random_state=42)` on study rows only. Reference labels were loaded only after fitting and generating holdout assignments. The external agreement values use all 5,400 holdout rows.

The K=10 groups capture significant alignment with reference labels (NMI 0.44, ARI 0.32). The analyzer returns the visual group for the fitted model and presents reference category proportions separately.
