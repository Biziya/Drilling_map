// PNG and SVG export of the visible viewport.
//
// Both formats come from one SVG document built from the same data and rules
// as the screen: the selected base map (the geological image, embedded since
// an export must stand alone, or the white coordinate grid), technological cells, deviation lines, markers, the measurement, then the
// title, north arrow and scale bar. Floating UI (toolbar, filter panel,
// tooltips) is simply never drawn. PNG rasterises that SVG at 2x.

import { BASE_MAP_SRC, DRILLHOLE_TYPE_CONFIG, MAP_CONFIG, MAP_UTM_BOUNDS, getGtRange } from '../config/technoMapConfig';
import type { BaseMapId } from '../config/technoMapConfig';
import type { TechnoCell } from '../mock/mockData';
import { computeCoordinateGrid } from './coordinateGrid';
import { outlineCentre, utmToMapRatio } from './coordinates';
import { mapRatioToViewport } from './geometry';
import { selectShownFeatures } from './mapFilters';
import type { MapFilters } from './mapFilters';
import { svgPointsFor } from './markerShapes';
import { resolveMarkerKind } from './markerKind';
import { endpointCrossPath, formatDistance, measureDistance } from './measurement';
import { computeScaleBar } from './scaleBar';
import { readDrillholeValue } from '../../../utils/drillholeFields';
import type { MapTransform, Point, ProjectedDrillhole, Size, UtmCoordinates } from '../../../types/map';

export type ExportFormat = 'png' | 'svg';

/** Everything on screen that the export reproduces. */
export interface MapSnapshot {
  viewport: Size;
  view: MapTransform;
  mapOrigin: Point;
  mapSize: Size;
  drillholes: readonly ProjectedDrillhole[];
  cells: readonly TechnoCell[];
  filters: MapFilters;
  measurement: readonly UtmCoordinates[];
  title: string;
  /** Background shown on screen; the geological image when omitted. */
  baseMap?: BaseMapId;
}

/** Images embedded in the export, as data URLs. */
export interface ExportAssets {
  /** The geological image; null when the white grid is drawn instead. */
  baseMap: string | null;
  rigIcon: string;
}

const PNG_PIXEL_RATIO = 2;
const FONT = "'Segoe UI', Arial, sans-serif";
const VIEWPORT_BACKGROUND = '#dbe2dc';
/** Markers within this distance of the edge are kept, so half-visible ones are not cut off. */
const EDGE_MARGIN = 40;

const pad = (value: number) => String(value).padStart(2, '0');

/** TechnoMap_YYYY-MM-DD_HH-mm.<ext>, in local time. */
export function exportFileName(format: ExportFormat, date = new Date()): string {
  const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

  return `TechnoMap_${day}_${pad(date.getHours())}-${pad(date.getMinutes())}.${format}`;
}

const escapeXml = (text: string) => text.replace(/[<>&'"]/g, (char) => `&#${char.charCodeAt(0)};`);
const n = (value: number) => Number(value.toFixed(2));

function markerSvg(drillhole: ProjectedDrillhole, at: Point, rigIcon: string): string {
  const kind = resolveMarkerKind(drillhole);
  if (!kind) return '';
  if (kind === 'rig') {
    return `<image href="${rigIcon}" x="${n(at.x - 16)}" y="${n(at.y - 16)}" width="32" height="32"/>`;
  }

  const { shape, color: typeColor } = DRILLHOLE_TYPE_CONFIG[kind];
  const fill = getGtRange(readDrillholeValue(drillhole, 'gt'))?.color ?? typeColor;
  if (shape === 'circle') {
    return `<circle cx="${n(at.x)}" cy="${n(at.y)}" r="5.5" fill="${fill}" stroke="#fff" stroke-width="2"/>`;
  }

  // A white shape with the fill inset inside it: the on-screen 2px white border.
  const size = shape === 'square' ? 13 : 15;

  return `<polygon points="${svgPointsFor(shape, at.x, at.y, size)}" fill="#fff"/>`
    + `<polygon points="${svgPointsFor(shape, at.x, at.y, size - 4)}" fill="${fill}"/>`;
}

function northArrowSvg(width: number): string {
  const x = width - 23;

  return `<text x="${x}" y="25" text-anchor="middle" font-family="${FONT}" font-size="11" font-weight="800" fill="#1b2d23">N</text>`
    + `<polygon points="${x},29 ${x + 7},53 ${x - 7},53" fill="#1b2d23" stroke="#fff" stroke-width="1"/>`;
}

function scaleBarSvg({ viewport, mapSize, view }: MapSnapshot): string {
  const bar = computeScaleBar({ mapWidth: mapSize.width, zoom: view.scale, bounds: MAP_UTM_BOUNDS });
  if (!bar) return '';

  const boxWidth = Math.max(52, bar.width + 20);
  // Bottom-left, as on screen.
  const left = 14;
  const top = viewport.height - 14 - 34;
  const x1 = left + (boxWidth - bar.width) / 2;
  const x2 = x1 + bar.width;

  return `<rect x="${n(left)}" y="${n(top)}" width="${n(boxWidth)}" height="34" rx="7" fill="#fff" fill-opacity="0.88"/>`
    + `<path d="M${n(x1)} ${top + 7}V${top + 15}H${n(x2)}V${top + 7}" fill="none" stroke="#1f3127" stroke-width="2"/>`
    + `<text x="${n(left + boxWidth / 2)}" y="${top + 28}" text-anchor="middle" font-family="${FONT}" font-size="10.5" font-weight="700" fill="#1f3127">${escapeXml(bar.label)}</text>`;
}

function titleSvg(title: string): string {
  const width = 24 + title.length * 9.5;

  return `<rect x="14" y="14" width="${n(width)}" height="34" rx="8" fill="#fff" fill-opacity="0.92" stroke="#21352a" stroke-opacity="0.16"/>`
    + `<text x="26" y="37" font-family="${FONT}" font-size="17" font-weight="700" fill="#1b2d23">${escapeXml(title)}</text>`;
}

/** The white grid base map, from the same lines and labels as the screen. */
function coordinateGridSvg({ viewport, view, mapOrigin, mapSize }: MapSnapshot): string {
  const style = MAP_CONFIG.baseMap.whiteGrid;
  const grid = computeCoordinateGrid({
    viewport,
    view,
    mapOrigin,
    mapSize,
    minLineSpacing: style.minLineSpacing,
    labelFontSize: style.labelFontSize,
  });
  if (!grid) return '';

  const { sheet, lines, labels } = grid;

  return `<rect x="${n(sheet.left)}" y="${n(sheet.top)}" width="${n(sheet.right - sheet.left)}" height="${n(sheet.bottom - sheet.top)}" fill="${style.background}"/>`
    + `<g stroke="${style.lineColor}" stroke-width="${style.lineWidth}" shape-rendering="crispEdges">`
    + lines.map(({ x1, y1, x2, y2 }) => `<line x1="${n(x1)}" y1="${n(y1)}" x2="${n(x2)}" y2="${n(y2)}"/>`).join('')
    + '</g>'
    + `<g font-family="${FONT}" font-size="${style.labelFontSize}" font-weight="600" fill="${style.labelColor}" `
    + `stroke="${style.background}" stroke-width="3" paint-order="stroke">`
    + labels.map(({ text, x, y }) => `<text x="${n(x)}" y="${n(y)}">${escapeXml(text)}</text>`).join('')
    + '</g>';
}

function measurementSvg(points: readonly UtmCoordinates[], toScreen: (point: UtmCoordinates) => Point): string {
  const color = MAP_CONFIG.measurement.color;
  const [start, end] = points;
  if (!start) return '';
  const a = toScreen(start);
  const b = end && toScreen(end);

  let svg = `<g fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round">`;
  if (b) svg += `<line x1="${n(a.x)}" y1="${n(a.y)}" x2="${n(b.x)}" y2="${n(b.y)}" stroke-dasharray="7 5"/>`;
  svg += (b ? [a, b] : [a]).map((point) => `<path d="${endpointCrossPath(point)}"/>`).join('');
  svg += '</g>';
  if (!end || !b) return svg;

  const label = formatDistance(measureDistance(start, end));
  const width = 16 + label.length * 7;
  const x = (a.x + b.x) / 2;
  const y = (a.y + b.y) / 2 - 16;

  return `${svg}<rect x="${n(x - width / 2)}" y="${n(y - 11)}" width="${n(width)}" height="22" rx="5" fill="#fff" stroke="${color}" stroke-width="1.5"/>`
    + `<text x="${n(x)}" y="${n(y + 4)}" text-anchor="middle" font-family="${FONT}" font-size="12" font-weight="700" fill="#7f1d1d">${escapeXml(label)}</text>`;
}

/** The export as one standalone SVG document, `pixelRatio` times the viewport size. */
export function buildMapSvg(snapshot: MapSnapshot, assets: ExportAssets, pixelRatio = 1): string {
  const { viewport, view, mapOrigin, mapSize, drillholes, cells, filters, measurement, title } = snapshot;
  const toScreen = (ratio: Point) => mapRatioToViewport(ratio, view, mapOrigin, mapSize);
  const utmToScreen = (point: UtmCoordinates) => toScreen(utmToMapRatio(point));
  const isNearView = ({ x, y }: Point) => x > -EDGE_MARGIN && y > -EDGE_MARGIN
    && x < viewport.width + EDGE_MARGIN && y < viewport.height + EDGE_MARGIN;

  const parts: string[] = [
    `<rect width="${viewport.width}" height="${viewport.height}" fill="${VIEWPORT_BACKGROUND}"/>`,
    snapshot.baseMap === 'white-grid' || !assets.baseMap
      ? coordinateGridSvg(snapshot)
      : `<image href="${assets.baseMap}" x="${n(mapOrigin.x + view.translateX)}" y="${n(mapOrigin.y + view.translateY)}" `
        + `width="${n(mapSize.width * view.scale)}" height="${n(mapSize.height * view.scale)}" preserveAspectRatio="none"/>`,
  ];

  if (filters['technological-cells']) {
    const { stroke, fill } = MAP_CONFIG.technologicalCells;
    cells.forEach((cell) => {
      const points = cell.vertices.map((vertex) => {
        const { x, y } = utmToScreen(vertex);

        return `${n(x)},${n(y)}`;
      });
      const centre = utmToScreen(outlineCentre(cell.vertices));
      parts.push(
        `<polygon points="${points.join(' ')}" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>`,
        `<text x="${n(centre.x)}" y="${n(centre.y + 4)}" text-anchor="middle" font-family="${FONT}" font-size="11" `
          + `font-weight="700" fill="${stroke}" stroke="#fff" stroke-width="3" paint-order="stroke">${escapeXml(cell.label)}</text>`,
      );
    });
  }

  const features = selectShownFeatures(drillholes, filters)
    .map((feature) => ({ ...feature, at: toScreen({ x: feature.drillhole.xPercent / 100, y: feature.drillhole.yPercent / 100 }) }))
    .filter(({ at }) => isNearView(at));

  if (filters['deviation-line'] && view.scale >= MAP_CONFIG.zoom.deviationMinZoom) {
    features.forEach(({ at, endpoint }) => {
      if (!endpoint) return;
      const end = toScreen({ x: endpoint.xPercent / 100, y: endpoint.yPercent / 100 });
      parts.push(`<line x1="${n(at.x)}" y1="${n(at.y)}" x2="${n(end.x)}" y2="${n(end.y)}" stroke="${MAP_CONFIG.deviationLine.color}" stroke-width="1" stroke-linecap="round"/>`);
    });
  }

  features.forEach(({ drillhole, at }) => parts.push(markerSvg(drillhole, at, assets.rigIcon)));
  parts.push(measurementSvg(measurement, utmToScreen), titleSvg(title), northArrowSvg(viewport.width), scaleBarSvg(snapshot));

  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" `
    + `width="${viewport.width * pixelRatio}" height="${viewport.height * pixelRatio}" `
    + `viewBox="0 0 ${viewport.width} ${viewport.height}">${parts.join('')}</svg>`;
}

// Fetched once per session: the base map is large and does not change.
const assetCache = new Map<string, Promise<string>>();

function loadDataUrl(src: string): Promise<string> {
  let pending = assetCache.get(src);
  if (!pending) {
    pending = fetch(src)
      .then((response) => {
        if (!response.ok) throw new Error(`${src} could not be loaded (HTTP ${response.status}).`);

        return response.blob();
      })
      .then((blob) => new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error(`${src} could not be read.`));
        reader.readAsDataURL(blob);
      }));
    pending.catch(() => assetCache.delete(src));
    assetCache.set(src, pending);
  }

  return pending;
}

async function rasterise(svg: string, width: number, height: number): Promise<Blob> {
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    const image = new Image();
    image.src = url;
    await image.decode();

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas is not available.');
    context.drawImage(image, 0, 0, width, height);

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('PNG encoding failed.'))), 'image/png');
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

function download(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Builds the export and starts the download. Rejects if any asset or step fails. */
export async function exportMap(format: ExportFormat, snapshot: MapSnapshot): Promise<void> {
  // The white grid is drawn, not embedded, so the image is only fetched when shown.
  const [baseMap, rigIcon] = await Promise.all([
    snapshot.baseMap === 'white-grid' ? null : loadDataUrl(BASE_MAP_SRC),
    loadDataUrl(MAP_CONFIG.rigIconSrc),
  ]);
  const assets = { baseMap, rigIcon };
  const { width, height } = snapshot.viewport;

  const blob = format === 'svg'
    ? new Blob([buildMapSvg(snapshot, assets)], { type: 'image/svg+xml' })
    : await rasterise(
      buildMapSvg(snapshot, assets, PNG_PIXEL_RATIO),
      Math.round(width * PNG_PIXEL_RATIO),
      Math.round(height * PNG_PIXEL_RATIO),
    );

  download(blob, exportFileName(format));
}
