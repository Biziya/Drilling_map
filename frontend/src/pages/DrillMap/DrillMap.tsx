import MapPage from '../../map/MapPage';
import { parseMapPageConfig } from '../../map/config/mapConfig';
import { fetchDrillholeMap } from '../../services/api/mapData';
import data from './config/drillMap.yaml';

const CONFIG = parseMapPageConfig(data, 'drillMap.yaml');

/** Exploration Map: SEDIMENT/DEVELOP holes from /api/exploration-map. */
function DrillMap() {
  return <MapPage config={CONFIG} fetchRecords={fetchDrillholeMap} />;
}

export default DrillMap;
