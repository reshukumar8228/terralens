# Team rehearsal and verification

The three roles below match the member order in `team.json`. Read the [learning guide](LEARNING_GUIDE.md) together, then divide the hands-on checks. Each member should be able to explain the whole pipeline in one minute and demonstrate their assigned part without reading the slides.

| Member | Assigned responsibility | Hands-on work to complete | Presentation handoff |
| --- | --- | --- | --- |
| 1 | Data and ML reproducibility | Run the science tests. Trace image descriptors, scaling and PCA through `features.py`, `study.py` and `inference.py`. Use the Projection Lab to explain one feature loading, the retained-variance curve and a t-SNE parameter change. | Open the talk with the problem, dataset and preprocessing. |
| 2 | Application verification and demonstration | Start a local copy. Trace a live experiment from `frontend/src/Experiments.tsx` through `backend/terralens/api/experiments.py` to its SQLite record. Fit a t-SNE view and test the Patch Analyzer with both held-out examples and an invalid file. Record what the API returned. | Explain the React and FastAPI workflow and operate the demo. |
| 3 | Results interpretation and documentation | Match the report's figures to `artifacts/study.json` and `artifacts/audit.json`. Compare K=2 and K=10 in the atlas. Reconcile PCA-space silhouette with common-space silhouette and check both submitted URLs. | Present the results, limitations and audit, then close with the team's completed work. |

## One practice session

1. Spend 20 minutes on the [learning guide](LEARNING_GUIDE.md). Each person explains one stage to the others without notes.
2. Spend 30 minutes on the assigned checks. Keep a short record of the commands, settings and observations. Run `.venv/bin/python -m pytest -q tests/test_science.py` from the project folder for the scientific checks.
3. Present the first 12 slides in 3-5 minutes using the [walkthrough](DEMO_WALKTHROUGH.md). Start the separate demo after the slide talk.
4. Take turns answering the [viva questions](VIVA_40.md). Practice why the labels were hidden, why the selected K is two, and why t-SNE shows a different structure from PCA.
5. Each member writes one or two accurate sentences about their completed work in `team.json`. Regenerate both documents using [the deliverables guide](DELIVERABLES.md), then create the individually named ZIP copies.

The assigned tasks are future work until each member completes them. The project implementation and drafting used Codex assistance. Describe personal verification, analysis, documentation and demonstration work as it actually happened.
