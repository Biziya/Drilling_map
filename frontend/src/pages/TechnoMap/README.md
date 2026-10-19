# TechnoMap — Techno Map page

Everything the Techno Map needs, in one folder: the page, its components, its
configuration, its maths and its hooks.

The page is mounted by `src/App.tsx` when the sidebar's `techno-map` entry is
active. It fetches `/api/techno-map`, projects each drillhole from UTM onto
the base map image, and renders a pannable, zoomable canvas of producer /
injector / rig markers, deviation lines, a legend and a scale bar.

> **This folder is intentionally self-contained.** Several files here are
> byte-identical to their counterparts in `../DrillMap`. That duplication is
> deliberate — see [Relationship to DrillMap](#relationship-to-drillmap).

---

## How this differs from the Exploration Map

The two pages are structurally the same and must stay visually consistent,
but they are not interchangeable:

| | DrillMap (Exploration) | TechnoMap |
| --- | --- | --- |
| Endpoint | `/api/exploration-map` | `/api/techno-map` |
| Marker kinds | rig, producer, injector, **drillhole** | rig, producer, **injector** (catch-all) |
| CSS prefix | `map-`, `drillhole-` | `techno-map-`, `techno-drillhole-` |
| Scale variable | `--inverse-map-scale` | `--techno-inverse-map-scale` |
| Symbol colour var | `--status-color` | `--techno-status-color` |
| View store key | `exploration-map` | `techno-map` |
| Cache key | `DATASET_IDS.explorationMap` | `DATASET_IDS.technoMap` |
| Legend symbols | rig only | injector, producer, rig |

The fourth marker kind is the real difference. The Exploration Map's dataset
is gated to `SEDIMENT` and `DEVELOP` holes, which are neither producers nor
injectors, so it keeps a plain `drillhole` kind for them. This map's dataset
is gated to `PRODUCT` and `INJECT`, so anything that is not a producer is an
injector.

The CSS prefixes are not cosmetic. `TechnoMapMarkerSymbol` writes
`--techno-status-color` and only `TechnoMap.css` reads it; crossing the two
renders every marker uncoloured with no error. There is a test pinning this
per module.

---

## Data flow

```
fetchTechnoMap()                 services/Api/technoMap.ts
        │                        raw DrillholeApiRecord[]
        ▼
useMapData()                     cache-then-network, owns loading/error state
        │  project: convertUtmToTechnoMapPosition
        ▼
ProjectedDrillhole[]             each record + xPercent / yPercent / isInsideMap
        │
        ▼
TechnoMapFeatures                dedupe → project endpoints → pixel offsets
        │
        ├─► TechnoMapMarker ──► TechnoMapMarkerSymbol | rig icon
        │                  └──► TechnoMapTooltip
        └─► TechnoMapDeviationLines
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
buildCanvasTransformStyle()      translate(x, y) scale(s) on .techno-map-canvas
```

---

## The page

| File | What it does |
| --- | --- |
| `TechnoMap.tsx` | The page. Wires `useMapViewport` and `useMapData` together, owns `INITIAL_VIEW`, the drag-ignore selector, the `--techno-inverse-map-scale` variable name and the `techno-map` view-persistence key. |
| `TechnoMap.css` | All styling for the page and every component below. Marker sizing, the deviation stroke and `overflow: visible` on the line SVG live here. |

## Components

| File | Props | What it does |
| --- | --- | --- |
| `MapCanvas.tsx` | `style`, `onImageLoad`, `onImageError`, `children` | The transformed layer. Renders the base map `<img>` and everything positioned on top of it. |
| `TechnoMapFeatures.tsx` | `drillholes`, `deviationVisible`, `mapWidth`, `mapHeight` | Turns projected drillholes into positioned features. Dedupes first, so one hole can never produce both a rig and a shape. Memoised. |
| `TechnoMapMarker.tsx` | `drillhole`, `markerKind?` | One marker button, defaulting to the injector square. Renders **either** the rig icon **or** a shape, never both. Memoised. |
| `TechnoMapMarkerSymbol.tsx` | `config`, `small?` | The coloured shape. Writes `--techno-status-color`. `small` is opt-in and used only by the legend, so a map marker's class list stays exactly `techno-marker-symbol techno-marker-symbol--<shape>`. |
| `TechnoMapTooltip.tsx` | `drillhole` | The hover/click panel. Reads both camelCase and PascalCase field spellings. Memoised. |
| `TechnoMapDeviationLines.tsx` | `deviation` | A 1×1 SVG with `overflow: visible` drawing the deviation vector from the collar. Must render identically to DrillMap's `DeviationLineVector`. |
| `TechnoMapControls.tsx` | `zoom`, `onZoomIn`, `onZoomOut`, `onReset` | Zoom buttons, reset and the percentage readout. |
| `TechnoMapScaleBar.tsx` | `mapWidth`, `zoom` | Distance bar. Returns `null` when the map has not been measured yet. Memoised. |
| `TechnoMapLegend.tsx` | — | GT bands, redox swatches, and injector / producer / rig symbols. Draws the shapes with the **same component the markers use**, so the legend cannot drift from the map. |
| `MapStatusOverlay.tsx` | `status`, `message`, `onRetry` | Loading / empty / error states. Unmounts completely on `ready`. |
| `MapMissingNotice.tsx` | — | Shown when the base map image fails to load. |

## Configuration

### `technoMapConfig.ts`

| Export | Notes |
| --- | --- |
| `TECHNO_BASE_MAP_SRC` | From `VITE_MAP_IMAGE_PATH`, default `/base-map.svg`. |
| `TECHNO_RIG_ICON_SRC` | `/rig.svg`. |
| `TECHNO_LEGEND_SYMBOL_COLOR` | Neutral fill for legend swatches — on the map the fill carries the grade, which the shape legend is not about. |
| `TECHNO_DEVIATION_LINE_EXAGGERATION` | `5`. **Must equal DrillMap's factor.** |
| `TECHNO_MAP_SETTINGS` | `minZoom` 1, `maxZoom` 90, `zoomStep` 0.4, `deviationMinZoom` 10, `showLegends`. |
| `TECHNO_MAP_UTM_BOUNDS` | From the `VITE_MAP_*` bounds, defaulting to the surveyed values. Same source as DrillMap, so both maps place a hole identically. |
| `TECHNO_GT_RANGES` | The six grade bands. **Must match `GT_RANGES`** — the same grade has to paint the same colour on both pages. |
| `TECHNO_STATUS_CONFIG`, `TECHNO_REDOX_CONFIG` | Classification tables. |
| `getTechnoMapGtRange(value)` | Takes `unknown`. Returns `null` for anything that is not a real reading in 0–4, including whitespace-only strings. |
| `getTechnoMapDrillholeStatus(drillhole)` | Explicit status if recognised, otherwise inferred from `coordinateType` containing `planned`. |
| `isTechnoDrillholeStatusName(value)` | Set-membership guard, used instead of indexing the config with an arbitrary API string. |

## Domain logic

| File | Exports | Notes |
| --- | --- | --- |
| `technoMapCoordinates.ts` | `convertUtmToTechnoMapPosition`, `calculateTechnoMapDeviationEndpoint` | Generic in the record. Azimuth convention: **0° N, 90° E, 180° S, 270° W**. Out-of-bounds holes are kept and flagged `isInsideMap: false`. |
| `technoMarkerKind.ts` | `TECHNO_MARKER_KIND`, `resolveTechnoMarkerKind`, `readHolePurpose`, `isInProgressHole`, `isProducerHole`, `isInjectorHole`, `markerShapeFor` | Marker priority: `HoleStatus = INPROGRESS` → rig, then `PRODUCT` → triangle, else injector square. The rig rule wins outright. |
| `drillholeFeatures.ts` | `projectDrillholes`, `attachDeviationOffsets` | Builds the `holeId-index` React key, flags rigs, projects endpoints, then converts the percentage delta into pixel offsets. |
| `mapDataState.ts` | `LOADING_STATE`, `DATA_SOURCES`, `resolveLoadedState`, `resolveFailedState`, `resolveCachedState`, `resolveRefreshedState`, `resolveRefreshFailure` | The state machine. A failed background refresh keeps cached drillholes on screen. |

`PRODUCER_PURPOSES` accepts both `PRODUCT` and `PRODUCER`, and
`INJECTOR_PURPOSES` both `INJECT` and `INJECTOR`. `PRODUCT`/`INJECT` are what
the API actually returns; the longer spellings are kept so neither vocabulary
can silently regress to a square. This previously matched only `PRODUCER`,
which no record carries, and no triangle was ever drawn.

## Maths and formatting

| File | Exports |
| --- | --- |
| `mapGeometry.ts` | `computeFitScale`, `computeRenderedMapSize`, `toPixels`, `computeMapOrigin`, `getDevicePixelRatio`, `snapToDevicePixels`, `buildCanvasTransformStyle` |
| `zoomMath.ts` | `crossesThreshold`, `snapToThreshold`, `clampScale`, `resolveScale`, `panAroundAnchor`, `zoomView`, `isViewZoomed` |
| `scaleBar.ts` | `computeScaleBar` — rounds to a 1/2/5 step near a 100 px target; returns `null` for degenerate input |
| `formatNumber.ts` | `formatNumber`, `formatMeasurement` — reject `null`, `''`, `'  '`, booleans and objects before `Number()` |
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
| `useAnimationFrameView` | `{ view, viewRef, queueViewUpdate }`. Absorbs high-frequency pointer and wheel updates in a ref; only the last per frame reaches state. |
| `useBaseMapImage` | `{ size, hasFailed, handleLoad, handleError }`. |
| `usePointerDrag` | `{ isDragging, startDrag, moveDrag, stopDrag }`. Captures the pointer so a fast drag leaving the viewport keeps panning. |
| `useMapPanning` | Wires drag-to-pan to the view, leaving scale untouched. |
| `useWheelZoom` | Registers a **non-passive** native `wheel` listener — React attaches wheel handlers passively, so `preventDefault()` would not work through `onWheel`. |
| `useZoomAtPoint` | `(scaleRequest, viewportPoint?) => void`. Omitting the point zooms about the viewport centre. |
| `useZoomControls` | `{ zoomIn, zoomOut, reset, zoomInAtPointer }`. |

---

## Relationship to DrillMap

These files are byte-identical to `../DrillMap`:

```
classNames.ts   formatNumber.ts   scaleBar.ts   zoomMath.ts   mapGeometry.ts
mapDataState.ts   drillholeFeatures.ts   useElementSize.ts
useAnimationFrameView.ts   useBaseMapImage.ts   usePointerDrag.ts
useMapPanning.ts   useWheelZoom.ts   useZoomAtPoint.ts
useZoomControls.ts   useMapViewport.ts   useMapData.ts
```

The two pages are deliberately independent, and the test suite runs the same
assertions against **both** copies specifically to catch drift. If you change
one of these files, change the other identically.

Three behaviours are additionally asserted to be *equal* across the two maps
by `tests/pages/deviationParity.test.jsx`:

- `calculateDeviationEndpoint` vs `calculateTechnoMapDeviationEndpoint`
- `convertUtmToMapPosition` vs `convertUtmToTechnoMapPosition`
- the rendered deviation SVG, attribute for attribute

Changing either map's deviation logic alone will fail that suite. That is the
point of it.

Genuinely shared code lives outside this folder:

- `src/types/` — `DrillholeApiRecord`, `MapBounds`, `MapTransform`, `Point`, …
- `src/services/` — API endpoints and the IndexedDB cache
- `src/state/mapViewStore.ts` — per-page pan/zoom persistence
- `src/utils/drillholeFields.ts` — **the** reader for record fields; resolves
  the camelCase/PascalCase aliases and defines `isInProgressHole`
- `src/utils/dedupeDrillholes.ts` — one marker per hole
- `src/config/env.ts` — typed environment variables

## Conventions worth keeping

- The API sends **some fields PascalCase**. Read both spellings, and read them
  through the helpers in `technoMarkerKind.ts` so the tooltip and the marker
  shape can never disagree.
- Never `Number()` an API value directly. `Number(null)`, `Number('')` and
  `Number('  ')` are all `0`.
- Keep every CSS class, custom property and asset path on the `techno-` prefix.
- Drillhole coordinates are the **centre** of the marker, and markers stay a
  constant on-screen size via `--techno-inverse-map-scale`.
