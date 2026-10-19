import { TECHNO_BASE_MAP_SRC } from './technoMapConfig';

function MapMissingNotice() {
  return (
    <div className="techno-map-missing" role="status">
      <strong>Base map not found</strong>
      <span>Add the image as <code>public{TECHNO_BASE_MAP_SRC}</code>.</span>
    </div>
  );
}

export default MapMissingNotice;
