import { memo, useState } from 'react';
import { MapTooltip } from '../MapTooltip/MapTooltip';
import { formatNumber } from '../../utils/formatNumber';
import type { SiteFeature } from '../../services/siteFeatures/siteFeatures';
import { SITE_ICON_CLASS, SITE_ICON_SIZE } from './siteFeatureLayout';
import type { Point, Size, StyleWithCssVariables, UtmCoordinates } from '../../types/map';
import './SiteFeatureOverlay.css';


export interface SiteFeatureOverlayProps {
  features: readonly SiteFeature[];
  /** Where a UTM point is drawn, in viewport px. */
  toViewport: (point: UtmCoordinates) => Point;
  /** Whether the dashed footprints are drawn (only when zoomed in far enough). */
  showOutlines: boolean;
  /** The feature whose popup is open, or null. */
  pinnedId: string | null;
  onToggle: (id: string) => void;
  viewport: Size;
  /** False while a map tool (measure, area select, screenshot) owns the pointer: icons let clicks through, no popup. */
  isInteractive?: boolean;
  /** Hides the popup, e.g. while the map is being dragged. */
  hidePopup?: boolean;
}

/** A steady colour per type, for the circle drawn when an icon fails to load. */
function fallbackColor(type: string): string {
  let hash = 0;
  for (const character of type) hash = (hash * 31 + character.charCodeAt(0)) | 0;

  return `hsl(${Math.abs(hash) % 360} 65% 42%)`;
}

const SiteIcon = memo(function SiteIcon({ feature, at, isPinned, onToggle }: {
  feature: SiteFeature;
  at: Point;
  isPinned: boolean;
  onToggle: (id: string) => void;
}) {
  const [hasFailed, setHasFailed] = useState(false);
  const style: StyleWithCssVariables = {
    left: at.x,
    top: at.y,
    '--site-icon-size': `${SITE_ICON_SIZE}px`,
    '--site-fallback-color': fallbackColor(feature.type),
  };

  return (
    <button
      type="button"
      className={`${SITE_ICON_CLASS}${isPinned ? ' is-pinned' : ''}${hasFailed ? ' is-fallback' : ''}`}
      style={style}
      data-site-feature={feature.id}
      aria-label={feature.name}
      aria-pressed={isPinned}
      title={feature.name}
      onClick={(event) => {
        event.stopPropagation();
        onToggle(feature.id);
      }}
    >
      {!hasFailed && <img src={feature.iconSrc} alt="" draggable="false" onError={() => setHasFailed(true)} />}
    </button>
  );
});

/**
 * Site features (pilot factory, mud pit, …) over the map, in viewport px:
 * dashed footprints when zoomed in, a fixed-size icon per feature above every
 * other map layer, and a popup (name, area, coordinates) for the clicked one.
 * Each map projects the points itself, through `toViewport`.
 */
function SiteFeatureOverlay({
  features, toViewport, showOutlines, pinnedId, onToggle, viewport, isInteractive = true, hidePopup = false,
}: SiteFeatureOverlayProps) {
  if (!features.length) return null;

  const pinned = (isInteractive && !hidePopup && features.find(({ id }) => id === pinnedId)) || null;

  return (
    <>
      <div className={`site-feature-layer${isInteractive ? '' : ' is-inert'}`}>
        {showOutlines && (
          <svg className="site-feature-outlines" aria-hidden="true">
            {features.filter(({ outlineUtm }) => outlineUtm.length).map((feature) => (
              <polygon
                key={feature.id}
                data-site-outline={feature.id}
                points={feature.outlineUtm.map((point) => {
                  const { x, y } = toViewport(point);
                  return `${x.toFixed(1)},${y.toFixed(1)}`;
                }).join(' ')}
              />
            ))}
          </svg>
        )}
        {features.map((feature) => (
          <SiteIcon
            key={feature.id}
            feature={feature}
            at={toViewport(feature.utm)}
            isPinned={isInteractive && feature.id === pinnedId}
            onToggle={onToggle}
          />
        ))}
      </div>

      {pinned && (
        <MapTooltip
          at={toViewport(pinned.utm)}
          markerHalf={SITE_ICON_SIZE / 2}
          viewport={viewport}
          isPinned
          className="site-feature-tooltip"
          label={pinned.name}
          holeId={pinned.id}
        >
          <span className="drillhole-tooltip" role="tooltip">
            <strong>{pinned.name}</strong>
            <dl className="drillhole-tooltip__fields">
              <div>
                <dt>Area</dt>
                <dd>{pinned.areaHa === null ? '—' : `${formatNumber(pinned.areaHa, 2)} ha`}</dd>
              </div>
              <div>
                <dt>Lat, Lon</dt>
                <dd>{pinned.lonLat[1].toFixed(5)}, {pinned.lonLat[0].toFixed(5)}</dd>
              </div>
            </dl>
          </span>
        </MapTooltip>
      )}
    </>
  );
}

export default memo(SiteFeatureOverlay);
