/**
 * Site features (pilot factory, mud pit, …) drawn as icons on both maps.
 *
 * The data is public/site_features/site_features.yaml, fetched at runtime so
 * it can be edited without a rebuild. Adding a feature is adding an entry
 * there: nothing here knows any feature id. The icon is the entry's `icon`,
 * or /<type>.svg when it has none.
 *
 * The YAML is in WGS 84 [longitude, latitude]; both maps are laid out in UTM
 * metres, so every point is converted with the zone named by `source_crs`.
 * A feature's `outline_utm`, when given, is used as is.
 */
import { load } from 'js-yaml';
import type { UtmCoordinates } from '../../types/map';
import { lonLatToUtm, utmZoneFromEpsg } from '../../utils/utm';

export const SITE_FEATURES_URL = '/site_features/site_features.yaml';

/** UTM 49N, the zone every map in this app is drawn in. */
const DEFAULT_ZONE = { zone: 49, south: false };

export interface SiteFeature {
  id: string;
  name: string;
  /** What kind of site this is; picks the icon when the entry names none. */
  type: string;
  iconSrc: string;
  /** Area in hectares, or null when the entry gives none. */
  areaHa: number | null;
  /** The icon's position as [longitude, latitude]. */
  lonLat: readonly [number, number];
  /** The icon's position in UTM metres. */
  utm: UtmCoordinates;
  /** The footprint in UTM metres; empty when the entry has no usable outline. */
  outlineUtm: readonly UtmCoordinates[];
}

function isPair(value: unknown): value is [number, number] {
  return Array.isArray(value) && value.length >= 2 && Number.isFinite(value[0]) && Number.isFinite(value[1]);
}

function readText(value: unknown): string | null {
  if (typeof value === 'number') return String(value);

  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function readOutline(value: unknown, toUtm: (pair: [number, number]) => UtmCoordinates): UtmCoordinates[] | null {
  if (!Array.isArray(value) || value.length < 3 || !value.every(isPair)) return null;

  return value.map(toUtm);
}

/**
 * Turns parsed YAML into features. A malformed entry is skipped with a
 * warning, so one typo never hides the rest.
 */
export function parseSiteFeatures(data: unknown): SiteFeature[] {
  if (!data || typeof data !== 'object' || !Array.isArray((data as { features?: unknown }).features)) {
    throw new Error('expected a "features" list');
  }

  const root = data as { source_crs?: unknown; features: unknown[] };
  const { zone, south } = utmZoneFromEpsg(root.source_crs) ?? DEFAULT_ZONE;
  const fromLonLat = ([lon, lat]: [number, number]) => lonLatToUtm(lon, lat, zone, south);
  const fromUtm = ([x, y]: [number, number]) => ({ x, y });
  const seen = new Set<string>();
  const features: SiteFeature[] = [];

  root.features.forEach((entry, index) => {
    const raw = (entry && typeof entry === 'object' ? entry : {}) as Record<string, unknown>;
    const id = readText(raw.id);
    const name = readText(raw.name) ?? id;
    const type = readText(raw.type);
    const position = raw.position;

    if (!id || !name || !type || !isPair(position) || seen.has(id)) {
      console.warn(`[site-features] Skipping entry ${index + 1}: it needs a unique id, a type and a [longitude, latitude] position.`);
      return;
    }

    const area = Number(raw.area_ha);
    const outlineUtm = readOutline(raw.outline_utm, fromUtm) ?? readOutline(raw.outline, fromLonLat) ?? [];
    if (!outlineUtm.length) console.warn(`[site-features] "${id}" has no usable outline; only its icon is shown.`);

    seen.add(id);
    features.push({
      id,
      name,
      type,
      iconSrc: readText(raw.icon) ?? `/${type}.svg`,
      areaHa: raw.area_ha !== undefined && Number.isFinite(area) ? area : null,
      lonLat: [position[0], position[1]],
      utm: fromLonLat(position),
      outlineUtm,
    });
  });

  return features;
}

let cached: Promise<SiteFeature[]> | null = null;

/**
 * Fetches and parses the site features, once per page load. Never rejects:
 * on any failure it logs one clear error and resolves to no features, so the
 * map carries on without them.
 */
export function loadSiteFeatures(): Promise<SiteFeature[]> {
  cached ??= (async () => {
    try {
      const response = await fetch(SITE_FEATURES_URL);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      // A missing file under a single-page-app server comes back as index.html, status 200.
      if (response.headers?.get('content-type')?.includes('text/html')) throw new Error('file not found (the server returned an HTML page)');

      return parseSiteFeatures(load(await response.text()));
    } catch (error) {
      console.error(`[site-features] Could not load ${SITE_FEATURES_URL}; the pilot factory and mud pit icons are not shown.`, error);
      return [];
    }
  })();

  return cached;
}

/** Forgets the loaded features, so the next load fetches again. For tests. */
export function resetSiteFeaturesCache(): void {
  cached = null;
}
