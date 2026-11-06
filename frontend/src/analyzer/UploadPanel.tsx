import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Crosshair, ImageSquare, UploadSimple, X } from '@phosphor-icons/react';
import { format } from '../api';
import { Notice, Panel } from '../UI';

const acceptedFiles = 'image/jpeg,image/png,image/webp';

interface UploadPanelProps {
  file: File | null;
  maxBytes: number;
  analyzing: boolean;
  loadingExample: boolean;
  error: string;
  modes: { id: string; label: string }[];
  selectedMode: string;
  onModeChange: (id: string) => void;
  onChoose: (file: File) => void;
  onClear: () => void;
  onAnalyze: () => void;
  onExample: () => void;
}

export default function UploadPanel({
  file, maxBytes, analyzing, loadingExample, error,
  modes, selectedMode, onModeChange, onChoose, onClear, onAnalyze, onExample,
}: UploadPanelProps) {
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState('');
  const [dragging, setDragging] = useState(false);
  const busy = analyzing || loadingExample;

  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  return (
    <Panel title="Choose a satellite patch" detail="Use an RGB satellite image at a scale similar to EuroSAT.">
      <form onSubmit={event => { event.preventDefault(); onAnalyze(); }}>
        <div
          className={['upload-zone', dragging && 'is-dragging', file && 'has-image'].filter(Boolean).join(' ')}
          onDragOver={event => {
            event.preventDefault();
            if (!busy) setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={event => {
            event.preventDefault();
            setDragging(false);
            const dropped = event.dataTransfer.files[0];
            if (dropped && !busy) onChoose(dropped);
          }}
        >
          {file ? (
            <>
              {preview && <img className="upload-preview" src={preview} alt="Selected satellite image"/>}
              <button
                type="button"
                className="icon-button remove-upload"
                aria-label="Remove selected image"
                disabled={busy}
                onClick={onClear}
              >
                <X size={18}/>
              </button>
            </>
          ) : (
            <>
              <div className="upload-symbol"><UploadSimple size={34} weight="light"/></div>
              <h3>Drop a satellite image</h3>
              <p>Drag a file here or browse your computer.</p>
              <button
                type="button"
                className="button button-outline"
                onClick={() => input.current?.click()}
                disabled={busy}
              >
                Choose an image <ArrowRight size={16}/>
              </button>
              <small id="image-upload-formats">
                JPEG, PNG, WebP · up to {format(maxBytes / 1024 / 1024, 0)} MB
              </small>
            </>
          )}
          <input
            ref={input}
            type="file"
            accept={acceptedFiles}
            aria-label="Upload a satellite image"
            className="visually-hidden"
            tabIndex={-1}
            disabled={busy}
            onChange={event => {
              const selected = event.currentTarget.files?.[0];
              event.currentTarget.value = '';
              if (selected) onChoose(selected);
            }}
          />
        </div>
        {file ? (
          <div className="uploaded-file">
            <ImageSquare size={20}/>
            <span>
              <strong>{file.name}</strong>
              <small>{format(file.size / 1024, 1)} KB · processed as a 64 × 64 RGB patch</small>
            </span>
            <button
              type="button"
              className="text-button upload-replace"
              disabled={busy}
              onClick={() => input.current?.click()}
            >
              Change image
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="text-button example-link"
            disabled={busy}
            onClick={onExample}
          >
            {loadingExample ? 'Loading example…' : 'Try a EuroSAT example'} <ArrowRight size={15}/>
          </button>
        )}
        {modes.length > 1 && (
          <div className="control-field analysis-mode">
            <label htmlFor="analysis-grouping">Visual grouping</label>
            <select id="analysis-grouping" value={selectedMode} disabled={busy}
              aria-describedby="analysis-grouping-detail" onChange={event => onModeChange(event.target.value)}>
              {modes.map(mode => <option key={mode.id} value={mode.id}>{mode.label}</option>)}
            </select>
            <p id="analysis-grouping-detail" className="caption">
              Both models group patches by colour and texture with land-type labels hidden.
            </p>
          </div>
        )}
        <button className="button button-primary run-button" type="submit" disabled={!file || busy}>
          {analyzing ? <span className="loading-dots"/> : <Crosshair size={18}/>}
          {analyzing ? 'Analyzing patch…' : 'Analyze patch'}
        </button>
        {error && <Notice warning>{error}</Notice>}
        <p className="caption">
          Analysis uses the saved feature extractor, scaler, PCA transformation, and cluster centres.
        </p>
      </form>
    </Panel>
  );
}
