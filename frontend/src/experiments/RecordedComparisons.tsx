import { useState } from 'react';
import { DownloadSimple } from '@phosphor-icons/react';
import { fixed, format, percent } from '../api';
import { MetricLine } from '../Charts';
import { MetricsRow, Panel } from '../UI';
import type { Run, Study } from '../types';

export default function RecordedComparisons({ study, reference }: { study: Study; reference: Run }) {
  const [variance, setVariance] = useState(reference.variance ?? 0.95);
  const [highlightId, setHighlightId] = useState(reference.id);
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
        <Panel title="How many groups?" detail={`Fixed screening cohort · ${format(study.experiments.screening_sample_size, 0)} patches`}
          action={
            <select aria-label="PCA variance for silhouette chart" value={variance} onChange={event => setVariance(Number(event.target.value))}>
              <option value="0.9">PCA 90%</option><option value="0.95">PCA 95%</option><option value="0.99">PCA 99%</option>
            </select>
          }>
          <MetricLine data={chartData} selectedK={reference.k}/>
          <div className="chart-axis-caption">Number of groups (K) · silhouette in the common standardised feature space</div>
        </Panel>
        <Panel title="Why this reference run?" detail="Selection used the recorded, label-blind metrics.">
          <div className="reference-model">
            <span>K = {reference.k}</span><strong>{reference.components} PCA components</strong>
            <p>{reference.selection_reason || study.provenance.selection_rule}</p>
          </div>
          <div className="selection-facts">
            <div><span>Common-space silhouette</span><code>{format(reference.metrics.silhouette_original)}</code></div>
            <div><span>Seed stability (ARI)</span><code>{fixed(reference.stability)}</code></div>
            <div><span>Random seed</span><code>{reference.seed}</code></div>
          </div>
        </Panel>
      </div>
      <Panel title="Recorded study comparisons" detail="Common-space silhouette uses the same standardised features and evaluation sample."
        action={<a className="text-button" href="/api/export/config.json" download><DownloadSimple size={15}/>Configuration</a>}>
        <div className="table-wrap">
          <table className="research-table">
            <thead><tr><th>Configuration</th><th>Groups</th><th>Dimensions</th><th>Common-space silhouette ↑</th><th>DB index ↓</th><th>Runtime</th><th></th></tr></thead>
            <tbody>
              {study.runs.map(run => (
                <tr key={run.id} className={highlight.id === run.id ? 'selected-row' : ''}>
                  <td data-label="Configuration">
                    <span className="configuration-name">{run.variance == null ? 'Without PCA' : `PCA ${percent(run.variance, 0)}`}
                      {run.id === reference.id && <span className="table-tag">Reference</span>}
                    </span>
                    <small>seed {run.seed}</small>
                  </td>
                  <td data-label="Groups">{run.k}</td>
                  <td data-label="Dimensions">{run.components}</td>
                  <td data-label="Common-space silhouette">{format(run.metrics.silhouette_original)}</td>
                  <td data-label="DB index">{format(run.metrics.davies_bouldin)}</td>
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
        <div className="selected-run-summary"><span>{highlight.id}</span><MetricsRow metrics={highlight.metrics} stability={highlight.stability} compact/></div>
      </Panel>
    </>
  );
}
