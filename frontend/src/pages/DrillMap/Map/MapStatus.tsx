import { BASE_MAP_SRC } from '../config/drillMapConfig';
import type { MapDataStatus } from '../hooks/useMapData';
import { describeFailure } from '../../../state/mapDataStore';
import type { MapDataFailure } from '../../../state/mapDataStore';

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
  /** Why loading failed; explains the 'unavailable' state. */
  failure?: MapDataFailure | null;
}

/** A small centred notice while the map has nothing to show. */
function MapStatus({ status, imageFailed, failure = null }: MapStatusProps) {
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
  const reason = status === 'unavailable' && failure ? describeFailure(failure) : null;

  return (
    <div className={`map-state map-state--${status}`} role="status">
      {status === 'loading' && <span className="map-state__spinner" aria-hidden="true" />}
      <strong>{title}</strong>
      {reason && <span>{reason}</span>}
      {detail && <span>{detail}</span>}
    </div>
  );
}

export default MapStatus;
