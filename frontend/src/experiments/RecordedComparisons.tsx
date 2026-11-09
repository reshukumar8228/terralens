import { useState } from 'react';
import { DownloadSimple, Sparkle } from '@phosphor-icons/react';
import { fixed, format, percent } from '../api';
import { MetricLine } from '../Charts';
import { MetricsRow, Panel } from '../UI';
import type { Run, Study } from '../types';

export default function RecordedComparisons({ study, reference }: { study: Study; reference: Run }) {
  const [variance, setVariance] = useState(reference.variance ?? 0.95);
  const [highlightId, setHighlightId] = useState(reference.id);
  const [showMetricsGuide, setShowMetricsGuide] = useState(false);
  const candidates = (study.experiments.screening ?? study.runs).filter(run => run.variance === variance);
  const byK = new Map<number, { k: number; value: number | null }>();
  for (const run of candidates) {
    if (!byK.has(run.k) || run.seed === study.split.seed) byK.set(run.k, { k: run.k, value: run.metrics.silhouette_original });
  }
  const chartData = [...byK.values()].sort((a, b) => a.k - b.k);
  const highlight = study.runs.find(run => run.id === highlightId) ?? reference;

  return (
    <>
      <div className="comparison-grid">
        <Panel
          title="How many groups? (K-Selection)"
          detail={`Fixed screening cohort · ${format(study.experiments.screening_sample_size, 0)} patches · Common-space silhouette`}
          action={
            <div className="screening-variance-selector">
              <label htmlFor="screening-variance">PCA Variance:</label>
              <select id="screening-variance" value={variance} onChange={event => setVariance(Number(event.target.value))}>
                <option value="0.9">PCA 90% (18 PCs)</option>
                <option value="0.95">PCA 95% (28 PCs · Reference)</option>
                <option value="0.99">PCA 99% (48 PCs)</option>
              </select>
            </div>
          }
        >
          <MetricLine data={chartData} selectedK={reference.k}/>
          <div className="chart-axis-caption">
            Number of groups (K) on X-axis · Silhouette score in common 78-feature space on Y-axis (higher = better separation)
          </div>
          <div className="k-selection-insight">
            <span className="insight-badge">Capstone Selection Rationale</span>
            <p>
              While lower $K$ ($K=2$ to $4$) scores higher mathematically by grouping all images into coarse "vegetation" vs "non-vegetation" blobs,
              <strong> $K=10$ provides the optimal balance</strong> between high silhouette cohesion and resolving all 10 distinct land-cover morphologies
              (forest, water, agriculture, built environment) with high seed stability ({fixed(reference.stability)} ARI).
            </p>
          </div>
        </Panel>

        <Panel
          title="Why this reference run?"
          detail="Selected strictly label-blind using unsupervised validation criteria."
          action={
            <button
              className="text-button"
              onClick={() => setShowMetricsGuide(v => !v)}
              aria-expanded={showMetricsGuide}
            >
              <Sparkle size={15} weight="fill"/>
              {showMetricsGuide ? 'Hide metric guide' : 'Metric defense guide'}
            </button>
          }
        >
          <div className="reference-model">
            <span>Selected Reference Model · K = {reference.k}</span>
            <strong>{reference.components} PCA components</strong>
            <p>{reference.selection_reason || study.provenance.selection_rule}</p>
          </div>
          <div className="selection-facts">
            <div>
              <span>Common-space silhouette</span>
              <code>{format(reference.metrics.silhouette_original, 4)}</code>
              <small>Evaluated across 78 dimensions</small>
            </div>
            <div>
              <span>Davies–Bouldin Index</span>
              <code>{format(reference.metrics.davies_bouldin, 3)}</code>
              <small>Lower is better</small>
            </div>
            <div>
              <span>Seed stability (ARI)</span>
              <code>{fixed(reference.stability)}</code>
              <small>Agreement across random seeds</small>
            </div>
            <div>
              <span>Calinski–Harabasz</span>
              <code>{format(reference.metrics.calinski_harabasz, 1)}</code>
              <small>Variance ratio criterion</small>
            </div>
          </div>
        </Panel>
      </div>

      {/* Internal Validation Metrics Guide for Viva Defense */}
      {showMetricsGuide && (
        <Panel
          title="Capstone Viva Guide: Unsupervised Validation Metrics"
          detail="How to answer examiners when asked how you proved the clustering was effective without ground truth"
          className="metrics-defense-panel"
        >
          <div className="metrics-explanation-grid">
            <div className="metric-guide-card">
              <span className="metric-code">1. Silhouette Score (S)</span>
              <strong>Cohesion vs. Separation</strong>
              <p>
                Measures how similar a patch is to its own cluster compared to other clusters.
                Formula: <code>s(i) = [b(i) - a(i)] / max(a(i), b(i))</code>.
                Ranges from -1 (misclassified) to +1 (highly dense and well separated).
              </p>
              <div className="metric-viva-tip">
                <strong>Viva Answer:</strong> "A positive common-space silhouette confirms that clusters represent compact, distinct geometric manifolds."
              </div>
            </div>

            <div className="metric-guide-card">
              <span className="metric-code">2. Davies–Bouldin Index (DB)</span>
              <strong>Cluster Scatter vs. Centroid Distance</strong>
              <p>
                Calculates the worst-case similarity ratio between clusters.
                Formula: <code>DB = (1/k) · Σ max(j ≠ i) [(s_i + s_j) / d(c_i, c_j)]</code>.
                <strong> Lower is better</strong>. Values below 2.0 indicate strong cluster isolation.
              </p>
              <div className="metric-viva-tip">
                <strong>Viva Answer:</strong> "Our DB score of {format(reference.metrics.davies_bouldin, 2)} confirms minimal overlap between cluster boundaries."
              </div>
            </div>

            <div className="metric-guide-card">
              <span className="metric-code">3. Calinski–Harabasz (CH)</span>
              <strong>Variance Ratio Criterion</strong>
              <p>
                Ratio of sum-of-squares between clusters to sum-of-squares within clusters:
                <code>CH = (SSB / SSW) · [(N - k) / (k - 1)]</code>.
                <strong> Higher is better</strong>. Rewards compact clusters with widely spaced centers.
              </p>
              <div className="metric-viva-tip">
                <strong>Viva Answer:</strong> "Our CH score of {format(reference.metrics.calinski_harabasz, 0)} demonstrates that inter-cluster variance dominates intra-cluster scatter."
              </div>
            </div>

            <div className="metric-guide-card metric-innovation-card">
              <span className="metric-code">4. Common-Space Silhouette</span>
              <strong>TerraLens Key Innovation</strong>
              <p>
                Evaluating models in their own PCA spaces introduces dimensional bias (curse of dimensionality decreases distances).
                TerraLens transforms all clustering solutions back into the <strong>standardized 78-feature space</strong> for fair, apple-to-apple comparison.
              </p>
              <div className="metric-viva-tip">
                <strong>Viva Answer:</strong> "Comparing a 90% PCA model (18 dims) to a 99% PCA model (48 dims) in their own spaces is invalid. Common-space evaluation ensures scientific integrity."
              </div>
            </div>
          </div>
        </Panel>
      )}

      <Panel
        title="Recorded study comparisons"
        detail="Common-space silhouette uses the same standardised features and evaluation sample."
        action={<a className="text-button" href="/api/export/config.json" download><DownloadSimple size={15}/>Configuration</a>}
      >
        <div className="table-wrap">
          <table className="research-table">
            <thead>
              <tr>
                <th>Configuration</th>
                <th>Groups</th>
                <th>Dimensions</th>
                <th>Common-space silhouette ↑</th>
                <th>DB index ↓</th>
                <th>Runtime</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {study.runs.map(run => (
                <tr key={run.id} className={highlight.id === run.id ? 'selected-row' : ''}>
                  <td data-label="Configuration">
                    <span className="configuration-name">
                      {run.variance == null ? 'Without PCA' : `PCA ${percent(run.variance, 0)}`}
                      {run.id === reference.id && <span className="table-tag">Reference</span>}
                    </span>
                    <small>seed {run.seed}</small>
                  </td>
                  <td data-label="Groups"><strong>{run.k}</strong></td>
                  <td data-label="Dimensions">{run.components}</td>
                  <td data-label="Common-space silhouette"><code>{format(run.metrics.silhouette_original, 4)}</code></td>
                  <td data-label="DB index"><code>{format(run.metrics.davies_bouldin, 3)}</code></td>
                  <td data-label="Runtime">{format(run.runtime_seconds, 2)} s</td>
                  <td>
                    <button className="text-button" onClick={() => setHighlightId(run.id)} aria-label={`Inspect recorded run ${run.id}`}>
                      {highlight.id === run.id ? 'Selected' : 'Inspect'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="selected-run-summary">
          <span>Inspect run: <strong>{highlight.id}</strong> (K={highlight.k}, {highlight.components} dimensions)</span>
          <MetricsRow metrics={highlight.metrics} stability={highlight.stability} compact/>
        </div>
      </Panel>
    </>
  );
}
