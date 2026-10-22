import data from './drillMap.yaml';
import { MAP_IMAGE_PATH, MAP_UTM_BOUNDS } from '../../../config/env';
import { ConfigError, boolean, dictionary, list, number, object, oneOf, parseConfig, text } from '../../../config/schema';
import type { Parser } from '../../../config/schema';
import { MARKER_KINDS } from '../utils/markerKind';
import type { GtRange, MapId } from '../../../types/map';

/** Keys this page's data and view are stored under. */
export const MAP_ID: MapId = 'exploration-map';

/** Backgrounds the map can be drawn on. Labels, order and the default are in the YAML. */
export const BASE_MAP_IDS = ['geological', 'white-grid'] as const;
export type BaseMapId = (typeof BASE_MAP_IDS)[number];

/** A legend dimension in px: a finite number, never negative. */
const size: Parser<number> = (value, path) => {
  const parsed = number(value, path);
  if (parsed < 0) throw new ConfigError(`${path}: expected 0 or more, got ${parsed}`);

  return parsed;
};

/** A grid dimension in px: a finite number above 0. */
const positive: Parser<number> = (value, path) => {
  const parsed = number(value, path);
  if (parsed <= 0) throw new ConfigError(`${path}: expected more than 0, got ${parsed}`);

  return parsed;
};

/** A whole number of 1 or more. */
const count: Parser<number> = (value, path) => {
  const parsed = number(value, path);
  if (!Number.isInteger(parsed) || parsed < 1) throw new ConfigError(`${path}: expected a whole number of 1 or more, got ${parsed}`);

  return parsed;
};

const legendLayout = {
  paddingBlock: size,
  paddingInline: size,
  columnGap: size,
  rowGap: size,
  titleGap: size,
  titleFontSize: size,
  labelFontSize: size,
  labelGap: size,
  symbolSize: size,
  gt: object({ columns: count, rowGap: size, columnGap: size }),
  redox: object({ rowGap: size }),
};

/** Rejects an empty or repeating option list, or a default that is not one of the options. */
function checkBaseMapOptions({ options, default: fallback }: { options: readonly { id: string }[]; default: string }, path: string) {
  if (options.length === 0) throw new ConfigError(`${path}.options: expected at least one base map`);
  const repeated = options.find(({ id }, index) => options.findIndex((entry) => entry.id === id) !== index);
  if (repeated) throw new ConfigError(`${path}.options: '${repeated.id}' must appear only once`);
  if (!options.some(({ id }) => id === fallback)) throw new ConfigError(`${path}.default: '${fallback}' is not one of the options`);
}

export const MAP_CONFIG = parseConfig(
  object({
    title: text,
    zoom: object({ minZoom: number, maxZoom: number, zoomStep: number, deviationMinZoom: number }),
    baseMap: object({
      options: list(object({ id: oneOf(...BASE_MAP_IDS), label: text })),
      default: oneOf(...BASE_MAP_IDS),
      whiteGrid: object({
        background: text,
        lineColor: text,
        lineWidth: positive,
        labelColor: text,
        labelFontSize: positive,
        minLineSpacing: positive,
      }),
    }),
    showLegends: boolean,
    deviationExaggeration: number,
    rigIconSrc: text,
    uniformMarkerColor: text,
    legendSymbolColor: text,
    gtRanges: list(object({ min: number, max: number, label: text, color: text })),
    redox: dictionary(text),
    markerLabels: object({ rig: text, producer: text, injector: text, drillhole: text }),
    legendSymbols: list(object({ kind: oneOf(...MARKER_KINDS), label: text })),
    measurement: object({ color: text }),
    legend: object({
      ...legendLayout,
      symbols: object({ rigIconScale: size, rowGap: size }),
    }),
  }),
  data,
  'drillMap.yaml',
);

checkBaseMapOptions(MAP_CONFIG.baseMap, 'drillMap.yaml.baseMap');

export const MAP_SETTINGS = MAP_CONFIG.zoom;

// Environment-specific, so these stay in VITE_* variables rather than YAML.
export const BASE_MAP_SRC = MAP_IMAGE_PATH;
export { MAP_UTM_BOUNDS };

/**
 * Classifies a GT reading into its colour band.
 *
 * Takes `unknown` because the value comes straight off an API record. Null,
 * blank and non-numeric values return null: a whitespace-only string coerces
 * to 0 and would otherwise be painted as a genuine low-grade assay.
 */
export function getGtRange(value: unknown): GtRange | null {
  if (typeof value === 'string' && !value.trim()) return null;
  if (typeof value !== 'number' && typeof value !== 'string') return null;

  const gt = Number(value);
  const ranges = MAP_CONFIG.gtRanges;
  const top = ranges.at(-1)?.max ?? 0;
  if (!Number.isFinite(gt) || gt < 0 || gt > top) return null;

  return ranges.find(({ min, max }) => gt >= min && (gt < max || (max === top && gt === top))) ?? null;
}
