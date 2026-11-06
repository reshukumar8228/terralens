import { ArrowRight, Crosshair, DownloadSimple } from '@phosphor-icons/react';
import { downloadJson, format } from '../api';
import { clusterColor } from '../Charts';
import { Notice, Panel, Patch } from '../UI';
import type { Analysis, Run } from '../types';
import CategoryMix from './CategoryMix';

function groupName(id: number) {
  return 'Group ' + String(id + 1).padStart(2, '0');
}

function CentroidEvidence({ result }: { result: Analysis }) {
  const hasRunnerUp = result.alternate_cluster != null && result.alternate_distance != null;

  return (
    <>
      <dl className="centroid-evidence">
        <div>
          <dt>Assigned centre</dt>
          <dd>{format(result.distance)}</dd>
          <small>{groupName(result.cluster)}</small>
        </div>
        {hasRunnerUp && (
          <div>
            <dt>Next closest centre</dt>
            <dd>{format(result.alternate_distance)}</dd>
            <small>{groupName(result.alternate_cluster!)}</small>
          </div>
        )}
        {result.margin != null && (
          <div>
            <dt>Distance gap</dt>
            <dd>{format(result.margin)}</dd>
            <small>Next closest minus assigned</small>
          </div>
        )}
      </dl>
      <p className="caption">
        Smaller distances in the fitted PCA space indicate more similar features.
        {hasRunnerUp && ' A small gap means the two groups are close competitors for this patch.'}
      </p>
      <p className="analyzer-percentile">
        <strong>{format(result.reference_percentile, 1)}th percentile</strong>
        {' '}of centroid distances in {groupName(result.cluster)}.
      </p>
    </>
  );
}

function NearestPatches({ result, onSelect }: { result: Analysis; onSelect: (id: string) => void }) {
  if (!result.neighbors?.length) {
    return (
      <>
        <div className="neighbors-heading"><h3>Group representatives</h3></div>
        <p className="caption">This response includes representative examples from the assigned group.</p>
        <div className="neighbor-patches">
          {result.representatives.slice(0, 8).map(id => <Patch key={id} id={id} onSelect={onSelect}/>)}
        </div>
      </>
    );
  }

  return (
    <>
      <div className="neighbors-heading"><h3>Closest reference patches</h3></div>
      <p className="caption">
        {result.neighbor_scope == null
          ? 'Ranked by distance to your upload within the assigned group.'
          : 'Ranked by distance to your upload among ' + format(result.neighbor_scope, 0) + ' candidates in this group.'}
      </p>
      <ol className="nearest-gallery">
        {result.neighbors.map((neighbor, index) => (
          <li key={neighbor.id}>
            <Patch id={neighbor.id} index={index} onSelect={onSelect}/>
            <span>Distance <strong>{format(neighbor.distance)}</strong></span>
          </li>
        ))}
      </ol>
    </>
  );
}

export default function AnalysisResult({
  result, run, isReference, analyzing, selectPatch,
}: {
  result: Analysis | null;
  run: Run;
  isReference: boolean;
  analyzing: boolean;
  selectPatch: (id: string) => void;
}) {
  if (!result) {
    return (
      <Panel title="Analysis result" detail="Your assigned group and nearby examples will appear here.">
        <div className="analyzer-empty" role="status">
          <Crosshair size={56} weight="thin"/>
          <h3>{analyzing ? 'Comparing image features…' : 'Explore the group your patch resembles'}</h3>
          <p>Choose a satellite patch to see its visual group, distance to its centre, and closest examples.</p>
          <div className="analyzer-steps">
            <span>Image features</span><ArrowRight size={13}/>
            <span>PCA</span><ArrowRight size={13}/><span>Nearest centre</span>
          </div>
        </div>
      </Panel>
    );
  }

  const cluster = run.clusters.find(group => group.id === result.cluster);
  const description = result.cluster_description || cluster?.description;

  return (
    <Panel
      title="Analysis result"
      detail={`${isReference ? 'Reference model' : 'Finer comparison'} · ${run.k} visual groups`}
      className="analyzer-result"
      action={
        <button
          className="text-button analysis-export"
          onClick={() => downloadJson(result, 'terralens-patch-analysis.json')}
        >
          <DownloadSimple size={16}/> Export JSON
        </button>
      }
    >
      <p className="visually-hidden" role="status">
        Analysis complete. Assigned visual group {groupName(result.cluster)}.
      </p>
      <div className="assignment-heading">
        <span className="assignment-number" style={{ color: clusterColor(result.cluster) }} aria-hidden="true">
          {String(result.cluster + 1).padStart(2, '0')}
        </span>
        <div>
          <span className="workspace-label">Assigned visual group</span>
          <h3>{groupName(result.cluster)}</h3>
          {description && <p className="assignment-description">{description}</p>}
        </div>
      </div>
      <CentroidEvidence result={result}/>
      <NearestPatches result={result} onSelect={selectPatch}/>
      <CategoryMix cluster={result.cluster} runId={run.id} isReference={isReference}/>
      {result.warnings.map((warning, index) => <Notice warning key={index}>{warning}</Notice>)}
    </Panel>
  );
}
