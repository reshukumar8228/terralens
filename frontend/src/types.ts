export type View = 'observatory' | 'projections' | 'clusters' | 'experiments' | 'analyzer' | 'evidence';
export interface PatchContext { runId: string; clusterId?: number; run?: Run; point?: Point; source?: 'live' }
export type XY = [number, number];
export interface Point { id: string; pca: XY; tsne: XY; cluster: number }
export interface Feature { name: string; value: number; zscore: number }
export interface Metrics {
  silhouette: number | null;
  davies_bouldin: number | null;
  calinski_harabasz: number | null;
  inertia: number | null;
  silhouette_original: number | null;
}
export interface Cluster {
  id: number; count: number; description: string; representatives: string[];
  boundary_samples: string[]; feature_profile: Feature[];
}
export interface Run {
  id: string; k: number; variance: number | null; components: number; seed: number;
  metrics: Metrics; runtime_seconds: number; stability: number | null; clusters: Cluster[];
  selection_reason?: string; holdout_metrics?: Record<string, number | null>;
}
export interface TSNERun {
  id: string; perplexity: number; seed: number; trustworthiness: number;
  runtime_seconds: number; points: XY[];
}
export interface ScreeningRun { k: number; variance: number | null; components: number; seed: number; metrics: Metrics; runtime_seconds: number; sample_size: number }
export interface StudyExperiments { screening?: ScreeningRun[]; screening_sample_size?: number; full_metric_sample_size?: number; ablations?: { name: string; k: number; components: number; metrics: Metrics; runtime_seconds: number }[]; reconstruction?: { variance: number; components: number; study_mse: number; holdout_mse: number }[]; comparison_rules?: string[]; units?: Record<string, string> }
export interface Study {
  project: { name: string; title: string; problem_id: string; course: string };
  dataset: { name: string; source_url: string; total_images: number; valid_images: number; image_width: number; image_height: number; channels: number; archive_sha256: string };
  preprocessing: { description: string; scaling: string; missing_value_policy: string; categorical_encoding: string; label_policy: string };
  split: { study_count: number; holdout_count: number; seed: number };
  quality: { unreadable_images: number; duplicate_images: number; missing_values: number; constant_features: number | string[]; notes: string[] };
  feature_names: string[];
  feature_families: { name: string; count: number; description: string }[];
  pca: { explained_variance_ratio: number[]; cumulative_variance: number[]; thresholds: { variance: number; components: number }[]; loadings: { component: number; features: { name: string; loading: number }[] }[]; pca2_trustworthiness?: number };
  selected_run_id: string;
  runs: Run[];
  points: Point[];
  tsne_runs: TSNERun[];
  experiments: StudyExperiments;
  limitations: string[];
  provenance: { created_at: string; seed: number; versions: Record<string, string>; selection_rule: string; metric_space: string; visual_sample_size: number; notes: string[] };
}
export interface Capabilities { max_experiment_samples: number; live_tsne: boolean; upload_max_bytes: number; storage: string; reference_run_id: string }
export interface ExperimentConfig { k: number; variance: number; seed: number; sample_size: number }
export interface Experiment { id: string; status: 'queued' | 'running' | 'completed' | 'failed'; stage?: string; config: ExperimentConfig; result?: Run & { points: Point[] }; error?: string; created_at?: string }
export interface Analysis { cluster: number; pca: XY; distance: number; relative_distance: number; reference_percentile: number; representatives: string[]; features: Feature[]; warnings: string[] }
export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
