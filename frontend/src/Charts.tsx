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

export function VarianceChart({
  ratios,
  cumulative,
  threshold = .95,
  compact = false,
  showControls = true,
  onComponentSelect,
}: {
  ratios: number[];
  cumulative: number[];
  threshold?: number;
  compact?: boolean;
  showControls?: boolean;
  onComponentSelect?: (componentIndex: number) => void;
}) {
  const [currentThreshold, setCurrentThreshold] = useState(threshold);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [pinnedIndex, setPinnedIndex] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    setCurrentThreshold(threshold);
  }, [threshold]);

  const width = compact ? 680 : 760;
  const height = compact ? 330 : 430;
  const left = 50, bottom = 44, top = 34, right = 24;
  const chartW = width - left - right, chartH = height - top - bottom;
  const count = ratios.length;
  if (!count) return <p className="muted">No PCA measurements available.</p>;

  const x = (i: number) => left + (i + .5) / count * chartW;
  const y = (v: number) => top + (1 - v) * chartH;
  const selected = Math.max(0, cumulative.findIndex(v => v >= currentThreshold));

  const activeIndex = hoverIndex !== null ? hoverIndex : pinnedIndex !== null ? pinnedIndex : selected;
  const activeX = x(activeIndex);
  const activeY = y(cumulative[activeIndex]);
  const activeRatio = ratios[activeIndex];
  const activeCum = cumulative[activeIndex];

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const svgX = ((e.clientX - rect.left) / rect.width) * width;
    if (svgX < left || svgX > width - right) {
      setHoverIndex(null);
      return;
    }
    const idx = Math.min(count - 1, Math.max(0, Math.floor(((svgX - left) / chartW) * count)));
    setHoverIndex(idx);
  };

  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const svgX = ((e.clientX - rect.left) / rect.width) * width;
    if (svgX >= left && svgX <= width - right) {
      const idx = Math.min(count - 1, Math.max(0, Math.floor(((svgX - left) / chartW) * count)));
      setPinnedIndex(prev => prev === idx ? null : idx);
      if (onComponentSelect) onComponentSelect(idx);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight') {
      const next = Math.min(count - 1, (pinnedIndex ?? selected) + 1);
      setPinnedIndex(next);
      if (onComponentSelect) onComponentSelect(next);
    } else if (e.key === 'ArrowLeft') {
      const prev = Math.max(0, (pinnedIndex ?? selected) - 1);
      setPinnedIndex(prev);
      if (onComponentSelect) onComponentSelect(prev);
    } else if (e.key === 'Escape') {
      setPinnedIndex(null);
      setHoverIndex(null);
    }
  };

  return (
    <div className="variance-chart-shell" tabIndex={0} onKeyDown={handleKeyDown} aria-label="Interactive PCA variance chart">
      {!compact && showControls && (
        <div className="threshold-chips" role="group" aria-label="PCA retained variance target">
          <span className="chips-label">Variance cutoff:</span>
          {[0.90, 0.95, 0.99].map(target => (
            <button
              key={target}
              type="button"
              className={`threshold-chip ${currentThreshold === target ? 'is-active' : ''}`}
              onClick={() => {
                setCurrentThreshold(target);
                setPinnedIndex(null);
              }}
            >
              {Math.round(target * 100)}% ({cumulative.findIndex(v => v >= target) + 1} PCs)
              {target === 0.95 ? ' · Reference' : ''}
            </button>
          ))}
          {pinnedIndex !== null && (
            <button type="button" className="threshold-chip chip-reset" onClick={() => setPinnedIndex(null)}>
              Reset to threshold
            </button>
          )}
        </div>
      )}

      <svg
        ref={svgRef}
        className="variance-chart interactive-chart"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`PCA variance chart. Component ${activeIndex + 1} explains ${percent(activeRatio, 2)} variance, reaching ${percent(activeCum, 1)} cumulative.`}
        onPointerMove={handlePointerMove}
        onPointerLeave={() => setHoverIndex(null)}
        onPointerDown={handlePointerDown}
      >
        {[0, .25, .5, .75, 1].map(v => (
          <g key={v}>
            <line x1={left} x2={width - right} y1={y(v)} y2={y(v)} className="chart-grid"/>
            <text x={left - 10} y={y(v) + 4} textAnchor="end">{v * 100}%</text>
          </g>
        ))}

        {ratios.map((v, i) => {
          const isActive = i === activeIndex;
          const barW = Math.max(1.8, chartW / count * .72);
          return (
            <rect
              key={i}
              x={x(i) - barW / 2}
              y={y(v)}
              width={barW}
              height={Math.max(0, chartH * v)}
              className={`variance-bar ${isActive ? 'is-active' : ''}`}
            />
          );
        })}

        <polyline points={cumulative.map((v, i) => `${x(i)},${y(v)}`).join(' ')} className="variance-line"/>
        <line x1={left} x2={width - right} y1={y(currentThreshold)} y2={y(currentThreshold)} className="threshold-line"/>

        <circle cx={x(selected)} cy={y(cumulative[selected])} r="5" className="variance-marker"/>
        <text
          x={Math.min(x(selected) + 10, width - 110)}
          y={Math.max(y(cumulative[selected]) - 10, 16)}
          className="chart-annotation"
        >
          {selected + 1} PCs · {percent(currentThreshold, 0)}
        </text>

        {(hoverIndex !== null || pinnedIndex !== null) && (() => {
          const tipW = 200;
          const tipH = 56;
          const tipX = Math.min(Math.max(activeX - tipW / 2, left + 4), width - right - tipW - 4);
          const tipY = activeY < top + chartH * 0.45 ? activeY + 18 : activeY - tipH - 16;
          return (
            <g className="active-inspection-group">
              <line x1={activeX} x2={activeX} y1={top} y2={top + chartH} className="variance-hover-line"/>
              <circle cx={activeX} cy={activeY} r="8" className="variance-active-pulse"/>
              <circle cx={activeX} cy={activeY} r="5.5" className="variance-active-dot"/>
              <g transform={`translate(${tipX}, ${tipY})`} className="variance-tooltip-group">
                <rect width={tipW} height={tipH} rx="8" className="variance-tooltip-card"/>
                <text x="14" y="24" className="variance-tip-title">
                  PC {String(activeIndex + 1).padStart(2, '0')} · {percent(activeRatio, 2)}
                </text>
                <text x="14" y="43" className="variance-tip-sub">
                  {percent(activeCum, 1)} cumulative variance
                </text>
              </g>
            </g>
          );
        })()}

        {[0, Math.floor(count / 4), Math.floor(count / 2), Math.floor(count * 3 / 4), count - 1]
          .filter((v, i, a) => a.indexOf(v) === i)
          .map(i => <text key={i} x={x(i)} y={height - 14} textAnchor="middle">{i + 1}</text>)}
      </svg>

      <div className="variance-interactive-hud">
        <div className="hud-primary">
          <span className="hud-badge">PC {String(activeIndex + 1).padStart(2, '0')}</span>
          <span className="hud-val">
            Explains <strong>{percent(activeRatio, 2)}</strong> individual variance
          </span>
          <span className="hud-sep">·</span>
          <span className="hud-val">
            Cumulative: <strong>{percent(activeCum, 1)}</strong>
          </span>
        </div>
        <div className="hud-secondary">
          {activeIndex === selected ? (
            <span className="threshold-tag">★ 95% Reference Threshold ({selected + 1} PCs)</span>
          ) : (
            <span className="prune-tag">{count - (activeIndex + 1)} dimensions pruned (-{percent(1 - (activeIndex + 1) / count, 0)})</span>
          )}
        </div>
      </div>
    </div>
  );
}

export function MetricLine({ data, selectedK }: { data: { k: number; value: number | null }[]; selectedK?: number }) {
  const [hoveredK, setHoveredK] = useState<number | null>(null);
  const filtered = data.filter((p): p is { k: number; value: number } => p.value != null && Number.isFinite(p.value));
  if (filtered.length < 2) return <p className="muted">At least two runs are needed for a comparison.</p>;
  const width = 600, height = 245, left = 45, right = 24, top = 25, bottom = 32;
  const minX = Math.min(...filtered.map(p => p.k)), maxX = Math.max(...filtered.map(p => p.k));
  const min = Math.min(...filtered.map(p => p.value)), max = Math.max(...filtered.map(p => p.value));
  const pad = Math.max((max - min) * .15, .015), low = min - pad, high = max + pad;
  const x = (n: number) => left + (n - minX) / (maxX - minX || 1) * (width - left - right);
  const y = (n: number) => top + (1 - (n - low) / (high - low)) * (height - top - bottom);

  const activePoint = filtered.find(p => p.k === (hoveredK ?? selectedK)) ?? filtered.find(p => p.k === selectedK) ?? filtered[0];

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const svgX = ((e.clientX - rect.left) / rect.width) * width;
    let closestK = filtered[0].k;
    let minDiff = Infinity;
    for (const pt of filtered) {
      const diff = Math.abs(x(pt.k) - svgX);
      if (diff < minDiff) {
        minDiff = diff;
        closestK = pt.k;
      }
    }
    setHoveredK(closestK);
  };

  return (
    <div className="metric-chart-shell">
      <svg
        className="metric-chart interactive-chart"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Silhouette scores by number of clusters"
        onPointerMove={handlePointerMove}
        onPointerLeave={() => setHoveredK(null)}
      >
        {[0, 1, 2, 3].map(i => {
          const value = low + (high - low) * i / 3;
          return (
            <g key={i}>
              <line x1={left} x2={width - right} y1={y(value)} y2={y(value)} className="chart-grid"/>
              <text x={left - 10} y={y(value) + 3} textAnchor="end">{format(value, 2)}</text>
            </g>
          );
        })}
        <polyline points={filtered.map(p => `${x(p.k)},${y(p.value)}`).join(' ')} className="variance-line"/>

        {hoveredK !== null && activePoint && (
          <line x1={x(activePoint.k)} x2={x(activePoint.k)} y1={top} y2={height - bottom} className="variance-hover-line"/>
        )}

        {filtered.map(p => {
          const isSelected = p.k === selectedK;
          const isHovered = p.k === hoveredK;
          return (
            <g key={p.k}>
              <circle
                cx={x(p.k)}
                cy={y(p.value)}
                r={isHovered ? 6.5 : isSelected ? 5.5 : 3.5}
                className={isSelected ? 'variance-marker' : isHovered ? 'variance-active-dot' : 'metric-dot'}
              />
              <text x={x(p.k)} y={height - 10} textAnchor="middle">{p.k}</text>
            </g>
          );
        })}

        {activePoint && (
          <g transform={`translate(${Math.min(Math.max(x(activePoint.k) - 50, left + 4), width - right - 110)}, ${Math.max(y(activePoint.value) - 30, top + 4)})`}>
            <rect width="115" height="24" rx="4" className="variance-tooltip-bg"/>
            <text x="8" y="15" className="variance-tooltip-text">
              K={activePoint.k}: {format(activePoint.value, 3)} s
            </text>
          </g>
        )}
      </svg>
      <div className="metric-interactive-hud">
        <span>
          <strong>K = {activePoint.k}</strong> visual groups · Common silhouette: <code>{format(activePoint.value, 4)}</code>
        </span>
        {activePoint.k === selectedK && (
          <span className="threshold-tag">★ Reference Model (Optimal Balance)</span>
        )}
      </div>
    </div>
  );
}
