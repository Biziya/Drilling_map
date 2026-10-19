import type { MapDataStatus } from './mapDataState';

interface ErrorBodyProps {
  message: string;
  onRetry: () => void;
}

export interface MapStatusOverlayProps {
  status: MapDataStatus;
  message: string;
  onRetry: () => void;
}

function LoadingBody() {
  return (
    <>
      <span className="map-state__spinner" aria-hidden="true" />
      <strong>Loading drillholes…</strong>
    </>
  );
}

function EmptyBody() {
  return (
    <>
      <strong>No drillholes found</strong>
      <span>The API returned an empty result.</span>
    </>
  );
}

function ErrorBody({ message, onRetry }: ErrorBodyProps) {
  return (
    <>
      <strong>Unable to load drillholes</strong>
      <span>{message}</span>
      <button type="button" onClick={onRetry}>
        Try again
      </button>
    </>
  );
}

/**
 * Covers the canvas while the map has nothing to show.
 *
 * Unmounts completely once the data is ready, because it sits above the
 * canvas and would otherwise swallow pointer events.
 */
function MapStatusOverlay({ status, message, onRetry }: MapStatusOverlayProps) {
  if (status === 'ready') return null;

  return (
    <div className={`map-state map-state--${status}`} role="status">
      {status === 'loading' && <LoadingBody />}
      {status === 'empty' && <EmptyBody />}
      {status === 'error' && <ErrorBody message={message} onRetry={onRetry} />}
    </div>
  );
}

export default MapStatusOverlay;
