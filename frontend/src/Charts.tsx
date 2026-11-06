import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowsOut, Crosshair, Minus, Plus, ArrowCounterClockwise } from '@phosphor-icons/react';
import { format, percent } from './api';
import type { Point, XY } from './types';

export const clusterColor = (id: number) => `var(--color-cluster-${((id % 15) + 15) % 15})`;
function cssColor(token: string) { return getComputedStyle(document.documentElement).getPropertyValue(token).trim(); }

interface ScatterProps {
  points: Point[]; coordinates?: XY[]; projection: 'pca' | 'tsne'; selected?: string;
  filter?: number | null; onSelect: (id: string) => void; compact?: boolean;
  xLabel?: string; yLabel?: string; marker?: XY; name?: string;
}

export const Scatter = memo(function Scatter({ points, coordinates, projection, selected, filter = null, onSelect, compact = false, xLabel, yLabel, marker, name }: ScatterProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const projected = useRef<{ x: number; y: number; id: string; cluster: number }[]>([]);
  const [width, setWidth] = useState(700);
  const [zoom, setZoom] = useState(1);
  const [hover, setHover] = useState<{ x: number; y: number; id: string; cluster: number } | null>(null);
  const height = compact ? 280 : 390;
  const xy = useMemo(() => coordinates || points.map(p => p[projection]), [coordinates, points, projection]);
  const bounds = useMemo(() => {
    const valid = [...xy, marker].filter((p): p is XY => !!p && Number.isFinite(p[0]) && Number.isFinite(p[1]));
    if (!valid.length) return { minX: -1, maxX: 1, minY: -1, maxY: 1 };
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const [x, y] of valid) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
    const padX = (maxX - minX || 1) * .08, padY = (maxY - minY || 1) * .09;
    return { minX: minX - padX, maxX: maxX + padX, minY: minY - padY, maxY: maxY + padY };
  }, [xy, marker]);
  useEffect(() => {
    if (!wrapRef.current) return;
    const observer = new ResizeObserver(entries => setWidth(Math.max(200, entries[0].contentRect.width)));
    observer.observe(wrapRef.current); return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr; canvas.height = height * dpr;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    ctx.scale(dpr, dpr); ctx.clearRect(0, 0, width, height);
    const left = compact ? 34 : 46, right = 16, top = 16, bottom = 38;
    const w = width - left - right, h = height - top - bottom;
    const midX = (bounds.maxX + bounds.minX) / 2, midY = (bounds.maxY + bounds.minY) / 2;
    const rangeX = (bounds.maxX - bounds.minX) / zoom, rangeY = (bounds.maxY - bounds.minY) / zoom;
    const xPos = (x: number) => left + (x - (midX - rangeX / 2)) / rangeX * w;
    const yPos = (y: number) => top + h - (y - (midY - rangeY / 2)) / rangeY * h;
    ctx.strokeStyle = cssColor('--color-chart-grid'); ctx.lineWidth = .7;
    ctx.fillStyle = cssColor('--color-muted'); ctx.font = `10px ${cssColor('--font-mono')}`;
    ctx.textAlign = 'right';
    for (let i = 0; i <= 4; i++) {
      const y = top + h * i / 4;
      ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(width - right, y); ctx.stroke();
      ctx.fillText(format(midY + rangeY / 2 - rangeY * i / 4, 1), left - 9, y + 3);
    }
    ctx.textAlign = 'center';
    for (let i = 0; i <= 4; i++) {
      const x = left + w * i / 4;
      ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, top + h); ctx.stroke();
      ctx.fillText(format(midX - rangeX / 2 + rangeX * i / 4, 1), x, height - 18);
    }
    const colours = Array.from({ length: 15 }, (_, i) => cssColor(`--color-cluster-${i}`));
    projected.current = [];
    ctx.save(); ctx.beginPath(); ctx.rect(left, top, w, h); ctx.clip();
    points.forEach((point, index) => {
      const coordinate = xy[index]; if (!coordinate) return;
      const x = xPos(coordinate[0]), y = yPos(coordinate[1]);
      if (x < left || x > width - right || y < top || y > top + h) return;
      projected.current.push({ x, y, id: point.id, cluster: point.cluster });
      ctx.globalAlpha = filter != null && point.cluster !== filter ? .08 : .67;
      ctx.fillStyle = colours[point.cluster % 15];
      ctx.beginPath(); ctx.arc(x, y, compact ? 2.15 : 2.65, 0, Math.PI * 2); ctx.fill();
    });
    ctx.globalAlpha = 1;
    const active = projected.current.find(p => p.id === selected);
    if (active) { ctx.strokeStyle = cssColor('--color-ink'); ctx.lineWidth = 1.8; ctx.beginPath(); ctx.arc(active.x, active.y, 7, 0, Math.PI * 2); ctx.stroke(); }
    if (marker) {
      const x = xPos(marker[0]), y = yPos(marker[1]);
      ctx.strokeStyle = cssColor('--color-ink'); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x - 8, y); ctx.lineTo(x + 8, y); ctx.moveTo(x, y - 8); ctx.lineTo(x, y + 8); ctx.stroke();
      ctx.beginPath(); ctx.arc(x, y, 10, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();
  }, [width, height, points, xy, bounds, zoom, selected, filter, compact, marker]);
  const nearest = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect(); const x = event.clientX - rect.left, y = event.clientY - rect.top;
    let result: typeof projected.current[number] | null = null, distance = 110;
    for (const p of projected.current) {
      if (filter != null && p.cluster !== filter) continue;
      const d = (p.x - x) ** 2 + (p.y - y) ** 2;
      if (d < distance) { distance = d; result = p; }
    }
    return result;
  };
  const fullscreen = () => { if (wrapRef.current?.requestFullscreen) void wrapRef.current.requestFullscreen(); };
  return <div className="scatter-shell" ref={wrapRef}>
    <div className="plot-tools" aria-label="Plot controls">
      <button className="icon-button" aria-label="Zoom in" onClick={() => setZoom(z => Math.min(z * 1.35, 4))} disabled={zoom >= 4}><Plus size={15}/></button>
      <button className="icon-button" aria-label="Zoom out" onClick={() => setZoom(z => Math.max(z / 1.35, 1))} disabled={zoom <= 1}><Minus size={15}/></button>
      <button className="icon-button" aria-label="Reset plot zoom" onClick={() => setZoom(1)}><ArrowCounterClockwise size={15}/></button>
      <button className="icon-button" aria-label="View plot fullscreen" onClick={fullscreen}><ArrowsOut size={15}/></button>
    </div>
    <canvas ref={canvasRef} style={{ width: '100%', height }} aria-label={`${name || projection.toUpperCase()} plot of ${points.length} satellite patches. Select a point with a pointer, or use the patch gallery below.`} role="img"
      onPointerMove={e => setHover(nearest(e))} onPointerLeave={() => setHover(null)} onPointerDown={e => { const p = nearest(e); if (p) onSelect(p.id); }}/>
    {hover ? <div className="plot-tooltip" style={{ left: Math.min(hover.x + 12, width - 150), top: Math.max(hover.y - 60, 8) }}><span className="colour-dot" style={{ background: clusterColor(hover.cluster) }}/><span>Group {String(hover.cluster + 1).padStart(2, '0')}<small>{hover.id.slice(0, 12)}</small></span></div> : null}
    <div className="plot-axis"><span>{yLabel || (projection === 'pca' ? 'PC 2' : 't-SNE 2')}</span><span>{xLabel || (projection === 'pca' ? 'Principal component 1' : 't-SNE dimension 1')}</span></div>
    {!compact ? <div className="plot-hint"><Crosshair size={13}/><span>Select any point to inspect its satellite patch</span></div> : null}
  </div>;
});

export function VarianceChart({ ratios, cumulative, threshold = .95, compact = false }: { ratios: number[]; cumulative: number[]; threshold?: number; compact?: boolean }) {
  const width = 620, height = compact ? 180 : 245, left = 42, bottom = 32, top = 18, right = 18;
  const chartW = width - left - right, chartH = height - top - bottom;
  const count = ratios.length;
  if (!count) return <p className="muted">No PCA measurements available.</p>;
  const x = (i: number) => left + (i + .5) / count * chartW;
  const y = (v: number) => top + (1 - v) * chartH;
  const selected = Math.max(0, cumulative.findIndex(v => v >= threshold));
  return <svg className="variance-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`PCA variance chart. ${selected + 1} components retain at least ${Math.round(threshold * 100)} percent variance.`}>
    {[0, .25, .5, .75, 1].map(v => <g key={v}><line x1={left} x2={width - right} y1={y(v)} y2={y(v)} className="chart-grid"/><text x={left - 9} y={y(v) + 3} textAnchor="end">{v * 100}%</text></g>)}
    {ratios.map((v, i) => <rect key={i} x={x(i) - chartW / count * .34} y={y(v)} width={Math.max(1, chartW / count * .68)} height={Math.max(0, chartH * v)} className="variance-bar"/>)}
    <polyline points={cumulative.map((v, i) => `${x(i)},${y(v)}`).join(' ')} className="variance-line"/>
    <line x1={left} x2={width - right} y1={y(threshold)} y2={y(threshold)} className="threshold-line"/>
    <circle cx={x(selected)} cy={y(cumulative[selected])} r="4" className="variance-marker"/>
    <text x={Math.min(x(selected) + 9, width - 100)} y={Math.max(y(cumulative[selected]) - 9, 12)} className="chart-annotation">{selected + 1} PCs · {percent(threshold, 0)}</text>
    {[0, Math.floor(count / 4), Math.floor(count / 2), Math.floor(count * 3 / 4), count - 1].filter((v, i, a) => a.indexOf(v) === i).map(i => <text key={i} x={x(i)} y={height - 13} textAnchor="middle">{i + 1}</text>)}
  </svg>;
}

export function MetricLine({ data, selectedK }: { data: { k: number; value: number | null }[]; selectedK?: number }) {
  const filtered = data.filter((p): p is { k: number; value: number } => p.value != null && Number.isFinite(p.value));
  if (filtered.length < 2) return <p className="muted">At least two runs are needed for a comparison.</p>;
  const width = 600, height = 240, left = 45, right = 24, top = 25, bottom = 32;
  const minX = Math.min(...filtered.map(p => p.k)), maxX = Math.max(...filtered.map(p => p.k));
  const min = Math.min(...filtered.map(p => p.value)), max = Math.max(...filtered.map(p => p.value));
  const pad = Math.max((max - min) * .15, .015), low = min - pad, high = max + pad;
  const x = (n: number) => left + (n - minX) / (maxX - minX || 1) * (width - left - right);
  const y = (n: number) => top + (1 - (n - low) / (high - low)) * (height - top - bottom);
  return <svg className="metric-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Silhouette scores by number of clusters">
    {[0, 1, 2, 3].map(i => { const value = low + (high - low) * i / 3; return <g key={i}><line x1={left} x2={width - right} y1={y(value)} y2={y(value)} className="chart-grid"/><text x={left - 10} y={y(value) + 3} textAnchor="end">{format(value, 2)}</text></g>; })}
    <polyline points={filtered.map(p => `${x(p.k)},${y(p.value)}`).join(' ')} className="variance-line"/>
    {filtered.map(p => <g key={p.k}><circle cx={x(p.k)} cy={y(p.value)} r={p.k === selectedK ? 5.5 : 3.5} className={p.k === selectedK ? 'variance-marker' : 'metric-dot'}/><text x={x(p.k)} y={height - 10} textAnchor="middle">{p.k}</text></g>)}
  </svg>;
}
