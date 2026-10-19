# map — the shared map feature

Both map pages (Exploration and Techno) are this one implementation, driven by
a small per-page YAML file. A page differs only in its title, endpoint,
fallback marker kind, marker labels and legend symbols; everything else —
zoom, projection, markers, tooltips, legend, styling — is identical by
construction rather than kept in sync by hand.

```
map/
├─ MapPage.tsx          composes the sections below for one page
├─ map.css              marker, tooltip, legend and overlay styles
├─ Map/                 what is drawn on and over the map
│  ├─ MapCanvas.tsx       transformed layer: base image + children
│  ├─ DrillholeFeatures   dedupe → markers + deviation lines
│  ├─ DrillholeMarker     rig icon OR shape (never both) + tooltip
│  ├─ MapScaleBar.tsx     metre scale for the current zoom
│  └─ MapStatus.tsx       small notice: loading / empty / no data / no base map
├─ Legends/
│  ├─ MapLegend.tsx       GT bands, redox, marker symbols
│  └─ MarkerSymbol.tsx    the square/triangle shared by markers and legend
├─ Controls/
│  ├─ MapControls.tsx     zoom in/out, reset, zoom readout
│  └─ RefreshButton.tsx   top-right: fetch fresh data from the backend
├─ Tooltips/
│  └─ DrillholeTooltip    the hole's details on hover, focus or click
├─ hooks/
│  ├─ useMapData.ts       automatic loading → display status + refresh()
│  └─ useMapViewport.ts   sizing, drag-pan, wheel/button zoom, view persistence
├─ config/
│  ├─ map.yaml            shared settings: zoom, GT bands, colours, icons
│  └─ mapConfig.ts        validates map.yaml and the page YAML files
└─ utils/                 pure functions, unit tested
   ├─ coordinates.ts      UTM → map %, deviation endpoints and pixel offsets
   ├─ geometry.ts         fit, transform, cursor-centred zoom
   ├─ markerKind.ts       rig > producer > injector > page fallback
   └─ scaleBar.ts         a round 1/2/5 distance for the scale bar
```

## Data loading

`hooks/useMapData` reads `state/mapDataStore`, which loads each map
stale-while-revalidate:

1. On first opening a map, the IndexedDB copy (if any) is drawn at once and
   the backend is asked for fresh data in the background.
2. A successful response replaces what is on screen and the IndexedDB copy.
   No toast — automatic success is silent.
3. A failed response leaves the map and IndexedDB untouched. With data on
   screen: a warning toast (*Backend unavailable. Showing cached data.*).
   With none: an error toast and a small *No map data available* notice.

The store is module-level, so switching pages keeps the data and does not
refetch. A request still running when its page unmounts finishes and is
waiting when the page returns. There is at most one request per map: a second
load joins the running one, which also means an older response can never
overwrite a newer one. After a failure, the next visit tries again. There is
no polling.

## Manual refresh

`Controls/RefreshButton` always asks the backend, even if data is fresh. It
spins and is disabled while any request for the map runs (repeat clicks do
nothing), the drillholes and the pan/zoom stay as they are, and the result is
a toast: success, or the same warning/error as an automatic failure.

## Notifications

Temporary feedback goes through the app-wide toasts in
`src/components/Toast` (top-centre, error 5 s, warning/success 3 s). The map
itself only shows persistent states, via `Map/MapStatus`.
