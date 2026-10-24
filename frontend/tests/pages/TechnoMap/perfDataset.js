// Deterministic /api/techno-map payload for performance work: any number of
// holes (5,000 by default) in the API's shape, spread over the map in
// wellfield clusters. Used by the performance tests and by the browser
// benchmark; never written to the app's own data or cache.

import { asBackendRecord } from "./backendRecord.js";

const BOUNDS = { minX: 412600, maxX: 423200, minY: 4890600, maxY: 4898000 };

// SQL Type and sampling flags, by share of the dataset.
const MIX = [
  [0.34, { holePurpose: "PRODUCT" }],
  [0.34, { holePurpose: "INJECT" }],
  [0.08, { holePurpose: "DEVELOP" }],
  [0.06, { holePurpose: "EXPLO" }],
  [0.04, { holePurpose: "PIEZO" }],
  [0.02, { holePurpose: "GEOTECHNICAL" }],
  [0.02, { holePurpose: "WATER_WELL" }],
  [0.04, { holePurpose: "EXPLO", raGradeSampling: true }],
  [0.03, { holePurpose: "EXPLO", sedimentSampling: true }],
  [0.03, { holePurpose: "SER" }],
];

/** Integer hash to [0, 1): the same seed always gives the same value. */
function noise(seed) {
  let h = Math.imul(seed ^ 0x9e3779b9, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);

  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function typeFor(r) {
  let total = 0;
  for (const [share, type] of MIX) {
    total += share;
    if (r < total) return type;
  }

  return MIX[0][1];
}

export function buildPerfDataset(count = 5000) {
  const clusters = Array.from({ length: 24 }, (_, index) => ({
    x: BOUNDS.minX + 600 + noise(index * 7 + 1) * (BOUNDS.maxX - BOUNDS.minX - 1200),
    y: BOUNDS.minY + 600 + noise(index * 7 + 2) * (BOUNDS.maxY - BOUNDS.minY - 1200),
  }));

  return Array.from({ length: count }, (_, index) => {
    const seed = index * 11 + 100;
    const cluster = clusters[index % clusters.length];
    const angle = noise(seed) * 2 * Math.PI;
    const radius = 450 * Math.sqrt(noise(seed + 1));
    const isDeviated = noise(seed + 2) < 0.25;
    const isInProgress = noise(seed + 3) < 0.02;

    return asBackendRecord({
      id: String(index + 1),
      holeId: `PERF-${String(index + 1).padStart(5, "0")}`,
      ...typeFor(noise(seed + 4)),
      holeStatus: isInProgress ? "INPROGRESS" : "COMPLETED",
      x: Number((cluster.x + radius * Math.cos(angle)).toFixed(2)),
      y: Number((cluster.y + radius * Math.sin(angle)).toFixed(2)),
      z: Number((990 + noise(seed + 5) * 40).toFixed(2)),
      license: "MV-017129",
      drillingCompany: "Perf Drilling",
      azimuth: isDeviated ? Number((noise(seed + 6) * 360).toFixed(2)) : null,
      finalDeviation: isDeviated ? Number((1 + noise(seed + 7) * 5).toFixed(2)) : null,
    });
  });
}
