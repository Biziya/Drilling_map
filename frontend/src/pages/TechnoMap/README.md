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
│  ├─ MapCanvas.tsx         transformed layer: base image + children
│  ├─ CoordinateGrid.tsx    white grid base map: Easting/Northing lines + labels
│  ├─ TechnoCells.tsx       technological cell outlines and labels
│  ├─ DrillholeFeatures     dedupe → filter → markers + deviation lines
│  ├─ DrillholeMarker       rig icon OR shape (never both) + tooltip
│  ├─ MeasurementOverlay    the A–B measurement, in viewport pixels
│  ├─ MapScaleBar.tsx       metre scale for the current zoom
│  └─ MapStatus.tsx         small notice: loading / empty / no data / no base map
├─ Legends/
│  ├─ MapLegend.tsx         GT bands, redox, all 12 layer symbols (hidden = faded)
│  ├─ LayerSymbol.tsx       one layer's swatch, shared by legend and filter panel
│  └─ MarkerSymbol.tsx      the type shapes shared by markers, legend and panel
├─ Controls/
│  ├─ MapControls.tsx       zoom in/out, reset, measure, export menu, zoom readout
│  ├─ LayerPanel.tsx        floating "Map Layers" panel: 12 filters, Show/Hide All
│  ├─ RefreshButton.tsx     header button: reload the data
│  └─ BaseMapSwitcher.tsx   header menu right of Refresh: Geological / White Grid
├─ Tooltips/
│  └─ DrillholeTooltip      the hole's details on hover, focus or click
├─ hooks/
│  ├─ useBaseMap.ts         the selected base map, remembered in localStorage
│  ├─ useMapData.ts         demo data, or automatic loading → status, refresh()
│  ├─ useMapFilters.ts      the 12 filters, remembered in localStorage
│  └─ useMapViewport.ts     sizing, drag-pan, zoom, map clicks, fit, view persistence
├─ mock/
│  └─ mockData.ts           the fixed demo drillholes and cells
├─ config/
│  ├─ technoMap.yaml        data source, zoom, GT bands, types, layers, colours
│  └─ technoMapConfig.ts    validates the YAML; ids, MAP_ID, getGtRange
└─ utils/                   pure functions
   ├─ coordinateGrid.ts     white grid lines/labels for the view (screen + export)
   ├─ coordinates.ts        UTM ↔ map ratio, deviation endpoints, extent
   ├─ geometry.ts           fit, transform, cursor-centred zoom, viewport ↔ map
   ├─ markerKind.ts         API category → type, marker priority
   ├─ markerShapes.ts       shape outlines for CSS clip-paths and the export
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
filter and is not drawn, though it still counts in the header. A shape is
filled with its GT band colour, or with its type's colour when the hole has
no GT. The tooltip shows the original Type next to the category.

Deviation lines run from the collar towards the API's `deviationEndX/Y`,
stretched by `deviationExaggeration` for display.

Twelve filters (nine types, then technological cells, drilling in progress,
deviation line). An in-progress hole needs both its type and *Drilling in
progress* checked, and is never downgraded to its type's shape. A deviation
line needs *Deviation line*, its hole visible, and the deviation zoom.
Technological cells are independent of the drillhole filters. Filters persist
under `techno-map:filters`; Hide All leaves the base map, grid, north arrow,
scale bar, measurement and view untouched.

## Viewport

Floating layout (same as the Exploration Map, plus Map Layers): compass
top-left, toolbar (zoom, reset, ruler, export) top-right, Map Layers bottom-right
directly below it, scale bar bottom-left; the legend sits below the map. The
toolbar and panel share `--float-width`, and every corner uses `--float-inset`
(TechnoMap.css root); the panel's height is capped so it never reaches the
toolbar, and it scrolls instead.

Reset fits every drillhole in the active dataset (whatever the filters) with
`zoom.fitPadding`. The view persists across page switches (`state/mapViewStore`)
and browser refreshes (`techno-map:view` in localStorage).

## Measurement and export

The ruler places A on the first click and B on the second; the third starts
over. Measuring takes priority over the map's features: markers stop catching
the pointer and show no tooltip, so a point can be placed on a marker, cell or
deviation line. A press that moves more than 4 px is a pan, not a click, and
double-click zoom is off while measuring. Points are stored in UTM metres, so zoom, pan and
resizing do not change the distance. Switching the tool off clears it.

Export draws the visible viewport as one SVG (base map embedded, markers, cells,
deviation lines and measurement as vectors, plus title, north arrow and scale
bar); PNG rasterises it at 2×. Files are `TechnoMap_YYYY-MM-DD_HH-mm.png|svg`.
No export is made while the base map is not loaded.

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
ticked: **Geological Map** (the surveyed image) and **White Grid Map**.
Switching changes only the background; view, features, filters and the
measurement stay as they are. The choice persists under `techno-map:base-map`
(localStorage) and falls back to `baseMap.default` (geological).

The geological image stays loaded and laid out while hidden: its size is what
every feature is placed against, so nothing moves. `Map/CoordinateGrid` draws
under the canvas, in viewport pixels, from `utils/coordinateGrid.ts`: a white
sheet over exactly the UTM bounds, lines every 1/2/5 x 10^n metres (the
smallest step at least `whiteGrid.minLineSpacing` px apart, so it refines on
zoom), eastings along the top and northings along the left. Positions go
through the same UTM → map ratio → viewport functions as the markers. The
export draws the same grid instead of embedding the image. Colours, line
width, label size and spacing are under `baseMap.whiteGrid`.

## Legend sizes

Legend dimensions are set under `legend:` in `config/technoMap.yaml` (px, validated
as 0 or more) and reach the stylesheet as CSS variables from
`Legends/MapLegend.tsx`. One base `symbolSize` sizes every legend symbol: GT
circles and Redox squares are exactly `symbolSize` on both sides, and the type
shapes match. Each symbol, in all three sections, is centred in a box 1.9 x
`symbolSize` wide and as tall as the rig icon (`symbols.rigIconScale`), so
labels line up everywhere and the line and cell swatches fit. Changing `symbolSize` resizes the
whole legend without changing any shape.

Layout: the sections sit side by side at their content width and wrap onto a
new line when they do not fit (no fixed columns or heights); the Symbol section
takes the remaining width. GT bands fill `gt.columns` columns top to bottom, so
GT is no taller than the Symbol section.
