import MapPage from '../../map/MapPage';
import { parseMapPageConfig } from '../../map/config/mapConfig';
import { fetchTechnoMap } from '../../services/api/mapData';
import data from './config/technoMap.yaml';

const CONFIG = parseMapPageConfig(data, 'technoMap.yaml');

/** Techno Map: PRODUCT/INJECT holes from /api/techno-map. */
function TechnoMap() {
  return <MapPage config={CONFIG} fetchRecords={fetchTechnoMap} />;
}

export default TechnoMap;
