import data from './technoMap.yaml';
import { MAP_IMAGE_PATH, MAP_UTM_BOUNDS } from '../../../config/env';
import { boolean, dictionary, list, number, object, oneOf, parseConfig, text } from '../../../config/schema';
import { MARKER_KINDS } from '../utils/markerKind';
import type { GtRange, MapId } from '../../../types/map';

/** Keys this page's data and view are stored under. */
export const MAP_ID: MapId = 'techno-map';

export const MAP_CONFIG = parseConfig(
  object({
    title: text,
    zoom: object({ minZoom: number, maxZoom: number, zoomStep: number, deviationMinZoom: number }),
    showLegends: boolean,
    deviationExaggeration: number,
    rigIconSrc: text,
    uniformMarkerColor: text,
    legendSymbolColor: text,
    gtRanges: list(object({ min: number, max: number, label: text, color: text })),
    redox: dictionary(text),
    markerLabels: object({ rig: text, producer: text, injector: text }),
    legendSymbols: list(object({ kind: oneOf(...MARKER_KINDS), label: text })),
  }),
  data,
  'technoMap.yaml',
);

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
