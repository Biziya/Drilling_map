/// <reference types="vite/client" />

/**
 * Vite exposes every `VITE_`-prefixed variable as a string, and exposes
 * nothing at all when the variable is absent from the environment. Both facts
 * are encoded here so that callers are forced to deal with `undefined` and
 * with the string-to-number conversion rather than assuming either away.
 *
 * Only non-secret configuration belongs in this list: everything here is
 * inlined into the client bundle at build time and is readable by anyone who
 * opens the site.
 */
interface ImportMetaEnv {
  /** Origin the drillhole API is served from. Empty for a same-origin proxy. */
  readonly VITE_API_BASE_URL?: string;
  /** UTM easting of the base map's left edge. */
  readonly VITE_MAP_MIN_X?: string;
  /** UTM easting of the base map's right edge. */
  readonly VITE_MAP_MAX_X?: string;
  /** UTM northing of the base map's bottom edge. */
  readonly VITE_MAP_MIN_Y?: string;
  /** UTM northing of the base map's top edge. */
  readonly VITE_MAP_MAX_Y?: string;
  /** Public path of the base map image. */
  readonly VITE_MAP_IMAGE_PATH?: string;
  /** Base path of the Weekly Geos reporting API. Defaults to the `/weekly-api` proxy. */
  readonly VITE_WEEKLY_API_BASE_URL?: string;
  /** `true` runs the Weekly Geos pages on generated data, with no backend. */
  readonly VITE_WEEKLY_USE_MOCK?: string;
  /** Dev-server only: where `/weekly-api` is forwarded. Read in vite.config.ts. */
  readonly VITE_WEEKLY_PROXY_TARGET?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
