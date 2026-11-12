import data from './drillMap.yaml';
import { MAP_IMAGE_PATH, MAP_UTM_BOUNDS as ENV_UTM_BOUNDS } from '../../../config/env';
import type { MarkerKind } from '../utils/markerKind';
import type { GtRange, MapBounds, MapId } from '../../../types/map';

/** Keys this page's data and view are stored under. */
export const MAP_ID: MapId = 'exploration-map';

/** Backgrounds the map can be drawn on. Labels, order and the default are in the YAML. */
export type BaseMapId = 'redox' | 'geological' | 'white-grid';

interface DrillMapConfig {
  title: string;
  zoom: {
    minZoom: number;
    maxZoom: number;
    zoomStep: number;
    adaptiveZoomEnabled: boolean;
    minWheelZoomStep: number;
    maxWheelZoomStep: number;
    deviationMinZoom: number;
  };
  baseMap: {
    options: { id: BaseMapId; label: string; src?: string; bounds?: MapBounds }[];
    default: BaseMapId;
    whiteGrid: {
      background: string;
      lineColor: string;
      lineWidth: number;
      labelColor: string;
      labelFontSize: number;
      minLineSpacing: number;
    };
  };
  showLegends: boolean;
  deviationExaggeration: number;
  rigIconSrc: string;
  uniformMarkerColor: string;
  legendSymbolColor: string;
  gtRanges: GtRange[];
  redox: Record<string, string>;
  markerLabels: Record<MarkerKind, string>;
  legendSymbols: { kind: MarkerKind; label: string }[];
  measurement: { color: string };
  legend: {
    paddingBlock: number;
    paddingInline: number;
    columnGap: number;
    rowGap: number;
    titleGap: number;
    titleFontSize: number;
    labelFontSize: number;
    labelGap: number;
    symbolSize: number;
    gt: { columns: number; rowGap: number; columnGap: number };
    redox: { rowGap: number };
    symbols: { rigIconScale: number; rowGap: number };
  };
}

export const MAP_CONFIG = data as DrillMapConfig;

export const MAP_SETTINGS = MAP_CONFIG.zoom;

/** Where a base map is drawn from and what it covers. */
interface BaseMapLayout {
  /** Image shown as the background, or null when the white grid is drawn instead. */
  src: string | null;
  /**
   * Image the canvas is laid out on (loaded even while hidden): its size is
   * what every feature is placed against.
   */
  imageSrc: string;
  /** UTM rectangle the image covers. */
  bounds: Readonly<MapBounds>;
}

const layouts = new Map<BaseMapId, BaseMapLayout>(
  MAP_CONFIG.baseMap.options.map((option) => {
    // Without its own image and corners, a base map uses the environment's
    // VITE_MAP_IMAGE_PATH and VITE_MAP_* bounds: the Geological Map.
    const imageSrc = option.src ?? MAP_IMAGE_PATH;
    const layout: BaseMapLayout = Object.freeze({
      src: option.id === 'white-grid' ? null : imageSrc,
      imageSrc,
      bounds: option.bounds ?? ENV_UTM_BOUNDS,
    });

    return [option.id, layout];
  }),
);

/** The image and UTM corners of a base map; the default's for one not offered. */
export function baseMapLayout(id: BaseMapId): BaseMapLayout {
  return (layouts.get(id) ?? layouts.get(MAP_CONFIG.baseMap.default)) as BaseMapLayout;
}

/** The default base map's image and UTM corners, used when no base map is named. */
export const BASE_MAP_SRC = baseMapLayout(MAP_CONFIG.baseMap.default).imageSrc;
export const MAP_UTM_BOUNDS = baseMapLayout(MAP_CONFIG.baseMap.default).bounds;

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
