// Port of the raster letter/word detection from ai_measure_boxup.py (the --fast
// path). Operates on an RGB pixel buffer produced by pdfium (lib/pdf/pdfium.ts).
import { PNG } from "pngjs";
import { POINTS_PER_INCH, snapDisplayMeasurement, type Bbox } from "@/lib/pdf/vector";
import { pyRound } from "@/lib/pdf/pyfmt";
import type { RenderedPage } from "@/lib/pdf/pdfium";

type PxBbox = [number, number, number, number];

function isArtworkPixel(r: number, g: number, b: number): boolean {
  return r < 245 || g < 245 || b < 245;
}

function intervalsFromXs(xs: number[]): [number, number][] {
  if (xs.length === 0) return [];
  const intervals: [number, number][] = [];
  let start = xs[0];
  let last = xs[0];
  for (let i = 1; i < xs.length; i++) {
    const x = xs[i];
    if (x <= last + 1) { last = x; continue; }
    intervals.push([start, last]);
    start = x;
    last = x;
  }
  intervals.push([start, last]);
  return intervals;
}

function connectedComponentBoxes(artByRow: number[][], rowTop: number, rowBottom: number): PxBbox[] {
  const parent: number[] = [];
  const boxes: number[][] = [];
  const makeBox = (x1: number, y: number, x2: number) => {
    const index = parent.length;
    parent.push(index);
    boxes.push([x1, y, x2, y]);
    return index;
  };
  const find = (index: number): number => {
    while (parent[index] !== index) { parent[index] = parent[parent[index]]; index = parent[index]; }
    return index;
  };
  const union = (a: number, b: number): number => {
    const ra = find(a);
    const rb = find(b);
    if (ra === rb) return ra;
    parent[rb] = ra;
    boxes[ra][0] = Math.min(boxes[ra][0], boxes[rb][0]);
    boxes[ra][1] = Math.min(boxes[ra][1], boxes[rb][1]);
    boxes[ra][2] = Math.max(boxes[ra][2], boxes[rb][2]);
    boxes[ra][3] = Math.max(boxes[ra][3], boxes[rb][3]);
    return ra;
  };
  let previous: [number, number, number][] = [];
  for (let y = rowTop; y <= rowBottom; y++) {
    const current: [number, number, number][] = [];
    for (const [x1, x2] of intervalsFromXs(artByRow[y])) {
      let component = makeBox(x1, y, x2);
      for (const [px1, px2, previousComponent] of previous) {
        if (px2 + 1 < x1) continue;
        if (x2 + 1 < px1) break;
        component = union(component, previousComponent);
      }
      const root = find(component);
      boxes[root][0] = Math.min(boxes[root][0], x1);
      boxes[root][1] = Math.min(boxes[root][1], y);
      boxes[root][2] = Math.max(boxes[root][2], x2);
      boxes[root][3] = Math.max(boxes[root][3], y);
      current.push([x1, x2, root]);
    }
    previous = current;
  }
  const components = new Map<number, number[]>();
  for (let index = 0; index < boxes.length; index++) {
    const root = find(index);
    const box = boxes[index];
    const existing = components.get(root);
    if (!existing) components.set(root, boxes[root].slice());
    else {
      existing[0] = Math.min(existing[0], box[0]);
      existing[1] = Math.min(existing[1], box[1]);
      existing[2] = Math.max(existing[2], box[2]);
      existing[3] = Math.max(existing[3], box[3]);
    }
  }
  return [...components.values()].map((b) => [b[0], b[1], b[2], b[3]] as PxBbox);
}

function tightBboxForSpan(artByRow: number[][], x1: number, x2: number, rowTop: number, rowBottom: number): PxBbox | null {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  let found = false;
  for (let y = rowTop; y <= rowBottom; y++) {
    let rowHit = false;
    for (const x of artByRow[y]) {
      if (x < x1 || x > x2) continue;
      rowHit = true;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
    }
    if (rowHit) {
      found = true;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (!found) return null;
  return [minX, minY, maxX, maxY];
}

function splitWideFlatBox(artByRow: number[][], box: PxBbox): PxBbox[] {
  const [x1, y1, x2, y2] = box;
  const components = connectedComponentBoxes(artByRow, y1, y2);
  const pieces: PxBbox[] = [];
  for (const component of components) {
    if (component[0] < x1 || component[2] > x2) continue;
    const width = component[2] - component[0] + 1;
    const height = component[3] - component[1] + 1;
    if (width >= 4 && height >= 4) pieces.push(component);
  }
  return pieces.length > 1 ? pieces.sort((a, b) => a[1] - b[1] || a[0] - b[0]) : [box];
}

export type RasterEntry = {
  label: string;
  image_data_url: string;
  width_in: number;
  height_in: number;
  bbox_in: { x_in: number; y_in: number; width_in: number; height_in: number };
  highlight_pct: { left: number; top: number; width: number; height: number } | null;
  led_clearance: { too_small: boolean; min_clearance_cm: number } | null;
  source: "raster-outline";
};

export function rasterWordDimensions(page: RenderedPage, measurementScale = 1.0, maxItems = 120, renderScale = 1.0): RasterEntry[] {
  const { width: widthPx, height: heightPx, rgb } = page;
  const scale = renderScale || 2.0;
  const px = (x: number, y: number): [number, number, number] => {
    const i = (y * widthPx + x) * 3;
    return [rgb[i], rgb[i + 1], rgb[i + 2]];
  };
  // LED channel clearance: largest inscribed circle inside the letter (distance
  // transform) = widest channel that can hold an LED. If < 1.2cm it can't fit.
  const ledClearanceFor = (bbox: PxBbox): RasterEntry["led_clearance"] => {
    const [x1, y1, x2, y2] = bbox;
    const w = x2 - x1 + 1;
    const h = y2 - y1 + 1;
    if (w < 2 || h < 2 || w * h > 3_000_000) return null;
    const INF = 1e9;
    const dist = new Float64Array(w * h);
    for (let yy = 0; yy < h; yy++) {
      for (let xx = 0; xx < w; xx++) {
        const [r, g, b] = px(x1 + xx, y1 + yy);
        dist[yy * w + xx] = isArtworkPixel(r, g, b) ? INF : 0;
      }
    }
    const R2 = Math.SQRT2;
    for (let yy = 0; yy < h; yy++) {
      for (let xx = 0; xx < w; xx++) {
        const idx = yy * w + xx;
        if (dist[idx] === 0) continue;
        let d = Math.min(dist[idx], xx + 1, yy + 1); // bbox left/top edge = background
        if (xx > 0) d = Math.min(d, dist[idx - 1] + 1);
        if (yy > 0) d = Math.min(d, dist[idx - w] + 1);
        if (xx > 0 && yy > 0) d = Math.min(d, dist[idx - w - 1] + R2);
        if (xx < w - 1 && yy > 0) d = Math.min(d, dist[idx - w + 1] + R2);
        dist[idx] = d;
      }
    }
    let maxDist = 0;
    for (let yy = h - 1; yy >= 0; yy--) {
      for (let xx = w - 1; xx >= 0; xx--) {
        const idx = yy * w + xx;
        if (dist[idx] === 0) continue;
        let d = Math.min(dist[idx], w - xx, h - yy); // bbox right/bottom edge = background
        if (xx < w - 1) d = Math.min(d, dist[idx + 1] + 1);
        if (yy < h - 1) d = Math.min(d, dist[idx + w] + 1);
        if (xx < w - 1 && yy < h - 1) d = Math.min(d, dist[idx + w + 1] + R2);
        if (xx > 0 && yy < h - 1) d = Math.min(d, dist[idx + w - 1] + R2);
        dist[idx] = d;
        if (d > maxDist) maxDist = d;
      }
    }
    const channelPx = 2 * maxDist;
    const cm = (channelPx / scale / POINTS_PER_INCH) * measurementScale * 2.54;
    return { too_small: cm < 1.2, min_clearance_cm: cm };
  };
  const artByRow: number[][] = new Array(heightPx);
  const rowHasArt: boolean[] = new Array(heightPx);
  for (let y = 0; y < heightPx; y++) {
    const xs: number[] = [];
    const base = y * widthPx * 3;
    for (let x = 0; x < widthPx; x++) {
      const i = base + x * 3;
      if (rgb[i] < 245 || rgb[i + 1] < 245 || rgb[i + 2] < 245) xs.push(x);
    }
    artByRow[y] = xs;
    rowHasArt[y] = xs.length > 0;
  }

  const rows: [number, number][] = [];
  let y = 0;
  const maxRowGap = Math.max(2, pyRound(4 * scale));
  while (y < heightPx) {
    while (y < heightPx && !rowHasArt[y]) y++;
    if (y >= heightPx) break;
    const start = y;
    let lastDark = y;
    let gap = 0;
    y++;
    while (y < heightPx) {
      if (rowHasArt[y]) { lastDark = y; gap = 0; }
      else { gap++; if (gap > maxRowGap) break; }
      y++;
    }
    rows.push([start, lastDark]);
  }

  const entries: RasterEntry[] = [];
  let contentArtBbox: PxBbox | null = null;
  {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity, any = false;
    for (let yy = 0; yy < heightPx; yy++) {
      const xs = artByRow[yy];
      if (!xs.length) continue;
      any = true;
      if (yy < minY) minY = yy;
      if (yy > maxY) maxY = yy;
      const a = xs[0], b = xs[xs.length - 1];
      if (a < minX) minX = a;
      if (b > maxX) maxX = b;
    }
    if (any) contentArtBbox = [minX, minY, maxX, maxY];
  }

  for (const [rowTop, rowBottom] of rows) {
    if (rowBottom <= rowTop) continue;
    const rowHeight = rowBottom - rowTop + 1;
    let rowLowerArtwork = false;
    if (contentArtBbox) {
      const cy1 = contentArtBbox[1], cy2 = contentArtBbox[3];
      rowLowerArtwork = rowTop >= cy1 + (cy2 - cy1 + 1) * 0.55;
    }
    let rowBoxes: PxBbox[] = [];
    if (rowLowerArtwork) {
      rowBoxes = connectedComponentBoxes(artByRow, rowTop, rowBottom);
    } else {
      const colHasArt: boolean[] = new Array(widthPx).fill(false);
      for (let x = 0; x < widthPx; x++) {
        for (let yy = rowTop; yy <= rowBottom; yy++) {
          const [r, g, b] = px(x, yy);
          if (isArtworkPixel(r, g, b)) { colHasArt[x] = true; break; }
        }
      }
      const characterGap = Math.max(2, pyRound(rowHeight * 0.035));
      let x = 0;
      while (x < widthPx) {
        while (x < widthPx && !colHasArt[x]) x++;
        if (x >= widthPx) break;
        const start = x;
        let lastArt = x;
        let gap = 0;
        x++;
        while (x < widthPx) {
          if (colHasArt[x]) { lastArt = x; gap = 0; }
          else { gap++; if (gap > characterGap) break; }
          x++;
        }
        if (lastArt > start) {
          const tightBox = tightBboxForSpan(artByRow, start, lastArt, rowTop, rowBottom);
          if (tightBox) {
            const boxWidth = tightBox[2] - tightBox[0] + 1;
            const boxHeight = tightBox[3] - tightBox[1] + 1;
            if (boxWidth > boxHeight * 3 && boxHeight < rowHeight * 0.75) rowBoxes.push(...splitWideFlatBox(artByRow, tightBox));
            else rowBoxes.push(tightBox);
          }
        }
      }
    }
    rowBoxes = rowBoxes.filter((box) => box[2] - box[0] + 1 >= 4 && box[3] - box[1] + 1 >= 4);
    for (const bboxPx of rowBoxes) {
      const widthIn = ((bboxPx[2] - bboxPx[0] + 1) / scale / POINTS_PER_INCH) * measurementScale;
      const heightIn = ((bboxPx[3] - bboxPx[1] + 1) / scale / POINTS_PER_INCH) * measurementScale;
      if (widthIn >= 0.25 && heightIn >= 0.25) {
        let highlightPct: RasterEntry["highlight_pct"] = null;
        if (contentArtBbox) {
          const [cx1, cy1, cx2, cy2] = contentArtBbox;
          const cw = Math.max(1, cx2 - cx1 + 1);
          const ch = Math.max(1, cy2 - cy1 + 1);
          highlightPct = {
            left: (bboxPx[0] - cx1) / cw,
            top: (bboxPx[1] - cy1) / ch,
            width: (bboxPx[2] - bboxPx[0] + 1) / cw,
            height: (bboxPx[3] - bboxPx[1] + 1) / ch,
          };
        }
        let lowerArtwork = false;
        if (contentArtBbox) {
          const cy1 = contentArtBbox[1], cy2 = contentArtBbox[3];
          lowerArtwork = bboxPx[1] >= cy1 + (cy2 - cy1 + 1) * 0.55;
        }
        const looksLikeLogo = lowerArtwork; // quick mode: recognized is always None
        const labelPrefix = looksLikeLogo ? "Logo" : "Letter";
        const labelCount = 1 + entries.filter((item) => item.label.startsWith(labelPrefix)).length;
        const label = `${labelPrefix} ${labelCount}`;
        const cropUrl = rasterCropDataUrl(page, bboxPx, 150, lowerArtwork);
        entries.push({
          label,
          image_data_url: cropUrl,
          width_in: snapDisplayMeasurement(widthIn),
          height_in: snapDisplayMeasurement(heightIn),
          bbox_in: {
            x_in: (bboxPx[0] / scale / POINTS_PER_INCH) * measurementScale,
            y_in: (bboxPx[1] / scale / POINTS_PER_INCH) * measurementScale,
            width_in: snapDisplayMeasurement(widthIn),
            height_in: snapDisplayMeasurement(heightIn),
          },
          highlight_pct: highlightPct,
          led_clearance: ledClearanceFor(bboxPx),
          source: "raster-outline",
        });
      }
    }
  }
  return entries.slice(0, maxItems);
}

export function rasterContentBbox(page: RenderedPage, renderScale = 1.0): Bbox | null {
  const { width, height, rgb } = page;
  const scale = renderScale || 2.0;
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity, any = false;
  for (let y = 0; y < height; y++) {
    const base = y * width * 3;
    for (let x = 0; x < width; x++) {
      const i = base + x * 3;
      if (rgb[i] < 105 && rgb[i + 1] < 105 && rgb[i + 2] < 105) {
        any = true;
        if (x < x1) x1 = x;
        if (x > x2) x2 = x;
        if (y < y1) y1 = y;
        if (y > y2) y2 = y;
      }
    }
  }
  if (!any) return null;
  const pageHeightPt = height / scale;
  return [x1 / scale, pageHeightPt - (y2 + 1) / scale, (x2 + 1) / scale, pageHeightPt - y1 / scale];
}

// ---- letter crop thumbnails (PNG data URLs) ----
function connectedMaskForBbox(page: RenderedPage, bboxPx: PxBbox): { mask: Uint8Array; width: number; height: number; x1: number; y1: number } | null {
  const { width: imgW, rgb } = page;
  const [x1, y1, x2, y2] = bboxPx;
  const width = x2 - x1 + 1;
  const height = y2 - y1 + 1;
  const artwork = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    const gy = y1 + y;
    for (let x = 0; x < width; x++) {
      const gx = x1 + x;
      const i = (gy * imgW + gx) * 3;
      if (rgb[i] < 245 || rgb[i + 1] < 245 || rgb[i + 2] < 245) artwork[y * width + x] = 1;
    }
  }
  const visited = new Uint8Array(width * height);
  type Comp = { indices: number[]; bx1: number; by1: number; bx2: number; by2: number };
  const components: Comp[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const start = y * width + x;
      if (visited[start]) continue;
      visited[start] = 1;
      if (!artwork[start]) continue;
      const stack = [start];
      const indices: number[] = [];
      let minX = x, maxX = x, minY = y, maxY = y;
      while (stack.length) {
        const current = stack.pop()!;
        indices.push(current);
        const px = current % width;
        const py = (current / width) | 0;
        if (px < minX) minX = px;
        if (px > maxX) maxX = px;
        if (py < minY) minY = py;
        if (py > maxY) maxY = py;
        const neigh = [[px + 1, py], [px - 1, py], [px, py + 1], [px, py - 1]];
        for (const [nx, ny] of neigh) {
          if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
          const ni = ny * width + nx;
          if (visited[ni]) continue;
          visited[ni] = 1;
          if (artwork[ni]) stack.push(ni);
        }
      }
      if (indices.length) components.push({ indices, bx1: minX, by1: minY, bx2: maxX, by2: maxY });
    }
  }
  if (!components.length) return null;
  const score = (c: Comp): [number, number] => {
    const edgeHits = (c.bx1 <= 1 ? 1 : 0) + (c.by1 <= 1 ? 1 : 0) + (c.bx2 >= width - 2 ? 1 : 0) + (c.by2 >= height - 2 ? 1 : 0);
    return [edgeHits, c.indices.length];
  };
  let chosen = components[0];
  for (const c of components) {
    const sc = score(c);
    const sb = score(chosen);
    if (sc[0] > sb[0] || (sc[0] === sb[0] && sc[1] > sb[1])) chosen = c;
  }
  const mask = new Uint8Array(width * height);
  for (const index of chosen.indices) mask[index] = 1;
  return { mask, width, height, x1, y1 };
}

// Simple area-average downscale (thumbnail-only; visual parity with PIL LANCZOS).
function downscaleRgb(src: Uint8Array, sw: number, sh: number, dw: number, dh: number): Uint8Array {
  const out = new Uint8Array(dw * dh * 3);
  for (let dy = 0; dy < dh; dy++) {
    const sy0 = Math.floor((dy * sh) / dh);
    const sy1 = Math.max(sy0 + 1, Math.floor(((dy + 1) * sh) / dh));
    for (let dx = 0; dx < dw; dx++) {
      const sx0 = Math.floor((dx * sw) / dw);
      const sx1 = Math.max(sx0 + 1, Math.floor(((dx + 1) * sw) / dw));
      let r = 0, g = 0, b = 0, n = 0;
      for (let sy = sy0; sy < sy1 && sy < sh; sy++) {
        for (let sx = sx0; sx < sx1 && sx < sw; sx++) {
          const i = (sy * sw + sx) * 3;
          r += src[i]; g += src[i + 1]; b += src[i + 2]; n++;
        }
      }
      const o = (dy * dw + dx) * 3;
      out[o] = n ? Math.round(r / n) : 255;
      out[o + 1] = n ? Math.round(g / n) : 255;
      out[o + 2] = n ? Math.round(b / n) : 255;
    }
  }
  return out;
}

function rasterCropDataUrl(page: RenderedPage, bboxPx: PxBbox, maxSide = 150, maskShape = false): string {
  const { width: imgW, height: imgH, rgb } = page;
  const [x1, y1, x2, y2] = bboxPx;
  const pad = 16;
  const selectedMask = maskShape ? connectedMaskForBbox(page, bboxPx) : null;
  const cx1 = Math.max(0, x1 - pad);
  const cy1 = Math.max(0, y1 - pad);
  const cx2 = Math.min(imgW, x2 + pad + 1);
  const cy2 = Math.min(imgH, y2 + pad + 1);
  const cw = cx2 - cx1;
  const ch = cy2 - cy1;
  const crop = new Uint8Array(cw * ch * 3);
  for (let yy = 0; yy < ch; yy++) {
    for (let xx = 0; xx < cw; xx++) {
      const gx = cx1 + xx;
      const gy = cy1 + yy;
      let r: number, g: number, b: number;
      let inMask = true;
      if (selectedMask) {
        const { mask, width: mw, x1: mx, y1: my } = selectedMask;
        inMask = mx <= gx && gx <= x2 && my <= gy && gy <= y2 && !!mask[(gy - my) * mw + (gx - mx)];
      }
      if (selectedMask && !inMask) { r = 255; g = 255; b = 255; }
      else { const i = (gy * imgW + gx) * 3; r = rgb[i]; g = rgb[i + 1]; b = rgb[i + 2]; }
      const o = (yy * cw + xx) * 3;
      crop[o] = r; crop[o + 1] = g; crop[o + 2] = b;
    }
  }
  // thumbnail: only downscale, preserve aspect
  let tw = cw, th = ch;
  let thumb: Uint8Array = crop;
  if (cw > maxSide || ch > maxSide) {
    const ratio = Math.min(maxSide / cw, maxSide / ch);
    tw = Math.max(1, Math.round(cw * ratio));
    th = Math.max(1, Math.round(ch * ratio));
    thumb = downscaleRgb(crop, cw, ch, tw, th);
  }
  // paste centered on white maxSide x maxSide canvas, encode PNG
  const png = new PNG({ width: maxSide, height: maxSide });
  png.data.fill(255);
  const ox = Math.floor((maxSide - tw) / 2);
  const oy = Math.floor((maxSide - th) / 2);
  for (let yy = 0; yy < th; yy++) {
    for (let xx = 0; xx < tw; xx++) {
      const si = (yy * tw + xx) * 3;
      const di = ((oy + yy) * maxSide + (ox + xx)) * 4;
      png.data[di] = thumb[si];
      png.data[di + 1] = thumb[si + 1];
      png.data[di + 2] = thumb[si + 2];
      png.data[di + 3] = 255;
    }
  }
  const buffer = PNG.sync.write(png);
  return "data:image/png;base64," + buffer.toString("base64");
}
