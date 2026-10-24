import data from './technoMap.yaml';
import { MAP_IMAGE_PATH, MAP_UTM_BOUNDS } from '../../../config/env';
import { ConfigError, boolean, dictionary, list, number, object, oneOf, parseConfig, text } from '../../../config/schema';
import type { Parser } from '../../../config/schema';
import type { MapId } from '../../../types/map';

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
export const BASE_MAP_IDS = ['geological', 'white-grid'] as const;
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
    zoom: object({ minZoom: number, maxZoom: number, zoomStep: number, deviationMinZoom: number, fitPadding: number }),
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

// Environment-specific, so these stay in VITE_* variables rather than YAML.
export const BASE_MAP_SRC = MAP_IMAGE_PATH;
export { MAP_UTM_BOUNDS };
