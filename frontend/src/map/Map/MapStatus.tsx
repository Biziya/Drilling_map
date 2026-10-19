import { BASE_MAP_SRC } from '../config/mapConfig';
import type { MapDataStatus } from '../hooks/useMapData';

// Persistent states only. Temporary feedback (refreshed, backend down) is a
// toast, raised by the map data store.
const NOTICES: Readonly<Record<Exclude<MapDataStatus, 'ready'>, { title: string; detail?: string }>> = {
  loading: { title: 'Loading drillholes…' },
  empty: { title: 'No drillholes found', detail: 'The API returned an empty result.' },
  unplaceable: { title: 'No drillholes to place', detail: 'None have valid UTM coordinates.' },
  unavailable: { title: 'No map data available', detail: 'Use the refresh button to try again.' },
};

export interface MapStatusProps {
  status: MapDataStatus;
  imageFailed: boolean;
}

/** A small centred notice while the map has nothing to show. */
function MapStatus({ status, imageFailed }: MapStatusProps) {
  if (imageFailed) {
    return (
      <div className="map-missing" role="status">
        <strong>Base map not found</strong>
        <span>Add the image as <code>public{BASE_MAP_SRC}</code>.</span>
      </div>
    );
  }

  if (status === 'ready') return null;

  const { title, detail } = NOTICES[status];

  return (
    <div className={`map-state map-state--${status}`} role="status">
      {status === 'loading' && <span className="map-state__spinner" aria-hidden="true" />}
      <strong>{title}</strong>
      {detail && <span>{detail}</span>}
    </div>
  );
}

export default MapStatus;
