# Verification record

The reference study uses the verified EuroSAT RGB archive and includes the anonymous split, measured model comparisons, six t-SNE runs, fitted pipeline, and separate post-hoc audit. The selected run is `pca95-k2-s42`.

## Application checks

| Check | Observed result |
| --- | --- |
| `.venv/bin/python -m pytest -q` | 24 tests passed. One dependency deprecation warning in Starlette's test client. |
| `npm --prefix frontend run build` | TypeScript and production build passed. |
| Six workspaces at 320, 375, 414 and 768 px | 24 browser checks with no page-level horizontal overflow. |
| Projection controls | Changing perplexity updated the selected embedding and its measured trustworthiness. |
| Atlas and keyboard | K=10 patch inspector showed the saved comparison context. Escape closed it, and the skip link focused the workspace without changing the route. |
| Live experiment | K=3, 95% PCA, seed 17 and 200 patches completed. The history restored its measured result and exposed its export. |
| Patch analyzer | Uploaded a genuine 64×64 RGB EuroSAT example. The saved pipeline returned its group, centroid distance, feature profile and PCA coordinates. |
| Reference audit | Explicitly opened the frozen study's separate reference category table. |
| Deployment source | Application commit `79e557a` pushed to GitHub `main`. |

Screenshots of the observed application are in `docs/screenshots/`. Numeric evidence is available in `artifacts/study.json`, `artifacts/audit.json`, and the application exports.

## Published checks

- A clean Git archive installed successfully, built the frontend, and passed all 24 tests.
- The GitHub Actions workflow passed for `79e557a`.
- Render Free in Singapore deployed `79e557a`. The homepage, health check, study, configuration export, thumbnails and separate audit responded successfully.
- A real EuroSAT upload returned Group 02 through the saved reference pipeline. A new 200-patch K=3 experiment reached `completed` and returned 200 PCA points.
- Public application: [TerraLens](https://terralens-f0sn.onrender.com).
