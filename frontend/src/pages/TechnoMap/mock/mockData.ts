// Fixed demo dataset for `dataSource: mock` (technoMap.yaml).
//
// Illustrative only: ids, grades and deviations are made up and are not
// survey or production results. Positions are computed once from fixed
// offsets and an integer hash, so every load produces identical records.
//
// Layout, in UTM metres around a NE-trending wellfield near the map centre:
//   - 5 technological cells along the trend, each a line-drive pattern of
//     6 injectors and 6 producers
//   - development step-outs just around the wellfield, exploration further out
//   - a monitoring ring around the wellfield, geotechnical holes at a plant site
//   - Ra-grade samples along the ore trend, sediment samples down a drainage,
//     water wells on a northern supply line and at a few scattered sites
//
// 130 unique holes; 10 of them drilling in progress, 30 with deviation.
//
// Records have the /api/techno-map shape: the SQL Type as holePurpose, the
// sampling flags, and the category and deviation endpoint the backend would
// resolve for them.

import type { DrillholeType } from '../config/technoMapConfig';
import type { DrillholeApiRecord } from '../../../types/drillhole';
import type { UtmCoordinates } from '../../../types/map';

export interface TechnoCell {
  id: string;
  label: string;
  /** Polygon outline in UTM metres. */
  vertices: readonly UtmCoordinates[];
}

const CENTRE: UtmCoordinates = { x: 418200, y: 4894300 };
const TREND_DEGREES = 35;
const ALONG = { x: Math.sin((TREND_DEGREES * Math.PI) / 180), y: Math.cos((TREND_DEGREES * Math.PI) / 180) };
const ACROSS = { x: ALONG.y, y: -ALONG.x };

const CELL_COUNT = 5;
const CELL_SPACING = 260;
const WELL_SPACING = 50;
const ROW_SPACING = 45;

/** Deterministic 0-1 value for an integer seed (integer hash, same on every engine). */
function noise(seed: number): number {
  let hash = Math.imul(seed ^ 0x9e3779b9, 0x85ebca6b);
  hash ^= hash >>> 13;
  hash = Math.imul(hash, 0xc2b2ae35);
  hash ^= hash >>> 16;

  return (hash >>> 0) / 4294967296;
}

const round = (value: number, digits: number) => Number(value.toFixed(digits));

/** Wellfield frame (metres along / across the trend) to UTM, with a few metres of jitter. */
function wellfieldPoint(along: number, across: number, seed = 0, jitter = 0): UtmCoordinates {
  const a = along + (noise(seed * 2 + 1) - 0.5) * jitter;
  const b = across + (noise(seed * 2 + 2) - 0.5) * jitter;

  return { x: round(CENTRE.x + a * ALONG.x + b * ACROSS.x, 2), y: round(CENTRE.y + a * ALONG.y + b * ACROSS.y, 2) };
}

const cellAlong = (cell: number) => (cell - (CELL_COUNT - 1) / 2) * CELL_SPACING;

// --- Positions per type ------------------------------------------------------

// Rows alternate injector / producer; producer rows sit half a spacing over.
function patternWells(rowParity: 0 | 1, seedBase: number): UtmCoordinates[] {
  return Array.from({ length: CELL_COUNT }, (_, cell) => [0, 1, 2, 3]
    .filter((row) => row % 2 === rowParity)
    .flatMap((row) => [0, 1, 2].map((column) => {
      const index = cell * 12 + row * 3 + column;
      const across = (column - 1) * WELL_SPACING + (row % 2 ? WELL_SPACING / 2 : 0) - WELL_SPACING / 4;

      return wellfieldPoint(cellAlong(cell) + (row - 1.5) * ROW_SPACING, across, seedBase + index, 6);
    }))).flat();
}

const fromWellfield = (offsets: readonly (readonly [number, number])[], seedBase: number) =>
  offsets.map(([along, across], index) => wellfieldPoint(along, across, seedBase + index, 20));

const fromUtm = (points: readonly (readonly [number, number])[]) => points.map(([x, y]) => ({ x, y }));

const DEVELOPMENT = fromWellfield([
  [-760, -40], [-720, 90], [760, 30], [720, -100], [-380, 190],
  [-120, -200], [150, 205], [420, -190], [600, 170], [-560, -180],
], 300);

const EXPLORATION = fromWellfield([
  [-1500, 120], [-1250, -380], [1300, 260], [1650, -150], [-300, 650],
  [380, -700], [900, 800], [-900, -820], [2100, 400], [-2000, -300],
], 400);

// An ellipse about 300 m outside the wellfield.
const MONITORING = Array.from({ length: 10 }, (_, index) => {
  const angle = ((18 + index * 36) * Math.PI) / 180;

  return wellfieldPoint(950 * Math.cos(angle), 420 * Math.sin(angle), 500 + index, 30);
});

const GEOTECHNICAL = fromUtm([
  [419900, 4893100], [420020, 4893140], [420130, 4893080], [419960, 4892970], [420080, 4892940],
  [419810, 4893040], [420200, 4893210], [419860, 4893250], [420040, 4893290], [420160, 4892960],
]);

const RA_GRADE_SAMPLING = fromWellfield([
  [-450, 120], [-200, -130], [60, 125], [300, -120], [520, 110],
  [-650, 40], [880, -30], [-880, 60], [1050, 90], [-1100, -60],
], 600);

// Down a NW-SE drainage, meandering either side of its line.
const SEDIMENT_SAMPLING = Array.from({ length: 10 }, (_, index) => {
  const t = index / 9;
  const meander = 250 * Math.sin(index * 1.3);

  return {
    x: round(414300 + t * 7500 + meander * 0.58, 2),
    y: round(4896900 - t * 5300 + meander * 0.82, 2),
  };
});

const WATER = fromUtm([
  [415200, 4897300], [415660, 4897360], [416110, 4897270], [416570, 4897340], [417020, 4897250],
  [417480, 4897320], [417000, 4892000], [421500, 4895800], [413800, 4893400], [422600, 4892400],
]);

// --- Records -----------------------------------------------------------------

interface TypeSpec {
  prefix: string;
  /** SQL Type. */
  purpose: string;
  /** What the backend resolves: the sampling category if flagged, else the Type's. */
  category: DrillholeType;
  sampling?: 'ra-grade' | 'sediment';
  points: readonly UtmCoordinates[];
  /** GT range for holes that are logged, or null for types without assays. */
  gt: readonly [number, number] | null;
  depth: readonly [number, number];
  inProgress: readonly number[];
  deviated: readonly number[];
}

const injectorPositions = patternWells(0, 0);
const producerPositions = patternWells(1, 0);

const TYPES: readonly TypeSpec[] = [
  { prefix: 'DEV', purpose: 'DEVELOP', category: 'development', points: DEVELOPMENT, gt: [0.01, 0.35], depth: [360, 440], inProgress: [2, 6], deviated: [0, 3, 5, 8] },
  { prefix: 'EXP', purpose: 'EXPLO', category: 'exploration', points: EXPLORATION, gt: [0, 0.2], depth: [400, 520], inProgress: [4], deviated: [1, 5, 7, 9] },
  { prefix: 'GEO', purpose: 'GEOTECHNICAL', category: 'geotechnical', points: GEOTECHNICAL, gt: null, depth: [30, 60], inProgress: [5], deviated: [0, 4] },
  { prefix: 'INJ', purpose: 'INJECT', category: 'injector', points: injectorPositions, gt: [0.02, 0.9], depth: [380, 430], inProgress: [8, 21], deviated: [1, 4, 7, 10, 13, 16, 19, 22, 25, 28] },
  { prefix: 'MON', purpose: 'PIEZO', category: 'monitoring', points: MONITORING, gt: null, depth: [380, 450], inProgress: [7], deviated: [] },
  { prefix: 'PRD', purpose: 'PRODUCT', category: 'producer', points: producerPositions, gt: [0.03, 1.2], depth: [380, 430], inProgress: [4, 14, 26], deviated: [0, 3, 6, 9, 12, 15, 18, 21, 24, 27] },
  { prefix: 'RAS', purpose: 'EXPLO', category: 'ra-grade-sampling', sampling: 'ra-grade', points: RA_GRADE_SAMPLING, gt: [0.01, 0.6], depth: [380, 440], inProgress: [], deviated: [] },
  { prefix: 'SED', purpose: 'EXPLO', category: 'sediment-sampling', sampling: 'sediment', points: SEDIMENT_SAMPLING, gt: null, depth: [5, 15], inProgress: [], deviated: [] },
  { prefix: 'WTR', purpose: 'WATER_WELL', category: 'water', points: WATER, gt: null, depth: [150, 260], inProgress: [], deviated: [] },
];

const between = ([min, max]: readonly [number, number], seed: number, digits: number) =>
  round(min + noise(seed) * (max - min), digits);

function buildRecords(): DrillholeApiRecord[] {
  return TYPES.flatMap(({ prefix, purpose, category, sampling, points, gt, depth, inProgress, deviated }, typeIndex) =>
    points.map(({ x, y }, index) => {
      const seed = 10_000 + typeIndex * 1000 + index * 10;
      const isInProgress = inProgress.includes(index);
      const isDeviated = deviated.includes(index);
      const azimuth = isDeviated ? between([0, 360], seed + 3, 2) : null;
      const finalDeviation = isDeviated ? between([1, 6], seed + 4, 2) : null;
      // As the backend computes it: azimuth is a bearing, so sine moves the easting.
      const radians = ((azimuth ?? 0) * Math.PI) / 180;

      return {
        id: String(typeIndex * 100 + index + 1),
        holeId: `TM-${prefix}-${String(index + 1).padStart(3, '0')}`,
        coordinateType: 'UTM',
        x,
        y,
        z: between([995, 1030], seed, 2),
        year: 2026,
        campaign: 'DEMO DATASET',
        holePurpose: purpose,
        category,
        raGradeSampling: sampling === 'ra-grade',
        sedimentSampling: sampling === 'sediment',
        holeStatus: isInProgress ? 'INPROGRESS' : 'VALIDATED',
        // Holes still being drilled have no assay, depth or deviation survey yet.
        gt: gt && !isInProgress ? between(gt, seed + 1, 4) : null,
        maxDepth: isInProgress ? null : between(depth, seed + 2, 1),
        azimuth,
        finalDeviation,
        deviationEndX: finalDeviation === null ? null : round(x + Math.sin(radians) * finalDeviation, 4),
        deviationEndY: finalDeviation === null ? null : round(y + Math.cos(radians) * finalDeviation, 4),
      };
    }));
}

function buildCells(): TechnoCell[] {
  // Rectangle around each cell's 12 wells, with slightly irregular corners.
  const outline: readonly (readonly [number, number])[] = [
    [-100, -80], [-30, -88], [100, -78], [104, 0], [96, 84], [0, 90], [-98, 80], [-104, 0],
  ];

  return Array.from({ length: CELL_COUNT }, (_, cell) => {
    const label = `TC-${String(cell + 1).padStart(3, '0')}`;

    return {
      id: label,
      label,
      vertices: outline.map(([along, across]) => wellfieldPoint(cellAlong(cell) + along, across)),
    };
  });
}

export const MOCK_DRILLHOLES: readonly DrillholeApiRecord[] = Object.freeze(buildRecords());
export const MOCK_CELLS: readonly TechnoCell[] = Object.freeze(buildCells());
