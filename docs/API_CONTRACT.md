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
- `GET /audit` -> separate frozen study audit JSON (reference labels used only after fitting/selection).
- `GET /features` -> `{features:[{name,family,description}], ...}`.
- `POST /experiments` body `{k:2..15,variance:0.9|0.95|0.99,seed:0..9999,sample_size:200..3000}` -> `{id,status}`. Backend may cap hosted samples, explicitly advertise in `/capabilities`.
- `GET /experiments/{id}` -> `{id,status:queued|running|completed|failed,stage,config,result?:{...run,points:[{id,pca,cluster}],...},error?:string}`. This is a live bounded K-Means-on-PCA experiment. No live t-SNE rerun required on free host; preset t-SNE studies are genuine saved runs.
- `GET /experiments` -> `{experiments:[job...]}` newest first.
- `POST /analyze` multipart `file` -> `{cluster,pca:[x,y],distance,relative_distance,reference_percentile,representatives:string[],features:[{name,value,zscore}],warnings:string[]}`. No class probability or t-SNE coordinate. Saved reference pipeline only.
- `GET /export/study.json`, `/export/metrics.csv`, `/export/config.json` -> downloadable recorded data.
- `GET /capabilities` -> `{max_experiment_samples,live_tsne:false,upload_max_bytes,storage,reference_run_id}`.

FastAPI serves `/` and built frontend assets if `frontend/dist` exists. Vite dev proxies `/api` to `http://127.0.0.1:8000`. Frontend reads only this contract and must not fabricate fallback numbers if data unavailable.

## ML Python integration
`backend/terralens/features.py`: `extract_features(PIL.Image)->np.ndarray`, `FEATURE_NAMES`, feature dictionary.
`backend/terralens/pipeline.py`: `analyze_image(image, artifacts_dir:Path)->dict`, `run_experiment(config:dict, artifacts_dir:Path)->dict`. These load saved artifact state and must not refit on upload. `run_experiment` may use the bundled compact study feature matrix.
`scripts/prepare_study.py`: runnable full download/study command, configurable performance bounds; stores compact inference artifacts and reference JSON in `artifacts/`.
