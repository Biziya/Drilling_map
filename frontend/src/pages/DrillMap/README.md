# DrillMap — Exploration Map

The Exploration Map page: SEDIMENT and DEVELOP drillholes from
`GET /api/exploration-map`, cached in IndexedDB under `exploration-map`.

```
DrillMap/
├─ DrillMap.tsx           renders the shared MapPage with this page's config
└─ config/drillMap.yaml   title, fallback marker kind, marker labels, legend
```

All rendering, loading, caching, refresh and notification behaviour is the
shared map feature — see [`src/map/README.md`](../../map/README.md).

## What is specific to this page

| Setting (`config/drillMap.yaml`) | Value | Why |
| --- | --- | --- |
| `fallbackMarkerKind` | `drillhole` | SEDIMENT/DEVELOP holes are neither producers nor injectors, so they keep a plain square labelled "Drillhole". |
| `legendSymbols` | Producer, Drillhole, Drill Rig | Injector and drillhole draw the same square, so only one is listed. |

Marker priority: in-progress → rig; PRODUCT → triangle; INJECT → square
(injector); anything else → square (drillhole).
