import { BASE_MAP_SRC } from './drillMapConfig';

function MapMissingNotice() {
  return (
    <div className="map-missing" role="status">
      <strong>Base map not found</strong>
      <span>Add the image as <code>public{BASE_MAP_SRC}</code>.</span>
    </div>
  );
}

export default MapMissingNotice;
