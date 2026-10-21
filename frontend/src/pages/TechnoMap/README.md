# TechnoMap — Techno Map

Data comes from `dataSource` in `config/technoMap.yaml`:

- `mock` (default): the fixed demo dataset in `mock/mockData.ts` — 130
  drillholes, 5 technological cells. No backend request, nothing written to
  IndexedDB, and a **Demo** badge beside the title.
- `backend`: `GET /api/techno-map`, cached in IndexedDB under `techno-map`.

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
│  └─ RefreshButton.tsx     header button: reload the data
├─ Tooltips/
│  └─ DrillholeTooltip      the hole's details on hover, focus or click
├─ hooks/
│  ├─ useMapData.ts         demo data, or automatic loading → status, refresh()
│  ├─ useMapFilters.ts      the 12 filters, remembered in localStorage
│  └─ useMapViewport.ts     sizing, drag-pan, zoom, map clicks, fit, view persistence
├─ mock/
│  └─ mockData.ts           the fixed demo drillholes and cells
├─ config/
│  ├─ technoMap.yaml        data source, zoom, GT bands, types, layers, colours
│  └─ technoMapConfig.ts    validates the YAML; ids, MAP_ID, getGtRange
└─ utils/                   pure functions
   ├─ coordinates.ts        UTM ↔ map ratio, deviation endpoints, extent
   ├─ geometry.ts           fit, transform, cursor-centred zoom, viewport ↔ map
   ├─ markerKind.ts         purpose → type, marker priority
   ├─ markerShapes.ts       shape outlines for CSS clip-paths and the export
   ├─ mapFilters.ts         which holes and layers the filters let through
   ├─ measurement.ts        distance, formatting, click cycle
   ├─ exportMap.ts          PNG/SVG export of the visible viewport
   ├─ scaleBar.ts           a round 1/2/5 distance for the scale bar
   └─ storage.ts            localStorage read/write that never throws
```

## Markers and filters

Priority (`utils/markerKind.ts`): in-progress → rig; otherwise the drillhole
type its HolePurpose maps to (`drillholeTypes[].purposes` in the YAML); an
unknown purpose → injector square. A shape is filled with its GT band colour,
or with its type's colour when the hole has no GT.

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

`Controls/RefreshButton` sits in the header, immediately before the drillhole
count. Backend mode asks the backend; mock mode reloads the fixed demo data
without a request. While it runs only the icon spins (clockwise; not under
reduced motion) and further clicks are ignored; drillholes, filters, pan, zoom
and measurement stay as they are. Success shows *Map data refreshed
successfully*.
