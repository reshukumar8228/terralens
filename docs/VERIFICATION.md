# Verification record

## Two- and ten-group upload comparison

TerraLens 1.2 adds a grouping choice to Patch Analyzer. Both example patches reuse the same 28-component PCA representation in both modes. The fitted centroids, neighbor ranking and group-level category audit follow the selected run.

| Held-out upload | Two-group reference | Ten-group comparison |
| --- | --- | --- |
| `demo-patch-01.jpg` | Group 01 | Group 10 |
| `demo-patch-02.jpg` | Group 02 | Group 04 |

The 29-test suite passed, including comparison assignment, shared PCA coordinates, ordered cohort groups, run selection validation and reference-only artifact compatibility. The production frontend build passed. On Render 1.2, both held-out images returned the expected results in both modes. In the deployed browser, changing models kept the selected image, cleared the result and displayed the new group, its matching neighbors and its separately loaded category mix after analysis. The deployed result also fit a 375 px viewport. The local patch inspector identified the K=10 comparison. Full study reproduction and comparison-only regeneration both produced the ten-group model and audit.

## Reference and live experiment checks

TerraLens 1.1 preserves the frozen reference run `pca95-k2-s42` and its evidence from 27,000 EuroSAT RGB patches. The upgrade adds query-specific image analysis and optional live t-SNE.

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

## Why ten groups still do not identify ten land types

| Holdout measure | K=2 reference | K=10 comparison |
| --- | --- | --- |
| Silhouette in the common standardized descriptor space | 0.243 | 0.157 |
| Adjusted Rand index against EuroSAT labels | 0.106 | 0.322 |
| Normalized mutual information against EuroSAT labels | 0.221 | 0.442 |

For this follow-up audit, the original split IDs were matched to the full descriptor cache. The frozen imputer, scaler and first 28 PCA components transformed the study and holdout rows. The comparison used `KMeans(n_clusters=10, n_init=10, random_state=42)` on study rows only. Its inertia matched the recorded run within floating-point tolerance. Reference labels were loaded only after fitting and generating both sets of holdout assignments. The common-space silhouette values are from the stored study comparison. The external agreement values use all 5,400 holdout rows.

The K=10 groups show higher agreement with the reference labels and weaker geometric separation in the common descriptor space. Assigning each K=10 group its most common **study** label gave 52.65% accuracy and 0.442 macro F1 on the holdout. This simple mapping predicted eight categories and missed Highway and Pasture entirely. One river-leading group contained 379 River patches among 1,205 holdout members. The mapping is an offline diagnostic only. The analyzer returns the visual group for the selected fitted model and presents reference category proportions separately.
