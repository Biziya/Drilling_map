import { MAP_IMAGE_PATH, MAP_UTM_BOUNDS as CONFIGURED_MAP_UTM_BOUNDS } from '../../config/env';
import type { ApiText, DrillholeApiRecord } from '../../types/drillhole';
import type {
  DrillholeStatusConfig,
  GtRange,
  MapBounds,
  MapPageSettings,
} from '../../types/map';

export const TECHNO_BASE_MAP_SRC: string = MAP_IMAGE_PATH;

export const TECHNO_RIG_ICON_SRC = '/rig.svg';

// Neutral fill for the legend's shape swatches: on the map itself the fill
// carries the GT grade, which the shape legend is not about.
export const TECHNO_LEGEND_SYMBOL_COLOR = '#111827';

/**
 * Multiplier applied to the measured deviation before it is drawn. Must stay
 * equal to the Exploration Map's factor: the two maps are required to draw
 * identical deviation lines.
 */
export const TECHNO_DEVIATION_LINE_EXAGGERATION = 5;

export const TECHNO_MAP_SETTINGS: MapPageSettings = {
  minZoom: 1,
  maxZoom: 90,
  zoomStep: 0.4,
  deviationMinZoom: 10,
  showLegends: true,
};

/** UTM rectangle the base map image covers. */
export const TECHNO_MAP_UTM_BOUNDS: Readonly<MapBounds> = CONFIGURED_MAP_UTM_BOUNDS;

export const TECHNO_STATUS_CONFIG = {
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

/** Every status the Techno Map knows how to draw. */
export type TechnoDrillholeStatusName = keyof typeof TECHNO_STATUS_CONFIG;

const DEFAULT_STATUS: TechnoDrillholeStatusName = 'Validated';
const PLANNED_STATUS: TechnoDrillholeStatusName = 'Infill Program - Next Points';

/**
 * GT grade bands, lowest first. Must stay identical to the Exploration Map's
 * bands: the same grade has to paint the same colour on both pages.
 */
export const TECHNO_GT_RANGES: readonly GtRange[] = [
  { min: 0, max: 0.025, label: '0 – 0.025', color: '#dbeafe' },
  { min: 0.025, max: 0.05, label: '0.025 – 0.05', color: '#93c5fd' },
  { min: 0.05, max: 0.1, label: '0.05 – 0.1', color: '#38bdf8' },
  { min: 0.1, max: 0.25, label: '0.1 – 0.25', color: '#22c55e' },
  { min: 0.25, max: 0.5, label: '0.25 – 0.5', color: '#facc15' },
  { min: 0.5, max: 4, label: '0.5 – 4', color: '#ef4444' },
];

const GT_MAX = 4;

export const TECHNO_REDOX_CONFIG: Readonly<Record<string, string>> = {
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
export function getTechnoMapGtRange(value: unknown): GtRange | null {
  if (value === null || value === undefined || typeof value === 'boolean') return null;
  if (typeof value === 'string' && !value.trim()) return null;
  if (typeof value !== 'number' && typeof value !== 'string') return null;

  const gt = Number(value);
  if (!Number.isFinite(gt) || gt < 0 || gt > GT_MAX) return null;

  return (
    TECHNO_GT_RANGES.find(
      ({ min, max }) => gt >= min && (gt < max || (max === GT_MAX && gt === GT_MAX)),
    ) ?? null
  );
}

const TECHNO_STATUS_NAMES: ReadonlySet<string> = new Set(Object.keys(TECHNO_STATUS_CONFIG));

/**
 * True for a status the map has a configuration entry for.
 *
 * A membership test rather than an index lookup, so an arbitrary string from
 * the API can never be used to reach into the configuration object.
 */
export function isTechnoDrillholeStatusName(
  value: ApiText | undefined,
): value is TechnoDrillholeStatusName {
  return typeof value === 'string' && TECHNO_STATUS_NAMES.has(value);
}

/** Resolves the status a drillhole should be drawn as. */
export function getTechnoMapDrillholeStatus(
  drillhole: Pick<DrillholeApiRecord, 'status' | 'coordinateType'>,
): TechnoDrillholeStatusName {
  if (isTechnoDrillholeStatusName(drillhole.status)) return drillhole.status;

  // Checked as a string rather than String()-ing it: a null coordinateType
  // became the literal "null", which happened not to contain "planned" but
  // only by luck.
  const coordinateType = drillhole.coordinateType;
  const isPlanned = typeof coordinateType === 'string'
    && coordinateType.toLowerCase().includes('planned');

  return isPlanned ? PLANNED_STATUS : DEFAULT_STATUS;
}
