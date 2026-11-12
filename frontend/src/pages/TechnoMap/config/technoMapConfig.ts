import data from './technoMap.yaml';
import { MAP_IMAGE_PATH, MAP_UTM_BOUNDS as ENV_UTM_BOUNDS } from '../../../config/env';
import type { MapBounds, MapId } from '../../../types/map';

/** Keys this page's data and view are stored under. */
export const MAP_ID: MapId = 'techno-map';

// The identifiers the code relies on. Labels, order and styling are in the YAML.
export const DRILLHOLE_TYPES = [
  'development',
  'exploration',
  'geotechnical',
  'injector',
  'monitoring',
  'producer',
  'ra-grade-sampling',
  'sediment-sampling',
  'water',
] as const;
export type DrillholeType = (typeof DRILLHOLE_TYPES)[number];

export const MAP_FEATURES = ['drilling-in-progress', 'deviation-line'] as const;
type MapFeature = (typeof MAP_FEATURES)[number];

/** The map filters: one per drillhole type, one per feature layer. */
export type FilterId = DrillholeType | MapFeature;
export const FILTER_IDS: readonly FilterId[] = [...DRILLHOLE_TYPES, ...MAP_FEATURES];

/** What a marker can be drawn as: the rig, or one drillhole type's symbol. */
export const MARKER_KINDS = ['rig', ...DRILLHOLE_TYPES] as const;
export type MarkerKind = (typeof MARKER_KINDS)[number];

export type MarkerShape =
  | 'square' | 'triangle' | 'circle' | 'diamond' | 'triangle-down'
  | 'pentagon' | 'hexagon' | 'star' | 'cross';

/** Backgrounds the map can be drawn on. Labels, order and the default are in the YAML. */
export type BaseMapId = 'geological' | 'white-grid';

interface DrillholeTypeConfig {
  id: DrillholeType;
  label: string;
  shape: MarkerShape;
  color: string;
}

interface TechnoMapConfig {
  title: string;
  zoom: {
    minZoom: number;
    maxZoom: number;
    zoomStep: number;
    adaptiveZoomEnabled: boolean;
    minWheelZoomStep: number;
    maxWheelZoomStep: number;
    deviationMinZoom: number;
    fitPadding: number;
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
  redox: Record<string, string>;
  drillholeTypes: DrillholeTypeConfig[];
  markers: { size: number; polygonSize: number; outline: number; rigSize: number };
  mapFeatures: { id: MapFeature; label: string }[];
  markerLabels: Record<MarkerKind, string>;
  deviationLine: { color: string };
  measurement: { color: string };
  interaction: { hoverColor: string; pinnedColor: string };
  legend: {
    paddingBlock: number;
    paddingInline: number;
    rowGap: number;
    labelFontSize: number;
    labelGap: number;
    symbolSize: number;
    symbols: { rigIconScale: number; lineThickness: number };
  };
}

export const MAP_CONFIG = data as TechnoMapConfig;

export const MAP_SETTINGS = MAP_CONFIG.zoom;

/** Each drillhole type's label, shape and colour, by id. */
export const DRILLHOLE_TYPE_CONFIG = Object.fromEntries(
  MAP_CONFIG.drillholeTypes.map((entry) => [entry.id, entry]),
) as Readonly<Record<DrillholeType, DrillholeTypeConfig>>;

/** Every filter in panel and legend order: the drillhole types, then the feature layers. */
export const FILTER_ENTRIES: readonly { id: FilterId; label: string }[] = [
  ...MAP_CONFIG.drillholeTypes,
  ...MAP_CONFIG.mapFeatures,
];

/** Where a base map is drawn from and what it covers. */
interface BaseMapLayout {
  /** Image shown as the background, or null when the white grid is drawn instead. */
  src: string | null;
  /** Image the canvas is laid out on (loaded even while hidden); every feature is placed against its size. */
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
