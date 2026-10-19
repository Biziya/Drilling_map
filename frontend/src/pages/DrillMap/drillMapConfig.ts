import { MAP_IMAGE_PATH, MAP_UTM_BOUNDS as CONFIGURED_MAP_UTM_BOUNDS } from '../../config/env';
import type {
  ApiText,
  DrillholeApiRecord,
} from '../../types/drillhole';
import type {
  DrillholeStatusConfig,
  GtRange,
  MapBounds,
  MapPageSettings,
} from '../../types/map';

export const BASE_MAP_SRC: string = MAP_IMAGE_PATH;

/**
 * Multiplier applied to the measured deviation before it is drawn.
 *
 * A real deviation of a few metres is invisible at map scale, so the line is
 * exaggerated. This is a display factor only and never feeds a calculation
 * the user reads as a measurement.
 */
export const DEVIATION_LINE_EXAGGERATION = 5;

export const RIG_ICON_SRC = '/rig.svg';

// Neutral fill for the legend's shape swatches: on the map itself the fill
// carries the GT grade, which the shape legend is not about.
export const LEGEND_SYMBOL_COLOR = '#111827';

export const MAP_SETTINGS: MapPageSettings = {
  minZoom: 1,
  maxZoom: 90,
  zoomStep: 0.4,
  // Zoom level the wheel/button steps snap to, and the zoom from which
  // deviation lines are drawn. One value for both, matching Techno Map.
  deviationMinZoom: 10,
  showLegends: true,
};

/** UTM rectangle the base map image covers. */
export const MAP_UTM_BOUNDS: Readonly<MapBounds> = CONFIGURED_MAP_UTM_BOUNDS;

export const STATUS_CONFIG = {
  Validated: { color: '#15803d', shape: 'square', label: 'Validated DH' },
  'Waiting for Final Validation': {
    color: '#86efac',
    shape: 'square-outline',
    label: 'Waiting for Final Validation',
  },
  'Hydrogeological Program': {
    color: '#2563eb',
    shape: 'circle',
    label: 'Hydrogeological Program',
  },
  'Hydrogeological DH Realized': {
    color: '#0e7490',
    shape: 'circle',
    label: 'Hydrogeological DH Realized',
  },
  'Drilled, not equipped': {
    color: '#7c3aed',
    shape: 'diamond',
    label: 'Drilled, not equipped',
  },
  'Infill Program': {
    color: '#eab308',
    shape: 'circle',
    label: 'Infill Program',
  },
  'Infill Program - Next Points': {
    color: '#111827',
    shape: 'triangle',
    label: 'Infill Program - Next Points',
  },
} as const satisfies Record<string, DrillholeStatusConfig>;

/** Every status the map knows how to draw. */
export type DrillholeStatusName = keyof typeof STATUS_CONFIG;

const DEFAULT_STATUS: DrillholeStatusName = 'Validated';
const PLANNED_STATUS: DrillholeStatusName = 'Infill Program - Next Points';

/**
 * GT grade bands, lowest first.
 *
 * Bands are inclusive of their lower bound and exclusive of their upper one,
 * except the final band which includes 4 so the top of the scale is covered.
 */
export const GT_RANGES: readonly GtRange[] = [
  { min: 0, max: 0.025, label: '0 – 0.025', color: '#dbeafe' },
  { min: 0.025, max: 0.05, label: '0.025 – 0.05', color: '#93c5fd' },
  { min: 0.05, max: 0.1, label: '0.05 – 0.1', color: '#38bdf8' },
  { min: 0.1, max: 0.25, label: '0.1 – 0.25', color: '#22c55e' },
  { min: 0.25, max: 0.5, label: '0.25 – 0.5', color: '#facc15' },
  { min: 0.5, max: 4, label: '0.5 – 4', color: '#ef4444' },
];

const GT_MAX = 4;

export const REDOX_CONFIG: Readonly<Record<string, string>> = {
  Reduced: '#e1e1e1',
  Intermediate: '#ffffbe',
  Oxidized: '#dedec0',
};

/**
 * Classifies a GT reading into its colour band.
 *
 * Takes `unknown` because the value comes straight off an API record and is
 * routinely null, blank or a numeric string. Returns null for anything that
 * is not a real reading in range: a whitespace-only string coerces to 0 and
 * would otherwise be painted as a genuine low-grade assay.
 */
export function getGtRange(value: unknown): GtRange | null {
  if (value === null || value === undefined || typeof value === 'boolean') return null;
  if (typeof value === 'string' && !value.trim()) return null;
  if (typeof value !== 'number' && typeof value !== 'string') return null;

  const gt = Number(value);
  if (!Number.isFinite(gt) || gt < 0 || gt > GT_MAX) return null;

  return (
    GT_RANGES.find(({ min, max }) => gt >= min && (gt < max || (max === GT_MAX && gt === GT_MAX))) ??
    null
  );
}

const STATUS_NAMES: ReadonlySet<string> = new Set(Object.keys(STATUS_CONFIG));

/**
 * True for a status the map has a configuration entry for.
 *
 * A membership test rather than an index lookup, so an arbitrary string from
 * the API can never be used to reach into the configuration object.
 */
export function isDrillholeStatusName(value: ApiText | undefined): value is DrillholeStatusName {
  return typeof value === 'string' && STATUS_NAMES.has(value);
}

/** Resolves the status a drillhole should be drawn as. */
export function getDrillholeStatus(
  drillhole: Pick<DrillholeApiRecord, 'status' | 'coordinateType'>,
): DrillholeStatusName {
  if (isDrillholeStatusName(drillhole.status)) return drillhole.status;

  // Checked as a string rather than String()-ing it: a null coordinateType
  // became the literal "null", which happened not to contain "planned" but
  // only by luck.
  const coordinateType = drillhole.coordinateType;
  const isPlanned = typeof coordinateType === 'string'
    && coordinateType.toLowerCase().includes('planned');

  return isPlanned ? PLANNED_STATUS : DEFAULT_STATUS;
}
