import { useEffect, useState } from 'react';
import { ArrowClockwise, CaretDown, CaretUp, DownloadSimple, Flask, GraduationCap } from '@phosphor-icons/react';
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
  const [showPresentationGuide, setShowPresentationGuide] = useState(true);
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

      <div className="teacher-viva-section" style={{ marginTop: 0, marginBottom: '24px' }}>
        <button
          type="button"
          className="teacher-viva-toggle"
          onClick={() => setShowPresentationGuide(prev => !prev)}
          aria-expanded={showPresentationGuide}
        >
          <span className="viva-badge">
            <GraduationCap size={16} weight="bold" />
            Teacher Viva Guide · How to present the Experiment Bench
          </span>
          <span style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--color-muted)' }}>
            {showPresentationGuide ? 'Collapse Guide' : 'Expand Guide'}
            {showPresentationGuide ? <CaretUp size={14} /> : <CaretDown size={14} />}
          </span>
        </button>

        {showPresentationGuide && (
          <div className="teacher-viva-content">
            <div className="viva-qna-grid">
              <div className="viva-qna-card">
                <h5>1. What is the purpose of this Experiment Bench?</h5>
                <p>
                  In supervised learning, you tune hyperparameters to minimize cross-entropy loss. In unsupervised learning, there is no ground truth during training! The Experiment Bench lets us systematically evaluate how changing <strong>cluster count (K)</strong> and <strong>PCA variance retention (90% vs 95% vs 99%)</strong> alters cluster geometry, stability, and compactness.
                </p>
              </div>

              <div className="viva-qna-card">
                <h5>2. Why compare live runs against the frozen reference model?</h5>
                <p>
                  The reference model (K=10, 95% variance) was trained once on the complete 21,600-patch study cohort. The live runner computes instant fits on random subsamples (e.g. 1,000 patches). This tests sample-size robustness and convergence without requiring a multi-minute full-dataset retraining.
                </p>
              </div>

              <div className="viva-qna-card">
                <h5>3. How do you defend your choice of K=10 to the teacher?</h5>
                <p>
                  While purely mathematical metrics like Silhouette Score peak at very low K (e.g. K=2 or 3, grouping earth into just "water vs land"), such trivial partitions have zero practical remote-sensing utility. K=10 provides the optimal trade-off between statistical cohesion and land cover expressiveness across urban, agricultural, and hydrological domains.
                </p>
              </div>
            </div>

            <div className="viva-takeaway">
              <strong>Key Examiner Takeaway:</strong> "Unsupervised models must never be evaluated solely by a single metric. We use the Experiment Bench to prove stability across seeds, track silhouette trajectories across K, and demonstrate reproducible separation in a shared common space."
            </div>
          </div>
        )}
      </div>

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
