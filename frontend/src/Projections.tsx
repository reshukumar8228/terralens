import { ArrowDown, DownloadSimple, Info } from '@phosphor-icons/react';
import { useMemo, useState } from 'react';
import { format, percent, titleCase } from './api';
import { Scatter, VarianceChart } from './Charts';
import { ClusterPills, Notice, PageTitle, Panel, Patch } from './UI';
import type { Run, Study } from './types';

export default function Projections({ study, run, selectPatch }: { study: Study; run: Run; selectPatch: (id: string) => void }) {
  const [tsneId, setTsneId] = useState(study.tsne_runs.find(t => t.perplexity === 30 && t.seed === study.split.seed)?.id || study.tsne_runs[0]?.id || '');
  const [filter, setFilter] = useState<number | null>(null);
  const [componentIndex, setComponentIndex] = useState(0);
  const [explain, setExplain] = useState(false);
  const tsne = study.tsne_runs.find(r => r.id === tsneId) || study.tsne_runs[0];
  const sample = useMemo(() => study.points.filter(p => filter == null || p.cluster === filter).slice(0, 10), [study.points, filter]);
  const loadings = study.pca.loadings[componentIndex];
  const maxLoading = Math.max(...(loadings?.features.map(f => Math.abs(f.loading)) || [1]));
  return <>
    <PageTitle title="Projection lab" text="Two views of the same patches. Explore what each representation reveals."><button className="button button-outline" onClick={() => setExplain(v => !v)} aria-expanded={explain}><Info size={17}/>Reading these plots</button><a className="button button-primary" href="/api/export/study.json" download><DownloadSimple size={17}/>Export study</a></PageTitle>
    {explain ? <Notice><strong>PCA preserves variation; t-SNE explores neighbourhoods.</strong> A point represents one patch. Colours show K-Means assignments from the selected PCA space. Apparent gaps, island sizes, and map orientation in t-SNE do not establish true land classes. Both plots use the same {format(study.points.length, 0)} patch IDs.</Notice> : null}
    <div className="lab-toolbar"><ClusterPills clusters={run.clusters} selected={filter} onSelect={setFilter}/><span className="toolbar-note"><span className="status-dot"/>Linked cohort · labels hidden</span></div>
    <div className="projection-grid"><Panel title="PCA" detail={`Linear projection · ${percent(study.pca.cumulative_variance[1])} in these two dimensions`} action={<span className="method-chip">Global variation</span>}>
      <Scatter points={study.points} projection="pca" filter={filter} onSelect={selectPatch} xLabel={`PC 1 · ${percent(study.pca.explained_variance_ratio[0])}`} yLabel="PC 2"/>
      <div className="plot-metadata"><span><strong>{run.components}</strong> dimensions used for clustering</span><span><strong>{percent(run.variance)}</strong> target retained variance</span></div>
    </Panel><Panel title="t-SNE" detail="Nonlinear projection · local neighbourhoods" action={<span className="method-chip">Local structure</span>}>
      <div className="tsne-controls"><label htmlFor="tsne-run">Recorded configuration</label><select id="tsne-run" value={tsne?.id || ''} onChange={e => setTsneId(e.target.value)}>{study.tsne_runs.map(t => <option key={t.id} value={t.id}>Perplexity {t.perplexity} · seed {t.seed}</option>)}</select></div>
      {tsne ? <Scatter points={study.points} coordinates={tsne.points} projection="tsne" filter={filter} onSelect={selectPatch}/> : <Notice>No t-SNE run is available in this study.</Notice>}
      <div className="plot-metadata"><span><strong>{format(tsne?.trustworthiness)}</strong> trustworthiness</span><span><strong>{format(tsne?.runtime_seconds, 1)} s</strong> recorded runtime</span></div>
    </Panel></div>
    <Notice>The K-Means model uses {run.components} PCA components. These two-dimensional charts help interpret its groups; clustering is not performed on the t-SNE map.</Notice>
    <div className="linked-patches"><div><h3>From points to places</h3><p>{filter == null ? 'A shared sample from both views.' : `A selection from group ${String(filter + 1).padStart(2, '0')}.`}</p></div><div className="linked-patch-grid">{sample.map(p => <Patch key={p.id} id={p.id} onSelect={selectPatch}/>)}</div></div>
    <div className="analysis-grid"><Panel title="How much variation remains?" detail="PCA cumulative variance and individual component contributions"><VarianceChart ratios={study.pca.explained_variance_ratio} cumulative={study.pca.cumulative_variance} threshold={run.variance || .95}/><div className="variance-thresholds">{study.pca.thresholds.map(t => <div key={t.variance}><span>{percent(t.variance, 0)} retained</span><strong>{t.components}<small>components</small></strong></div>)}</div></Panel><Panel title="What shapes a component?" detail="Feature loadings describe direction, not causation." action={<select aria-label="Principal component loadings" value={componentIndex} onChange={e => setComponentIndex(Number(e.target.value))}>{study.pca.loadings.map((l, i) => <option value={i} key={l.component}>PC {l.component + (l.component === 0 ? 1 : 0)}</option>)}</select>}><div className="loading-rows">{loadings?.features.slice(0, 10).map(f => <div key={f.name}><div><span title={f.name}>{titleCase(f.name)}</span><code>{f.loading > 0 ? '+' : ''}{format(f.loading)}</code></div><div className="loading-track"><i className={f.loading < 0 ? 'is-negative' : ''} style={{ width: `${Math.abs(f.loading) / maxLoading * 100}%` }}/></div></div>)}</div></Panel></div>
    <div className="method-callout"><ArrowDown size={22}/><p><strong>Try changing t-SNE perplexity.</strong> Compare which local groupings persist across settings and seeds. Layout changes are part of the result.</p></div>
  </>;
}
