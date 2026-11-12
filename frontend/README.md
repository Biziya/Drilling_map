# Drilling Map frontend

React, TypeScript and Vite frontend for the Drilling Map application. It has
four pages.

The Exploration Map and the Techno Map are independent maps. Each plots
drillholes from UTM coordinates onto a base map image, with pan,
cursor-centred zoom, deviation lines, tooltips, a legend and a scale bar.

Drilling Details and Drilling by Rig are the drilling dashboard from the
Weekly Geos report. They chart weekly metres against the campaign plan, with
slicers, cored/destructive donuts and cross-filtering by week. The only
difference between them is whether the metres chart is split by rig.

## Quick start

```bash
npm install
npm run dev
```

| Script | What it does |
| --- | --- |
| `npm run dev` | Vite dev server |
| `npm run build` | `tsc -b && vite build`: type-check, then bundle |
| `npm run preview` | Serve the production build locally |
| `npm run typecheck` | `tsc -b --force`, no emit |
| `npm run lint` | ESLint, type-aware on `src/` |
| `npm test` | Vitest, single run |
| `npm run version:bump` | Bump `../VERSION` (see Versioning) |

Build into the publish directory:

```bash
npm run build -- --outDir publish
```

## Requirements

- Node 20.19+ or 22.12+ (Vite 7)
- A reachable backend (`../backend`) exposing `/api/exploration-map`,
  `/api/techno-map` and `/api/Dashboard/*`. All four pages talk to this one
  service.

## Environment variables

All are optional. `src/vite-env.d.ts` types them as `string | undefined`,
which is what Vite provides, and `src/config/env.ts` converts them with
explicit fallbacks. A blank value counts as missing, and a map bound that is
not a finite number falls back to its default instead of becoming `0`.

| Variable | Default | Purpose |
| --- | --- | --- |
| `VITE_API_BASE_URL` | `''` (same origin) | Origin of the backend, for the maps and the dashboard |
| `VITE_MAP_IMAGE_PATH` | `/base-map.svg` | Public path of the Geological Map image |
| `VITE_MAP_MIN_X` | `335469.35` | UTM easting of the map's left edge |
| `VITE_MAP_MAX_X` | `483969.35` | UTM easting of the map's right edge |
| `VITE_MAP_MIN_Y` | `4843775.24` | UTM northing of the map's bottom edge |
| `VITE_MAP_MAX_Y` | `4948775.24` | UTM northing of the map's top edge |

`.env` points `VITE_API_BASE_URL` at `http://localhost:5236` (the backend's
launch profile) and `.env.production` at the server address. Every request
goes through `apiUrl()` in `src/services/api/http.ts`, which prefixes that
origin, so the backend has to allow the frontend's origin (its CORS policy
currently allows any). When the variable is set, the dev server also
forwards same-origin `/api` requests to it.

Never put secrets in a `VITE_` variable. Everything with that prefix is
inlined into the client bundle at build time and is readable by anyone who
opens the site.

## Static assets

These live in `public/` and are referenced by absolute path:

- `base-map.svg` is the Geological Map. Its extent must match the
  `VITE_MAP_*` bounds, or every hole lands in the wrong place.
- `base-map3.svg` is the Redox Map, offered by the Exploration Map's base
  map switcher. Its corners are set in `src/pages/DrillMap/config/drillMap.yaml`.
- `rig.svg` is the drill rig marker, used for `HoleStatus = INPROGRESS`.

## Project layout

```
frontend/
├─ public/                    base-map.svg, base-map3.svg, rig.svg
├─ scripts/                   bump-version.mjs
├─ src/
│  ├─ main.tsx                entry point, mounts #root
│  ├─ App.tsx                 layout, sidebar, active page, toast region
│  ├─ index.css               Tailwind entry, theme tokens, base styles
│  ├─ vite-env.d.ts           typed VITE_ variables, __APP_VERSION__
│  ├─ yaml.d.ts               module declaration for *.yaml imports
│  ├─ components/
│  │  ├─ HelpDialog/          per-page help button and dialog
│  │  ├─ MapScreenshot/       drag-to-select capture of a map region
│  │  ├─ Sidebar/             navigation, collapse toggle, Online/Offline
│  │  └─ Toast/               app-wide toast store and container
│  ├─ config/                 app.yaml and app.ts, env readers, version
│  ├─ pages/                  one self-contained folder per page
│  │  ├─ DrillMap/            Exploration Map
│  │  ├─ TechnoMap/           Techno Map
│  │  └─ WeeklyGeos/          the two dashboard pages
│  ├─ services/
│  │  ├─ api/                 fetch plumbing, map endpoints, health check
│  │  └─ cache/               IndexedDB cache of the raw map responses
│  ├─ state/                  module-level stores: map data, map views,
│  │                          backend status
│  ├─ types/                  drillhole and map types
│  └─ utils/                  field readers, dedupe, number formatting,
│                             wheel handling
└─ tests/                     Vitest suite (JavaScript), mirrors src/
```

Each page has its own README covering its sections, loading, refresh and
toasts:
[`src/pages/DrillMap/README.md`](src/pages/DrillMap/README.md),
[`src/pages/TechnoMap/README.md`](src/pages/TechnoMap/README.md),
[`src/pages/WeeklyGeos/README.md`](src/pages/WeeklyGeos/README.md).

## Architecture

### Independent pages

The Exploration and Techno maps look alike today but are expected to diverge,
so each page folder owns its whole implementation: components, hooks, maths,
YAML configuration and a stylesheet scoped under its own root class. No page
imports from another; `tests/pages/pageIndependence.test.js` checks this.
Shared code is limited to global infrastructure: `services/api`,
`services/cache`, the stores in `state/`, the components in `components/`,
types, and the helpers in `utils/`.

### Configuration

Each config module imports its YAML file (parsed at build time by
`@rollup/plugin-yaml`) and casts it to a TypeScript interface, for example
`APP_CONFIG` in `src/config/app.ts`. Nothing checks the YAML at runtime, so
a typo or a wrong type in a YAML file loads without complaint and shows up
as wrong behaviour on the page. Keep each YAML file in step with the interface
next to it.

### Data flow

```
API ──► fetch*  ──► DrillholeApiRecord[] ──► state/mapDataStore ◄──► IndexedDB
                                                  │
                                            useMapData: project to xPercent / yPercent
                                                  │
                                            dedupe → features → markers + deviation lines
```

### Stale-while-revalidate

The drillhole endpoints take roughly 5 to 15 seconds. When a map first
opens, the IndexedDB copy is drawn at once while the backend is asked for
fresh data, and the response replaces both the map and the cache. Data stays
in memory across page switches without a refetch, and at most one request
per map runs at a time. A failed request never clears the map or the cache;
it raises a toast instead. The refresh button in each page header always asks
the backend. Failure toasts name the cause (no connection, timeout, HTTP
status, invalid data). Each page's README has the details.

The cache is an optimisation only. It stores the API response verbatim,
without filtering or projecting, so a later feature that needs `z` or
`maxDepth` finds it already cached. It also never rejects: private windows,
blocked storage and jsdom all resolve to "no cached data", and loading falls
back to the network.

### Notifications

`src/components/Toast` is the only toast system. Call
`showToast(type, message)` from anywhere in the UI layer; toasts appear
top-centre. Errors last 5 s, warnings and successes 3 s. A repeated message
restarts its timer instead of stacking, and at most three show at once.

### Pan and cursor-centred zoom

The canvas is transformed with `translate(translateX, translateY) scale(scale)`.
`panAroundAnchor` in each page's `utils/geometry.ts` solves for the
translation that keeps the map point under the cursor fixed, and it assumes
exactly that order of transforms. Swapping translate and scale breaks zoom.

The view lives in a ref and is committed to React state once per animation
frame, because pointer and wheel events fire far faster than React can
usefully render.

## The drillhole types

`src/types/drillhole.ts` defines two:

- `DrillholeMapItem` is the row as the backend documents it. Every column is
  nullable, because every database column is. Extend this when a column is
  added.
- `DrillholeApiRecord` is the row as it actually arrives. Every field is
  optional, numerics are widened to `number | string | null`, and the
  PascalCase aliases the API sends (`HoleStatus`, `Azimuth`,
  `FinalDeviation`, …) are declared alongside the camelCase names.

Modelling the wire format this way lets every reader stay type-safe without
indexing records by arbitrary strings. Two rules follow from it.

1. Read record fields through `readDrillholeValue`, `readDrillholeText` or
   `readDrillholeTag` from `src/utils/drillholeFields.ts`. Its alias table
   maps each canonical name to every spelling the API uses, so a PascalCase
   payload reads the same as a camelCase one everywhere, tooltips included.
2. Do not call `Number()` on an API value directly. `Number(null)` and
   `Number('')` are both `0`, which would plot a missing coordinate as a
   real one. Each page's `utils/coordinates.ts` converts through a
   `toFiniteNumber` helper that returns `null` for those.

## Runtime checks

TypeScript stops at the build, so three boundaries also check at runtime:

1. API responses. In `services/api/mapData.ts`, a body that is not an array
   throws, because a single object reaching `.map()` downstream would crash
   the page. Entries within the array are filtered with
   `isDrillholeApiRecord`, so a malformed row is dropped and the rest of
   the map still draws.
2. IndexedDB. Anything read back may have been written by an older build, so
   records and the timestamp are checked again before use.
3. Measurements, which are rejected before `Number()` sees them, as above.

`catch` clauses bind `unknown`. Request failures become an `ApiError` from
`services/api/http.ts` whose `kind` (`network`, `timeout`, `http`,
`invalid-response`) drives the toast text.

## TypeScript configuration

The project uses references: `tsconfig.app.json` for `src` and
`tsconfig.node.json` for the Vite config. On top of `strict`, the app config
enables `noUncheckedIndexedAccess`, `noImplicitReturns`, `noUnusedLocals`,
`noUnusedParameters`, `noImplicitOverride`, `verbatimModuleSyntax` and
`erasableSyntaxOnly`. `allowJs` is false, so a JavaScript file under `src/`
fails the build.

`src/` contains no `any`, `@ts-ignore`, `@ts-nocheck` or `unknown as T`
casts. ESLint reports explicit `any` and non-null assertions as errors, and
`recommendedTypeChecked` catches unsafe `any` coming in from untyped
boundaries. Please keep it that way.

## Tests

```bash
npm test
```

The suite covers each page's maths, config, coordinates and marker rules;
component tests for markers, legends, the status notice, the refresh button,
the help dialog, the sidebar and toasts; store tests for stale-while-revalidate
loading; and integration tests that render the pages against a mocked API and
a fake IndexedDB. The DrillMap marker tests are in `tests/pages/DrillMap/`.
The Techno Map tests serve their records from the fixture in
`tests/pages/TechnoMap/demoDataset.js` through a stubbed fetcher.

The tests are JavaScript. `vite.config.ts` only collects
`tests/**/*.test.{js,jsx}`, and Vite resolves a `./foo.js` import to
`foo.ts`, so tests import sources with a `.js` extension.

`vite.config.ts` also runs the test workers with
`--no-experimental-webstorage`. Node 25 and later ship their own
`localStorage` global, which otherwise hides jsdom's.

## Versioning

The website version lives in `../VERSION` and shows under the backend status
in the sidebar. `vite.config.ts` inlines it as `__APP_VERSION__`, and
`src/config/version.ts` shows `dev` if it is missing or malformed. Restart
the dev server after a bump. The bump and changelog rules are in
[VERSIONING.md](../VERSIONING.md).

## Adding things

To add a drillhole field, add it to `DrillholeMapItem` and
`DrillholeApiRecord` in `src/types/drillhole.ts` (plus its PascalCase alias
if the API sends one) and to the alias table in
`src/utils/drillholeFields.ts`, then add the row to each page's tooltip. The
cache needs no change, since it stores the response verbatim.

To add a map page, add a `MapId` in `src/types/map.ts`, a `DATASET_IDS`
entry in `services/cache/drillholeCache.ts` and a fetcher in
`services/api/mapData.ts`. Copy a page folder as a starting point, rename its
root class and config, and register the page in `config/app.yaml` and
`App.tsx`.

To add a marker type or GT band, edit that page's `utils/markerKind.ts` and
`config/<page>.yaml`. Changing one page never changes the other.
