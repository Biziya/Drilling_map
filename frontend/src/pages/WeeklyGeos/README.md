# Weekly Geos — drilling dashboard

The two drilling pages from the `Weekly_Geos.pbix` report, merged in from
the standalone Weekly Geos application. They appear in the sidebar as
**Drilling Details** and **Drilling by Rig**.

Both render `DrillingDashboard`. The only difference between them is the
`dimension` prop — `category` or `rig` — which decides the heading and
whether the metres chart is stacked by rig. That was the only difference
between the two pages in the original report too, so there is no duplicated
chart code to keep in sync.

```
WeeklyGeos.tsx            page shell: query client, page root, CSS import
DrillingDashboard.tsx     the dashboard itself, both pages
WeeklyGeos.css            every style, scoped under .weekly-geos-page
config/weeklyGeos.yaml    headings, default campaign year, cache lifetime
types/drilling.ts         mirrors the reporting API's DTOs
api/client.ts             fetch layer; the mock switch lives here
api/mockData.ts           seeded generator — delete when the API lands
hooks/useDrilling.ts      filter state + one query hook per endpoint
components/charts.tsx     ECharts wrapper and the four chart types
components/shell.tsx      slicers, panels, cards, dialog, loading/error states
```

## What the merge changed

Everything below differs from the standalone application. Nothing else does.

**The sidebar is gone.** The application's own sidebar navigates to these
pages. The one that shipped with the dashboard was both a duplicate and a
direct collision: it styled `.sidebar`, `.sidebar__link`, `.sidebar__label`,
`.sidebar__icon` and `.sidebar__brand`, every one of which the application
sidebar owns. `useSidebar` went with it.

**The router is gone.** The application switches pages with state, not
routes, so `react-router-dom` is no longer a dependency. The keying that
stopped the two pages sharing filter state still matters and still exists —
it moved from the `<Route>` elements to `WeeklyGeos.tsx`. Without it React
reconciles the two pages as one component and a hole purpose picked on the
first page silently filters the second.

**Every style is scoped** under `.weekly-geos-page`, including what used to
sit on `:root` and `body`. The three stylesheets are merged into one file.
`pageIndependence.test.js` enforces the scoping, and specifically checks
that none of the shared sidebar class names reappear.

**The query client is at module scope**, not in a provider in the tree. The
application unmounts a page on navigation, so a client created per mount
would be discarded and every figure refetched on each visit. At module
scope the cache outlives the mount and both pages share it.

**The enlarged-chart dialog is portalled to `<body>`.** The page declares
`container: inline-size` so the grid reflows against the main area rather
than the window — a window-width media query fired about a sidebar too late
and left four columns in 980px of space. But a CSS container is also the
containing block for `position: fixed` descendants, which would have left
the dialog's backdrop covering the main area only. The portal wrapper keeps
the page class, since that is what the dialog's styles are scoped to.

**The charts read their tokens from the page root**, not from
`document.documentElement`, because that is where the tokens now live.

**The page is lazy-loaded.** ECharts and the query client are about 200 kB
gzipped, more than double the rest of the application, and someone who only
opens a map should not pay for it. `App.tsx` loads this page on demand.

**It reads a second backend.** See the two-backends section of the root
README: the reporting API does not share a port with the drilling API, so it
is reached through `/weekly-api` rather than `/api`.

Type fixes for this project's stricter compiler (no parameter properties, no
unchecked index access, no global `JSX` namespace under React 19) touched
`client.ts`, `mockData.ts`, `charts.tsx` and `DrillingDashboard.tsx` without
changing behaviour.

## Choices carried over from the original

**ECharts, not Recharts.** The weekly column chart needs a two-level
category axis — week labels banded by month. ECharts does it with a second
x-axis; Recharts cannot do it at all.

**One `RateChart` used three times.** Cored proportion, deviation and
recovery are the same chart: a weekly series plus a flat campaign-average
reference line. One component, three configurations.

**Three fixes against the Power BI model.** The Techno donut was filtered to
`Hydro` in the original — here each donut binds to its own category. The
banner rendered as `Campaign W14 - W45Target: 38,000 m`, missing a
separator. The recovery chart used the unclamped measure while deviation
used the clamped one; both are clamped to the campaign window here.

These mean the numbers differ slightly from the Power BI report during
parallel running. That is deliberate — but someone should sign it off, or it
will get filed as a bug.

## Still unsettled

- **Number formats.** Decimal places, thousands separators and axis ranges
  are a best guess. Page screenshots would settle it in minutes.
- **The four KPI cards.** The original had five; four were per-category hole
  counts beside the donuts. Those counts moved into the donut headers and
  the top row now shows campaign-level figures. Revert if the original four
  were what people actually read.
- **Month names** come from the API (`DATENAME`), so they follow the SQL
  connection's language. If the report should read French, decide whether to
  localise in SQL or in the frontend — not both.
- **Sidebar labels.** "Drilling Details" and "Drilling by Rig" are in
  `src/config/app.yaml`; the page headings are in `config/weeklyGeos.yaml`.
  They are deliberately separate — a sidebar entry has less room than a
  heading — but they should not drift apart in meaning.
