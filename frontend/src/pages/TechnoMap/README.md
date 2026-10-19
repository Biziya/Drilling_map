# TechnoMap — Techno Map

The Techno Map page: PRODUCT and INJECT drillholes from `GET /api/techno-map`,
cached in IndexedDB under `techno-map`.

```
TechnoMap/
├─ TechnoMap.tsx            renders the shared MapPage with this page's config
└─ config/technoMap.yaml    title, fallback marker kind, marker labels, legend
```

All rendering, loading, caching, refresh and notification behaviour is the
shared map feature — see [`src/map/README.md`](../../map/README.md).

## What is specific to this page

| Setting (`config/technoMap.yaml`) | Value | Why |
| --- | --- | --- |
| `fallbackMarkerKind` | `injector` | The dataset is gated to PRODUCT and INJECT, so anything not a producer is an injector. |
| `legendSymbols` | Injector, Producer, Drill Rig | |

Marker priority: in-progress → rig; PRODUCT → triangle; anything else →
square (injector).
