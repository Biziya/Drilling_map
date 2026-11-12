import data from './technoMap.yaml';
import { MAP_IMAGE_PATH, MAP_UTM_BOUNDS as ENV_UTM_BOUNDS } from '../../../config/env';
import { ConfigError, boolean, dictionary, list, number, object, oneOf, parseConfig, text } from '../../../config/schema';
import type { Parser } from '../../../config/schema';
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

export const MAP_FEATURES = ['technological-cells', 'drilling-in-progress', 'deviation-line'] as const;
export type MapFeature = (typeof MAP_FEATURES)[number];

/** The 12 map filters: one per drillhole type, one per feature layer. */
export type FilterId = DrillholeType | MapFeature;
export const FILTER_IDS: readonly FilterId[] = [...DRILLHOLE_TYPES, ...MAP_FEATURES];

/** What a marker can be drawn as: the rig, or one drillhole type's symbol. */
export const MARKER_KINDS = ['rig', ...DRILLHOLE_TYPES] as const;
export type MarkerKind = (typeof MARKER_KINDS)[number];

export const MARKER_SHAPES = [
  'square',
  'triangle',
  'circle',
  'diamond',
  'triangle-down',
  'pentagon',
  'hexagon',
  'star',
  'cross',
] as const;
export type MarkerShape = (typeof MARKER_SHAPES)[number];

/** Backgrounds the map can be drawn on. Labels, order and the default are in the YAML. */
export const BASE_MAP_IDS = ['geological', 'redox', 'white-grid'] as const;
export type BaseMapId = (typeof BASE_MAP_IDS)[number];

const markerLabels = object(
  Object.fromEntries(MARKER_KINDS.map((kind) => [kind, text])) as Record<MarkerKind, Parser<string>>,
);

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

/** `parse`, or undefined when the setting is left out. */
function optional<T>(parse: Parser<T>): Parser<T | undefined> {
  return (value, path) => (value === undefined ? undefined : parse(value, path));
}

/** A UTM rectangle in metres: finite corners, each max above its min. */
const bounds: Parser<MapBounds> = (value, path) => {
  const parsed = object({ minX: number, maxX: number, minY: number, maxY: number })(value, path);
  if (parsed.maxX <= parsed.minX) throw new ConfigError(`${path}.maxX: expected more than minX (${parsed.minX}), got ${parsed.maxX}`);
  if (parsed.maxY <= parsed.minY) throw new ConfigError(`${path}.maxY: expected more than minY (${parsed.minY}), got ${parsed.maxY}`);

  return parsed;
};

const legendLayout = {
  paddingBlock: size,
  paddingInline: size,
  rowGap: size,
  labelFontSize: size,
  labelGap: size,
  symbolSize: size,
};

/** Rejects a list that misses or repeats one of `ids`, so every filter appears exactly once. */
function coversExactly<T extends { id: string }>(entries: readonly T[], ids: readonly string[], path: string) {
  const seen = entries.map(({ id }) => id);
  const problem = ids.find((id) => seen.filter((entry) => entry === id).length !== 1);
  if (problem) throw new ConfigError(`${path}: '${problem}' must appear exactly once`);
}

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
    dataSource: oneOf('mock', 'backend'),
    zoom: object({
      minZoom: number,
      maxZoom: number,
      zoomStep: number,
      adaptiveZoomEnabled: boolean,
      minWheelZoomStep: positive,
      maxWheelZoomStep: positive,
      deviationMinZoom: number,
      fitPadding: number,
    }),
    baseMap: object({
      options: list(object({ id: oneOf(...BASE_MAP_IDS), label: text, src: optional(text), bounds: optional(bounds) })),
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
    redox: dictionary(text),
    drillholeTypes: list(object({
      id: oneOf(...DRILLHOLE_TYPES),
      label: text,
      shape: oneOf(...MARKER_SHAPES),
      color: text,
    })),
    markers: object({ size: positive, polygonSize: positive, outline: size, rigSize: positive }),
    mapFeatures: list(object({ id: oneOf(...MAP_FEATURES), label: text })),
    markerLabels,
    technologicalCells: object({ stroke: text, fill: text }),
    deviationLine: object({ color: text }),
    measurement: object({ color: text }),
    interaction: object({ hoverColor: text, pinnedColor: text }),
    legend: object({
      ...legendLayout,
      symbols: object({ rigIconScale: size, lineThickness: size }),
    }),
  }),
  data,
  'technoMap.yaml',
);

coversExactly(MAP_CONFIG.drillholeTypes, DRILLHOLE_TYPES, 'technoMap.yaml.drillholeTypes');
coversExactly(MAP_CONFIG.mapFeatures, MAP_FEATURES, 'technoMap.yaml.mapFeatures');
checkBaseMapOptions(MAP_CONFIG.baseMap, 'technoMap.yaml.baseMap');

if (MAP_CONFIG.zoom.maxWheelZoomStep < MAP_CONFIG.zoom.minWheelZoomStep) {
  throw new ConfigError('technoMap.yaml.zoom.maxWheelZoomStep: expected at least minWheelZoomStep');
}

export const MAP_SETTINGS = MAP_CONFIG.zoom;

export type DrillholeTypeConfig = (typeof MAP_CONFIG.drillholeTypes)[number];

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
export interface BaseMapLayout {
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
    // (VITE_MAP_IMAGE_PATH and the VITE_MAP_* bounds, environment-specific so
    // they stay out of the YAML): the Geological Map.
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
  // The default is checked above to be one of the options.
  return (layouts.get(id) ?? layouts.get(MAP_CONFIG.baseMap.default)) as BaseMapLayout;
}

/** The default base map's image and UTM corners, used when no base map is named. */
export const BASE_MAP_SRC = baseMapLayout(MAP_CONFIG.baseMap.default).imageSrc;
export const MAP_UTM_BOUNDS = baseMapLayout(MAP_CONFIG.baseMap.default).bounds;
