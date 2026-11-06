import { CheckCircle, Play } from '@phosphor-icons/react';
import { format } from '../api';
import { Notice, Panel } from '../UI';
import type { ExperimentConfig, LivePerplexity } from '../types';

interface Props {
  config: ExperimentConfig;
  onChange: (config: ExperimentConfig) => void;
  onSubmit: () => void;
  maximum: number;
  tsneMaximum?: number;
  busy: boolean;
  error: string;
}

export default function ExperimentControls({ config, onChange, onSubmit, maximum, tsneMaximum, busy, error }: Props) {
  const sampleLimit = config.tsne_perplexity != null && tsneMaximum ? tsneMaximum : maximum;
  const sampleOptions = [...new Set([200, 500, 1000, 2000, 3000, sampleLimit])]
    .filter(count => count <= sampleLimit)
    .sort((a, b) => a - b);

  function changePerplexity(value: string) {
    const perplexity = value ? Number(value) as LivePerplexity : undefined;
    onChange({
      ...config,
      tsne_perplexity: perplexity,
      sample_size: perplexity && tsneMaximum ? Math.min(config.sample_size, tsneMaximum) : config.sample_size,
    });
  }

  return (
    <Panel title="Run a live experiment" detail="Fit PCA and K-Means on a fresh sample of anonymous descriptors." className="experiment-controls">
      <form onSubmit={event => { event.preventDefault(); onSubmit(); }}>
        <fieldset className="experiment-fields" disabled={busy}>
          <div className="control-field">
            <label htmlFor="clusters-k">Number of groups <output>{config.k}</output></label>
            <input id="clusters-k" type="range" min="2" max="15" value={config.k}
              onChange={event => onChange({ ...config, k: Number(event.target.value) })}/>
            <div className="range-labels"><span>2 groups</span><span>15 groups</span></div>
          </div>
          <div className="control-field">
            <label htmlFor="variance">PCA retained variance</label>
            <select id="variance" value={config.variance}
              onChange={event => onChange({ ...config, variance: Number(event.target.value) })}>
              <option value="0.9">90% · greater compression</option>
              <option value="0.95">95% · balanced retention</option>
              <option value="0.99">99% · more dimensions</option>
            </select>
          </div>
          <div className="paired-controls">
            <div className="control-field">
              <label htmlFor="seed">Random seed</label>
              <input id="seed" type="number" min="0" max="9999" step="1" value={config.seed}
                onChange={event => onChange({ ...config, seed: Number(event.target.value) })}/>
            </div>
            <div className="control-field">
              <label htmlFor="sample-size">Sample size</label>
              <select id="sample-size" value={config.sample_size}
                onChange={event => onChange({ ...config, sample_size: Number(event.target.value) })}>
                {sampleOptions.map(count => <option value={count} key={count}>{format(count, 0)} patches</option>)}
              </select>
            </div>
          </div>
          {tsneMaximum != null && (
            <div className="control-field">
              <label htmlFor="live-perplexity">Live t-SNE projection</label>
              <select id="live-perplexity" value={config.tsne_perplexity ?? ''} aria-describedby="live-tsne-limit"
                onChange={event => changePerplexity(event.target.value)}>
                <option value="">Off · PCA and K-Means</option>
                {[10, 30, 50].map(value => <option value={value} key={value}>Perplexity {value}</option>)}
              </select>
              <p id="live-tsne-limit" className="caption">
                Live t-SNE uses up to {format(tsneMaximum, 0)} of the same patches. The points keep their K-Means groups.
              </p>
            </div>
          )}
          <button className="button button-primary run-button" type="submit">
            {busy ? <><span className="loading-dots"/>Computing experiment</> : <><Play size={17} weight="fill"/>Run experiment</>}
          </button>
        </fieldset>
      </form>
      <p className="caption">The result is computed for these settings. Recorded study runs are available below.</p>
      {error && <Notice warning>{error}</Notice>}
      <div className="experiment-capability"><CheckCircle size={16}/><span>Labels excluded from model fitting</span></div>
    </Panel>
  );
}
