/**
 * Drillhole domain types.
 *
 *   `DrillholeMapItem`   - the drillhole as the backend documents it. Extend
 *                          this first when a column is added.
 *   `DrillholeApiRecord` - the drillhole as it actually arrives. The API sends
 *                          some columns PascalCase and some numbers as strings,
 *                          and any column can be missing, so every field is
 *                          optional and widened.
 */

/** A text column. Nullable in the database, so nullable here. */
export type ApiText = string | null;

/** A numeric column, which a misconfigured serializer may send as a string. */
export type ApiNumeric = number | string | null;

/** One drillhole as `/api/exploration-map` and `/api/techno-map` document it. */
export interface DrillholeMapItem {
  holeId: ApiText;
  coordinateType: ApiText;
  x: number | null;
  y: number | null;
  z: number | null;
  year: number | null;
  campaign: ApiText;
  gt: number | null;
  maxDepth: number | null;
  azimuth: number | null;
  finalDeviation: number | null;
  holePurpose: ApiText;
  holeStatus: ApiText;
}

/** PascalCase spellings the API also sends. Aliases, never additional data. */
export interface DrillholePascalCaseAliases {
  HoleId?: ApiText;
  Hole_ID?: ApiText;
  CoordinateType?: ApiText;
  X?: ApiNumeric;
  Y?: ApiNumeric;
  Z?: ApiNumeric;
  Year?: ApiNumeric;
  Campaign?: ApiText;
  GT?: ApiNumeric;
  MaxDepth?: ApiNumeric;
  Azimuth?: ApiNumeric;
  FinalDeviation?: ApiNumeric;
  HolePurpose?: ApiText;
  HoleStatus?: ApiText;
}

/** One drillhole as received at runtime. Treat every value as a claim to check. */
export interface DrillholeApiRecord extends DrillholePascalCaseAliases {
  holeId?: ApiText;
  coordinateType?: ApiText;
  x?: ApiNumeric;
  y?: ApiNumeric;
  z?: ApiNumeric;
  year?: ApiNumeric;
  campaign?: ApiText;
  gt?: ApiNumeric;
  maxDepth?: ApiNumeric;
  azimuth?: ApiNumeric;
  finalDeviation?: ApiNumeric;
  holePurpose?: ApiText;
  holeStatus?: ApiText;
}

/**
 * Narrows an unknown value to a drillhole record. Only the container is
 * checked: rejecting a row over one odd column would lose holes the map can
 * still place.
 */
export function isDrillholeApiRecord(value: unknown): value is DrillholeApiRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
