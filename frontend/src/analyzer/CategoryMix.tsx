import { useEffect, useRef, useState } from 'react';
import { ChartBarHorizontal, CaretDown, CaretUp } from '@phosphor-icons/react';
import { format, percent, request } from '../api';
import { Notice } from '../UI';

interface AuditGroup {
  cluster: number;
  counts: Record<string, number>;
  total: number;
}

interface Audit {
  reference_run_id: string;
  contingency: AuditGroup[];
}

function categoryName(name: string) {
  return name.replace(/([a-z])([A-Z])/g, '$1 $2').replaceAll('_', ' ');
}

export default function CategoryMix({ cluster, runId }: { cluster: number; runId: string }) {
  const [expanded, setExpanded] = useState(false);
  const [group, setGroup] = useState<AuditGroup | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const activeRequest = useRef<AbortController | null>(null);

  useEffect(() => () => activeRequest.current?.abort(), []);

  async function loadGroup() {
    const controller = new AbortController();
    activeRequest.current = controller;
    setLoading(true);
    setError('');
    try {
      const audit = await request<Audit>('/audit', { signal: controller.signal });
      if (audit.reference_run_id !== runId) {
        throw new Error('The available reference audit belongs to a different run.');
      }
      const matched = audit.contingency.find(row => row.cluster === cluster);
      if (!matched || !matched.total) {
        throw new Error('The reference audit has no category counts for this group.');
      }
      if (!controller.signal.aborted) setGroup(matched);
    } catch (cause) {
      if (!controller.signal.aborted) setError((cause as Error).message);
    } finally {
      if (!controller.signal.aborted) setLoading(false);
      activeRequest.current = null;
    }
  }

  function toggle() {
    setExpanded(!expanded);
    if (!expanded && !group && !activeRequest.current) void loadGroup();
  }

  const categories = group
    ? Object.entries(group.counts).filter(([, count]) => count > 0).sort((a, b) => b[1] - a[1])
    : [];

  return (
    <section className="category-audit">
      <button
        className="text-button category-audit-toggle"
        aria-expanded={expanded}
        aria-controls="patch-category-mix"
        onClick={toggle}
      >
        <ChartBarHorizontal size={18}/>
        Reference categories in this group
        {expanded ? <CaretUp size={14}/> : <CaretDown size={14}/>}
      </button>
      <div id="patch-category-mix" hidden={!expanded}>
        {loading && <p className="caption" role="status">Loading the reference audit…</p>}
        {error && (
          <>
            <Notice warning>{error}</Notice>
            <button className="text-button" onClick={() => { void loadGroup(); }}>Retry audit</button>
          </>
        )}
        {group && (
          <>
            <p className="caption">
              Recorded categories for {format(group.total, 0)} study patches in this group.
              The study used these labels after fitting to describe group composition.
            </p>
            <ul className="category-counts">
              {categories.map(([name, count]) => (
                <li key={name}>
                  <span>{categoryName(name)}</span>
                  <span className="category-count">
                    {format(count, 0)} <small>({percent(count / group.total)})</small>
                  </span>
                  <span className="category-bar" aria-hidden="true">
                    <span style={{ width: percent(count / group.total, 2) }}/>
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </section>
  );
}
