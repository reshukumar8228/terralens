import { ArrowUpRight, Info, WarningCircle } from '@phosphor-icons/react';
import type { ReactNode } from 'react';
import { fixed, format, patchUrl, titleCase, clusterName } from './api';
import { clusterColor } from './Charts';
import type { Cluster, Feature, Metrics } from './types';

export function PageTitle({ title, text, children }: { title: string; text: string; children?: ReactNode }) {
  return <div className="page-heading"><div><h1>{title}</h1><p>{text}</p></div>{children ? <div className="heading-actions">{children}</div> : null}</div>;
}
export function Panel({ title, detail, children, action, className = '' }: { title: string; detail?: string; children: ReactNode; action?: ReactNode; className?: string }) {
  return <section className={`panel ${className}`}><div className="panel-heading"><div><h2>{title}</h2>{detail ? <p>{detail}</p> : null}</div>{action}</div>{children}</section>;
}
export function Notice({ children, warning = false }: { children: ReactNode; warning?: boolean }) {
  return <div className={`notice ${warning ? 'notice-warning' : ''}`} role={warning ? 'alert' : undefined}>{warning ? <WarningCircle size={19}/> : <Info size={19}/>}<div>{children}</div></div>;
}
export function Patch({ id, onSelect, className = '', index }: { id: string; onSelect: (id: string) => void; className?: string; index?: number }) {
  return <button className={`patch ${className}`} onClick={() => onSelect(id)} aria-label={`Inspect satellite patch ${id}`}><img src={patchUrl(id)} alt={`EuroSAT satellite patch ${id}`} loading="lazy" width="64" height="64"/>{index != null ? <span className="patch-index">{String(index + 1).padStart(2, '0')}</span> : null}<span className="patch-open"><ArrowUpRight size={16}/></span></button>;
}
export function ClusterPills({ clusters, selected, onSelect, all = true }: { clusters: Cluster[]; selected: number | null; onSelect: (id: number | null) => void; all?: boolean }) {
  return <div className="cluster-pills" aria-label="Filter by cluster">{all ? <button className={`cluster-pill ${selected == null ? 'is-active' : ''}`} aria-pressed={selected == null} onClick={() => onSelect(null)}>All groups</button> : null}{clusters.map(c => <button key={c.id} className={`cluster-pill ${selected === c.id ? 'is-active' : ''}`} aria-pressed={selected === c.id} onClick={() => onSelect(selected === c.id && all ? null : c.id)} title={`${clusterName(c)}: ${c.description}`}><span className="colour-dot" style={{ background: clusterColor(c.id) }}/>Group {String(c.id + 1).padStart(2, '0')} · {clusterName(c)}<span className="pill-count">{format(c.count, 0)}</span></button>)}</div>;
}
export function MetricsRow({ metrics, stability, compact = false }: { metrics: Metrics; stability?: number | null; compact?: boolean }) {
  const items = [
    { label: 'Run-space silhouette', value: metrics.silhouette, hint: 'Higher is better · −1 to 1' },
    { label: 'Davies–Bouldin', value: metrics.davies_bouldin, hint: 'Lower is better' },
    { label: 'Calinski–Harabasz', value: metrics.calinski_harabasz, hint: 'Higher is better' },
    ...(stability !== undefined ? [{ label: 'Seed stability', value: stability, hint: 'ARI agreement across runs' }] : []),
  ];
  return <div className={`metrics-row ${compact ? 'metrics-compact' : ''}`}>{items.map(item => <div key={item.label}><span className="metric-label">{item.label}</span><strong>{item.label === 'Seed stability' ? fixed(item.value) : format(item.value)}</strong><small>{item.hint}</small></div>)}</div>;
}
export function FeatureProfile({ features, title = 'Feature profile', reference = 'study' }: { features: Feature[]; title?: string; reference?: 'study' | 'run' }) {
  const visible = features.slice(0, 8);
  const max = Math.max(2.5, ...visible.map(f => Math.abs(f.zscore)));
  return <div className="feature-profile"><h3>{title}</h3><p className="caption">Standard deviations from the {reference} mean</p><div className="profile-rows">{visible.map(f => <div className="profile-row" key={f.name}><span title={f.name}>{titleCase(f.name)}</span><div className="diverging-track"><i className="diverging-zero"/><i className={`diverging-bar ${f.zscore < 0 ? 'negative' : ''}`} style={{ width: `${Math.min(Math.abs(f.zscore) / max, 1) * 50}%`, left: f.zscore < 0 ? `${50 - Math.min(Math.abs(f.zscore) / max, 1) * 50}%` : '50%' }}/></div><code>{f.zscore > 0 ? '+' : ''}{format(f.zscore, 2)}</code></div>)}</div></div>;
}
