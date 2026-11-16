import { useRef, useState } from 'react';
import type { DragEvent, RefObject } from 'react';
import { describeSnap } from '../utils/hexagons';
import type { HexagonSource } from '../utils/hexagons';

export interface HexagonUploadPanelProps {
  /** The uploaded file, or null when there is none. */
  hexagons: HexagonSource | null;
  isUploading: boolean;
  onUpload: (file: File) => void;
  onClear: () => void;
  /** Lets the toolbar's popover treat presses inside the window as inside. */
  panelRef?: RefObject<HTMLElement | null>;
}

const ACCEPT = '.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** True while the drag carries files (not text or a link dragged off the page). */
const carriesFiles = (event: DragEvent) => Array.from(event.dataTransfer?.types ?? []).includes('Files');

/**
 * The window the toolbar Upload button opens: choose or drop the wellfield
 * Excel, see the loaded file's name and cell count, replace it or remove it.
 * It stays open after an upload so the result is visible.
 */
export default function HexagonUploadPanel({ hexagons, isUploading, onUpload, onClear, panelRef }: HexagonUploadPanelProps) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const snapNote = hexagons ? describeSnap(hexagons) : null;

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file && !isUploading) onUpload(file);
  };

  return (
    <div ref={panelRef as RefObject<HTMLDivElement | null> | undefined} className="hexagon-upload" role="dialog" aria-label="Hexagons from Excel">
      <p className="hexagon-upload__title">Hexagons from Excel</p>

      {hexagons ? (
        <div className="hexagon-upload__file">
          <svg className="hexagon-upload__file-icon" viewBox="5 1 16 22" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
            <path d="M6 2h9l5 5v15H6z" />
            <path d="M14 2v6h6M9 12l5 6M14 12l-5 6" />
          </svg>
          {/* Name, count and snap result share one left edge beside the icon. */}
          <div className="hexagon-upload__file-text">
            <span className="hexagon-upload__file-name" title={hexagons.fileName}>{hexagons.fileName}</span>
            <span className="hexagon-upload__file-count">{hexagons.count} hexagon cell{hexagons.count === 1 ? '' : 's'}</span>
            {snapNote && <span className="hexagon-upload__snap" title={snapNote}>{snapNote}</span>}
          </div>
          <button
            type="button"
            className="hexagon-upload__remove"
            onClick={onClear}
            aria-label="Remove file"
            title="Remove the uploaded hexagons from the map"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
          </button>
        </div>
      ) : (
        <p className="hexagon-upload__empty">No file uploaded</p>
      )}

      <div
        className={`hexagon-upload__drop${isDragging ? ' is-dragging' : ''}`}
        data-testid="hexagon-drop-zone"
        onDragEnter={(event) => { if (carriesFiles(event)) setIsDragging(true); }}
        onDragOver={(event) => {
          if (!carriesFiles(event)) return;
          event.preventDefault();
          event.dataTransfer.dropEffect = 'copy';
        }}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setIsDragging(false);
        }}
        onDrop={onDrop}
      >
        <span>Drop an .xlsx file here or</span>
        <button type="button" className="hexagon-upload__choose" disabled={isUploading} aria-busy={isUploading} onClick={() => fileRef.current?.click()}>
          {isUploading ? 'Reading…' : hexagons ? 'Replace file' : 'Choose Excel file'}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept={ACCEPT}
          hidden
          data-testid="hexagon-file-input"
          onChange={(event) => {
            const file = event.target.files?.[0];
            // Cleared, so picking the same file again uploads it again.
            event.target.value = '';
            if (file) onUpload(file);
          }}
        />
      </div>

      {!hexagons && <p className="hexagon-upload__hint">Needs columns: Name, Type, X [m], Y [m], Associated production cells</p>}
    </div>
  );
}
