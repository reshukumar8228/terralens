import { CheckCircle, Play } from '@phosphor-icons/react';
import { format } from '../api';
import { CustomSelect, Notice, Panel } from '../UI';
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
            <CustomSelect
              id="variance"
              ariaLabel="PCA retained variance"
              value={config.variance}
              onChange={v => onChange({ ...config, variance: Number(v) })}
              options={[
                { value: 0.9, label: '90% · greater compression' },
                { value: 0.95, label: '95% · balanced retention' },
                { value: 0.99, label: '99% · more dimensions' },
              ]}
            />
          </div>
          <div className="paired-controls">
            <div className="control-field">
              <label htmlFor="seed">Random seed</label>
              <input id="seed" type="number" min="0" max="9999" step="1" value={config.seed}
                onChange={event => onChange({ ...config, seed: Number(event.target.value) })}/>
            </div>
            <div className="control-field">
              <label htmlFor="sample-size">Sample size</label>
              <CustomSelect
                id="sample-size"
                ariaLabel="Sample size"
                value={config.sample_size}
                onChange={s => onChange({ ...config, sample_size: Number(s) })}
                options={sampleOptions.map(count => ({
                  value: count,
                  label: `${format(count, 0)} patches`,
                }))}
              />
            </div>
          </div>
          {tsneMaximum != null && (
            <div className="control-field">
              <label htmlFor="live-perplexity">Live t-SNE projection</label>
              <CustomSelect
                id="live-perplexity"
                ariaLabel="Live t-SNE projection"
                value={config.tsne_perplexity ?? ''}
                onChange={val => changePerplexity(String(val))}
                options={[
                  { value: '', label: 'Off · PCA and K-Means only' },
                  { value: 10, label: 'Perplexity 10' },
                  { value: 30, label: 'Perplexity 30' },
                  { value: 50, label: 'Perplexity 50' },
                ]}
              />
              <span className="field-hint" id="live-tsne-limit">Live t-SNE fits up to {format(tsneMaximum, 0)} patches on this host.</span>
            </div>
          )}
          <button type="submit" className="button button-primary" disabled={busy}>
            {busy ? <span className="button-spinner" aria-hidden="true"/> : <Play size={17} weight="bold"/>}
            <span>{busy ? 'Running experiment…' : 'Run experiment'}</span>
          </button>
        </fieldset>
      </form>
      {error && <Notice warning>{error}</Notice>}
      <ul className="experiment-assurances">
        <li><CheckCircle size={15}/><span>The reference study remains unchanged.</span></li>
        <li><CheckCircle size={15}/><span>Experiments run on the current host.</span></li>
      </ul>
    </Panel>
  );
}
