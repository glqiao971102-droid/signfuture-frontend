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
  source: "raster-outline" | "spec";
  // Contour length of this record's outline, in metres (the path a 3D-printed
  // return traces once per layer). Populated by the Box Up analyzer.
  outline_length_m?: number;
  // Estimated LED strip length for this record, in metres — concentric rings
  // filling the letter: 1cm gap from the outline, then 7mm LED strip, 2cm gap,
  // repeat inward until full. Populated by the Box Up analyzer.
  led_length_m?: number;
};

// The bbox of all non-white artwork on the page, in pixels (y-down from top). Used
// to express a record's position as a fraction of the artwork for the preview.
function contentArtBboxPx(page: RenderedPage): PxBbox | null {
  const { width, height, rgb } = page;
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity, any = false;
  for (let y = 0; y < height; y++) {
    const base = y * width * 3;
    for (let x = 0; x < width; x++) {
      const i = base + x * 3;
      if (rgb[i] < 245 || rgb[i + 1] < 245 || rgb[i + 2] < 245) { any = true; if (x < x1) x1 = x; if (x > x2) x2 = x; if (y < y1) y1 = y; if (y > y2) y2 = y; }
    }
  }
  return any ? [x1, y1, x2, y2] : null;
}

// Build records straight from an uploaded "spec" (exported from Illustrator, where
// grouping still exists). Each spec item -> one record with the EXACT file size; the
// rendered page is used only for the masked thumbnail. This bypasses all pixel/vector
// detection so the result matches the AI file's real grouping and dimensions.
export type SpecItem = { box: PxBbox; isLogo: boolean; sizeIn: { x_in: number; y_in: number; width_in: number; height_in: number } };
export function recordsFromSpec(page: RenderedPage, items: SpecItem[]): RasterEntry[] {
  const content = contentArtBboxPx(page);
  const entries: RasterEntry[] = [];
  let letterN = 0, logoN = 0;
  for (const it of items) {
    if (it.sizeIn.width_in < 0.05 || it.sizeIn.height_in < 0.05) continue;
    const box = it.box;
    const rawArea = (box[2] - box[0] + 1) * (box[3] - box[1] + 1);
    const maskInfo = rawArea <= 600_000 ? connectedMaskForBbox(page, box) : null;
    const cropUrl = rasterCropDataUrl(page, box, 150, maskInfo != null, maskInfo);
    let highlightPct: RasterEntry["highlight_pct"] = null;
    if (content) {
      const [cx1, cy1, cx2, cy2] = content;
      const cw = Math.max(1, cx2 - cx1 + 1), ch = Math.max(1, cy2 - cy1 + 1);
      highlightPct = { left: (box[0] - cx1) / cw, top: (box[1] - cy1) / ch, width: (box[2] - box[0] + 1) / cw, height: (box[3] - box[1] + 1) / ch };
    }
    const minCm = Math.min(it.sizeIn.width_in, it.sizeIn.height_in) * 2.54;
    const label = `${it.isLogo ? "Logo" : "Letter"} ${it.isLogo ? ++logoN : ++letterN}`;
    entries.push({
      label,
      image_data_url: cropUrl,
      width_in: it.sizeIn.width_in,
      height_in: it.sizeIn.height_in,
      bbox_in: it.sizeIn,
      highlight_pct: highlightPct,
      led_clearance: { too_small: minCm < 1.2, min_clearance_cm: minCm },
      source: "spec",
    });
  }
  return entries;
}

// Merge candidate letter boxes that belong to the same compound-path fill group
// (Ctrl+8 in Illustrator). `fillGroupsPx` are the compound-path bounding boxes in
// pixel space. Any candidates whose centres fall inside the same group box are
// replaced by a single union box; ungrouped candidates pass through unchanged.
function mergeByFillGroups(boxes: PxBbox[], fillGroupsPx: PxBbox[]): PxBbox[] {
  if (!fillGroupsPx.length) return boxes;
  const centerIn = (b: PxBbox, g: PxBbox) => {
    const cx = (b[0] + b[2]) / 2, cy = (b[1] + b[3]) / 2;
    return cx >= g[0] && cx <= g[2] && cy >= g[1] && cy <= g[3];
  };
  const groupArea = (g: PxBbox) => Math.max(1, g[2] - g[0]) * Math.max(1, g[3] - g[1]);
  const assigned = new Array(boxes.length).fill(-1);
  boxes.forEach((b, bi) => {
    let best = -1, bestArea = Infinity;
    fillGroupsPx.forEach((g, gi) => {
      // Assign to the SMALLEST group that contains the box's centre, so nested
      // compound paths merge at the tightest level.
      if (centerIn(b, g)) { const a = groupArea(g); if (a < bestArea) { bestArea = a; best = gi; } }
    });
    assigned[bi] = best;
  });
  const out: PxBbox[] = [];
  const usedGroup = new Map<number, PxBbox>();
  const groupMembers = new Map<number, number>();
  assigned.forEach((gi) => { if (gi >= 0) groupMembers.set(gi, (groupMembers.get(gi) || 0) + 1); });
  boxes.forEach((b, bi) => {
    const gi = assigned[bi];
    if (gi < 0 || (groupMembers.get(gi) || 0) < 2) { out.push(b); return; }
    const cur = usedGroup.get(gi);
    if (!cur) { usedGroup.set(gi, [b[0], b[1], b[2], b[3]]); }
    else { cur[0] = Math.min(cur[0], b[0]); cur[1] = Math.min(cur[1], b[1]); cur[2] = Math.max(cur[2], b[2]); cur[3] = Math.max(cur[3], b[3]); }
  });
  for (const g of usedGroup.values()) out.push(g);
  return out;
}

const boxArea = (b: PxBbox) => Math.max(0, b[2] - b[0]) * Math.max(0, b[3] - b[1]);
const overlapArea = (a: PxBbox, b: PxBbox) =>
  Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0])) * Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]));

// Cluster boxes that HEAVILY overlap (one contains/covers most of the other) — a
// single letter's own inner+outer contours (e.g. the ring and counter of an "O")
// so they aren't torn apart. Separate letters barely overlap, so they stay apart.
function clusterHeavyOverlap(boxes: PxBbox[]): PxBbox[] {
  const parent = boxes.map((_, i) => i);
  const find = (i: number): number => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const ov = overlapArea(boxes[i], boxes[j]);
      const minA = Math.max(1, Math.min(boxArea(boxes[i]), boxArea(boxes[j])));
      if (ov / minA > 0.6) { const a = find(i), b = find(j); if (a !== b) parent[b] = a; }
    }
  }
  const groups = new Map<number, PxBbox>();
  boxes.forEach((b, i) => {
    const r = find(i), cur = groups.get(r);
    if (!cur) groups.set(r, [b[0], b[1], b[2], b[3]]);
    else { cur[0] = Math.min(cur[0], b[0]); cur[1] = Math.min(cur[1], b[1]); cur[2] = Math.max(cur[2], b[2]); cur[3] = Math.max(cur[3], b[3]); }
  });
  return [...groups.values()];
}

// Merge a letter's inner COUNTERS (the enclosed holes of 8 6 9 0 O A P R 4) back
// into the letter. When a letter is drawn as an OUTLINE (contours only, no fill —
// common for cut/box-up artwork) each counter is a separate closed loop, so the
// raster sees it as its own connected component and it becomes a phantom record.
// A counter is a box fully inside a LARGER box. The parent-size cap keeps a real
// small letter that happens to sit inside a big LOGO's bbox from being swallowed —
// that must survive as its own record (a logo is far bigger than any letter).
function mergeCounters(boxes: PxBbox[], maxParentPx: number): PxBbox[] {
  const parent = boxes.map((_, i) => i);
  const find = (i: number): number => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
  const inside = (s: PxBbox, big: PxBbox) => s[0] >= big[0] - 1 && s[1] >= big[1] - 1 && s[2] <= big[2] + 1 && s[3] <= big[3] + 1;
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const ai = boxArea(boxes[i]), aj = boxArea(boxes[j]);
      const big = ai >= aj ? boxes[i] : boxes[j];
      const small = ai >= aj ? boxes[j] : boxes[i];
      const bigMin = Math.min(big[2] - big[0], big[3] - big[1]);
      // parent must be letter-sized; child strictly smaller and fully enclosed.
      if (bigMin <= maxParentPx && Math.min(ai, aj) < 0.9 * Math.max(1, Math.max(ai, aj)) && inside(small, big)) {
        const a = find(i), b = find(j); if (a !== b) parent[b] = a;
      }
    }
  }
  const groups = new Map<number, PxBbox>();
  boxes.forEach((b, i) => {
    const r = find(i), cur = groups.get(r);
    if (!cur) groups.set(r, [b[0], b[1], b[2], b[3]]);
    else { cur[0] = Math.min(cur[0], b[0]); cur[1] = Math.min(cur[1], b[1]); cur[2] = Math.max(cur[2], b[2]); cur[3] = Math.max(cur[3], b[3]); }
  });
  return [...groups.values()];
}

// Push apart sibling letter boxes that overlap, by cutting the shared strip at its
// midline (along the axis of smaller overlap). Stacked/interleaved letters have
// overlapping bounding boxes even when their shapes are separate; this makes each
// crop show only its own letter instead of a slice of the neighbour.
function separateSiblings(boxes: PxBbox[]): PxBbox[] {
  const out = boxes.map((b) => [b[0], b[1], b[2], b[3]] as PxBbox);
  for (let i = 0; i < out.length; i++) {
    for (let j = i + 1; j < out.length; j++) {
      const a = out[i], b = out[j];
      const ox = Math.min(a[2], b[2]) - Math.max(a[0], b[0]);
      const oy = Math.min(a[3], b[3]) - Math.max(a[1], b[1]);
      if (ox <= 0 || oy <= 0) continue;
      if (oy <= ox) {
        const [top, bot] = a[1] <= b[1] ? [a, b] : [b, a];
        const mid = Math.round((Math.max(top[1], bot[1]) + Math.min(top[3], bot[3])) / 2);
        top[3] = Math.min(top[3], mid); bot[1] = Math.max(bot[1], mid);
      } else {
        const [left, right] = a[0] <= b[0] ? [a, b] : [b, a];
        const mid = Math.round((Math.max(left[0], right[0]) + Math.min(left[2], right[2])) / 2);
        left[2] = Math.min(left[2], mid); right[0] = Math.max(right[0], mid);
      }
    }
  }
  return out;
}

// Split a merged blob into its letters using the vector fills inside it. Stacked
// letters that touch at native resolution (e.g. "A/Y/L") form one raster blob but
// are separate vector fills — break the blob at those fills. A dense illustration
// (a logo = many tiny fills) is left whole. Returns null when it shouldn't split.
function splitBlobByFills(blob: PxBbox, fillBoxesPx: PxBbox[]): PxBbox[] | null {
  const blobW = blob[2] - blob[0];
  const blobH = blob[3] - blob[1];
  const blobArea = Math.max(1, blobW * blobH);
  const inside = fillBoxesPx.filter((f) => {
    const cx = (f[0] + f[2]) / 2, cy = (f[1] + f[3]) / 2;
    return cx >= blob[0] && cx <= blob[2] && cy >= blob[1] && cy <= blob[3];
  });
  // < 2 fills = a single shape; > 8 = a dense illustration (logo) -> leave whole.
  if (inside.length < 2 || inside.length > 8) return null;
  const substantial = inside
    .filter((f) => {
      const w = f[2] - f[0], h = f[3] - f[1];
      return w * h >= 0.18 * blobArea && h >= 0.25 * blobH && w >= 0.25 * blobW;
    })
    .map((f) => [Math.max(blob[0], f[0]), Math.max(blob[1], f[1]), Math.min(blob[2], f[2]), Math.min(blob[3], f[3])] as PxBbox);
  if (substantial.length < 2) return null;
  // Merge a letter's own overlapping parts (inner+outer of "O"); a real letter with
  // parts collapses to one cluster, so a single-letter blob won't be split.
  const letters = clusterHeavyOverlap(substantial);
  if (letters.length < 2) return null;
  // Separate touching sibling boxes, then round to integer pixels (fractional coords
  // corrupt pixel indexing in the mask/crop and blow up the run time).
  return separateSiblings(letters).map((b) => [Math.round(b[0]), Math.round(b[1]), Math.round(b[2]), Math.round(b[3])] as PxBbox);
}

export function rasterWordDimensions(page: RenderedPage, measurementScale = 1.0, maxItems = 120, renderScale = 1.0, fillGroupsPx: PxBbox[] = [], fillBoxesPx: PxBbox[] = [], logoClustersPx: PxBbox[] = [], clipBoxesPx: PxBbox[] = []): RasterEntry[] {
  const { width: widthPx, height: heightPx, rgb } = page;
  const scale = renderScale || 2.0;
  // LED clearance = the letter's own MINIMUM overall dimension (its shortest side).
  // The LED module has to sit inside the letter, so a wide/tall letter (U, O) fits
  // while a thin letter (I, a thin stroke) does not. Measured from the record's
  // bounding box, not the stroke thickness. Flag if the shortest side < 1.2cm.
  const ledClearanceFor = (bbox: PxBbox): RasterEntry["led_clearance"] => {
    const wIn = ((bbox[2] - bbox[0] + 1) / scale / POINTS_PER_INCH) * measurementScale;
    const hIn = ((bbox[3] - bbox[1] + 1) / scale / POINTS_PER_INCH) * measurementScale;
    const cm = Math.min(wIn, hIn) * 2.54;
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

  // One record per connected shape — never proximity- or overlap-group them.
  // The AI file's own grouping is NOT recoverable (Illustrator flattens it away
  // on PDF export), so we always keep shapes separate; the customer joins a
  // logo's pieces with the "Group" button when they want to.
  const candidateBoxes: PxBbox[] = [];
  for (const [rowTop, rowBottom] of rows) {
    if (rowBottom <= rowTop) continue;
    for (const box of connectedComponentBoxes(artByRow, rowTop, rowBottom)) {
      if (box[2] - box[0] + 1 >= 4 && box[3] - box[1] + 1 >= 4) candidateBoxes.push(box);
    }
  }
  // Keep pieces of the same compound path (Ctrl+8) together as one record.
  const fillGrouped = mergeByFillGroups(candidateBoxes, fillGroupsPx);
  // Merge outlined letters' inner counters (holes) back into the letter. Parent cap
  // = 3in so a big logo never absorbs a neighbouring letter that sits in its bbox.
  const groupedBoxes = mergeCounters(fillGrouped, (3.0 / measurementScale) * POINTS_PER_INCH * scale);
  // Split blobs that fused a few touching letters into their separate vector letters
  // (e.g. a stacked "A/Y/L" column). Dense logos (many fills) are left whole. Only
  // attempt it on record-sized blobs — the many tiny components (filtered out later)
  // would make the per-blob fill scan O(blobs x fills) and dominate the run time.
  const minRecordPx = (0.25 / measurementScale) * POINTS_PER_INCH * scale;
  // Splitting only helps letter designs (a handful of fills). A file with thousands
  // of fills is a detailed illustration where letter-splitting doesn't apply, and
  // the per-blob fill scan would be far too slow — skip it there.
  const canSplit = fillBoxesPx.length > 0 && fillBoxesPx.length <= 4000;
  const splitBoxes: PxBbox[] = [];
  for (const box of groupedBoxes) {
    const recordSized = box[2] - box[0] + 1 >= minRecordPx && box[3] - box[1] + 1 >= minRecordPx;
    const parts = canSplit && recordSized ? splitBlobByFills(box, fillBoxesPx) : null;
    if (parts && parts.length >= 2) splitBoxes.push(...parts);
    else splitBoxes.push(box);
  }
  const mergedBoxes = splitBoxes.sort((a, b) => a[1] - b[1] || a[0] - b[0]);
  // Snap each logo record to its vector-fill cluster box, so its reported size
  // matches the AI file (the raster box under-measures light-edged logos). For each
  // logo cluster, the raster candidate that overlaps it most IS the logo -> replace
  // its box with the cluster box. Guards: (1) the winner must cover MOST of the
  // cluster (bestOv > 0.5*clusterArea) so a letter merely sitting in a corner of the
  // cluster bbox can't be promoted, and a fragmented logo (no single dominant blob)
  // is left alone rather than mis-snapped; (2) a candidate already claimed by an
  // earlier cluster can't be claimed again. Letters (separate small clusters) are
  // untouched. NOTE: we deliberately do NOT remove other boxes inside the cluster
  // bbox — a real neighbour letter (e.g. an "A" in the logo's empty corner) sits
  // inside the bbox and must survive as its own record.
  const snappedLogos = new Set<PxBbox>();
  const claimed = new Set<number>();
  for (const cluster of logoClustersPx) {
    let best = -1, bestOv = 0;
    mergedBoxes.forEach((b, i) => { if (claimed.has(i)) return; const ov = overlapArea(b, cluster); if (ov > bestOv) { bestOv = ov; best = i; } });
    if (best >= 0 && bestOv > 0.5 * boxArea(cluster)) {
      const snapped: PxBbox = [Math.round(cluster[0]), Math.round(cluster[1]), Math.round(cluster[2]), Math.round(cluster[3])];
      mergedBoxes[best] = snapped;
      claimed.add(best);
      snappedLogos.add(snapped);
    }
  }
  // GENERAL vector-size snap. The raster box under-measures any record with LIGHT
  // edges (a gold gradient, a soft glow): near-white pixels (>=245) fall below the
  // art threshold, so the pixel box is smaller than the AI file (a gradient "運" read
  // 11.0x9.9in when the file is 11.6x11.0in). The vector FILLS are the true geometry —
  // the same source Illustrator measures. Grow each non-logo record box to the union
  // of the individual fills whose centre lies in it, so the box, size, highlight AND
  // LED are all measured from the true extent. Guard: accept the union only when it is
  // within [0.7x, 1.7x] of the raster box in BOTH dims, so light edges are recovered
  // but a record never balloons by swallowing an overlapping neighbour's fill. Snapped
  // boxes skip the mask tight-trim below (which would shrink them back to the ink core).
  // Fills AND clip paths are both true vector geometry (gradient art is a fill clipped
  // to a letter shape, so the clip bbox is the letter). Use both as the size source.
  const sizeVectorsPx = fillBoxesPx.concat(clipBoxesPx);
  const snappedFills = new Set<PxBbox>();
  if (sizeVectorsPx.length > 0 && sizeVectorsPx.length <= 8000) {
    for (let i = 0; i < mergedBoxes.length; i++) {
      const b = mergedBoxes[i];
      if (snappedLogos.has(b)) continue;
      let ux1 = Infinity, uy1 = Infinity, ux2 = -Infinity, uy2 = -Infinity, cnt = 0;
      for (const f of sizeVectorsPx) {
        const fcx = (f[0] + f[2]) / 2, fcy = (f[1] + f[3]) / 2;
        if (fcx < b[0] || fcx > b[2] || fcy < b[1] || fcy > b[3]) continue;
        if (f[0] < ux1) ux1 = f[0]; if (f[1] < uy1) uy1 = f[1]; if (f[2] > ux2) ux2 = f[2]; if (f[3] > uy2) uy2 = f[3]; cnt++;
      }
      if (cnt === 0) continue;
      const bw = b[2] - b[0], bh = b[3] - b[1], uw = ux2 - ux1, uh = uy2 - uy1;
      if (uw < bw * 0.7 || uw > bw * 1.7 || uh < bh * 0.7 || uh > bh * 1.7) continue;
      const snapped: PxBbox = [Math.round(ux1), Math.round(uy1), Math.round(ux2), Math.round(uy2)];
      mergedBoxes[i] = snapped;
      snappedFills.add(snapped);
    }
  }
  {
    for (const rawBox of mergedBoxes) {
      const isLogo = snappedLogos.has(rawBox) || snappedFills.has(rawBox);
      // Compute this record's own-shape mask ONCE and reuse it for the thumbnail,
      // the LED clearance and a TIGHT bbox. The tight bbox = the mask's real extent,
      // so a neighbour letter that merely clipped the corner is excluded from the
      // reported size, the highlight rectangle and the LED measurement.
      // Only small/medium boxes (where tightly-packed neighbours actually intrude)
      // are masked; a big letter or logo skips it — the connected-component flood
      // over millions of pixels would be far too slow and it doesn't need it.
      const rawArea = (rawBox[2] - rawBox[0] + 1) * (rawBox[3] - rawBox[1] + 1);
      const maskInfo = rawArea <= 600_000 ? connectedMaskForBbox(page, rawBox) : null;
      let bboxPx = rawBox;
      // For a snapped LOGO, keep the vector cluster box as the size/frame (the mask
      // is still used to clean the thumbnail). Only letters get the tight-bbox trim.
      if (maskInfo && !isLogo) {
        const { mask, width: mw, height: mh, x1: mx, y1: my } = maskInfo;
        let mnX = mw, mnY = mh, mxX = -1, mxY = -1;
        for (let ry = 0; ry < mh; ry++) {
          for (let rx = 0; rx < mw; rx++) {
            if (!mask[ry * mw + rx]) continue;
            if (rx < mnX) mnX = rx;
            if (rx > mxX) mxX = rx;
            if (ry < mnY) mnY = ry;
            if (ry > mxY) mxY = ry;
          }
        }
        if (mxX >= mnX && mxY >= mnY) bboxPx = [mx + mnX, my + mnY, mx + mxX, my + mxY];
      }
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
        // Mask the thumbnail to this record's shape (neighbours clipped in the box
        // are whitened). Crop the ORIGINAL box so the letter keeps a little margin.
        // Big boxes (maskInfo === null) skip masking — a plain crop, no extra flood.
        const cropUrl = rasterCropDataUrl(page, rawBox, 150, maskInfo != null, maskInfo);
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
          // LED clearance from the tight letter box (its shortest side).
          led_clearance: ledClearanceFor(bboxPx),
          // led_length_m (concentric-ring fill estimate) is stamped later in
          // analyze.ts so BOTH the raster and vector letter paths get it.
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
      // Use the same non-white test as letter detection (was dark-only < 105,
      // which missed coloured artwork like blue letters — that made the preview
      // crop fall back to the vector bbox and mis-align every highlight box).
      if (isArtworkPixel(rgb[i], rgb[i + 1], rgb[i + 2])) {
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
// Build a mask of just THIS record's shape. We flood-fill connected components in
// a region padded around the box, then keep only components that live MOSTLY
// inside the box. A neighbouring letter that merely pokes into the box has most of
// its body outside the box -> dropped. The record's own letter (and its own parts,
// e.g. the dot of an "i") sits fully inside -> kept. Never returns blank: if
// nothing qualifies, it falls back to the component with the most in-box pixels.
function connectedMaskForBbox(page: RenderedPage, bboxPx: PxBbox): { mask: Uint8Array; width: number; height: number; x1: number; y1: number } | null {
  const { width: imgW, height: imgH, rgb } = page;
  const [x1, y1, x2, y2] = bboxPx;
  const boxW = x2 - x1 + 1;
  const boxH = y2 - y1 + 1;
  // Padded region so we can see whether a component continues beyond the box.
  // Capped in absolute pixels so a big letter at high DPI doesn't flood a giant area.
  const padX = Math.min(80, Math.max(6, Math.round(boxW * 0.9)));
  const padY = Math.min(80, Math.max(6, Math.round(boxH * 0.9)));
  const rx1 = Math.max(0, x1 - padX), ry1 = Math.max(0, y1 - padY);
  const rx2 = Math.min(imgW - 1, x2 + padX), ry2 = Math.min(imgH - 1, y2 + padY);
  const rw = rx2 - rx1 + 1, rh = ry2 - ry1 + 1;
  const artwork = new Uint8Array(rw * rh);
  for (let y = 0; y < rh; y++) {
    const gy = ry1 + y;
    for (let x = 0; x < rw; x++) {
      const i = (gy * imgW + (rx1 + x)) * 3;
      if (rgb[i] < 245 || rgb[i + 1] < 245 || rgb[i + 2] < 245) artwork[y * rw + x] = 1;
    }
  }
  // Box position within the region.
  const bL = x1 - rx1, bT = y1 - ry1, bR = bL + boxW - 1, bB = bT + boxH - 1;
  const visited = new Uint8Array(rw * rh);
  type Comp = { indices: number[]; inside: number };
  const components: Comp[] = [];
  for (let y = 0; y < rh; y++) {
    for (let x = 0; x < rw; x++) {
      const start = y * rw + x;
      if (visited[start]) continue;
      visited[start] = 1;
      if (!artwork[start]) continue;
      const stack = [start];
      const indices: number[] = [];
      let inside = 0;
      while (stack.length) {
        const current = stack.pop()!;
        indices.push(current);
        const px = current % rw;
        const py = (current / rw) | 0;
        if (px >= bL && px <= bR && py >= bT && py <= bB) inside++;
        const neigh = [[px + 1, py], [px - 1, py], [px, py + 1], [px, py - 1]];
        for (const [nx, ny] of neigh) {
          if (nx < 0 || nx >= rw || ny < 0 || ny >= rh) continue;
          const ni = ny * rw + nx;
          if (visited[ni]) continue;
          visited[ni] = 1;
          if (artwork[ni]) stack.push(ni);
        }
      }
      if (inside > 0) components.push({ indices, inside });
    }
  }
  if (!components.length) return null;
  const mask = new Uint8Array(boxW * boxH);
  const paint = (c: Comp) => {
    for (const idx of c.indices) {
      const px = idx % rw, py = (idx / rw) | 0;
      if (px >= bL && px <= bR && py >= bT && py <= bB) mask[(py - bT) * boxW + (px - bL)] = 1;
    }
  };
  // Keep ONLY this record's own shape = the connected component with the most
  // pixels inside the box. Any OTHER shape that merely overlaps the box — a
  // separate letter sitting inside a big logo's bounding box, or a neighbour that
  // clips the corner — is a different record and gets whitened out of this crop.
  let best = components[0];
  for (const c of components) if (c.inside > best.inside) best = c;
  paint(best);
  return { mask, width: boxW, height: boxH, x1, y1 };
}

/**
 * Build a downsample-bounded shape mask for one letter box and return its LED
 * fill length. Unlike the thumbnail mask (capped at 600k px so big letters skip
 * masking) this always produces a mask: for a large box it samples on a coarser
 * grid so the working area stays within a fixed pixel budget, then scales pxPerCm
 * to match. The largest connected component is kept so a neighbour clipping the
 * box corner cannot inflate the fillable area.
 */
export function ledLengthForBox(page: RenderedPage, bboxPx: PxBbox, pxPerCm: number): number {
  if (!pxPerCm || pxPerCm <= 0) return 0;
  const { width: imgW, height: imgH, rgb } = page;
  const [x1, y1, x2, y2] = bboxPx;
  const boxW = x2 - x1 + 1;
  const boxH = y2 - y1 + 1;
  if (boxW <= 1 || boxH <= 1) return 0;
  const BUDGET = 1_200_000;
  const area = boxW * boxH;
  const step = area > BUDGET ? Math.ceil(Math.sqrt(area / BUDGET)) : 1;
  const w = Math.max(1, Math.floor(boxW / step));
  const h = Math.max(1, Math.floor(boxH / step));
  if (w <= 1 || h <= 1) return 0;
  // Max-pool each step×step block into a mask that carries a 1px EMPTY frame
  // (pw×ph). The frame guarantees a clean "outside" so face-detection's border
  // flood is correct even when the letter touches the tight box edge, and so the
  // distance transform insets from every outer edge (the letter's extreme points
  // sit on the box border). A cell is artwork if ANY pixel in its block is — using
  // the block (not just the centre pixel) keeps a thin outline stroke connected
  // after downsampling, so the face flood can't leak through a sampling gap.
  const pw = w + 2, ph = h + 2;
  const mask = new Uint8Array(pw * ph);
  for (let cy = 0; cy < h; cy++) {
    const gy0 = y1 + cy * step;
    const gy1 = Math.min(y2, gy0 + step - 1);
    for (let cx = 0; cx < w; cx++) {
      const gx0 = x1 + cx * step;
      const gx1 = Math.min(x2, gx0 + step - 1);
      let hit = 0;
      for (let gy = gy0; gy <= gy1 && !hit; gy++) {
        const rowBase = gy * imgW;
        for (let gx = gx0; gx <= gx1; gx++) {
          const i = (rowBase + gx) * 3;
          if (rgb[i] < 245 || rgb[i + 1] < 245 || rgb[i + 2] < 245) { hit = 1; break; }
        }
      }
      if (hit) mask[(cy + 1) * pw + (cx + 1)] = 1;
    }
  }
  // The artwork draws each glyph as a hollow OUTLINE (channel-letter return), so
  // recover the solid letter FACE — but NOT its counters. A counter (the hole in
  // a/o/e/d, or a hole in a logo) gets no LED, so the face keeps a 1cm gap from the
  // counter edge too. faceMaskExcludingCounters() fills the face and leaves counters
  // empty; the distance transform then insets from both the outer and counter edges.
  const faced = faceMaskExcludingCounters(mask, pw, ph);
  keepLargestComponent(faced, pw, ph);
  return ledFillLengthMeters(faced, pw, ph, pxPerCm / step);
}

/**
 * Keep the letter FACE, drop its counters. An outline glyph draws each closed
 * shape as a stroke; the background one stroke inside the outermost edge is the
 * face (gets LED), the background two strokes in is a counter/hole (no LED — the
 * "a"/"o" hole, or a hole punched in a logo). Every background pixel is classified
 * by how many artwork boundaries separate it from the image border (a 0-1 BFS,
 * crossing artwork↔background costs 1). Outside background sits at 0 crossings, the
 * face at 2, a counter at 4, and so on — so background at ≡2 (mod 4) is face and is
 * kept; everything at ≡0 (mod 4) is outside/counter and stays empty. Artwork pixels
 * (the drawn strokes) are always part of the face.
 */
function faceMaskExcludingCounters(mask: Uint8Array, w: number, h: number): Uint8Array {
  const n = w * h;
  const depth = new Int32Array(n).fill(-1);
  const buckets: number[][] = [];
  const push = (i: number, d: number) => { (buckets[d] || (buckets[d] = [])).push(i); };
  const seedBorder = (i: number) => { if (depth[i] !== 0) { depth[i] = 0; push(i, 0); } };
  for (let x = 0; x < w; x++) { seedBorder(x); seedBorder((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { seedBorder(y * w); seedBorder(y * w + w - 1); }
  for (let d = 0; d < buckets.length; d++) {
    const q = buckets[d];
    if (!q) continue;
    for (let qi = 0; qi < q.length; qi++) {
      const i = q[qi];
      if (depth[i] !== d) continue; // stale entry from a later relaxation
      const cx = i % w, cy = (i / w) | 0;
      const relax = (ni: number) => {
        const nd = d + (mask[i] === mask[ni] ? 0 : 1);
        if (depth[ni] === -1 || nd < depth[ni]) { depth[ni] = nd; push(ni, nd); }
      };
      if (cx > 0) relax(i - 1);
      if (cx < w - 1) relax(i + 1);
      if (cy > 0) relax(i - w);
      if (cy < h - 1) relax(i + w);
    }
  }
  // Decide whether the artwork is drawn as OUTLINE or SOLID. The background one
  // boundary in (depth ≡ 2 mod 4) is the letter FACE when the art is a hollow
  // outline (that region is big, the drawn strokes are thin) but is the COUNTER
  // when the art is solid (that region is a small hole inside a large fill). So
  // fill the depth-2 background only when it out-measures the drawn artwork.
  let maskCount = 0, innerCount = 0;
  for (let i = 0; i < n; i++) {
    if (mask[i]) maskCount++;
    else if ((depth[i] & 3) === 2) innerCount++;
  }
  const outline = innerCount > maskCount;
  const out = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    if (mask[i]) out[i] = 1;                              // solid fill / drawn stroke = face
    else if (outline && (depth[i] & 3) === 2) out[i] = 1; // outline art: background one stroke in = face
  }
  return out;
}

/** Zero every pixel that is not part of the largest 4-connected component. */
function keepLargestComponent(mask: Uint8Array, w: number, h: number): void {
  const n = w * h;
  const label = new Int32Array(n).fill(-1);
  const stack: number[] = [];
  let bestId = -1;
  let bestSize = 0;
  let nextId = 0;
  for (let s = 0; s < n; s++) {
    if (!mask[s] || label[s] !== -1) continue;
    const id = nextId++;
    label[s] = id;
    stack.length = 0;
    stack.push(s);
    let size = 0;
    while (stack.length) {
      const c = stack.pop()!;
      size++;
      const cx = c % w;
      const cy = (c / w) | 0;
      if (cx > 0) { const ni = c - 1; if (mask[ni] && label[ni] === -1) { label[ni] = id; stack.push(ni); } }
      if (cx < w - 1) { const ni = c + 1; if (mask[ni] && label[ni] === -1) { label[ni] = id; stack.push(ni); } }
      if (cy > 0) { const ni = c - w; if (mask[ni] && label[ni] === -1) { label[ni] = id; stack.push(ni); } }
      if (cy < h - 1) { const ni = c + w; if (mask[ni] && label[ni] === -1) { label[ni] = id; stack.push(ni); } }
    }
    if (size > bestSize) { bestSize = size; bestId = id; }
  }
  if (bestId < 0) return;
  for (let i = 0; i < n; i++) if (label[i] !== bestId) mask[i] = 0;
}

/**
 * Estimated LED strip length (metres) to fill one record with concentric rings:
 * leave a 1cm gap from the outline, stick a 7mm LED strip, leave a 2cm gap, then
 * another ring, repeating inward until full.
 *
 * Rings spaced at pitch = 0.7cm (strip) + 2.0cm (gap) fill the area that sits at
 * least 1cm inside the outline, so the total strip centreline length is that
 * fillable area divided by the pitch (the standard area/pitch fill estimate).
 * The fillable area comes from a chamfer distance transform of the shape mask,
 * which naturally drops thin strokes that are too narrow for a ring.
 */
function ledFillLengthMeters(mask: Uint8Array, w: number, h: number, pxPerCm: number): number {
  if (!pxPerCm || pxPerCm <= 0 || w <= 0 || h <= 0) return 0;
  const n = w * h;
  const INF = 1e9;
  const dist = new Float32Array(n);
  for (let i = 0; i < n; i++) dist[i] = mask[i] ? INF : 0;
  const dOrtho = 1;
  const dDiag = Math.SQRT2;
  // Forward pass (top-left to bottom-right).
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (dist[i] === 0) continue;
      let m = dist[i];
      if (x > 0) m = Math.min(m, dist[i - 1] + dOrtho);
      if (y > 0) m = Math.min(m, dist[i - w] + dOrtho);
      if (x > 0 && y > 0) m = Math.min(m, dist[i - w - 1] + dDiag);
      if (x < w - 1 && y > 0) m = Math.min(m, dist[i - w + 1] + dDiag);
      dist[i] = m;
    }
  }
  // Backward pass (bottom-right to top-left).
  for (let y = h - 1; y >= 0; y--) {
    for (let x = w - 1; x >= 0; x--) {
      const i = y * w + x;
      if (dist[i] === 0) continue;
      let m = dist[i];
      if (x < w - 1) m = Math.min(m, dist[i + 1] + dOrtho);
      if (y < h - 1) m = Math.min(m, dist[i + w] + dOrtho);
      if (x < w - 1 && y < h - 1) m = Math.min(m, dist[i + w + 1] + dDiag);
      if (x > 0 && y < h - 1) m = Math.min(m, dist[i + w - 1] + dDiag);
      dist[i] = m;
    }
  }
  const borderPx = 1.0 * pxPerCm; // leave 1cm empty from the outline
  let fillablePx = 0;
  for (let i = 0; i < n; i++) if (dist[i] >= borderPx) fillablePx++;
  const areaCm2 = fillablePx / (pxPerCm * pxPerCm);
  const pitchCm = 2.0; // ring centre-to-centre spacing (2cm)
  return areaCm2 / pitchCm / 100; // cm → metres
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

type MaskInfo = { mask: Uint8Array; width: number; height: number; x1: number; y1: number };

function rasterCropDataUrl(page: RenderedPage, bboxPx: PxBbox, maxSide = 150, maskShape = false, precomputedMask: MaskInfo | null = null): string {
  const { width: imgW, height: imgH, rgb } = page;
  const [x1, y1, x2, y2] = bboxPx;
  const pad = 16;
  const selectedMask = maskShape ? (precomputedMask ?? connectedMaskForBbox(page, bboxPx)) : null;
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
