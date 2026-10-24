# TechnoMap — Techno Map

Data comes from `dataSource` in `config/technoMap.yaml`:

- `backend` (default): `GET /api/techno-map` (`pyISR_AllData_V2`), cached in
  IndexedDB under `techno-map`. Never falls back to the demo dataset, and has
  no technological cells: the view has no cell data, so that layer is a
  placeholder until a source exists.
- `mock`: the fixed demo dataset in `mock/mockData.ts` — 130 drillholes, 5
  technological cells, in the API's shape. No backend request, nothing written
  to IndexedDB, and a **Demo** badge beside the title.

**This page is self-contained.** It owns its components, hooks, maths,
configuration and styles, and imports nothing from `../DrillMap`. The two maps
look alike today but are expected to diverge, so a change here never changes
the other page. Only global infrastructure is shared: API plumbing
(`services/api`), the IndexedDB cache (`services/cache`), the data and view
stores (`state/`), toasts, types and generic field/number utilities.

```
TechnoMap/
├─ TechnoMap.tsx              composes the sections; header with refresh + count
├─ TechnoMap.css              styles, every selector scoped under .techno-map-page
├─ Map/
│  ├─ MapCanvas.tsx         transformed layer: base image + technological cells
│  ├─ CoordinateGrid.tsx    white grid base map: km lines, values and axis titles
│  ├─ TechnoCells.tsx       technological cell outlines and labels
│  ├─ DrillholeLayer.tsx    one canvas: every shown marker and deviation line
│  ├─ MeasurementOverlay    the A–B measurement, in viewport pixels
│  ├─ MapScaleBar.tsx       metre scale for the current zoom
│  └─ MapStatus.tsx         small notice: loading / empty / no data / no base map
├─ Legends/
│  ├─ MapLegend.tsx         anchored top-left: redox and all 12 symbols (hidden = faded)
│  ├─ LayerSymbol.tsx       one layer's swatch, shared by legend and Legends panel
│  └─ MarkerSymbol.tsx      the type shapes in miniature, for legend and panel
├─ Controls/
│  ├─ MapControls.tsx       zoom in/out, reset, measure, export (camera), zoom readout
│  ├─ LayerPanel.tsx        floating "Legends" panel: 12 filters, Show/Hide All
│  ├─ RefreshButton.tsx     header button: reload the data
│  └─ BaseMapSwitcher.tsx   header menu right of Refresh: Redox Map / White Grid
├─ Tooltips/
│  ├─ MarkerTooltip.tsx     the one tooltip: highlight ring + details, on the marker
│  └─ DrillholeTooltip      the hole's details
├─ hooks/
│  ├─ useBaseMap.ts         the selected base map, remembered in localStorage
│  ├─ useMapData.ts         demo data, or automatic loading → status, refresh()
│  ├─ useMapFilters.ts      the 12 filters, remembered in localStorage
│  └─ useMapViewport.ts     sizing, drag-pan, zoom, map clicks/taps, fit, view persistence
├─ mock/
│  └─ mockData.ts           the fixed demo drillholes and cells
├─ config/
│  ├─ technoMap.yaml        data source, zoom, types, marker sizes, layers, colours
│  └─ technoMapConfig.ts    validates the YAML; ids, MAP_ID
└─ utils/                   pure functions
   ├─ coordinateGrid.ts     white grid lines/labels for the view (screen + export)
   ├─ coordinates.ts        UTM ↔ map ratio, deviation endpoints, extent
   ├─ geometry.ts           fit, transform, cursor-centred zoom, viewport ↔ map
   ├─ markerKind.ts         API category → type, marker priority
   ├─ markerLayer.ts        marker data, hit-testing grid, sprites, the canvas frame
   ├─ markerShapes.ts       shape outlines and sizes: canvas, CSS clip-paths, export
   ├─ mapFilters.ts         which holes and layers the filters let through
   ├─ measurement.ts        distance, formatting, click cycle
   ├─ exportMap.ts          PNG/SVG export of the visible viewport
   ├─ scaleBar.ts           a round 1/2/5 distance for the scale bar
   └─ storage.ts            localStorage read/write that never throws
```

## Markers and filters

Priority (`utils/markerKind.ts`): in-progress → rig; otherwise the type named
by the API's `category`. The backend resolves it (sampling flags first, then
the SQL Type; see `backend/README.md`), so the page never classifies on its
own. A hole without a category (an unmapped Type such as `SER`) belongs to no
filter and is not drawn, though it still counts in the header. The tooltip
shows the original Type next to the category.

Each type's shape and colour are under `drillholeTypes` in the YAML:
Development, Exploration, Ra-grade- and Sediment-sampling are orange circles,
Geotechnical a gray five-point star, Injector a red downward triangle,
Monitoring a green vertical diamond, Producer a blue square, Water a light
teal square; in-progress holes are the rig icon. The same colour fills the
marker and its legend symbol and colours the type's label in the Legends
panel. Marker sizes are under `markers` (px at every zoom).

Deviation lines run from the collar towards the API's `deviationEndX/Y`,
stretched by `deviationExaggeration` for display.

Twelve filters (nine types, then technological cells, drilling in progress,
deviation line). An in-progress hole needs both its type and *Drilling in
progress* checked, and is never downgraded to its type's shape. A deviation
line needs *Deviation line*, its hole visible, and the deviation zoom.
Technological cells are independent of the drillhole filters. Filters persist
under `techno-map:filters`; Hide All leaves the base map, grid, legend, scale
bar, measurement and view untouched.

## Rendering (5,000+ drillholes)

Markers and deviation lines are drawn on one viewport-sized canvas
(`Map/DrillholeLayer`, `utils/markerLayer.ts`), not as DOM elements:

- **Once per dataset** `buildMarkerFeatures` deduplicates, classifies and
  projects every hole (collar and deviation endpoint as map ratios).
- **Once per filter change** the features are filtered and bucketed into a
  128 × 128 grid for hit-testing.
- **Once per frame** (the view is committed once per animation frame by
  `useMapViewport`) the canvas is cleared and redrawn in the same commit as the
  base map's transform, so the two never drift: every line in one stroke,
  then each marker stamped from a sprite pre-rendered per type at device
  resolution, rigs last. Anything more than 40 px outside the viewport is
  skipped (culling) but stays in the feature list.

The canvas takes no pointer events. Moving the pointer hit-tests the grid
(a handful of candidates, nearest wins, rigs on top) and shows one tooltip
(`Tooltips/MarkerTooltip`) with a ring on the marker; a click pins it until a
click on empty map. The tooltip opens below markers in the upper part of the
map and turns inwards near the edges. While measuring, no tooltip shows.

Measured in headless Edge (software rendering, 1600 × 1000) with the
deterministic 5,000-hole dataset in `tests/pages/TechnoMap/perfDataset.js`:

| | DOM markers (before) | Canvas (after) |
|---|---|---|
| DOM nodes | 107,677 | 209 |
| Pan, whole map in view | 2 FPS | 60 FPS |
| Wheel zoom, whole map | 10 FPS | 59 FPS |
| Pan / wheel, zoomed 1280% | 30 / 16 FPS | 60 / 60 FPS |
| Filter toggle | ~535 ms | ≤ 34 ms (two frames) |
| Hide All / Show All | 514 / 1,705 ms | 31 / 33 ms |
| Tooltip on hover | 520–590 ms | 20–33 ms |
| First display | 1.1 s | 0.5 s |

At 10,000 holes panning the whole map runs at about 32 FPS (60 when zoomed
in). Markers are no longer individually keyboard-focusable; the header count
and the tooltip remain.

## Viewport

Floating layout: the anchored legend top-left, the Legends panel top-right,
the toolbar (zoom, reset, ruler, export) bottom-right below it, scale bar
bottom-left; there is no compass. The panel and toolbar share `--float-width`,
and every corner uses `--float-inset` (TechnoMap.css root); the panel and
legend are height-capped so they never reach the toolbar or scale bar, and
scroll instead.

Reset fits every drillhole in the active dataset (whatever the filters) with
`zoom.fitPadding`. The view persists across page switches (`state/mapViewStore`)
and browser refreshes (`techno-map:view` in localStorage).

## Measurement and export

The ruler places A on the first click and B on the second; the third starts
over. Measuring takes priority over the map's features: a press on a marker
places a point where it lands and opens no tooltip. A press that moves more
than 4 px is a pan, not a click, and double-click zoom is off while measuring.
Points are stored in UTM metres, so zoom, pan and resizing do not change the
distance. Switching the tool off clears it.

Export (camera button) draws the visible viewport as one SVG — the selected
base map, cells, deviation lines, markers (same features, shapes, sizes and
colours as the canvas) and measurement as vectors, plus title and scale bar;
PNG rasterises it at 2×. Files are `TechnoMap_YYYY-MM-DD_HH-mm.png|svg`. No
export is made while the base map is not loaded.

## Data loading in backend mode (global infrastructure)

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
There is no polling. The API returns no technological cells, so that layer is
empty in backend mode.

## Refresh

`Controls/RefreshButton` sits in the header, followed by the base map switcher
and the drillhole count. Backend mode asks the backend; mock mode reloads the fixed demo data
without a request. While it runs only the icon spins (clockwise; not under
reduced motion) and further clicks are ignored; drillholes, filters, pan, zoom
and measurement stay as they are. Success shows *Map data refreshed
successfully*.

## Base map

`Controls/BaseMapSwitcher` (layers icon, right of Refresh) opens a menu of
the backgrounds in `baseMap.options` (`config/technoMap.yaml`), the current one
ticked: **Redox Map** (the surveyed image; id `geological`, kept so saved
choices still apply) and **White Grid Map**. Switching changes only the
background; view, features, filters and the measurement stay as they are. The
choice persists under `techno-map:base-map` (localStorage) and falls back to
`baseMap.default`.

The image stays loaded and laid out while hidden: its size is what every
feature is placed against, so nothing moves. `Map/CoordinateGrid` draws under
the canvas, in viewport pixels, from `utils/coordinateGrid.ts`: a white sheet
over exactly the UTM bounds, lines every 1/2/5 x 10^n metres (the smallest
step at least `whiteGrid.minLineSpacing` px apart, so it refines on zoom).
Values are written in kilometres (414,000 m → 414, 4,894,500 m → 4,894.5):
eastings along the bottom under an **Easting (km)** title, northings up the
left beside a turned **Northing (km)** title. Coordinates stay in metres;
positions go through the same UTM → map ratio → viewport functions as the
markers. The export draws the same grid instead of embedding the image.
Colours, line width, label size and spacing are under `baseMap.whiteGrid`.

## Legend sizes

Legend dimensions are set under `legend:` in `config/technoMap.yaml` (px, validated
as 0 or more) and reach the stylesheet as CSS variables from
`Legends/MapLegend.tsx`. One base `symbolSize` sizes every legend symbol: Redox
squares are exactly `symbolSize` on both sides, and the type shapes match.
Each symbol, in both sections, is centred in a box 1.9 x `symbolSize` wide and
as tall as the rig icon (`symbols.rigIconScale`), so labels line up everywhere
and the line and cell swatches fit. Changing `symbolSize` resizes the whole
legend without changing any shape.

Layout: Redox Status and the symbols (no heading, three content-width columns)
sit side by side and wrap when they do not fit; the card stops short of the
Legends panel and the scale bar and scrolls rather than reach them.
