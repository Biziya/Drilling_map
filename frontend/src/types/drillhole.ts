/**
 * Drillhole domain types.
 *
 * Two shapes live here and the distinction matters:
 *
 *   `DrillholeMapItem`  - the drillhole as the backend documents it. This is
 *                         the authoritative description of a row and the type
 *                         to extend when a new column is added.
 *
 *   `DrillholeApiRecord` - the drillhole as it actually arrives. The API has
 *                         been observed sending some columns PascalCase and
 *                         some numeric columns as strings, and any column can
 *                         be missing. Every field is therefore optional and
 *                         widened, and no consumer reads one without first
 *                         narrowing it.
 *
 * Keeping them apart means `DrillholeMapItem` stays a clean statement of the
 * contract while the defensive reading stays confined to the wire type.
 */

/** A text column. Nullable in the database, so nullable here. */
export type ApiText = string | null;

/**
 * A numeric column. Numbers arrive as numbers from a correctly configured
 * serializer and as strings from a misconfigured one, so both are accepted
 * and narrowed at the point of use.
 */
export type ApiNumeric = number | string | null;

/**
 * One drillhole exactly as the `/api/exploration-map` and `/api/techno-map`
 * endpoints document it. Every column is nullable because every underlying
 * database column is.
 *
 * Add new drillhole columns here first: the optional PascalCase aliases below
 * and every consumer that must handle the new field will then be flagged by
 * the compiler.
 */
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

/**
 * The PascalCase spellings the API is known to also send for some columns.
 * These are aliases of the camelCase fields above, never additional data.
 */
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

/**
 * One drillhole as received at runtime.
 *
 * Optional rather than required, and widened to `ApiNumeric` where the value
 * is a measurement, because this is untrusted input. Treat a value read from
 * this type as a claim to be checked, not a fact.
 */
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

  /** Classification used by `getDrillholeStatus`, absent from the live API. */
  status?: ApiText;
  /** Redox classification, absent from the live API. */
  redox?: ApiText;
}

/**
 * Narrows an unknown value to a drillhole record.
 *
 * Only the container is verified. Individual columns stay untrusted by
 * design, because rejecting a whole row over one unexpected value would lose
 * drillholes the map can still place.
 */
export function isDrillholeApiRecord(value: unknown): value is DrillholeApiRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
