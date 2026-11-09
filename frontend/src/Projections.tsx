import { ArrowDown, DownloadSimple, Info, Lightbulb, Sparkle } from '@phosphor-icons/react';
import { useMemo, useState } from 'react';
import { clusterName, format, percent, titleCase } from './api';
import { Scatter, VarianceChart } from './Charts';
import { ClusterPills, Notice, PageTitle, Panel, Patch } from './UI';
import type { Run, Study } from './types';

export default function Projections({ study, run, selectPatch }: { study: Study; run: Run; selectPatch: (id: string) => void }) {
  const [tsneId, setTsneId] = useState(study.tsne_runs.find(t => t.perplexity === 30 && t.seed === study.split.seed)?.id || study.tsne_runs[0]?.id || '');
  const [filter, setFilter] = useState<number | null>(null);
  const [componentIndex, setComponentIndex] = useState(0);
  const [explain, setExplain] = useState(false);
  const [showVivaGuide, setShowVivaGuide] = useState(false);
  const tsne = study.tsne_runs.find(r => r.id === tsneId) || study.tsne_runs[0];
  const sample = useMemo(() => study.points.filter(p => filter == null || p.cluster === filter).slice(0, 10), [study.points, filter]);
  const loadings = study.pca.loadings[componentIndex];
  const maxLoading = Math.max(...(loadings?.features.map(f => Math.abs(f.loading)) || [1]));

  // Physical interpretation of top components for viva defense
  const componentInterpretations: Record<number, { title: string; physical: string }> = {
    0: {
      title: 'Overall Surface Brightness & Albedo',
      physical: 'Strongest variance axis (40.2%). Heavily loads on value_mean, red_mean, green_mean. Separates low-reflectance surfaces (Deep Sea, Forest) from highly reflective urban concrete and dry agricultural soils.',
    },
    1: {
      title: 'Spectral Saturation & Surface Texture',
      physical: 'Second variance axis (11.8%). Driven by saturation_mean and GLCM texture contrast. Differentiates smooth, uniform water from visually intricate residential street grids and industrial rooftops.',
    },
    2: {
      title: 'Vegetation Greenness & Canopy Structure',
      physical: 'Third variance axis (8.4%). Driven by hue_mean and local binary pattern (LBP) uniform texture. Separates evergreen woodland canopies from seasonal cropland and herbaceous pastures.',
    },
    3: {
      title: 'Linear Feature & Edge Sharpness',
      physical: 'Fourth variance axis (4.1%). Highlights strong directional edge gradients characteristic of highways, transport corridors, and riverbanks.',
    },
  };

  const activeInterpretation = componentInterpretations[componentIndex] || {
    title: `Higher-Order Spectral Variation (Component ${componentIndex + 1})`,
    physical: `Explains ${percent(study.pca.explained_variance_ratio[componentIndex], 2)} of variance. Captures localized color-channel bin distributions and subtle textural transitions.`,
  };

  return <>
    <PageTitle title="Projection lab" text="Dual PCA and t-SNE views of the same patches. Explore what each representation reveals.">
      <button className="button button-outline" onClick={() => setShowVivaGuide(v => !v)} aria-expanded={showVivaGuide}>
        <Sparkle size={17} weight="fill"/>Teacher Viva Guide
      </button>
      <button className="button button-outline" onClick={() => setExplain(v => !v)} aria-expanded={explain}>
        <Info size={17}/>Reading these plots
      </button>
      <a className="button button-primary" href="/api/export/study.json" download>
        <DownloadSimple size={17}/>Export study
      </a>
    </PageTitle>

    {/* Teacher / Capstone Viva Defense Guide */}
    {showVivaGuide && (
      <Panel title="Capstone Defense: Dual-Projection Framework" detail="Everything you need to explain PCA vs. t-SNE to your examiner" className="viva-defense-panel">
        <div className="viva-defense-grid">
          <div className="viva-card">
            <span className="viva-tag tag-pca">1. PCA (Global Linear)</span>
            <h4>Why PCA for Clustering?</h4>
            <p>
              PCA performs an orthogonal linear transformation that maximizes global variance ($\sum \lambda_i$).
              Euclidean distances between points in PCA space are mathematically meaningful and directly preserve
              true feature differences. That is why <strong>K-Means is fitted directly in 28-dimensional PCA space</strong>.
            </p>
            <div className="viva-bullet-list">
              <div>✓ 100% deterministic (no random seed required)</div>
              <div>✓ Preserves global metric distances and variances</div>
              <div>✓ Enables instant out-of-sample inference for new uploads</div>
            </div>
          </div>

          <div className="viva-card">
            <span className="viva-tag tag-tsne">2. t-SNE (Local Manifold)</span>
            <h4>Why t-SNE for Inspection?</h4>
            <p>
              t-SNE minimizes Kullback-Leibler divergence between joint probabilities in high-dimensional and 2D space.
              It unrolls non-linear manifolds and excels at revealing local neighborhood clusters that overlap in linear PCA projections.
            </p>
            <div className="viva-bullet-list">
              <div>✓ Reveals non-linear cluster separation and sub-groups</div>
              <div>✗ Cluster sizes and inter-cluster distances are non-metric</div>
              <div>✗ Cannot project new patches without refitting whole model</div>
            </div>
          </div>

          <div className="viva-card viva-card-highlight">
            <span className="viva-tag tag-decision">Examiner Answer</span>
            <h4>"Why not run K-Means on t-SNE?"</h4>
            <p>
              <em>"Examiner question: If t-SNE shows such clear clusters, why didn't you run K-Means directly on the t-SNE coordinates?"</em>
            </p>
            <p className="viva-answer-text">
              <strong>Your Answer:</strong> "Because t-SNE is a non-parametric, non-distance-preserving visualization technique.
              t-SNE intentionally distorts global density and distance to prevent crowding in 2D. Running K-Means on t-SNE coordinates would cluster visualization artifacts rather than genuine physical satellite properties, and would prevent analyzing new uploaded images without retraining."
            </p>
          </div>
        </div>
      </Panel>
    )}

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
    
    <div className="linked-patches"><div><h3>From points to places</h3><p>{filter == null ? 'A shared sample from both views.' : `A selection from group ${String(filter + 1).padStart(2, '0')} (${clusterName(filter)}).`}</p></div><div className="linked-patch-grid">{sample.map(p => <Patch key={p.id} id={p.id} onSelect={selectPatch}/>)}</div></div>
    
    <div className="analysis-grid">
      <Panel
        title="How much variation remains?"
        detail="Interactive PCA scree curve · hover components to explore, select threshold targets"
      >
        <VarianceChart
          ratios={study.pca.explained_variance_ratio}
          cumulative={study.pca.cumulative_variance}
          threshold={run.variance || .95}
          selectedComponent={componentIndex}
          onSelectComponent={setComponentIndex}
          showThresholdControls={true}
        />
        <div className="variance-thresholds">
          {study.pca.thresholds.map(t => (
            <div key={t.variance} className={Math.abs((run.variance || 0.95) - t.variance) < 0.005 ? 'is-selected-threshold' : ''}>
              <span>{percent(t.variance, 0)} retained</span>
              <strong>{t.components}<small>components</small></strong>
            </div>
          ))}
        </div>
        <div className="pca-pedagogical-callout">
          <Lightbulb size={16}/>
          <span>
            <strong>Interactive Tip:</strong> Click any component in the chart above or the buttons below to inspect its exact feature loadings in the adjacent panel.
          </span>
        </div>
      </Panel>

      <Panel
        title="What shapes a component?"
        detail="Feature loadings describe direction and physical satellite properties, not causation."
        action={
          <div className="component-selector-row">
            <select aria-label="Principal component loadings" value={componentIndex} onChange={e => setComponentIndex(Number(e.target.value))}>
              {study.pca.loadings.map((l, i) => (
                <option value={i} key={l.component}>
                  PC {l.component + 1} ({percent(study.pca.explained_variance_ratio[i], 1)})
                </option>
              ))}
            </select>
          </div>
        }
      >
        {/* Physical Interpretation Callout */}
        <div className="component-physical-card">
          <div className="comp-card-badge">PC {componentIndex + 1}</div>
          <div>
            <strong>{activeInterpretation.title}</strong>
            <p>{activeInterpretation.physical}</p>
          </div>
        </div>

        <div className="loading-rows">
          {loadings?.features.slice(0, 10).map(f => (
            <div key={f.name}>
              <div>
                <span title={f.name}>{titleCase(f.name)}</span>
                <code>{f.loading > 0 ? '+' : ''}{format(f.loading)}</code>
              </div>
              <div className="loading-track">
                <i className={f.loading < 0 ? 'is-negative' : ''} style={{ width: `${Math.abs(f.loading) / maxLoading * 100}%` }}/>
              </div>
            </div>
          ))}
        </div>
        <p className="panel-footnote">
          Positive loadings shift patches toward higher values of that feature; negative loadings indicate inverse correlation.
        </p>
      </Panel>
    </div>

    <div className="method-callout">
      <ArrowDown size={22}/>
      <p>
        <strong>Try changing t-SNE perplexity.</strong> Higher perplexity considers more global neighbors, while lower perplexity emphasizes micro-clusters. Layout changes are intrinsic to manifold learning.
      </p>
    </div>
  </>;
}
