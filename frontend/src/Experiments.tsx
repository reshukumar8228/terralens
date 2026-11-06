import { useEffect, useState } from 'react';
import { ArrowClockwise, DownloadSimple, Flask } from '@phosphor-icons/react';
import { format, percent, request } from './api';
import { Notice, PageTitle, Panel } from './UI';
import ExperimentControls from './experiments/ExperimentControls';
import ExperimentOutput from './experiments/ExperimentOutput';
import RecordedComparisons from './experiments/RecordedComparisons';
import type { Capabilities, Experiment, ExperimentConfig, PatchContext, Run, Study } from './types';
import './experiments/experiments.css';

interface Props {
  study: Study;
  run: Run;
  capabilities: Capabilities;
  selectPatch: (id: string, context?: PatchContext) => void;
}

type AcceptedJob = Pick<Experiment, 'id' | 'status'>;

export default function Experiments({ study, run, capabilities, selectPatch }: Props) {
  const maximum = capabilities.max_experiment_samples;
  const tsneMaximum = capabilities.live_tsne ? capabilities.max_live_tsne_samples : undefined;
  const [config, setConfig] = useState<ExperimentConfig>({
    k: run.k, variance: run.variance ?? 0.95, seed: study.split.seed, sample_size: Math.min(1000, maximum),
  });
  const [job, setJob] = useState<Experiment | null>(null);
  const [activity, setActivity] = useState<'submit' | 'history' | null>(null);
  const [error, setError] = useState('');
  const [history, setHistory] = useState<Experiment[]>([]);
  const activeJobId = job?.status === 'queued' || job?.status === 'running' ? job.id : null;
  const busy = Boolean(activity || activeJobId);

  useEffect(() => {
    const controller = new AbortController();
    request<{ experiments: Experiment[] }>('/experiments', { signal: controller.signal })
      .then(data => setHistory(data.experiments))
      .catch(cause => { if (!controller.signal.aborted) setError((cause as Error).message); });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!activeJobId) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;

    async function poll() {
      try {
        const updated = await request<Experiment>(`/experiments/${activeJobId}`, { signal: controller.signal });
        if (controller.signal.aborted) return;
        setJob(updated);
        if (updated.status === 'completed' || updated.status === 'failed') {
          setHistory(items => [updated, ...items.filter(item => item.id !== updated.id)].slice(0, 50));
        } else {
          timer = setTimeout(poll, 1000);
        }
      } catch (cause) {
        if (!controller.signal.aborted) {
          setError((cause as Error).message);
          setJob(current => current && {
            ...current, status: 'failed', error: 'Connection interrupted. Check the saved job in Recent live runs.',
          });
        }
      }
    }

    timer = setTimeout(poll, 700);
    return () => { controller.abort(); clearTimeout(timer); };
  }, [activeJobId]);

  async function startExperiment() {
    if (busy) return;
    setError('');
    setActivity('submit');
    try {
      const created = await request<AcceptedJob>('/experiments', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(config),
      });
      setJob({ ...created, config });
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setActivity(null);
    }
  }

  async function refreshHistory() {
    try {
      const data = await request<{ experiments: Experiment[] }>('/experiments');
      setHistory(data.experiments);
    } catch (cause) { setError((cause as Error).message); }
  }

  async function openHistory(id: string) {
    if (busy) return;
    setError('');
    setActivity('history');
    try { setJob(await request<Experiment>(`/experiments/${id}`)); }
    catch (cause) { setError((cause as Error).message); }
    finally { setActivity(null); }
  }

  return (
    <>
      <PageTitle title="Experiment bench" text="Change the settings and measure what happens to the same sample.">
        <a className="button button-outline" href="/api/export/metrics.csv" download><DownloadSimple size={17}/>Metrics CSV</a>
      </PageTitle>
      <div className="experiment-grid">
        <ExperimentControls config={config} onChange={setConfig} onSubmit={() => { void startExperiment(); }}
          maximum={maximum} tsneMaximum={tsneMaximum} busy={busy} error={error}/>
        <ExperimentOutput job={job} selectPatch={selectPatch}/>
      </div>
      <Notice>
        Live PCA and K-Means runs use up to {format(maximum, 0)} patches on this host.
        {tsneMaximum && ` Live t-SNE is available for up to ${format(tsneMaximum, 0)} patches.`}
        {' '}Cluster IDs can change between fits.
      </Notice>
      <RecordedComparisons study={study} reference={run}/>
      <Panel title="Recent live runs" detail="Anonymous runs on this service, separate from the frozen reference."
        action={<button className="text-button" onClick={() => { void refreshHistory(); }}><ArrowClockwise size={15}/>Refresh</button>}>
        {history.length ? (
          <div className="session-runs">
            {history.map(item => (
              <button key={item.id} disabled={busy} onClick={() => { void openHistory(item.id); }} className="session-run">
                <Flask size={20}/>
                <span>
                  <strong>K {item.config.k} · PCA {percent(item.config.variance, 0)}
                    {item.config.tsne_perplexity && ` · t-SNE ${item.config.tsne_perplexity}`}
                  </strong>
                  <small>{item.id.slice(0, 16)} · {format(item.config.sample_size, 0)} patches</small>
                </span>
                <span className={`job-status status-${item.status}`}>{item.status}</span>
              </button>
            ))}
          </div>
        ) : <p className="empty-inline">Recent experiments on this service will appear here.</p>}
        <p className="panel-footnote">{capabilities.storage}</p>
      </Panel>
    </>
  );
}
