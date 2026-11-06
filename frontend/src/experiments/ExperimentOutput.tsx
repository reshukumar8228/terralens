import { CheckCircle, DownloadSimple, Flask, WarningCircle } from '@phosphor-icons/react';
import { downloadJson, format, percent } from '../api';
import { Scatter } from '../Charts';
import { MetricsRow, Notice, Panel } from '../UI';
import type { Experiment, ExperimentResult, PatchContext } from '../types';

type SelectPatch = (id: string, context?: PatchContext) => void;

function RunResult({ job, result, selectPatch }: { job: Experiment; result: ExperimentResult; selectPatch: SelectPatch }) {
  function inspectPoint(id: string) {
    const point = result.points.find(item => item.id === id);
    if (point) selectPatch(id, { runId: result.id, run: result, point, clusterId: point.cluster, source: 'live' });
  }

  return (
    <>
      <div className="result-summary">
        <span className="success-label" role="status"><CheckCircle size={17}/>Measured run completed</span>
        <button className="text-button" onClick={() => downloadJson(job, `terralens-${job.id}.json`)}>
          <DownloadSimple size={15}/>Export run
        </button>
      </div>
      <MetricsRow metrics={result.metrics} compact/>
      <div className="live-projection-grid">
        <section>
          <h3>PCA projection</h3>
          <Scatter points={result.points} projection="pca" compact onSelect={inspectPoint}/>
          <p className="caption">
            PC1 and PC2 of the {result.components}-component K-Means input.
            {result.retained_variance != null && ` The retained components explain ${percent(result.retained_variance, 2)} of variance.`}
          </p>
        </section>
        {result.tsne && (
          <section>
            <h3>Live t-SNE projection</h3>
            <Scatter points={result.points} projection="tsne" compact onSelect={inspectPoint}/>
            <p className="caption">
              Perplexity {result.tsne.perplexity} · trustworthiness {format(result.tsne.trustworthiness)}
              {' '}· fit {format(result.tsne.runtime_seconds, 2)} s
            </p>
          </section>
        )}
      </div>
      {result.tsne && <p className="caption">Both plots show the same patches, coloured by K-Means assignments from PCA space.</p>}
      <div className="plot-metadata">
        <span><strong>{format(result.points.length, 0)}</strong> patches</span>
        <span><strong>{format(result.runtime_seconds, 2)} s</strong> total measured runtime</span>
      </div>
    </>
  );
}

export default function ExperimentOutput({ job, selectPatch }: { job: Experiment | null; selectPatch: SelectPatch }) {
  let content;
  if (!job) {
    content = (
      <div className="experiment-empty">
        <Flask size={44} weight="duotone"/>
        <h3>Set the parameters, then run the experiment</h3>
        <p>Try changing K, retained variance, or t-SNE perplexity.</p>
      </div>
    );
  } else if (job.status === 'queued' || job.status === 'running') {
    content = (
      <div className="job-progress" role="status">
        <div className="job-progress-icon"><Flask size={34}/></div>
        <h3>{job.status === 'queued' ? 'Your experiment is queued.' : 'Computing your experiment'}</h3>
        <p>{job.stage || 'Preparing features and fitting the model…'}</p>
        <div className="progress-track" aria-hidden="true"><span/></div>
      </div>
    );
  } else if (job.status === 'failed') {
    content = (
      <div className="empty-state" role="alert">
        <WarningCircle size={34}/><h3>The experiment could not finish.</h3>
        <p>{job.error || 'Try a smaller sample or run the experiment again.'}</p>
      </div>
    );
  } else {
    content = job.result
      ? <RunResult job={job} result={job.result} selectPatch={selectPatch}/>
      : <Notice>The completed run has no result payload.</Notice>;
  }
  const detail = job
    ? `Run ${job.id.slice(0, 12)} · K ${job.config.k} · PCA target ${percent(job.config.variance, 0)} · seed ${job.config.seed}`
    : 'Results for your current settings.';
  return (
    <Panel title="The experiment notebook" detail={detail} className="experiment-result">
      {content}
    </Panel>
  );
}
