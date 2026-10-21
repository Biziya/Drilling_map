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
│  └─ RefreshButton.tsx     header button: fetch fresh data
├─ Tooltips/
│  └─ DrillholeTooltip      the hole's details on hover, focus or click
├─ hooks/
│  ├─ useMapData.ts         automatic loading → status, drillholes, refresh()
│  └─ useMapViewport.ts     sizing, drag-pan, zoom, map clicks, view persistence
├─ config/
│  ├─ drillMap.yaml           title, zoom, GT bands, colours, labels, legend
│  └─ drillMapConfig.ts       validates the YAML; MAP_ID, getGtRange
└─ utils/                   pure functions
   ├─ coordinates.ts        UTM → map %, deviation endpoints, pixel offsets
   ├─ geometry.ts           fit, transform, cursor-centred zoom, viewport ↔ map
   ├─ markerKind.ts         this page's marker rules
   ├─ measurement.ts        distance, formatting, click cycle
   ├─ exportMap.ts          PNG/SVG export of the visible viewport
   └─ scaleBar.ts           a round 1/2/5 distance for the scale bar
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

`Controls/RefreshButton` sits in the header, immediately before the drillhole
count. It always asks the backend. While the request runs only the icon
spins (clockwise; not under reduced motion) and further clicks are ignored;
the drillholes, pan and zoom stay as they are. Success shows *Map data
refreshed successfully*.

## Legend sizes

Legend dimensions are set under `legend:` in `config/drillMap.yaml` (px, validated
as 0 or more) and reach the stylesheet as CSS variables from
`Legends/MapLegend.tsx`. One base `symbolSize` sizes every legend symbol: GT
circles and Redox squares are exactly `symbolSize` on both sides, and the type
shapes match. Each symbol, in all three sections, is centred in a box 2.4 x 1.6
times `symbolSize`, so labels line up everywhere; the rig icon
(`symbols.rigIconScale`) scale with it. Changing
`symbolSize` resizes the whole legend without changing any shape.
