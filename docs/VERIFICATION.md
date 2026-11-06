# Verification record

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
