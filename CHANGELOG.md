# Changelog

Every version of the Drilling Map website, newest first. The version format
and when to bump each part are in [VERSIONING.md](VERSIONING.md). Write each
entry for the people using the site: what they can now do, or what got fixed.

## 1.1.3.0 - 2026-11-16

- Exploration Map now matches the Techno Map: the toolbar sits bottom-right,
  and a Layers panel top-right hides producers, drillholes, drill rigs and
  deviation lines. The GT, Redox, Drillhole Types and Overlays legend sits
  top-left, one section per row. The compass is gone.
- Exploration Map area select: drag a box or Ctrl+click holes to list them in
  a table of the exploration fields, which filters, sorts, hides columns and
  exports to Excel or CSV.
- Exploration Map details now open in the same tooltip as the Techno Map: on
  hover, or pinned with a click.
- Techno Map: upload a wellfield Excel to draw production-cell hexagons. The
  Upload button opens a small window to choose, drop, replace or remove the
  file, and cell corners snap to the drilled wells. The Hexagons layer only
  appears in Layers and the legend once a file is uploaded.
- The "Legends" panel is now called "Layers" on both maps, with two groups:
  Drillhole Types and Overlays (deviation lines, drilling in progress,
  hexagons).
- Both maps zoom more smoothly with the wheel and stop at a 5 m scale bar.
- The sidebar header is one large button that collapses and expands it. The
  New Year greeting button is gone from the sidebar.

## 1.1.2.0 - 2026-11-12

- The Techno Map no longer offers a "Technological cells" layer. Only the old
  demo dataset had cell outlines, so the checkbox never showed anything on
  real data.
- The demo datasets for the Techno Map and the dashboards are gone. Both
  always read the backend.
- Code and documentation cleanup with no other visible change.

## 1.1.1.1 - 2026-11-12

First numbered version. What the website does today:

- Exploration Map: drillholes by GT band on the Redox, Geological or White
  Grid map, with measurement, map export (PNG/SVG) and a help dialog.
- Techno Map: drillholes by type on the Geological or White Grid map, layer
  filters, measurement, map export and a help dialog.
- Techno Map selection: Ctrl+click or the area tool selects holes. The
  selection table filters, sorts, hides columns and exports to Excel or CSV,
  and stays fast with 5,000 holes selected.
- Drilling Details and Drilling by Rig dashboards.
- The sidebar shows the backend status and this version number.
