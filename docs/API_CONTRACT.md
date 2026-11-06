# API contract v1

All routes under `/api`. JSON numbers are finite or null. No class labels in fitting or default dataset responses. The immutable reference bundle is `artifacts/study.json`. The label audit is separate `artifacts/audit.json`. Anonymous preview images live in `artifacts/thumbnails/{id}.jpg`.

## GET /study
Returns `{project, dataset, preprocessing, split, quality, feature_names, feature_families, pca, selected_run_id, runs, points, tsne_runs, experiments, limitations, provenance}`.

- `project`: `{name,title,problem_id,course}`.
- `dataset`: `{name,source_url,total_images,valid_images,image_width,image_height,channels,archive_sha256}`.
- `split`: `{study_count,holdout_count,seed}`.
- `quality`: `{unreadable_images,duplicate_images,missing_values,constant_features,notes:string[]}`.
- `preprocessing`: `{description,scaling,missing_value_policy,categorical_encoding,label_policy}`.
- `feature_names`: string[]. `feature_families`: `[{name,count,description}]`.
- `pca`: `{explained_variance_ratio:number[],cumulative_variance:number[],thresholds:[{variance,components}],loadings:[{component,features:[{name,loading}]}]}`.
- `runs`: `[{id,k,variance:number|null,components,seed,metrics:{silhouette,davies_bouldin,calinski_harabasz,inertia,silhouette_original},runtime_seconds,stability:number|null,clusters:[{id,count,description,representatives:string[],boundary_samples:string[],feature_profile:[{name,value,zscore}]}],selection_reason?:string,holdout_metrics?:object}]`.
- `points`: `[{id,pca:[number,number],tsne:[number,number],cluster:number}]`; same order/IDs used for all t-SNE runs, reference run cluster assignments.
- `tsne_runs`: `[{id,perplexity,seed,trustworthiness,runtime_seconds,points:[number,number][]}]`.
- `experiments`: free structured JSON of ablations and sensitivity tables with declared units/spaces.
- `provenance`: `{created_at,seed,versions,selection_rule,metric_space,visual_sample_size,notes:string[]}`.
- `limitations`: string[].

## Other endpoints
- `GET /health` -> `{status,study_ready,version}`.
- `GET /patches/{id}.jpg` -> anonymous JPEG, or 404.
- `GET /audit` -> separate frozen study audit JSON (reference labels used only after fitting and selection). Supply `?run_id=pca95-k10-s42` for the ten-group comparison audit when available.
- `GET /features` -> `{features:[{name,family,description}], ...}`.
- `POST /experiments` body `{k:2..15,variance:0.9|0.95|0.99,seed:0..9999,sample_size:200..3000,tsne_perplexity:10|30|50|null}` -> `{id,status}`. Backend may cap hosted samples, explicitly advertise in `/capabilities`.
- `GET /experiments/{id}` -> `{id,status:queued|running|completed|failed,stage,config,result?:{...run,points:[{id,pca,cluster,tsne?}],tsne?:{perplexity,trustworthiness,runtime_seconds},...},error?:string}`. An optional new t-SNE fit runs on the same retained PCA features and uses the same point IDs and existing K-Means group colours.
- `GET /experiments` -> `{experiments:[job...]}` newest first.
- `POST /analyze` multipart `file` and optional `?run_id=pca95-k10-s42` -> `{run_id,cluster,cluster_description,pca:[x,y],distance,alternate_cluster,alternate_distance,margin,relative_distance,reference_percentile,representatives:string[],neighbors:[{id,distance}],neighbor_scope,features:[{name,value,zscore}],warnings:string[],cohort_clusters?:number[]}`. The reference run is the default. The comparison returns `cohort_clusters` in the order of `study.points`. Distances and neighbors use the full retained PCA space. Neighbors are ranked within the assigned group of the bundled preview cohort. The browser can export this response as JSON without the input image.
- `GET /export/study.json`, `/export/metrics.csv`, `/export/config.json` -> downloadable recorded data. `GET /export/experiments/{id}.json` downloads a runtime job record.
- `GET /capabilities` -> `{max_experiment_samples,live_tsne:true,max_live_tsne_samples,upload_max_bytes,storage,reference_run_id,analysis_runs:string[]}`. Only bundled analysis runs are selectable.

FastAPI serves `/` and built frontend assets if `frontend/dist` exists. Vite dev proxies `/api` to `http://127.0.0.1:8000`. Frontend reads only this contract and must not fabricate fallback numbers if data unavailable.

## ML Python integration
`backend/terralens/features.py`: `extract_features(PIL.Image)->np.ndarray`, `FEATURE_NAMES`, feature dictionary.
`backend/terralens/inference.py`: `analyze_image(image, artifacts_dir, *, comparison=False)->dict` applies saved transforms and ranks reference patches.

`backend/terralens/experiments.py`: `run_experiment(config, artifacts_dir)->dict` fits independently on the compact study feature matrix. The route modules in `backend/terralens/api/` handle the HTTP contract.
`scripts/prepare_study.py`: runnable full download/study command, configurable performance bounds; stores compact inference artifacts and reference JSON in `artifacts/`.
