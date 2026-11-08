# Unify Platform to 10 Groups Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the 2-group clustering model completely and establish the 10-group model (`pca95-k10-s42`) as the universal standard across the entire TerraLens platform.

**Architecture:** Replace `model.joblib` and `audit.json` with the 10-group model and audit artifacts; update `study.json` so `selected_run_id` is `pca95-k10-s42` and all preview points are tagged with their 10 cluster IDs (0–9); streamline the backend API to serve the 10-group model as the single primary run; clean up the frontend mode selector; and align all tests and submission deliverables.

**Tech Stack:** Python 3.12, FastAPI, scikit-learn, NumPy, React 19, TypeScript, Vite 7.

---

## Tasks

### Task 1: Migrate Core Artifacts to 10 Groups
- [ ] Promote `artifacts/comparison-model.joblib` to `artifacts/model.joblib`.
- [ ] Promote `artifacts/comparison-audit.json` to `artifacts/audit.json`.
- [ ] Update `artifacts/study.json`:
  - Set `selected_run_id: "pca95-k10-s42"`.
  - Re-label the 3,000 points in `points` using the 10-group model predictions.
  - Set `selection_reason` to explain the 10-group unsupervised alignment.
- [ ] Re-calculate `study.json` SHA-256 and update `frozen_study_sha256` in `artifacts/audit.json`.
- [ ] Update `artifacts/config.json` with `selected_run_id: "pca95-k10-s42"`.

### Task 2: Backend Simplification & Routing Alignment
- [ ] Update `backend/terralens/api/resources.py`:
  - `analysis_run_ids` returns `[study["selected_run_id"]]`.
  - `uses_comparison` returns `False`.
- [ ] Verify `backend/terralens/inference.py`:
  - `_load_neighbor_groups` and `analyze_image` default cleanly to the 10-group model.

### Task 3: Frontend Cleanup & UI Build
- [ ] In `frontend/src/Analyzer.tsx`, ensure clean single-mode display without mode-switching clutter.
- [ ] Run `npm --prefix frontend run build` and ensure TypeScript compilation passes with zero errors.

### Task 4: Automated Test Suite Alignment
- [ ] Update `tests/test_api.py` to verify the 10-group primary model.
- [ ] Update `tests/test_science.py` to verify the 10-group points reproducibility.
- [ ] Run `PYTHONPATH=backend .venv/bin/python -m pytest -v` and confirm all tests pass.

### Task 5: Deliverables Regeneration & Final Packaging
- [ ] Populate `team.json` with complete contribution descriptions and institution name.
- [ ] Run `PYTHONPATH=backend .venv/bin/python scripts/build_deliverables.py` to regenerate the report PDF.
- [ ] Run `node scripts/build_presentation.mjs` to regenerate the presentation deck.
- [ ] Run `.venv/bin/python scripts/package_submission.py --final` to generate the three `INT396_<RegNo>.zip` packages.
