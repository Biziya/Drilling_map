# DrillMap: Exploration Map

The page reads `GET /api/exploration-map` and caches the response in
IndexedDB under `exploration-map`.

The page is self-contained. It owns its components, hooks, maths,
configuration and styles, and imports nothing from `../TechnoMap`
(`tests/pages/pageIndependence.test.js` enforces this). The two maps look
alike today but are expected to diverge, so a change here never changes the
other page. Only global infrastructure is shared: API plumbing
(`services/api`), the IndexedDB cache (`services/cache`), the data and view
stores (`state/`), the screenshot overlay (`components/MapScreenshot`), the
help dialog, toasts, types and generic field/number utilities.

```
DrillMap/
├─ DrillMap.tsx               composes the sections; header with refresh + count
├─ DrillMap.css               styles, every selector scoped under .drill-map-page
├─ Map/
│  ├─ MapCanvas.tsx           transformed layer: base image + children
│  ├─ CoordinateGrid.tsx      white grid base map: Easting/Northing lines + labels
│  ├─ DrillholeFeatures.tsx   dedupe → markers + deviation lines
│  ├─ DrillholeMarker.tsx     rig icon OR shape (never both) + tooltip
│  ├─ MeasurementOverlay.tsx  the A–B measurement, in viewport pixels
│  ├─ MapScaleBar.tsx         metre scale for the current zoom
│  └─ MapStatus.tsx           small notice: loading / empty / no data / no base map
├─ Legends/
│  ├─ MapLegend.tsx           GT bands, redox, this page's marker symbols
│  └─ MarkerSymbol.tsx        square/triangle shared by markers and legend
├─ Controls/
│  ├─ MapControls.tsx         zoom in/out, reset, measure, screenshot (camera), zoom readout
│  ├─ RefreshButton.tsx       header button: fetch fresh data
│  ├─ BaseMapSwitcher.tsx     header menu right of Refresh: Redox / Geological / White Grid
│  └─ icons.tsx               control icons, shared with the help dialog
├─ Tooltips/
│  └─ DrillholeTooltip.tsx    the hole's details on hover, focus or click
├─ hooks/
│  ├─ useBaseMap.ts           the selected base map, remembered in localStorage
│  ├─ useMapData.ts           automatic loading → status, placeable records, refresh()
│  └─ useMapViewport.ts       sizing, drag-pan, zoom, map clicks, view persistence
├─ config/
│  ├─ drillMap.yaml           title, zoom, base maps, GT bands, colours, labels, legend
│  ├─ drillMapConfig.ts       the YAML typed as DrillMapConfig; MAP_ID, getGtRange, baseMapLayout
│  └─ helpContent.tsx         what the ? help dialog lists: shortcuts and buttons
└─ utils/                     pure functions
   ├─ coordinateGrid.ts       white grid lines/labels for the view (screen + export)
   ├─ coordinates.ts          UTM → map %, deviation endpoints, pixel offsets
   ├─ geometry.ts             fit, transform, cursor-centred zoom, viewport ↔ map
   ├─ markerKind.ts           this page's marker rules
   ├─ measurement.ts          distance, formatting, click cycle
   ├─ exportMap.ts            PNG/SVG export of a dragged area of the map
   ├─ scaleBar.ts             a round 1/2/5 distance for the scale bar
   └─ storage.ts              localStorage read/write that never throws
```

## Configuration

`config/drillMap.yaml` holds the title, zoom limits, base maps, GT bands,
colours, marker labels and legend dimensions. `config/drillMapConfig.ts`
imports it and casts it to the `DrillMapConfig` interface. Nothing checks the
values at runtime, so a typo or a missing key in the YAML shows up as wrong
rendering, not as an error at load time.

## Layout and markers

The layout floats over the map like the Techno Map's, without the Legends
panel: a north arrow top-left, the toolbar top-right and the scale bar
bottom-left. The legend sits below the map. `--float-inset` and
`--float-width` on the DrillMap.css root set the spacing and toolbar width.

Marker priority (`utils/markerKind.ts`): an in-progress hole is drawn as the
rig; `PRODUCT` is a triangle (producer), `INJECT` a square (injector), and
anything else a square (drillhole). `PRODUCER` and `INJECTOR` are accepted
too. The dataset is mostly SEDIMENT and DEVELOP holes, so most draw as
"Drillhole".

## Measurement

The ruler places A on the first click and B on the second; the third starts
over. While measuring, markers stop catching the pointer and show no tooltip,
so a point can be placed on a marker. A press that moves more than 4 px pans
instead. Points are stored in UTM metres, so zoom and pan do not change the
distance.

## Screenshot export

The camera button (*Screenshot map*) switches the map into screenshot mode
(`components/MapScreenshot`). It turns off the ruler, wheel zoom is blocked,
and a hint reads *Drag to select an area · Esc to cancel*. Drag a rectangle
over the part of the map you want; anything smaller than 8 × 8 px is ignored.
A modal dialog then asks for PNG or SVG. *Export* saves the file, and
*Cancel*, × or Esc leave screenshot mode without saving. Clicking the camera
again also leaves it.

`utils/exportMap.ts` builds one SVG of the whole viewport and crops it to the
dragged rectangle with the `viewBox`. The SVG holds the selected base map (the
image embedded, or the white grid drawn as vectors), deviation lines once the
zoom reaches `zoom.deviationMinZoom`, markers and the measurement as vectors,
a north arrow in the top-right corner and the scale bar in the bottom-left.
The title is left out of an area export, and the north arrow and scale bar
only appear if the rectangle covers their spots. Toolbar and tooltips are
never drawn. PNG rasterises the cropped SVG at 2×. Files are named
`DrillMap_YYYY-MM-DD_HH-mm-ss.png|svg`. While the base map is not loaded, the
export is refused with a toast. The camera button is disabled while an export
runs.

## Help

The round **?** button at the right end of the header (shared
`components/HelpDialog`) opens a dialog listing every shortcut and every
button on this page. Pressing **?** anywhere on the page opens it too, except
while typing. Esc, × or a click outside closes it. The wording lives in
`config/helpContent.tsx`. Button names there must match the controls'
accessible names; `tests/pages/DrillMap/drillMapTools.test.jsx` checks this,
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
clicks are ignored. The drillholes, pan and zoom stay as they are. Success
shows *Map data refreshed successfully*.

## Base map

`Controls/BaseMapSwitcher` (layers icon, right of Refresh) opens a menu of the
backgrounds in `baseMap.options` (`config/drillMap.yaml`), with the current
one ticked: Redox Map (the default), Geological Map (the surveyed image) and
White Grid Map. The choice persists under `exploration-map:base-map` in
localStorage and falls back to `baseMap.default` (redox) when the stored value
is missing or no longer offered.

Each base map covers its own UTM rectangle. `baseMapLayout(id)` in
`config/drillMapConfig.ts` returns the image shown (`src`, null for the white
grid), the image the canvas is laid out on (`imageSrc`) and its corners
(`bounds`). `DrillMap.tsx` projects the drillholes with those bounds and
passes them to the measurement, scale bar, grid and export, so every position
follows the selected map.

| Base map | Image | minX | maxX | minY | maxY |
| --- | --- | --- | --- | --- | --- |
| Redox Map | `public/base-map3.svg` | 412499.97 | 423375.13 | 4890500 | 4898190.29 |
| Geological Map | `VITE_MAP_IMAGE_PATH` (`/base-map.svg`) | `VITE_MAP_MIN_X` | `VITE_MAP_MAX_X` | `VITE_MAP_MIN_Y` | `VITE_MAP_MAX_Y` |
| White Grid Map | geological image, hidden | as Geological | | | |

The Redox Map's `src` and `bounds` are written in `drillMap.yaml`. The corners
were read from the SVG's own Easting/Northing grid ticks and match the bounds
this project first shipped with (commit `6d89823`, `config/env.ts`). The
Geological corners come from `src/config/env.ts` (`MAP_UTM_BOUNDS`), which the
Techno Map also reads.

Switching to a base map with another image or other corners clears the
measurement and, once the new image has loaded, resets the view to the
initial view, since the old view no longer fits it. Geological and White Grid
share one layout, so switching between them changes only the background:
view, features and measurement stay put. The geological image stays loaded and
laid out while hidden, because its size is what every feature is placed
against. `Map/CoordinateGrid` draws under the canvas, in viewport pixels, from
`utils/coordinateGrid.ts`: a white sheet over exactly the UTM bounds, with
lines every 1/2/5 x 10^n metres (the smallest step at least
`whiteGrid.minLineSpacing` px apart, so it refines on zoom), eastings along
the top and northings along the left. Positions go through the same UTM → map
ratio → viewport functions as the markers. The export draws the same grid
instead of embedding the image. Colours, line width, label size and spacing
are under `baseMap.whiteGrid`.

## Legend sizes

Legend dimensions are set under `legend:` in `config/drillMap.yaml` (px) and
reach the stylesheet as CSS variables from `Legends/MapLegend.tsx`. One base
`symbolSize` sizes every legend symbol: GT circles and Redox squares are
exactly `symbolSize` on both sides, and the type shapes match. Each symbol, in
all three sections, is centred in a box 1.9 x `symbolSize` wide and as tall as
the rig icon (`symbols.rigIconScale`), so labels line up everywhere. Changing
`symbolSize` resizes the whole legend without changing any shape.

The sections sit side by side at their content width and wrap onto a new line
when they do not fit, with no fixed columns or heights. The Symbol section
takes the remaining width. GT bands fill `gt.columns` columns top to bottom,
so GT is no taller than the Symbol section.
