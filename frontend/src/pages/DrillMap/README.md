# DrillMap — Exploration Map page

Everything the Exploration Map needs, in one folder: the page, its
components, its configuration, its maths and its hooks.

The page is mounted by `src/App.tsx` when the sidebar's `drill-map` entry is
active. It fetches `/api/exploration-map`, projects each drillhole from UTM
onto the base map image, and renders a pannable, zoomable canvas of markers,
deviation lines, a legend and a scale bar.

> **This folder is intentionally self-contained.** Several files here are
> byte-identical to their counterparts in `../TechnoMap`. That duplication is
> deliberate — see [Relationship to TechnoMap](#relationship-to-technomap).

---

## Data flow

```
fetchDrillholeMap()              services/Api/drillholeMap.ts
        │                        raw DrillholeApiRecord[]
        ▼
useMapData()                     cache-then-network, owns loading/error state
        │  project: convertUtmToMapPosition
        ▼
ProjectedDrillhole[]             each record + xPercent / yPercent / isInsideMap
        │
        ▼
DrillholeMapFeatures             dedupe → project endpoints → pixel offsets
        │
        ├─► DrillholeMarker ──► MarkerSymbol | rig icon
        │                  └──► DrillholeTooltip
        └─► DeviationLineVector
```

Pan and zoom run on a separate track:

```
useMapViewport()                 composes every interaction hook
        ├─ useElementSize        viewport size via ResizeObserver
        ├─ useBaseMapImage       intrinsic image size + load failure
        ├─ useAnimationFrameView view in a ref, committed once per frame
        ├─ useZoomAtPoint  ─► zoomMath.zoomView   (cursor-centred zoom)
        ├─ useZoomControls       +, −, reset, double-click
        ├─ useMapPanning   ─► usePointerDrag      (drag to pan)
        └─ useWheelZoom          non-passive wheel listener
        │
        ▼
buildCanvasTransformStyle()      translate(x, y) scale(s) on .map-canvas
```

---

## The page

| File | What it does |
| --- | --- |
| `DrillMap.tsx` | The page. Wires `useMapViewport` and `useMapData` together, owns `INITIAL_VIEW`, the drag-ignore selector, the `--inverse-map-scale` variable name and the `exploration-map` view-persistence key. |
| `DrillMap.css` | All styling for the page and every component below. Marker sizing, the deviation stroke and `overflow: visible` on the line SVG live here. |

## Components

| File | Props | What it does |
| --- | --- | --- |
| `MapCanvas.tsx` | `style`, `onImageLoad`, `onImageError`, `children` | The transformed layer. Renders the base map `<img>` and everything positioned on top of it. |
| `DrillholeMapFeatures.tsx` | `drillholes`, `deviationVisible`, `mapWidth`, `mapHeight` | Turns projected drillholes into positioned features. Dedupes first, so one hole can never produce both a rig and a shape. Memoised. |
| `DrillholeMarker.tsx` | `drillhole`, `markerKind?` | One marker button. Renders **either** the rig icon **or** a shape, never both. Owns the tooltip open state. Memoised. |
| `MarkerSymbol.tsx` | `config`, `small?` | The coloured shape. Passes the fill down as `--status-color`; the stylesheet decides whether that paints a background or a `::before`. |
| `DrillholeTooltip.tsx` | `drillhole` | The hover/click panel. Reads both camelCase and PascalCase field spellings so it can never disagree with the marker shape. Memoised. |
| `DeviationLineVector.tsx` | `deviation` | A 1×1 SVG with `overflow: visible` drawing the deviation vector from the collar. Must stay identical to TechnoMap's copy. |
| `MapControls.tsx` | `zoom`, `onZoomIn`, `onZoomOut`, `onReset` | Zoom buttons, reset and the percentage readout. Disables at `minZoom` / `maxZoom`. |
| `MapScaleBar.tsx` | `mapWidth`, `zoom` | Distance bar. Returns `null` when the map has not been measured yet. Memoised. |
| `MapLegend.tsx` | — | GT bands, redox swatches, and the producer / drillhole / rig symbols. Draws the shapes with the **same component the markers use**, so the legend cannot drift from the map. |
| `MapStatusOverlay.tsx` | `status`, `message`, `onRetry` | Loading / empty / error states. Unmounts completely on `ready`, because it sits above the canvas and would otherwise swallow pointer events. |
| `MapMissingNotice.tsx` | — | Shown when the base map image fails to load. |

## Configuration

### `drillMapConfig.ts`

| Export | Notes |
| --- | --- |
| `BASE_MAP_SRC` | From `VITE_MAP_IMAGE_PATH`, default `/base-map.svg`. |
| `RIG_ICON_SRC` | `/rig.svg`. |
| `DEVIATION_LINE_EXAGGERATION` | `5`. Display-only multiplier — a real deviation of a few metres is invisible at map scale. **Must equal TechnoMap's factor.** |
| `MAP_SETTINGS` | `MapZoomSettings`: `minZoom` 1, `maxZoom` 90, `zoomStep` 0.4, `deviationMinZoom` 10, `showLegends`. `deviationMinZoom` is both the snap target and the zoom at which deviation lines appear. |
| `MAP_UTM_BOUNDS` | From `VITE_MAP_MIN_X` / `MAX_X` / `MIN_Y` / `MAX_Y`, defaulting to the surveyed bounds. |
| `GT_RANGES` | The six grade bands. Lower bound inclusive, upper exclusive, except the last which includes 4. |
| `STATUS_CONFIG`, `REDOX_CONFIG` | Status and redox classification tables. |
| `getGtRange(value)` | Takes `unknown` — the value comes straight off an API record. Returns `null` for anything that is not a real reading in 0–4, including whitespace-only strings, which would otherwise coerce to `0` and paint as a genuine low grade. |
| `getDrillholeStatus(drillhole)` | Explicit status if recognised, otherwise inferred from `coordinateType` containing `planned`. |
| `isDrillholeStatusName(value)` | Set-membership guard. Used instead of indexing `STATUS_CONFIG` with an arbitrary API string. |

## Domain logic

| File | Exports | Notes |
| --- | --- | --- |
| `utmCoordinates.ts` | `convertUtmToMapPosition`, `calculateDeviationEndpoint` | Generic in the record, so the same function projects a full drillhole and a bare endpoint. Azimuth convention: **0° N, 90° E, 180° S, 270° W** — sine drives easting, cosine drives northing. Out-of-bounds holes are kept and flagged `isInsideMap: false`. |
| `drillholeMarkerKind.ts` | `MARKER_KIND`, `resolveDrillholeMarkerKind`, `readHoleStatus`, `readHolePurpose`, `isInProgressHole`, `markerShapeFor`, `isRigKind` | Marker priority: `HoleStatus = INPROGRESS` → rig, then `PRODUCT` → triangle, `INJECT` → square, else plain square. The rig rule wins outright. |
| `drillholeFeatures.ts` | `projectDrillholes`, `attachDeviationOffsets` | Builds the `holeId-index` React key, flags rigs, projects endpoints, then converts the percentage delta into pixel offsets. |
| `mapDataState.ts` | `LOADING_STATE`, `DATA_SOURCES`, `resolveLoadedState`, `resolveFailedState`, `resolveCachedState`, `resolveRefreshedState`, `resolveRefreshFailure` | The state machine. `empty` and `error` are distinct: no records vs. records that cannot be placed. A failed background refresh keeps cached drillholes on screen. |

## Maths and formatting

| File | Exports |
| --- | --- |
| `mapGeometry.ts` | `computeFitScale`, `computeRenderedMapSize`, `toPixels`, `computeMapOrigin`, `getDevicePixelRatio`, `snapToDevicePixels`, `buildCanvasTransformStyle` |
| `zoomMath.ts` | `crossesThreshold`, `snapToThreshold`, `clampScale`, `resolveScale`, `panAroundAnchor`, `zoomView`, `isViewZoomed` |
| `scaleBar.ts` | `computeScaleBar` — rounds to a 1/2/5 step near a 100 px target; returns `null` for degenerate input |
| `formatNumber.ts` | `formatNumber`, `formatMeasurement` — reject `null`, `''`, `'  '`, booleans and objects before `Number()`, so a missing reading never renders as `0` |
| `classNames.ts` | `classNames` — joins the truthy parts |

Two things in here are load-bearing and should not be "tidied":

- **`buildCanvasTransformStyle` emits `translate(...) scale(...)` in that
  order.** `panAroundAnchor` solves for the translation assuming exactly this
  composition. Swapping them moves the map out from under the cursor.
- **`zoomView` returns the *same object* when the scale cannot change.** The
  caller skips the re-render by reference comparison.

## Hooks

| Hook | Returns / does |
| --- | --- |
| `useMapData` | `{ status, drillholes, message, source, isRefreshing, refreshMessage, reload }`. Starts the cache read and the network request together; a late cache read never overwrites fresher API data. Aborts on unmount. |
| `useMapViewport` | `{ viewportRef, view, renderedMapSize, image, controls, drag }`. Composes everything below and restores/persists the view via `state/mapViewStore`. |
| `useElementSize` | Viewport size via `ResizeObserver`; only re-renders when the box actually changes. |
| `useAnimationFrameView` | `{ view, viewRef, queueViewUpdate }`. Pointer and wheel events fire far faster than React can usefully render, so the ref absorbs them and only the last update per frame reaches state. |
| `useBaseMapImage` | `{ size, hasFailed, handleLoad, handleError }`. |
| `usePointerDrag` | `{ isDragging, startDrag, moveDrag, stopDrag }`. Captures the pointer so a fast drag leaving the viewport keeps panning. |
| `useMapPanning` | Wires drag-to-pan to the view, leaving scale untouched. |
| `useWheelZoom` | Registers a **non-passive** native `wheel` listener — React attaches wheel handlers passively, so `preventDefault()` would not work through `onWheel`. |
| `useZoomAtPoint` | `(scaleRequest, viewportPoint?) => void`. Omitting the point zooms about the viewport centre, which is what the +/− buttons want. |
| `useZoomControls` | `{ zoomIn, zoomOut, reset, zoomInAtPointer }`. |

---

## Relationship to TechnoMap

These files are byte-identical to `../TechnoMap`:

```
classNames.ts   formatNumber.ts   scaleBar.ts   zoomMath.ts   mapGeometry.ts
mapDataState.ts   drillholeFeatures.ts   useElementSize.ts
useAnimationFrameView.ts   useBaseMapImage.ts   usePointerDrag.ts
useMapPanning.ts   useWheelZoom.ts   useZoomAtPoint.ts
useZoomControls.ts   useMapViewport.ts   useMapData.ts
```

The two pages are deliberately independent, and the test suite runs the same
assertions against **both** copies specifically to catch drift. If you change
one of these files, change the other identically — or the paired tests in
`tests/pages/DrillMap/` will fail.

Genuinely shared code lives outside this folder:

- `src/types/` — `DrillholeApiRecord`, `MapBounds`, `MapTransform`, `Point`, …
- `src/services/` — API endpoints and the IndexedDB cache
- `src/state/mapViewStore.ts` — per-page pan/zoom persistence
- `src/utils/drillholeFields.ts` — **the** reader for record fields; resolves
  the camelCase/PascalCase aliases and defines `isInProgressHole`
- `src/utils/dedupeDrillholes.ts` — one marker per hole
- `src/config/env.ts` — typed environment variables

## Adding a drillhole field

1. Add it to `DrillholeMapItem` **and** `DrillholeApiRecord` in
   `src/types/drillhole.ts` (plus the PascalCase alias if the API sends one).
2. The compiler will flag nothing automatically — the field is optional — so
   add the row to `DrillholeTooltip.tsx` and, if it affects the symbol, to
   `drillholeMarkerKind.ts`.
3. Nothing needs to change in the cache: it stores the API response verbatim,
   so the new column is already there on the next read.

## Conventions worth keeping

- The API sends **some fields PascalCase**. Read both spellings, and read them
  through the helpers in `drillholeMarkerKind.ts` so the tooltip and the
  marker shape can never disagree.
- Never `Number()` an API value directly. Use `toFiniteNumber` /
  `toMeasuredNumber`; `Number(null)`, `Number('')` and `Number('  ')` are all
  `0`.
- Drillhole coordinates are the **centre** of the marker, and markers stay a
  constant on-screen size via `--inverse-map-scale`.
