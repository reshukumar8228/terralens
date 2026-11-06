import { useEffect, useRef, useState } from 'react';
import { format, patchUrl, request } from './api';
import { Scatter } from './Charts';
import { FeatureProfile, Notice, PageTitle, Panel } from './UI';
import AnalysisResult from './analyzer/AnalysisResult';
import UploadPanel from './analyzer/UploadPanel';
import type { Analysis, Capabilities, Run, Study } from './types';
import './analyzer/analyzer.css';

interface AnalyzerProps {
  study: Study;
  run: Run;
  capabilities: Capabilities;
  selectPatch: (id: string) => void;
}

const imageFormats = ['image/jpeg', 'image/png', 'image/webp'];

export default function Analyzer({ study, run, capabilities, selectPatch }: AnalyzerProps) {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<Analysis | null>(null);
  const [activity, setActivity] = useState<'example' | 'analysis' | null>(null);
  const [error, setError] = useState('');
  const activeRequest = useRef<AbortController | null>(null);

  useEffect(() => () => activeRequest.current?.abort(), []);

  function clearImage() {
    setFile(null);
    setResult(null);
    setError('');
  }

  function chooseImage(next: File) {
    clearImage();
    if (!imageFormats.includes(next.type)) {
      setError('Choose a JPEG, PNG, or WebP image.');
    } else if (next.size > capabilities.upload_max_bytes) {
      setError('Choose a file up to ' + format(capabilities.upload_max_bytes / 1024 / 1024, 0) + ' MB.');
    } else if (!next.size) {
      setError('This file is empty. Choose another image.');
    } else {
      setFile(next);
    }
  }

  async function analyze() {
    if (!file || activeRequest.current) return;
    const controller = new AbortController();
    activeRequest.current = controller;
    setActivity('analysis');
    setError('');
    setResult(null);

    try {
      const body = new FormData();
      body.append('file', file);
      const analysis = await request<Analysis>('/analyze', {
        method: 'POST', body, signal: controller.signal,
      });
      if (!controller.signal.aborted) setResult(analysis);
    } catch (cause) {
      if (!controller.signal.aborted) setError((cause as Error).message);
    } finally {
      if (!controller.signal.aborted) setActivity(null);
      activeRequest.current = null;
    }
  }

  async function useExample() {
    if (activeRequest.current) return;
    const id = run.clusters[0]?.representatives[0] || study.points[0]?.id;
    if (!id) {
      setError('No example patch is available. Choose an image from your computer.');
      return;
    }

    const controller = new AbortController();
    activeRequest.current = controller;
    setActivity('example');
    setError('');
    try {
      const response = await fetch(patchUrl(id), { signal: controller.signal });
      if (!response.ok) throw new Error('The example patch could not be loaded. Choose an image from your computer.');
      const blob = await response.blob();
      if (!controller.signal.aborted) {
        chooseImage(new File([blob], 'eurosat-example.jpg', { type: 'image/jpeg' }));
      }
    } catch (cause) {
      if (!controller.signal.aborted) setError((cause as Error).message);
    } finally {
      if (!controller.signal.aborted) setActivity(null);
      activeRequest.current = null;
    }
  }

  return (
    <>
      <PageTitle
        title="Patch analyzer"
        text="Compare a satellite image with the visual groups discovered in EuroSAT."
      />
      <div className="analyzer-grid">
        <UploadPanel
          file={file}
          maxBytes={capabilities.upload_max_bytes}
          analyzing={activity === 'analysis'}
          loadingExample={activity === 'example'}
          error={error}
          onChoose={chooseImage}
          onClear={clearImage}
          onAnalyze={() => { void analyze(); }}
          onExample={() => { void useExample(); }}
        />
        <AnalysisResult result={result} run={run} analyzing={activity === 'analysis'} selectPatch={selectPatch}/>
      </div>
      {result && (
        <div className="analysis-grid">
          <Panel
            title="Your patch in PCA space"
            detail="The crosshair marks your upload. The dots are reference study patches."
          >
            <Scatter
              points={study.points}
              projection="pca"
              marker={result.pca}
              filter={result.cluster}
              onSelect={selectPatch}
            />
          </Panel>
          <Panel title="What the image contains" detail="Feature measurements relative to the study distribution.">
            <FeatureProfile features={result.features} title="Your patch’s feature profile"/>
          </Panel>
        </div>
      )}
      <Notice>
        Use this tool to compare visual similarity. A different capture scale, a photograph, or a screenshot can produce a misleading assignment.
      </Notice>
    </>
  );
}
