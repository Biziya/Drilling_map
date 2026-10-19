# Drilling Map — frontend

React + TypeScript + Vite frontend for the Drilling Map application. It
renders two independent map pages — **Exploration Map** and **Techno Map** —
each plotting drillholes from UTM coordinates onto a base map image with pan,
cursor-centred zoom, deviation lines, tooltips, a legend and a scale bar.

> **Note for reviewers:** this file was rewritten during the TypeScript
> migration. The migration archive did not include the previous
> `frontend/README.md`, so anything project-specific that used to live here
> (deployment steps, internal URLs, team conventions) needs to be merged back
> in from version control.

---

## Quick start

```bash
npm install
npm run dev
```

| Script | What it does |
| --- | --- |
| `npm run dev` | Vite dev server |
| `npm run build` | `tsc -b && vite build` — type-check, then bundle |
| `npm run preview` | Serve the production build locally |
| `npm run typecheck` | `tsc -b --force`, no emit |
| `npm run lint` | ESLint, type-aware on `src/` |
| `npm test` | Vitest, single run |

Build into the publish directory:

```bash
npm run build -- --outDir frontend/publish
```

## Requirements

- Node 20.19+ or 22.12+ (Vite 7)
- A reachable backend exposing `/api/exploration-map` and `/api/techno-map`

---

## Environment variables

All are optional; each falls back to the value the app used before these
overrides existed, so an empty environment behaves exactly as before.

| Variable | Default | Purpose |
| --- | --- | --- |
| `VITE_API_BASE_URL` | `''` (same origin) | Origin of the drillhole API |
| `VITE_MAP_IMAGE_PATH` | `/base-map.svg` | Public path of the base map image |
| `VITE_MAP_MIN_X` | `412499.97` | UTM easting of the map's left edge |
| `VITE_MAP_MAX_X` | `423375.13` | UTM easting of the map's right edge |
| `VITE_MAP_MIN_Y` | `4890500` | UTM northing of the map's bottom edge |
| `VITE_MAP_MAX_Y` | `4898190.29` | UTM northing of the map's top edge |

They are typed in `src/vite-env.d.ts` as `string | undefined` — which is what
Vite actually provides — and converted in `src/config/env.ts` with explicit
fallbacks. Nothing relies on implicit coercion: `Number('')` is `0`, and a map
bound silently defaulting to zero would misplace every drillhole.

> **Never put secrets in a `VITE_` variable.** Everything with that prefix is
> inlined into the client bundle at build time and is readable by anyone who
> opens the site.

## Static assets

Both live in `public/` and are referenced by absolute path:

- `base-map.svg` — the georeferenced base map. Its extent must match the
  `VITE_MAP_*` bounds, or every hole will be placed wrongly.
- `rig.svg` — the drill rig marker, used for `HoleStatus = INPROGRESS`.

---

## Project layout

```
frontend/
├─ public/                    base-map.svg, rig.svg
├─ src/
│  ├─ main.tsx                entry point, mounts #root
│  ├─ App.tsx                 layout, sidebar navigation, active page
│  ├─ appConfig.ts            APP_TITLE, AppPageId
│  ├─ index.css               global styles
│  ├─ vite-env.d.ts           typed import.meta.env
│  ├─ components/
│  │  ├─ Sidebar.tsx          page navigation, collapse toggle
│  │  └─ Sidebar.css
│  ├─ config/
│  │  └─ env.ts               safe readers for the VITE_* variables
│  ├─ types/
│  │  ├─ drillhole.ts         DrillholeMapItem, DrillholeApiRecord
│  │  └─ map.ts               Point, MapBounds, MapTransform, MapConfig, …
│  ├─ services/
│  │  ├─ Api/
│  │  │  ├─ apiResponse.ts    fetch plumbing, error-body parsing
│  │  │  ├─ drillholeMap.ts   GET /api/exploration-map
│  │  │  └─ technoMap.ts      GET /api/techno-map
│  │  └─ cache/
│  │     └─ drillholeCache.ts IndexedDB cache of the raw responses
│  ├─ state/
│  │  └─ mapViewStore.ts      per-page pan/zoom persistence
│  ├─ utils/
│  │  └─ dedupeDrillholes.ts  one marker per hole
│  └─ pages/
│     ├─ DrillMap/            Exploration Map — see its README
│     └─ TechnoMap/           Techno Map — see its README
└─ tests/                     Vitest suite (deliberately JavaScript)
```

Each map page has its own README describing every file in it:

- [`src/pages/DrillMap/README.md`](src/pages/DrillMap/README.md)
- [`src/pages/TechnoMap/README.md`](src/pages/TechnoMap/README.md)

---

## Architecture

### Two independent pages

`DrillMap` and `TechnoMap` are separate pages with separate endpoints, CSS
prefixes, cache keys and view-state keys. They also keep **their own copies**
of the shared hooks and maths modules (`zoomMath`, `mapGeometry`,
`useMapViewport`, …).

That duplication is deliberate. The test suite runs the same assertions
against both copies, and `tests/pages/deviationParity.test.jsx` additionally
asserts the two maps produce *identical* deviation geometry. Changing one
map's copy alone fails the build. Only genuinely cross-cutting code —
types, services, cache, dedupe, env — is shared.

### Data flow

```
API ──► fetch*  ──► DrillholeApiRecord[]
                          │
                    useMapData  ◄──► IndexedDB cache
                          │
                    project to xPercent / yPercent
                          │
                    dedupe → features → markers + deviation lines
```

### Cache-then-network

The drillhole endpoints take roughly 5–15 seconds. Rather than holding a
blank map for that long, `useMapData` starts the IndexedDB read and the
network request **together**, draws whatever was cached last time
immediately, and replaces it when the API answers. The header shows
`· updating` while the request is still in flight.

The cache is only ever an optimisation:

- It stores the API response **verbatim** — no filtering, no projecting — so a
  future feature needing `z` or `maxDepth` finds it already cached.
- It never rejects. Private windows, blocked storage and jsdom all resolve to
  "no cached data", and the caller falls back to the network path it would
  have taken anyway.
- A failed background refresh keeps stale drillholes on screen rather than
  blanking a usable map.

### Pan and cursor-centred zoom

The canvas is transformed with `translate(translateX, translateY) scale(scale)`.
`zoomMath.panAroundAnchor` solves for the translation that keeps the map point
under the cursor fixed, assuming exactly that composition — **the order is
load-bearing**.

The view lives in a ref and is committed to React state once per animation
frame, because pointer and wheel events fire far faster than React can
usefully render.

---

## The drillhole type

There are two, and the distinction matters (`src/types/drillhole.ts`):

- **`DrillholeMapItem`** — the row as the backend documents it. Every column
  nullable, because every database column is. Extend this when a column is
  added.
- **`DrillholeApiRecord`** — the row as it actually arrives. Every field
  optional, numerics widened to `number | string | null`, and the PascalCase
  aliases the API really sends (`HoleStatus`, `Azimuth`, `FinalDeviation`, …)
  declared alongside the camelCase names.

Modelling the wire format honestly is what lets every reader be type-safe
instead of quietly indexing records with arbitrary strings.

### Two rules that follow from it

1. **Never read a record field directly.** Use `readDrillholeValue`,
   `readDrillholeText` or `readDrillholeTag` from
   `src/utils/drillholeFields.ts`. One compiler-checked alias table maps each
   canonical name to every spelling the API uses, so a PascalCase payload
   cannot draw correct markers above a tooltip full of dashes.
2. **Never `Number()` an API value directly.** `Number(null)`, `Number('')`
   and `Number('   ')` are all `0`, which would render a missing measurement
   as a real reading of zero. Use `toFiniteNumber` / `toMeasuredNumber`.

---

## Runtime validation

TypeScript stops at the build, so three boundaries also check at runtime:

1. **API responses** — a non-array body throws, because a single object
   reaching `.map()` downstream crashes the page. Entries *within* the array
   are filtered, so one malformed row costs that row rather than the map.
2. **IndexedDB** — anything read back may have been written by an older
   build, so records and the timestamp are re-validated before use.
3. **Measurements** — rejected before `Number()` sees them, as above.

Errors are narrowed properly: `catch` binds `unknown`, and `toError` /
`isAbortError` in `services/Api/apiResponse.ts` replace bare `error.message`
reads.

---

## TypeScript configuration

Project references: `tsconfig.app.json` (src) and `tsconfig.node.json` (Vite
config). Beyond `strict`, the app config enables `noUncheckedIndexedAccess`,
`noImplicitReturns`, `noUnusedLocals`, `noUnusedParameters`,
`noImplicitOverride`, `verbatimModuleSyntax` and `erasableSyntaxOnly`.

`allowJs` is **false**, so untyped JavaScript cannot reappear under `src/`
without a build failure.

There is no `any`, `as any`, `@ts-ignore`, `@ts-nocheck`, `unknown as T` or
non-null assertion anywhere in `src/`. ESLint enforces the first two and the
last as errors, and `recommendedTypeChecked` catches unsafe `any` flowing in
from untyped boundaries. Please keep it that way — the migration is only
worth anything if these stay out.

---

## Tests

```bash
npm test
```

499 tests across 23 files: unit coverage of the maths, config, coordinate and
state modules, component tests for markers, symbols and overlays, and
integration tests that render both pages against a mocked API and a fake
IndexedDB.

**The tests are JavaScript on purpose.** They were the regression harness the
TypeScript migration was verified against — run green before it, after each
stage, and after it, with no test file modified. Vite resolves a `./foo.js`
import to `foo.ts`, so they keep resolving to the converted sources. Rewriting
them would have meant changing the harness and the subject at the same time.

New tests can be written in TypeScript; `vite.config.ts` already includes
`tests/**/*.test.{js,jsx,ts,tsx}`.

Some suites are parameterised over **both** map modules. If you change a
shared file in one page folder, change it identically in the other or those
suites will fail — which is what they are for.

---

## Adding things

**A drillhole field.** Add it to `DrillholeMapItem` and `DrillholeApiRecord`
in `src/types/drillhole.ts` (plus its PascalCase alias if the API sends one),
then add the row to each page's tooltip. The cache needs no change — it stores
the response verbatim.

**A new map page.** Copy a page folder, rename the CSS prefix, custom
properties, view-state key and cache key, add a `DATASET_IDS` entry, and add
the page to `APP_PAGE_IDS` in `src/appConfig.ts` and to the switch in
`App.tsx`.

**A marker type or GT band.** Marker kinds live in each page's
`*MarkerKind.ts`; GT bands in each page's config. Bands must stay identical
across the two pages — the same grade has to paint the same colour on both.
