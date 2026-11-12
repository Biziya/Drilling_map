# TechnoMap: Techno Map

The page reads `GET /api/techno-map` (`pyISR_AllData_V2`) and caches the
response in IndexedDB under `techno-map`. There is no demo mode.
Tests serve a fixed 130-hole dataset, `tests/pages/TechnoMap/demoDataset.js`,
through a stubbed fetcher.

The page is self-contained. It owns its components, hooks, maths,
configuration and styles, and imports nothing from `../DrillMap`
(`tests/pages/pageIndependence.test.js` enforces this). The two maps look
alike today but are expected to diverge, so a change here never changes the
other page. Only global infrastructure is shared: API plumbing
(`services/api`), the IndexedDB cache (`services/cache`), the data and view
stores (`state/`), the screenshot overlay (`components/MapScreenshot`), the
help dialog, toasts, types and generic field/number utilities.

```
TechnoMap/
├─ TechnoMap.tsx              composes the sections; header with refresh + count
├─ TechnoMap.css              styles, every selector scoped under .techno-map-page
├─ Map/
│  ├─ MapCanvas.tsx           transformed layer: the base map image
│  ├─ CoordinateGrid.tsx      white grid base map: km lines, values and axis titles
│  ├─ DrillholeLayer.tsx      one canvas: every shown marker and deviation line
│  ├─ MeasurementOverlay.tsx  the A–B measurement, in viewport pixels
│  ├─ BoxSelectOverlay.tsx    rectangle select tool: drag a box to select holes
│  ├─ MarkerHighlight.tsx     ring on the hovered or pinned marker
│  ├─ MapScaleBar.tsx         metre scale for the current zoom
│  └─ MapStatus.tsx           small notice: loading / empty / no data / no base map
├─ Legends/
│  ├─ MapLegend.tsx           anchored top-left: all 11 symbols (hidden = faded)
│  ├─ LayerSymbol.tsx         one layer's swatch, shared by legend and Legends panel
│  └─ MarkerSymbol.tsx        the type shapes in miniature, for legend and panel
├─ Controls/
│  ├─ MapControls.tsx         zoom in/out, reset, measure, area select, screenshot (camera), zoom readout
│  ├─ LayerPanel.tsx          floating "Legends" panel: 11 filters, Show/Hide All
│  ├─ RefreshButton.tsx       header button: reload the data
│  ├─ BaseMapSwitcher.tsx     header menu right of Refresh: Geological Map / White Grid
│  └─ icons.tsx               control icons, shared with the help dialog
├─ Table/
│  ├─ SelectionTable.tsx      the selected holes under the map, per-column filter/sort
│  ├─ ColumnFilterMenu.tsx    Excel-style menu: sort, hide, search, Select/Unselect all, checkboxes
│  ├─ ColumnsMenu.tsx         bar menu: show or hide columns, Show all
│  ├─ ExportMenu.tsx          bar menu: download as Excel (.xlsx) or CSV
│  ├─ usePopover.ts           open/close for the bar menus (outside press, Esc)
│  └─ useWindowedRows.ts      renders only the rows a scroll box shows (table, filter lists)
├─ Tooltips/
│  ├─ MarkerTooltip.tsx       the one tooltip, placed beside its marker
│  └─ DrillholeTooltip.tsx    the hole's details
├─ hooks/
│  ├─ useBaseMap.ts           the selected base map, remembered in localStorage
│  ├─ useMapData.ts           automatic loading → status, refresh()
│  ├─ useMapFilters.ts        the 11 filters, remembered in localStorage
│  └─ useMapViewport.ts       sizing, drag-pan, zoom, map clicks/taps, fit, view persistence
├─ config/
│  ├─ technoMap.yaml          zoom, base maps, types, marker sizes, layers, colours, legend
│  ├─ technoMapConfig.ts      the YAML typed as TechnoMapConfig; ids, MAP_ID, baseMapLayout
│  └─ helpContent.tsx         what the ? help dialog lists: shortcuts and buttons
└─ utils/                     pure functions
   ├─ coordinateGrid.ts       white grid lines/labels for the view (screen + export)
   ├─ coordinates.ts          UTM ↔ map ratio, deviation endpoints, extent
   ├─ geometry.ts             fit, transform, cursor-centred zoom, viewport ↔ map
   ├─ markerKind.ts           API category → type, marker priority
   ├─ markerLayer.ts          marker data, hit-testing grid, sprites, the canvas frame
   ├─ markerShapes.ts         shape outlines and sizes: canvas, CSS clip-paths, export
   ├─ mapFilters.ts           which holes and layers the filters let through
   ├─ measurement.ts          distance, formatting, click cycle
   ├─ selectionTable.ts       selection table rows, column filters, sorting, hidden columns
   ├─ tableExport.ts          the table as shown → CSV text or .xlsx blob, file names
   ├─ xlsx.ts                 minimal .xlsx writer (stored ZIP + sheet XML), no dependency
   ├─ tooltipFields.ts        popup rows = table columns: label, formatting, sort kind
   ├─ exportMap.ts            PNG/SVG export of a dragged area of the map
   ├─ scaleBar.ts             a round 1/2/5 distance for the scale bar
   └─ storage.ts              localStorage read/write that never throws
```

## Configuration

`config/technoMap.yaml` holds the title, zoom limits, base maps, drillhole
types, marker sizes, map feature layers, colours and legend dimensions.
`config/technoMapConfig.ts` imports it and casts it to the `TechnoMapConfig`
interface. Nothing checks the values at runtime, so a typo or a missing key in
the YAML shows up as wrong rendering, not as an error at load time. The
identifiers the code depends on (`DRILLHOLE_TYPES`, `MAP_FEATURES`,
`FILTER_IDS`, `BaseMapId`) are fixed in the TypeScript file; labels, order and
styling come from the YAML.

## Markers and filters

Priority (`utils/markerKind.ts`): an in-progress hole is drawn as the rig;
otherwise the type named by the API's `category`. The backend resolves the
category (sampling flags first, then the SQL Type; see `backend/README.md`),
so the page never classifies holes itself. A hole without a category (an
unmapped Type such as `SER`) belongs to no filter and is not drawn, though it
still counts in the header. The tooltip shows the original Type next to the
category.

Each type's shape and colour are under `drillholeTypes` in the YAML.
Development, Exploration, Ra-grade-sampling and Sediment-sampling are orange
circles, Geotechnical is a gray five-point star, Injector a red downward
triangle, Monitoring a green vertical diamond, Producer a blue square and
Water a light teal square. In-progress holes use the rig icon. The same colour
fills the marker and its legend symbol and colours the type's label in the
Legends panel. Marker sizes are under `markers` (px at every zoom).

Deviation lines run from the collar towards the API's `deviationEndX/Y`,
stretched by `deviationExaggeration` for display.

The Legends panel has 11 filters: the nine types, then *Drilling in progress*
and *Deviation line*. An in-progress hole needs both its type and *Drilling in
progress* checked, and is never downgraded to its type's shape. A deviation
line needs *Deviation line*, its hole visible, and the deviation zoom
(`zoom.deviationMinZoom`). Filters persist under `techno-map:filters`. Hide
All leaves the base map, grid, legend, scale bar, measurement and view as they
are.

## Rendering (5,000+ drillholes)

Markers and deviation lines are drawn on one viewport-sized canvas
(`Map/DrillholeLayer`, `utils/markerLayer.ts`) instead of as DOM elements.
The work is split by how often it has to happen:

- Once per dataset, `buildMarkerFeatures` deduplicates, classifies and
  projects every hole (collar and deviation endpoint as map ratios).
- Once per filter change, the features are filtered and bucketed into a
  128 × 128 grid for hit-testing.
- Once per frame, the canvas is cleared and redrawn in the same commit as the
  base map's transform, so the two never drift apart. `useMapViewport` commits
  the view at most once per animation frame. Every deviation line goes in one
  stroke, then each marker is stamped from a sprite pre-rendered per type at
  device resolution, rigs last. Anything more than 40 px outside the viewport
  is skipped but stays in the feature list.

The canvas takes no pointer events. Moving the pointer hit-tests the grid (a
handful of candidates, nearest wins, rigs on top) and shows one tooltip
(`Tooltips/MarkerTooltip`), with a ring from `Map/MarkerHighlight`. A click
pins it until a click on empty map. The tooltip opens below markers in the
upper part of the map and turns inwards near the edges. No tooltip shows while
measuring.

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
| Tooltip on hover | 520 to 590 ms | 20 to 33 ms |
| First display | 1.1 s | 0.5 s |

At 10,000 holes, panning the whole map runs at about 32 FPS (60 when zoomed
in). Markers are not individually keyboard-focusable; the header count and the
tooltip remain.

## Viewport

The anchored legend sits top-left, the Legends panel top-right, the toolbar
(zoom, reset, ruler, area select, camera) bottom-right and the scale bar
bottom-left. There is no compass. The panel and toolbar share `--float-width`,
and every corner uses `--float-inset` (both on the TechnoMap.css root). The
panel and legend have a height cap so they scroll before they reach the
toolbar or scale bar.

Reset fits every drillhole in the dataset, whatever the filters, with
`zoom.fitPadding`. The view persists across page switches
(`state/mapViewStore`) and browser refreshes (`techno-map:view` in
localStorage).

## Measurement

The ruler places A on the first click and B on the second; the third starts
over. Measuring takes priority over the map's features: a press on a marker
places a point where it lands and opens no tooltip. A press that moves more
than 4 px pans instead, and double-click zoom is off while measuring. Points
are stored in UTM metres, so zoom, pan and resizing do not change the
distance. Switching the tool off clears it.

## Screenshot export

The camera button (*Screenshot map*) switches the map into screenshot mode
(`components/MapScreenshot`). It turns off the ruler and area select, wheel
zoom is blocked, and a hint reads *Drag to select an area · Esc to cancel*.
Drag a rectangle over the part of the map you want; anything smaller than
8 × 8 px is ignored. A modal dialog then asks for PNG or SVG. *Export* saves
the file, and *Cancel*, × or Esc leave screenshot mode without saving.
Clicking the camera again also leaves it.

`utils/exportMap.ts` builds one SVG of the whole viewport and crops it to the
dragged rectangle with the `viewBox`. The SVG holds the selected base map (the
image embedded, or the white grid drawn as vectors), deviation lines, markers
with the same features, shapes, sizes and colours as the canvas, the
measurement, and the scale bar at its on-screen spot in the bottom-left. The
title is left out of an area export, and the scale bar only appears if the
rectangle covers it. Floating UI (legend, Legends panel, toolbar, tooltip) is
never drawn. PNG rasterises the cropped SVG at 2×. Files are named
`TechnoMap_YYYY-MM-DD_HH-mm-ss.png|svg`. While the base map is not loaded, the
export is refused with a toast. The camera button is disabled while an export
runs.

## Selection and the selection table

There are two ways to select several holes. Ctrl+click (Cmd+click on a Mac) a
marker to add it to the selection, and Ctrl+click it again to take it out; a
plain click still pins one popup, and a plain drag pans. Area select, the
toolbar button right of the ruler, lets you drag a rectangle and adds every
shown hole inside it. The tool stays on for further boxes; click the button
again or press Esc to leave it. Area select and the ruler switch each other
off.

Selected holes get a green ring, drawn on the marker canvas in the same pass
as the markers (a DOM element per ring made panning slow with thousands
selected). While anything is selected, a table opens under the map with one
row per hole and one column per popup field that has data
(`utils/tooltipFields.ts`). A row click pins that hole's popup and × removes
it. *Clear selection* (or the close button) empties the selection and closes
the table. The selection is kept by record ID, so it survives a data refresh;
a hole hidden by the Legends filters keeps its row but loses its ring.

Each column header opens a filter menu: *Sort A → Z / Z → A* on text columns,
*Sort ascending / descending* on numbers and dates (empty cells always last),
a search box, *Select all / Unselect all* (applied to the values the search
shows) and a checkbox per distinct value with its count. Empty cells are
listed as *(Blank)*. Changes apply at once, and *Clear filters* resets every
column and the sort. Headers show a down arrow; a filtered column also shows a
green dot.

*Hide column* in a header menu hides that column, and the bar's *Columns* menu
shows or hides any column and has *Show all*. One column always stays
visible. Hidden columns are remembered in this browser
(`techno-map:table-columns`), and a filter on a hidden column keeps applying.

The bar's *Export* menu downloads exactly what the table shows: the filtered
rows in the current order, visible columns only, as
`TechnoMap_selection_YYYY-MM-DD_HH-mm-ss.xlsx` or `.csv`. Number columns are
written as real numbers instead of the rounded screen text, and dates as
`YYYY-MM-DD[ HH:mm]`. The CSV is UTF-8 with a BOM and CRLF line ends so Excel
opens it cleanly. The .xlsx has a bold, frozen header row and is written by
`utils/xlsx.ts` without any library.

The table stays responsive with 5,000 holes selected. Only the rows in view
are in the DOM (`Table/useWindowedRows.ts`, fixed 30px rows, spacer rows above
and below). Column widths come from every row, so nothing jumps while
scrolling (`columnWidths`, fixed table layout). Rows are cached per hole, so
adding one formats one row, and the page memoises the table so panning or
hovering the map never re-renders it. Filter menus list their values the same
way.

## Help

The round **?** button at the right end of the header (shared
`components/HelpDialog`) opens a dialog listing every shortcut and every
button on this page. Pressing **?** anywhere on the page opens it too, except
while typing. Esc, × or a click outside closes it. The wording lives in
`config/helpContent.tsx`. Button names there must match the controls'
accessible names; `tests/pages/TechnoMap/technoMapPage.test.jsx` checks this,
so a new toolbar button cannot ship undocumented. Icons come from
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
   With nothing to show, an error toast reads *Unable to load map data.* and
   a small notice gives the reason. An automatic retry that fails the same way
   again stays quiet.

Data stays in memory across page switches, with no refetch. At most one
request per map runs at a time, so an older response never overwrites a newer
one. There is no polling.

## Refresh

`Controls/RefreshButton` sits in the header, followed by the base map switcher
and the drillhole count. It always asks the backend. While the request runs,
only the icon spins (clockwise, and not under reduced motion) and further
clicks are ignored. Drillholes, filters, pan, zoom and measurement stay as
they are. Success shows *Map data refreshed successfully*.

## Base map

`Controls/BaseMapSwitcher` (layers icon, right of Refresh) opens a menu of the
backgrounds in `baseMap.options` (`config/technoMap.yaml`), with the current
one ticked:

| id | Label | Image | UTM corners |
|---|---|---|---|
| `geological` (default) | Geological Map | `VITE_MAP_IMAGE_PATH` | `VITE_MAP_MIN_X/MAX_X/MIN_Y/MAX_Y` |
| `white-grid` | White Grid Map | (geological, hidden) | geological |

This page has no Redox Map. The redox map (`/base-map3.svg`) covers the
exploration area and is offered on the Exploration Map only. The geological
image used to be labelled "Redox Map" and keeps the `geological` id, so a
saved choice still shows it; a saved `redox` choice falls back to the default.
`baseMapLayout(id)` in `config/technoMapConfig.ts` gives each background's
image and corners (an option may name its own `src` and `bounds`, as on the
Exploration Map). Holes, deviation lines, grid, scale bar, measurement and
export are all placed with them. Switching between the two keeps the view, the
measurement and the selection. The choice persists under `techno-map:base-map`
in localStorage and falls back to `baseMap.default`.

The image stays loaded and laid out while hidden, because its size is what
every feature is placed against. `Map/CoordinateGrid` draws under the canvas,
in viewport pixels, from `utils/coordinateGrid.ts`: a white sheet over exactly
the UTM bounds, with lines every 1/2/5 x 10^n metres (the smallest step at
least `whiteGrid.minLineSpacing` px apart, so it refines on zoom). Values are
written in kilometres (414,000 m → 414, 4,894,500 m → 4,894.5): eastings along
the bottom under an *Easting (km)* title, northings up the left beside a
turned *Northing (km)* title. Coordinates stay in metres, and positions go
through the same UTM → map ratio → viewport functions as the markers. The
export draws the same grid instead of embedding the image. Colours, line
width, label size and spacing are under `baseMap.whiteGrid`.

## Legend sizes

Legend dimensions are set under `legend:` in `config/technoMap.yaml` (px) and
reach the stylesheet as CSS variables from `Legends/MapLegend.tsx`. One base
`symbolSize` sizes every legend symbol, and the type shapes match it. Each
symbol is centred in a box 1.9 x `symbolSize` wide and as tall as the rig icon
(`symbols.rigIconScale`), so labels line up and the deviation line swatch
fits. Changing `symbolSize` resizes the whole legend without changing any
shape.

The legend lists one entry per row in filter order: the nine types, the rig
(*Drilling in progress*) and the deviation line. Entries whose filter is off
stay listed, faded. Redox colours are still in the YAML under `redox`, but the
API returns no redox value yet, so the legend does not show them. The card
stops short of the Legends panel and the scale bar and scrolls rather than
reach them.
