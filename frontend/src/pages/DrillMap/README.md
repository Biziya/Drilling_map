# DrillMap — Exploration Map

`GET /api/exploration-map`, cached in IndexedDB under `exploration-map`.

**This page is self-contained.** It owns its components, hooks, maths,
configuration and styles, and imports nothing from `../TechnoMap`. The two maps
look alike today but are expected to diverge, so a change here never changes
the other page. Only global infrastructure is shared: API plumbing
(`services/api`), the IndexedDB cache (`services/cache`), the data and view
stores (`state/`), toasts, types and generic field/number utilities.

```
DrillMap/
├─ DrillMap.tsx              composes the sections; header with refresh + count
├─ DrillMap.css              styles, every selector scoped under .drill-map-page
├─ Map/
│  ├─ MapCanvas.tsx         transformed layer: base image + children
│  ├─ CoordinateGrid.tsx    white grid base map: Easting/Northing lines + labels
│  ├─ DrillholeFeatures     dedupe → markers + deviation lines
│  ├─ DrillholeMarker       rig icon OR shape (never both) + tooltip
│  ├─ MeasurementOverlay    the A–B measurement, in viewport pixels
│  ├─ MapScaleBar.tsx       metre scale for the current zoom
│  └─ MapStatus.tsx         small notice: loading / empty / no data / no base map
├─ Legends/
│  ├─ MapLegend.tsx         GT bands, redox, this page's marker symbols
│  └─ MarkerSymbol.tsx      square/triangle shared by markers and legend
├─ Controls/
│  ├─ MapControls.tsx       zoom in/out, reset, measure, export menu, zoom readout
│  ├─ RefreshButton.tsx     header button: fetch fresh data
│  ├─ BaseMapSwitcher.tsx   header menu right of Refresh: Redox / Geological / White Grid
│  └─ icons.tsx             control icons, shared with the help dialog
├─ Tooltips/
│  └─ DrillholeTooltip      the hole's details on hover, focus or click
├─ hooks/
│  ├─ useBaseMap.ts         the selected base map, remembered in localStorage
│  ├─ useMapData.ts         automatic loading → status, placeable records, refresh()
│  └─ useMapViewport.ts     sizing, drag-pan, zoom, map clicks, view persistence
├─ config/
│  ├─ drillMap.yaml           title, zoom, GT bands, colours, labels, legend
│  ├─ drillMapConfig.ts       validates the YAML; MAP_ID, getGtRange, baseMapLayout
│  └─ helpContent.tsx         what the ? help dialog lists: shortcuts and buttons
└─ utils/                   pure functions
   ├─ coordinateGrid.ts     white grid lines/labels for the view (screen + export)
   ├─ coordinates.ts        UTM → map %, deviation endpoints, pixel offsets
   ├─ geometry.ts           fit, transform, cursor-centred zoom, viewport ↔ map
   ├─ markerKind.ts         this page's marker rules
   ├─ measurement.ts        distance, formatting, click cycle
   ├─ exportMap.ts          PNG/SVG export of the visible viewport
   ├─ scaleBar.ts           a round 1/2/5 distance for the scale bar
   └─ storage.ts            localStorage read/write that never throws
```

## Layout, measurement and export

Floating layout (same as the Techno Map, without Map Layers): compass top-left,
toolbar top-right, scale bar bottom-left; the legend sits below the map.
`--float-inset` and `--float-width` on the DrillMap.css root set the spacing and
toolbar width.

The ruler places A on the first click and B on the second; the third starts
over. While measuring, markers stop catching the pointer and show no tooltip,
so a point can be placed on a marker. A press that moves more than 4 px pans
instead. Points are stored in UTM metres, so zoom and pan do not change the
distance. Export draws the visible viewport as SVG (base map embedded, markers
and measurement as vectors, title, north arrow, scale bar), or PNG at 2×, named
`ExplorationMap_YYYY-MM-DD_HH-mm`. No export is made without the base map.

Marker priority (`utils/markerKind.ts`): in-progress → rig; PRODUCT →
triangle (producer); INJECT → square (injector); anything else → square
(drillhole). The dataset is SEDIMENT/DEVELOP holes, so most draw as
"Drillhole".

## Help

The round **?** button at the right end of the header (shared
`components/HelpDialog`) opens a dialog listing every shortcut and every
button on this page; pressing **?** anywhere on the page opens it too (not while
typing). Esc, × or a click outside closes it. The wording lives in
`config/helpContent.tsx`; button names there must match the controls'
accessible names, which the page test checks, so a new toolbar button cannot ship undocumented. Icons come from
`Controls/icons.tsx`, the same components the controls draw.

## Data loading (global infrastructure)

`hooks/useMapData` reads the app-wide store `src/state/mapDataStore.ts`,
which loads stale-while-revalidate:

1. On first opening the page, the IndexedDB copy (if any) is drawn at once
   and the backend is asked for fresh data in the background.
2. Success replaces the map and the IndexedDB copy, silently.
3. Failure leaves the map and IndexedDB untouched and raises a toast naming
   the real cause: *Backend unavailable* (no connection), *Backend did not
   respond in time* (60 s, `src/config/app.yaml`), *Backend error (HTTP n)*,
   or *Backend sent invalid data*, each followed by *Showing cached data.*
   With nothing to show: an error toast *Unable to load map data.* and a
   small notice with the reason. An automatic retry that fails the same way
   again stays quiet.

Data stays in memory across page switches (no refetch). At most one request
per map runs at a time, so an older response never overwrites a newer one.
There is no polling.

## Refresh

`Controls/RefreshButton` sits in the header, followed by the base map switcher
and the drillhole count. It always asks the backend. While the request runs only the icon
spins (clockwise; not under reduced motion) and further clicks are ignored;
the drillholes, pan and zoom stay as they are. Success shows *Map data
refreshed successfully*.

## Base map

`Controls/BaseMapSwitcher` (layers icon, right of Refresh) opens a menu of
the backgrounds in `baseMap.options` (`config/drillMap.yaml`), the current one
ticked: **Redox Map** (the default), **Geological Map** (the surveyed image)
and **White Grid Map**. The choice persists under `exploration-map:base-map`
(localStorage) and falls back to `baseMap.default` (redox) when the stored
value is missing or no longer offered.

Each base map covers its own UTM rectangle. `baseMapLayout(id)` in
`config/drillMapConfig.ts` returns the image shown (`src`, null for the white
grid), the image the canvas is laid out on (`imageSrc`) and its corners
(`bounds`). `DrillMap.tsx` projects the drillholes with those bounds, and passes
them to the measurement, scale bar, grid and export, so every position follows
the selected map.

| Base map | Image | minX | maxX | minY | maxY |
| --- | --- | --- | --- | --- | --- |
| Redox Map | `public/base-map3.svg` | 412499.97 | 423375.13 | 4890500 | 4898190.29 |
| Geological Map | `VITE_MAP_IMAGE_PATH` (`/base-map.svg`) | `VITE_MAP_MIN_X` | `VITE_MAP_MAX_X` | `VITE_MAP_MIN_Y` | `VITE_MAP_MAX_Y` |
| White Grid Map | geological image, hidden | as Geological | | | |

The Redox Map corners are written in `drillMap.yaml` (`src`, `bounds`, validated
as finite with max above min). They were read from the SVG's own
Easting/Northing grid ticks and match the bounds this project first shipped
with (commit `6d89823`, `config/env.ts`). The Geological corners default to
`src/config/env.ts` (`MAP_UTM_BOUNDS`), shared with the Techno Map, which keeps
using them unchanged.

Switching to a base map with another image or other corners clears the
measurement and resets the view to the initial view once the new image has
loaded, since the old view no longer fits it. Geological and White Grid share
one layout, so switching between them changes only the background: view,
features and measurement stay put. The geological image stays loaded and laid
out while hidden: its size is what every feature is placed against. `Map/CoordinateGrid` draws
under the canvas, in viewport pixels, from `utils/coordinateGrid.ts`: a white
sheet over exactly the UTM bounds, lines every 1/2/5 x 10^n metres (the
smallest step at least `whiteGrid.minLineSpacing` px apart, so it refines on
zoom), eastings along the top and northings along the left. Positions go
through the same UTM → map ratio → viewport functions as the markers. The
export draws the same grid instead of embedding the image. Colours, line
width, label size and spacing are under `baseMap.whiteGrid`.

## Legend sizes

Legend dimensions are set under `legend:` in `config/drillMap.yaml` (px, validated
as 0 or more) and reach the stylesheet as CSS variables from
`Legends/MapLegend.tsx`. One base `symbolSize` sizes every legend symbol: GT
circles and Redox squares are exactly `symbolSize` on both sides, and the type
shapes match. Each symbol, in all three sections, is centred in a box 1.9 x
`symbolSize` wide and as tall as the rig icon (`symbols.rigIconScale`), so
labels line up everywhere. Changing `symbolSize` resizes the
whole legend without changing any shape.

Layout: the sections sit side by side at their content width and wrap onto a
new line when they do not fit (no fixed columns or heights); the Symbol section
takes the remaining width. GT bands fill `gt.columns` columns top to bottom, so
GT is no taller than the Symbol section.
