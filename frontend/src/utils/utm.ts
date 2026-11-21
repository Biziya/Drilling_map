import type { UtmCoordinates } from '../types/map';

// WGS 84 ellipsoid and the UTM projection constants.
const A = 6378137;
const F = 1 / 298.257223563;
const K0 = 0.9996;
const FALSE_EASTING = 500000;
const FALSE_NORTHING_SOUTH = 10000000;

const N = F / (2 - F);
const A_HAT = (A / (1 + N)) * (1 + N ** 2 / 4 + N ** 4 / 64);
const ALPHA = [
  N / 2 - (2 / 3) * N ** 2 + (5 / 16) * N ** 3,
  (13 / 48) * N ** 2 - (3 / 5) * N ** 3,
  (61 / 240) * N ** 3,
];
const E2 = F * (2 - F);
const E = Math.sqrt(E2);

/** Reads the UTM zone from an EPSG code such as "EPSG:32649" (north) or "EPSG:32749" (south). */
export function utmZoneFromEpsg(code: unknown): { zone: number; south: boolean } | null {
  const match = typeof code === 'string' ? /^EPSG:(\d{5})$/i.exec(code.trim()) : null;
  const value = match ? Number(match[1]) : NaN;
  if (value >= 32601 && value <= 32660) return { zone: value - 32600, south: false };
  if (value >= 32701 && value <= 32760) return { zone: value - 32700, south: true };

  return null;
}

/**
 * WGS 84 longitude/latitude (degrees) to UTM easting/northing (metres) in the
 * given zone, by the Krüger series: sub-millimetre within a zone, and still
 * well under a metre a few degrees outside it.
 */
export function lonLatToUtm(lon: number, lat: number, zone: number, south = false): UtmCoordinates {
  const phi = (lat * Math.PI) / 180;
  const lambda = ((lon - (zone * 6 - 183)) * Math.PI) / 180;

  const t = Math.sinh(Math.atanh(Math.sin(phi)) - E * Math.atanh(E * Math.sin(phi)));
  const xiPrime = Math.atan2(t, Math.cos(lambda));
  const etaPrime = Math.atanh(Math.sin(lambda) / Math.sqrt(1 + t * t));

  let xi = xiPrime;
  let eta = etaPrime;
  ALPHA.forEach((alpha, index) => {
    const j = 2 * (index + 1);
    xi += alpha * Math.sin(j * xiPrime) * Math.cosh(j * etaPrime);
    eta += alpha * Math.cos(j * xiPrime) * Math.sinh(j * etaPrime);
  });

  return {
    x: FALSE_EASTING + K0 * A_HAT * eta,
    y: (south ? FALSE_NORTHING_SOUTH : 0) + K0 * A_HAT * xi,
  };
}
