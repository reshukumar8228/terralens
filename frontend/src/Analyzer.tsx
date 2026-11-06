import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Crosshair, ImageSquare, UploadSimple, X } from '@phosphor-icons/react';
import { format, patchUrl, request } from './api';
import { clusterColor, Scatter } from './Charts';
import { FeatureProfile, Notice, PageTitle, Panel, Patch } from './UI';
import type { Analysis, Capabilities, Run, Study } from './types';

export default function Analyzer({ study, run, capabilities, selectPatch }: { study: Study; run: Run; capabilities: Capabilities; selectPatch: (id: string) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [result, setResult] = useState<Analysis | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { if (!file) { setPreview(''); return; } const url = URL.createObjectURL(file); setPreview(url); return () => URL.revokeObjectURL(url); }, [file]);
  function choose(next: File | undefined) {
    if (!next) return;
    setError(''); setResult(null);
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(next.type)) { setFile(null); setError('Choose a JPEG, PNG, or WebP image. Other file formats are not supported.'); return; }
    if (next.size > capabilities.upload_max_bytes) { setFile(null); setError(`This image is too large. Choose a file smaller than ${format(capabilities.upload_max_bytes / 1024 / 1024, 0)} MB.`); return; }
    setFile(next);
  }
  async function analyze() {
    if (!file || busy) return;
    setBusy(true); setError(''); setResult(null);
    try { const body = new FormData(); body.append('file', file); setResult(await request<Analysis>('/analyze', { method: 'POST', body })); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  async function useExample() {
    setError('');
    try { const id = run.clusters[0]?.representatives[0] || study.points[0]?.id; if (!id) return; const response = await fetch(patchUrl(id)); if (!response.ok) throw new Error('The example patch could not be loaded. Try an image from your computer.'); const blob = await response.blob(); choose(new File([blob], 'eurosat-example.jpg', { type: 'image/jpeg' })); }
    catch (e) { setError((e as Error).message); }
  }
  const cluster = result ? run.clusters.find(c => c.id === result.cluster) : undefined;
  return <>
    <PageTitle title="Patch analyzer" text="Bring a satellite patch. Find its place in the discovered structure."/>
    <div className="analyzer-grid"><Panel title="Start with an image" detail="Use a satellite-like RGB patch for a meaningful comparison."><div className={`upload-zone ${dragging ? 'is-dragging' : ''} ${preview ? 'has-image' : ''}`} onDragOver={e => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={e => { e.preventDefault(); setDragging(false); if (!busy) choose(e.dataTransfer.files[0]); }}>
      {preview ? <><img className="upload-preview" src={preview} alt="Your selected satellite image"/><button className="icon-button remove-upload" aria-label="Remove selected image" disabled={busy} onClick={() => { setFile(null); setResult(null); setError(''); if (input.current) input.current.value = ''; }}><X size={18}/></button></> : <><div className="upload-symbol"><UploadSimple size={34} weight="light"/></div><h3>A small window into the world.</h3><p>Drop an image here, or choose a file.</p><button className="button button-outline" onClick={() => input.current?.click()} disabled={busy}>Choose an image <ArrowRight size={16}/></button><small>JPEG, PNG, WebP · up to {format(capabilities.upload_max_bytes / 1024 / 1024, 0)} MB</small></>}
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" aria-label="Upload a satellite image" onChange={e => choose(e.target.files?.[0])} disabled={busy} className="visually-hidden"/>
    </div>{file ? <div className="uploaded-file"><ImageSquare size={20}/><span><strong>{file.name}</strong><small>{format(file.size / 1024, 1)} KB · resized to the study's patch dimensions</small></span></div> : <button className="text-button example-link" onClick={useExample}>Try a genuine EuroSAT example <ArrowRight size={15}/></button>}
      <button className="button button-primary run-button" onClick={analyze} disabled={!file || busy}>{busy ? <><span className="loading-dots"/>Analyzing patch</> : <><Crosshair size={18}/>Analyze patch</>}</button>{error ? <Notice warning>{error}</Notice> : null}<p className="caption">The saved feature extractor, scaler, PCA, and cluster centres are reused. Uploading an image does not retrain the model.</p></Panel>
    <Panel title="A place among patterns" detail={result ? 'Assignment through the frozen reference pipeline.' : 'Your analysis will appear here.'} className="analyzer-result">{result ? <><div className="assignment-heading"><span className="assignment-number" style={{ color: clusterColor(result.cluster) }}>{String(result.cluster + 1).padStart(2, '0')}</span><div><span className="workspace-label">Assigned to discovered group</span><h2>{cluster?.description || `Group ${result.cluster + 1}`}</h2></div></div><div className="distance-strip"><div><span>Distance to centroid</span><strong>{format(result.distance)}</strong></div><div><span>Relative distance</span><strong>{format(result.relative_distance, 2)}<small>×</small></strong></div></div><p className="caption">Distance describes similarity in PCA space. It is not a probability of a land-type label.</p><div className="neighbors-heading"><h3>Representative neighbours</h3><span>Reference group {String(result.cluster + 1).padStart(2, '0')}</span></div><div className="neighbor-patches">{result.representatives.slice(0, 8).map(id => <Patch key={id} id={id} onSelect={selectPatch}/>)}</div>{result.warnings.map((w, i) => <Notice warning key={i}>{w}</Notice>)}</> : <div className="analyzer-empty"><Crosshair size={56} weight="thin"/><h3>Compare, don't guess.</h3><p>We will describe your patch numerically and compare it with the groups discovered in EuroSAT.</p><div className="analyzer-steps"><span>Image features</span><ArrowRight size={13}/><span>PCA</span><ArrowRight size={13}/><span>Nearest centre</span></div></div>}</Panel></div>
    {result ? <div className="analysis-grid"><Panel title="Your patch in PCA space" detail="Crosshair marks the uploaded patch; dots are reference study patches."><Scatter points={study.points} projection="pca" marker={result.pca} filter={result.cluster} onSelect={selectPatch}/><Notice>New uploads have a valid PCA transformation. They are not inserted into the fitted t-SNE map.</Notice></Panel><Panel title="What the image contains" detail="Feature measurements relative to the study distribution."><FeatureProfile features={result.features} title="Your patch's feature profile"/></Panel></div> : null}
    <Notice><strong>Context matters.</strong> A photograph, screenshot, or image at a different scale can receive a cluster assignment without being a meaningful match. This tool is an educational comparison, not a certified land-cover classifier.</Notice>
  </>;
}
