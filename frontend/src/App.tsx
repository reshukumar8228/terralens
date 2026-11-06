import { Component, lazy, Suspense, useEffect, useRef, useState } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { ArrowClockwise, ArrowRight, ArrowUpRight, BookOpen, ChartScatter, CirclesThree, Database, DownloadSimple, Flask, GlobeHemisphereWest, ImageSquare, Planet, ShieldCheck, X } from '@phosphor-icons/react';
import { format, patchUrl, request } from './api';
import { clusterColor } from './Charts';
import { FeatureProfile, Notice } from './UI';
import Observatory from './Observatory';
import type { Capabilities, PatchContext, Study, View } from './types';

const Projections = lazy(() => import('./Projections'));
const Clusters = lazy(() => import('./Clusters'));
const Experiments = lazy(() => import('./Experiments'));
const Analyzer = lazy(() => import('./Analyzer'));
const Evidence = lazy(() => import('./Evidence'));

const navigation = [
  { id: 'observatory', label: 'Observatory', Icon: GlobeHemisphereWest, description: 'The research workspace' },
  { id: 'projections', label: 'Projection lab', Icon: ChartScatter, description: 'PCA & t-SNE' },
  { id: 'clusters', label: 'Cluster atlas', Icon: CirclesThree, description: 'Explore discovered groups' },
  { id: 'experiments', label: 'Experiment bench', Icon: Flask, description: 'Parameters & comparisons' },
  { id: 'analyzer', label: 'Patch analyzer', Icon: ImageSquare, description: 'Analyze an image' },
  { id: 'evidence', label: 'Study & evidence', Icon: BookOpen, description: 'Methodology & results' },
] as const;
const views = new Set<string>(navigation.map(n => n.id));
const initialView = () => { const hash = window.location.hash.slice(1); return (views.has(hash) ? hash : 'observatory') as View; };

function LoadingView() { return <div className="view-skeleton" aria-label="Loading workspace" role="status"><div/><div/><div/></div>; }

class WorkspaceBoundary extends Component<{ children: ReactNode }, { error: boolean }> {
  state = { error: false };
  static getDerivedStateFromError() { return { error: true }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error('Workspace could not render', error.message, info.componentStack); }
  render() { return this.state.error ? <div className="workspace-error"><h2>This view could not be displayed.</h2><p>The research bundle may be incomplete or incompatible. Reload the workspace to reconnect.</p><button className="button button-primary" onClick={() => window.location.reload()}>Reload workspace</button></div> : this.props.children; }
}

export default function App() {
  const [view, setView] = useState<View>(initialView);
  const [study, setStudy] = useState<Study | null>(null);
  const [capabilities, setCapabilities] = useState<Capabilities | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [patchContext, setPatchContext] = useState<PatchContext | null>(null);
  const [guideOpen, setGuideOpen] = useState(false);
  const patchDialog = useRef<HTMLDialogElement>(null);
  const guideDialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError('');
    Promise.all([request<Study>('/study', { signal: controller.signal }), request<Capabilities>('/capabilities', { signal: controller.signal })]).then(([bundle, cap]) => {
      if (!bundle.points?.length || !bundle.runs?.length) throw new Error('The reference study is still being prepared. Please try again when its measured results are ready.');
      setStudy(bundle); setCapabilities(cap);
    }).catch(e => { if (e.name !== 'AbortError') setError(e.message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [attempt]);
  useEffect(() => { const handler = () => setView(initialView()); window.addEventListener('hashchange', handler); return () => window.removeEventListener('hashchange', handler); }, []);
  useEffect(() => { if (selectedId && patchDialog.current && !patchDialog.current.open) patchDialog.current.showModal(); }, [selectedId]);
  useEffect(() => { if (guideOpen && guideDialog.current && !guideDialog.current.open) guideDialog.current.showModal(); }, [guideOpen]);
  const navigate = (next: View) => { setView(next); window.location.hash = next; window.scrollTo({ top: 0, behavior: 'instant' }); };
  const selectedNav = navigation.find(n => n.id === view)!;
  const run = study?.runs.find(r => r.id === study.selected_run_id) || study?.runs[0];
  const selectedPoint = patchContext?.point || study?.points.find(p => p.id === selectedId);
  const inspectorRun = patchContext?.run || study?.runs.find(r => r.id === patchContext?.runId) || run;
  const selectedCluster = inspectorRun?.clusters.find(c => patchContext?.clusterId != null ? c.id === patchContext.clusterId : c.id === selectedPoint?.cluster || (selectedId && (c.representatives.includes(selectedId) || c.boundary_samples.includes(selectedId))));
  const selectPatch = (id: string, context?: PatchContext) => { setPatchContext(context || null); setSelectedId(id); };
  const closePatch = () => { patchDialog.current?.close(); setSelectedId(null); setPatchContext(null); };
  const closeGuide = () => { guideDialog.current?.close(); setGuideOpen(false); };
  return <div className="app-shell">
    <a href="#workspace-main" className="skip-link" onClick={e => { e.preventDefault(); document.getElementById('workspace-main')?.focus(); }}>Skip to workspace</a>
    <aside className="sidebar"><button className="brand" onClick={() => navigate('observatory')} aria-label="TerraLens observatory"><span className="brand-mark"><Planet size={35} weight="light"/></span><span>terra<span>lens</span><small>EARTH, IN PATTERNS</small></span></button><div className="sidebar-rule"/><span className="nav-label">Workspace</span><nav aria-label="Main navigation">{navigation.map(item => <button key={item.id} className={`nav-item ${view === item.id ? 'is-current' : ''}`} onClick={() => navigate(item.id)} aria-current={view === item.id ? 'page' : undefined}><item.Icon size={20} weight={view === item.id ? 'fill' : 'regular'}/><span>{item.label}</span>{view === item.id ? <span className="nav-active-mark"/> : null}</button>)}</nav><div className="sidebar-study"><div className="sidebar-study-top"><Database size={18}/><span>EUROSAT RGB</span><span className="status-dot"/></div><strong>{study ? `${format(study.dataset.valid_images, 0)} observations` : 'Satellite image study'}</strong><p>Exploring European land cover through colour and texture.</p><div className="sidebar-study-line"><ShieldCheck size={14}/><span>Reference labels hidden</span></div></div><div className="sidebar-bottom"><button className="guide-button" onClick={() => setGuideOpen(true)}><BookOpen size={18}/><span>Field guide</span><ArrowUpRight size={16}/></button><div className="course-lockup"><span>INT396</span><small>SIH26142 · RESEARCH EDITION</small></div></div></aside>
    <div className="workspace"><header className="topbar"><div className="breadcrumb"><span>Workspace</span><ArrowRight size={12}/><strong>{selectedNav.label}</strong></div><button className="mobile-brand" onClick={() => navigate('observatory')}><Planet size={26}/><strong>terralens</strong></button><div className="topbar-right"><span className="reference-status"><span className={`status-dot ${error ? 'is-error' : ''}`}/>{loading ? 'Connecting to study' : error ? 'Study unavailable' : 'Reference study'}</span><span className="topbar-divider"/><button className="mobile-guide icon-button" aria-label="Open field guide" onClick={() => setGuideOpen(true)}><BookOpen size={19}/></button><a href="/api/export/metrics.csv" className="topbar-export" download><DownloadSimple size={16}/><span>Export data</span></a></div></header><div className="mobile-workspace-nav"><label htmlFor="workspace-view">Workspace</label><select id="workspace-view" value={view} onChange={e => navigate(e.target.value as View)}>{navigation.map(n => <option value={n.id} key={n.id}>{n.label}</option>)}</select></div>
    <main id="workspace-main" className={`main-content view-${view}`} tabIndex={-1}>{loading ? <LoadingView/> : error || !study || !run || !capabilities ? <div className="connection-state"><div className="connection-symbol"><Planet size={52} weight="light"/></div><span className="workspace-label">TerraLens research workspace</span><h1>Waiting for the observations.</h1><p>{error || 'The study bundle could not be loaded.'}</p><Notice>The application needs the prepared EuroSAT study and a running research service. Once they are ready, reconnect to load the real results.</Notice><button className="button button-primary" onClick={() => setAttempt(a => a + 1)}><ArrowClockwise size={18}/>Reconnect to study</button></div> : <WorkspaceBoundary key={view}><Suspense fallback={<LoadingView/>}>{view === 'observatory' ? <Observatory study={study} run={run} navigate={navigate} selectPatch={selectPatch}/> : view === 'projections' ? <Projections study={study} run={run} selectPatch={selectPatch}/> : view === 'clusters' ? <Clusters study={study} run={run} selectPatch={selectPatch}/> : view === 'experiments' ? <Experiments study={study} run={run} capabilities={capabilities} selectPatch={selectPatch}/> : view === 'analyzer' ? <Analyzer study={study} run={run} capabilities={capabilities} selectPatch={selectPatch}/> : <Evidence study={study} run={run}/>}</Suspense></WorkspaceBoundary>}</main>
    <footer className="workspace-footer"><span><Planet size={16}/>TerraLens · Reproducible earth observation</span><span>INT396 <i/> PCA · t-SNE · K-Means</span></footer></div>
    <dialog className="patch-dialog" ref={patchDialog} onClose={() => setSelectedId(null)} onClick={e => { if (e.target === e.currentTarget) closePatch(); }} aria-labelledby="patch-dialog-title"><div className="dialog-top"><span className="workspace-label">{patchContext?.source === 'live' ? 'Live run patch inspector' : inspectorRun?.id === run?.id ? 'Reference patch inspector' : 'Saved-run patch inspector'}</span><button className="icon-button" aria-label="Close patch inspector" onClick={closePatch}><X size={20}/></button></div>{selectedId ? <><div className="patch-dialog-image"><img src={patchUrl(selectedId)} alt={`Satellite patch ${selectedId}`} width="64" height="64"/><span>{study?.dataset.image_width} × {study?.dataset.image_height} px · RGB</span></div><div className="patch-dialog-body"><span className="patch-anonymous-id">{selectedId}</span><span className="inspector-run-label">{patchContext?.source === 'live' ? 'Independent live run' : inspectorRun?.id === run?.id ? 'Frozen reference' : 'Saved comparison'} · K {inspectorRun?.k} · {inspectorRun?.variance == null ? 'Without PCA' : `PCA ${Math.round(inspectorRun.variance * 100)}%`}</span><h2 id="patch-dialog-title">{selectedCluster ? <><i className="colour-dot" style={{ background: clusterColor(selectedCluster.id) }}/>Group {String(selectedCluster.id + 1).padStart(2, '0')}</> : 'Anonymous satellite patch'}</h2>{selectedCluster ? <p>{selectedCluster.description}</p> : null}{selectedPoint ? <div className="patch-coordinates"><div><span>Principal component 1</span><code>{format(selectedPoint.pca[0])}</code></div><div><span>Principal component 2</span><code>{format(selectedPoint.pca[1])}</code></div></div> : null}{selectedCluster ? <FeatureProfile features={selectedCluster.feature_profile.slice(0, 5)} title="This group's feature profile" reference={patchContext?.source === 'live' ? 'run' : 'study'}/> : null}<div className="patch-dialog-note"><ShieldCheck size={16}/><span>Reference land-type labels are excluded from this view.</span></div></div></> : null}</dialog>
    <dialog className="guide-dialog" ref={guideDialog} onClose={() => setGuideOpen(false)} onClick={e => { if (e.target === e.currentTarget) closeGuide(); }} aria-labelledby="guide-title"><div className="dialog-top"><span className="workspace-label">A short field guide</span><button className="icon-button" aria-label="Close field guide" onClick={closeGuide}><X size={20}/></button></div><div className="guide-body"><Planet size={48} weight="light"/><h2 id="guide-title">Follow the patches.</h2><p>TerraLens explores whether satellite images form useful natural groups when their land-type labels are hidden.</p><ol><li><strong>Begin at the observatory.</strong> See the dataset and the reference study.</li><li><strong>Compare projections.</strong> PCA shows variation; t-SNE explores local similarity.</li><li><strong>Inspect the atlas.</strong> Look for shared colour, texture, and ambiguous patches.</li><li><strong>Question the parameters.</strong> Run a smaller live experiment and compare its measurements.</li><li><strong>Bring your own patch.</strong> Reuse the fitted pipeline to compare a satellite-like image.</li><li><strong>Read the evidence.</strong> Examine limitations before revealing the separate reference-label audit.</li></ol><Notice>Discovered group IDs do not identify guaranteed land types. Centroid distances are similarities, not class probabilities.</Notice><button className="button button-primary" onClick={() => { closeGuide(); navigate('projections'); }}>Start exploring <ArrowRight size={17}/></button></div></dialog>
  </div>;
}
