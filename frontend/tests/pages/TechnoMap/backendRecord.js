// What GET /api/techno-map derives for a pyISR_AllData_V2 row, for tests that
// start from raw fields. Mirrors the backend exactly:
//   category      - backend/Models/TechnoMap/TechnoMapCategory.cs
//   deviationEnd* - the DeviationEndX/Y CASE in TechnoMapRepository.cs

const CATEGORY_BY_TYPE = {
  DEVELOP: "development",
  EAU: "water",
  EXPLO: "exploration",
  GEOTECHNICAL: "geotechnical",
  INJECT: "injector",
  PIEZO: "monitoring",
  PRODUCT: "producer",
  WATER_WELL: "water",
};

export function resolveCategory(type, raGradeSampling, sedimentSampling) {
  if (raGradeSampling === true) return "ra-grade-sampling";
  if (sedimentSampling === true) return "sediment-sampling";
  if (typeof type !== "string") return null;

  return CATEGORY_BY_TYPE[type.trim().toUpperCase()] ?? null;
}

const toNumber = (value) => (value === null || value === undefined || value === "" ? null : Number(value));

export function deviationEndpoint({ x, y, azimuth, finalDeviation }) {
  [x, y, azimuth, finalDeviation] = [x, y, azimuth, finalDeviation].map(toNumber);
  if (x === null || y === null || azimuth === null || finalDeviation === null) return null;
  if (!(azimuth >= 0 && azimuth <= 360) || !(finalDeviation > 0)) return null;

  const radians = (azimuth * Math.PI) / 180;

  return { x: x + finalDeviation * Math.sin(radians), y: y + finalDeviation * Math.cos(radians) };
}

/** A record as the API would send it: the derived fields added, in the record's own casing. */
export function asBackendRecord(row) {
  const pick = (field) => row[field] ?? row[field[0].toUpperCase() + field.slice(1)];
  const pascal = "X" in row || "HolePurpose" in row;
  const category = pick("category") ?? resolveCategory(pick("holePurpose"), pick("raGradeSampling"), pick("sedimentSampling"));
  const end = deviationEndpoint({ x: pick("x"), y: pick("y"), azimuth: pick("azimuth"), finalDeviation: pick("finalDeviation") });

  return {
    ...row,
    [pascal ? "Category" : "category"]: category,
    [pascal ? "DeviationEndX" : "deviationEndX"]: end?.x ?? null,
    [pascal ? "DeviationEndY" : "deviationEndY"]: end?.y ?? null,
  };
}
