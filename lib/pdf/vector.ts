// Shared vector/PDF content-stream analysis (port of the common parts of the
// Python analyzers). The 3D Box Up analyzer uses this superset which also tracks
// filled paths; the Neon Line analyzer keeps its own copy.
import { pyRound, pyG } from "@/lib/pdf/pyfmt";

export const POINTS_PER_INCH = 72.0;
export const METERS_PER_POINT = 0.0254 / POINTS_PER_INCH;

export type Pt = [number, number];
export type Bbox = [number, number, number, number];
export type Color = { space: string; values: number[] };
export type Segment = ["line", Pt, Pt] | ["cubic", Pt, Pt, Pt, Pt];
export type Mat = [number, number, number, number, number, number];

export type Stroke = { page: number; color: Color; widthPt: number; lengthPt: number; bbox: Bbox; segments: Segment[] };
export type FillPath = { page: number; bbox: Bbox; segments: Segment[] };
export type ImagePlacement = { page: number; name: string; bbox: Bbox };
export type ClipPath = { page: number; bbox: Bbox };
export type BboxIn = { x_in: number; y_in: number; width_in: number; height_in: number };
export type ColorRow = { color: string; rgb_hex: string; rgb: number[]; paths: number; length_m: number };

// ---- geometry ----
export function matMul(a: Mat, b: Mat): Mat {
  return [
    a[0] * b[0] + a[2] * b[1],
    a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3],
    a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4],
    a[1] * b[4] + a[3] * b[5] + a[5],
  ];
}
export function applyMat(m: Mat, x: number, y: number): Pt {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}
export function dist(a: Pt, b: Pt): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}
export function cubicPoint(p0: Pt, p1: Pt, p2: Pt, p3: Pt, t: number): Pt {
  const mt = 1 - t;
  return [
    mt ** 3 * p0[0] + 3 * mt ** 2 * t * p1[0] + 3 * mt * t ** 2 * p2[0] + t ** 3 * p3[0],
    mt ** 3 * p0[1] + 3 * mt ** 2 * t * p1[1] + 3 * mt * t ** 2 * p2[1] + t ** 3 * p3[1],
  ];
}
export function cubicLength(p0: Pt, p1: Pt, p2: Pt, p3: Pt, steps = 32): number {
  let total = 0.0;
  let last = p0;
  for (let i = 1; i <= steps; i++) {
    const point = cubicPoint(p0, p1, p2, p3, i / steps);
    total += dist(last, point);
    last = point;
  }
  return total;
}

// ---- color ----
export function cmykToRgb(c: number, m: number, y: number, k: number): [number, number, number] {
  return [pyRound(255 * (1 - c) * (1 - k)), pyRound(255 * (1 - m) * (1 - k)), pyRound(255 * (1 - y) * (1 - k))];
}
export function rgbHex(rgb: number[]): string {
  return "#" + rgb.map((v) => (v & 0xff).toString(16).padStart(2, "0")).join("");
}
export function colorLabel(color: Color): string {
  if (color.space === "CMYK") {
    const [c, m, y, k] = color.values;
    return `${rgbHex(cmykToRgb(c, m, y, k))}  CMYK(${pyG(c)}, ${pyG(m)}, ${pyG(y)}, ${pyG(k)})`;
  }
  if (color.space === "RGB") {
    const rgb = color.values.map((v) => pyRound(v * 255));
    return `${rgbHex(rgb)}  RGB(${color.values.map((v) => pyG(v)).join(", ")})`;
  }
  return "Unknown";
}
export function isNeonColor(color: Color): boolean {
  let rgb: number[];
  if (color.space === "CMYK") rgb = cmykToRgb(color.values[0], color.values[1], color.values[2], color.values[3]);
  else if (color.space === "RGB") rgb = color.values.map((v) => pyRound(v * 255));
  else return false;
  const mx = Math.max(rgb[0], rgb[1], rgb[2]);
  const mn = Math.min(rgb[0], rgb[1], rgb[2]);
  return mx > 35 && (mx - mn > 20 || mx > 180);
}
export function colorRgbTuple(color: Color): [number, number, number] {
  if (color.space === "CMYK") return cmykToRgb(color.values[0], color.values[1], color.values[2], color.values[3]);
  if (color.space === "RGB") return color.values.map((v) => Math.max(0, Math.min(255, pyRound(v * 255)))) as [number, number, number];
  return [255, 255, 255];
}

// ---- bbox ----
export function unionBboxes(boxes: (Bbox | null)[]): Bbox | null {
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity, any = false;
  for (const b of boxes) {
    if (b === null) continue;
    any = true;
    if (b[0] < x1) x1 = b[0];
    if (b[1] < y1) y1 = b[1];
    if (b[2] > x2) x2 = b[2];
    if (b[3] > y2) y2 = b[3];
  }
  return any ? [x1, y1, x2, y2] : null;
}
export function unionBbox(items: { bbox: Bbox | null }[]): Bbox | null {
  return unionBboxes(items.map((i) => i.bbox));
}
export function bboxArea(bbox: Bbox | null): number {
  if (bbox === null) return 0;
  return Math.max(0, bbox[2] - bbox[0]) * Math.max(0, bbox[3] - bbox[1]);
}
export function bboxIntersects(a: Bbox | null, b: Bbox | null): boolean {
  if (a === null || b === null) return false;
  return Math.min(a[2], b[2]) > Math.max(a[0], b[0]) && Math.min(a[3], b[3]) > Math.max(a[1], b[1]);
}
export function bboxCenter(bbox: Bbox): Pt {
  return [(bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2];
}
export function pointInBbox(p: Pt, bbox: Bbox): boolean {
  return bbox[0] <= p[0] && p[0] <= bbox[2] && bbox[1] <= p[1] && p[1] <= bbox[3];
}
export function expandBbox(bbox: Bbox, pad: number): Bbox {
  return [bbox[0] - pad, bbox[1] - pad, bbox[2] + pad, bbox[3] + pad];
}
export function bboxesClose(a: Bbox, b: Bbox, gap: number): boolean {
  return bboxIntersects(expandBbox(a, gap), expandBbox(b, gap));
}
export function bboxContains(outer: Bbox | null, inner: Bbox | null): boolean {
  if (outer === null || inner === null) return false;
  return outer[0] <= inner[0] && inner[0] <= outer[2] && outer[0] <= inner[2] && inner[2] <= outer[2] && outer[1] <= inner[1] && inner[1] <= outer[3] && outer[1] <= inner[3] && inner[3] <= outer[3];
}
export function normalizeBbox(bbox: Bbox): Bbox {
  const [x1, y1, x2, y2] = bbox;
  return [Math.min(x1, x2), Math.min(y1, y2), Math.max(x1, x2), Math.max(y1, y2)];
}
export function dedupeBboxes(boxes: Bbox[], tolerance = 6): Bbox[] {
  const unique: Bbox[] = [];
  for (const box of boxes) {
    let dup = false;
    for (const ex of unique) if ([0, 1, 2, 3].every((i) => Math.abs(box[i] - ex[i]) <= tolerance)) { dup = true; break; }
    if (!dup) unique.push(box);
  }
  return unique;
}
// How many spatially-disjoint clusters a set of boxes forms. Overlapping boxes
// (e.g. a letter outline + its counter/hole) collapse into one cluster; visually
// separate boxes (e.g. the glyphs of an outlined word) each stay their own. Used
// to tell a single-shape fill from a multi-piece compound path.
export function disjointBoxCount(boxes: Bbox[]): number {
  const valid = boxes.filter((b) => b && bboxArea(b) > 0);
  const n = valid.length;
  if (n <= 1) return n;
  const parent = valid.map((_, i) => i);
  const find = (i: number): number => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (bboxIntersects(valid[i], valid[j])) { const a = find(i), b = find(j); if (a !== b) parent[b] = a; }
    }
  }
  const roots = new Set<number>();
  for (let i = 0; i < n; i++) roots.add(find(i));
  return roots.size;
}
export function clusterStrokeBboxes(strokes: { bbox: Bbox }[], gap = POINTS_PER_INCH * 4): Bbox[] {
  const boxes = strokes.map((s) => s.bbox).filter((b) => b !== null && bboxArea(b) > 0);
  const clusters: Bbox[][] = [];
  for (const box of boxes) {
    const matches: number[] = [];
    clusters.forEach((cluster, i) => {
      const u = unionBboxes(cluster);
      if (u && bboxesClose(u, box, gap)) matches.push(i);
    });
    if (matches.length === 0) { clusters.push([box]); continue; }
    const first = matches[0];
    clusters[first].push(box);
    for (const index of matches.slice(1).reverse()) { clusters[first].push(...clusters[index]); clusters.splice(index, 1); }
  }
  return clusters.map((c) => unionBboxes(c)).filter((b): b is Bbox => b !== null);
}
export function chooseClipBbox(clips: { bbox: Bbox }[], imageBbox: Bbox | null = null): Bbox | null {
  let boxes = clips.map((c) => c.bbox).filter((b) => b !== null && bboxArea(b) > 0);
  if (imageBbox !== null) {
    boxes = boxes.filter((box) => bboxIntersects(box, imageBbox));
    const imageArea = bboxArea(imageBbox);
    if (imageArea > 0) boxes = boxes.filter((box) => bboxArea(box) <= imageArea * 1.02);
  }
  if (boxes.length === 0) return null;
  return boxes.reduce((a, b) => (bboxArea(b) > bboxArea(a) ? b : a));
}
export function snapDisplayMeasurement(value: number): number {
  const rounded = pyRound(value);
  if (Math.abs(value - rounded) <= 0.03) return rounded;
  return value;
}
export function bboxToInches(bbox: Bbox | null, scale = 1.0): BboxIn | null {
  if (bbox === null) return null;
  const [x1, y1, x2, y2] = bbox;
  return {
    x_in: (x1 / POINTS_PER_INCH) * scale,
    y_in: (y1 / POINTS_PER_INCH) * scale,
    width_in: snapDisplayMeasurement(((x2 - x1) / POINTS_PER_INCH) * scale),
    height_in: snapDisplayMeasurement(((y2 - y1) / POINTS_PER_INCH) * scale),
  };
}
export function designBboxesForPage(pageClips: ClipPath[], pageImages: ImagePlacement[], pageNeon: Stroke[], pageSizePt: [number, number]): Bbox[] {
  const imageBbox = unionBbox(pageImages);
  const pageArea = pageSizePt[0] * pageSizePt[1];
  const minArea = (POINTS_PER_INCH * 10) ** 2;
  const maxArea = pageArea * 0.8;
  let clipBoxes: Bbox[] = [];
  for (const clip of pageClips) {
    const area = bboxArea(clip.bbox);
    if (area < minArea || area > maxArea) continue;
    if (imageBbox !== null && !bboxIntersects(clip.bbox, imageBbox)) continue;
    clipBoxes.push(clip.bbox);
  }
  clipBoxes = dedupeBboxes(clipBoxes);
  if (clipBoxes.length > 1) return clipBoxes.sort((a, b) => a[0] - b[0] || b[1] - a[1]);
  let clusterBoxes = clusterStrokeBboxes(pageNeon).filter((b) => bboxArea(b) >= minArea);
  if (clusterBoxes.length > 1) return clusterBoxes.sort((a, b) => a[0] - b[0] || b[1] - a[1]);
  const single = chooseClipBbox(pageClips, imageBbox) || imageBbox || unionBbox(pageNeon);
  return single !== null ? [single] : [];
}
export function strokesForBbox<T extends { bbox: Bbox }>(strokes: T[], bbox: Bbox): T[] {
  const selected: T[] = [];
  for (const stroke of strokes) {
    const center = bboxCenter(stroke.bbox);
    if (pointInBbox(center, bbox) || bboxIntersects(stroke.bbox, bbox)) selected.push(stroke);
  }
  return selected;
}
export function imageForBbox(images: ImagePlacement[], bbox: Bbox): ImagePlacement | null {
  const matches = images.filter((img) => bboxIntersects(img.bbox, bbox));
  if (matches.length === 0) return null;
  return matches.reduce((a, b) => (bboxArea(b.bbox) > bboxArea(a.bbox) ? b : a));
}
export function summarizeNeonColors(strokes: Stroke[], scale = 1.0): ColorRow[] {
  const byColor = new Map<string, ColorRow>();
  for (const stroke of strokes) {
    if (!isNeonColor(stroke.color)) continue;
    const rgb = colorRgbTuple(stroke.color);
    const hex = rgbHex(rgb);
    let item = byColor.get(hex);
    if (!item) { item = { color: colorLabel(stroke.color), rgb_hex: hex, rgb: [...rgb], paths: 0, length_m: 0.0 }; byColor.set(hex, item); }
    item.paths += 1;
    item.length_m += stroke.lengthPt * METERS_PER_POINT * scale;
  }
  return [...byColor.values()].sort((a, b) => b.length_m - a.length_m);
}

// ---- letter dimension helpers ----
export type LetterEntry = {
  label: string;
  width_in: number;
  height_in: number;
  bbox_in: BboxIn;
  source: string;
  image_data_url?: string;
  highlight_pct?: { left: number; top: number; width: number; height: number } | null;
  led_clearance?: null;
};
export function letterDimensionEntry(label: string, bbox: Bbox, scale = 1.0, source = "outline"): LetterEntry | null {
  const size = bboxToInches(normalizeBbox(bbox), scale);
  if (!size) return null;
  return { label, width_in: size.width_in, height_in: size.height_in, bbox_in: size, source };
}
export function sortLetterDimensions(entries: LetterEntry[]): LetterEntry[] {
  return [...entries].sort((a, b) => {
    const ka = pyRound(a.bbox_in.y_in / 0.35);
    const kb = pyRound(b.bbox_in.y_in / 0.35);
    return ka - kb || a.bbox_in.x_in - b.bbox_in.x_in;
  });
}
export function outlineLetterDimensions(paths: { bbox: Bbox }[], scale = 1.0, contentBbox: Bbox | null = null, maxItems = 120): LetterEntry[] {
  const boxes: Bbox[] = [];
  const contentWidth = contentBbox ? contentBbox[2] - contentBbox[0] : null;
  const contentHeight = contentBbox ? contentBbox[3] - contentBbox[1] : null;
  for (const item of paths) {
    if (item.bbox === null) continue;
    const box = normalizeBbox(item.bbox);
    if (bboxArea(box) <= 0) continue;
    if (contentBbox !== null) {
      const center = bboxCenter(box);
      if (!pointInBbox(center, contentBbox) && !bboxIntersects(box, contentBbox)) continue;
    }
    const width = box[2] - box[0];
    const height = box[3] - box[1];
    if (contentWidth && contentHeight && width > contentWidth * 0.72 && height > contentHeight * 0.72) continue;
    boxes.push(box);
  }
  if (boxes.length === 0) return [];
  const glyphGap = POINTS_PER_INCH * 0.06;
  const clusters: Bbox[][] = [];
  for (const box of boxes) {
    const matches: number[] = [];
    clusters.forEach((cluster, i) => { const u = unionBboxes(cluster); if (u && bboxesClose(u, box, glyphGap)) matches.push(i); });
    if (matches.length === 0) { clusters.push([box]); continue; }
    const first = matches[0];
    clusters[first].push(box);
    for (const index of matches.slice(1).reverse()) { clusters[first].push(...clusters[index]); clusters.splice(index, 1); }
  }
  let glyphBoxes = clusters.map((c) => unionBboxes(c)).filter((b): b is Bbox => b !== null && bboxArea(b) > 0);
  if (glyphBoxes.length === 0) return [];
  // Each glyph cluster is one letter/logo record. We deliberately do NOT merge
  // adjacent glyphs into "words" by proximity — that would fuse separate,
  // ungrouped letters (e.g. "S"+"G" -> "SG"). Following the artwork's own
  // separation keeps ungrouped letters apart; the customer can still group
  // them manually in the UI when they want to.
  const entries: LetterEntry[] = [];
  glyphBoxes.forEach((box, idx) => {
    if (!box || bboxArea(box) <= 0) return;
    const entry = letterDimensionEntry(`Letter ${idx + 1}`, box, scale, "outline");
    if (entry) entries.push(entry);
  });
  return sortLetterDimensions(entries).slice(0, maxItems);
}

// ---- content-stream parser (with fills) ----
function latin1(bytes: Uint8Array): string {
  let s = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) s += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK) as unknown as number[]);
  return s;
}

export class PdfPathAnalyzer {
  ctm: Mat = [1, 0, 0, 1, 0, 0];
  strokeColor: Color = { space: "Unknown", values: [] };
  strokeWidth = 1.0;
  stack: { ctm: Mat; strokeColor: Color; strokeWidth: number }[] = [];
  segments: Segment[] = [];
  current: Pt | null = null;
  subpathStart: Pt | null = null;
  strokes: Stroke[] = [];
  fills: FillPath[] = [];
  fillGroups: { page: number; bbox: Bbox; parts: number }[] = [];
  images: ImagePlacement[] = [];
  clips: ClipPath[] = [];

  push() { this.stack.push({ ctm: this.ctm, strokeColor: { space: this.strokeColor.space, values: [...this.strokeColor.values] }, strokeWidth: this.strokeWidth }); }
  pop() { const s = this.stack.pop(); if (s) { this.ctm = s.ctm; this.strokeColor = s.strokeColor; this.strokeWidth = s.strokeWidth; } }
  transform(x: number, y: number): Pt { return applyMat(this.ctm, x, y); }
  moveTo(x: number, y: number) { this.current = this.transform(x, y); this.subpathStart = this.current; }
  lineTo(x: number, y: number) { const end = this.transform(x, y); if (this.current !== null) this.segments.push(["line", this.current, end]); this.current = end; }
  curveTo(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number) { this.curveToPoints(this.transform(x1, y1), this.transform(x2, y2), this.transform(x3, y3)); }
  curveToPoints(p1: Pt, p2: Pt, p3: Pt) { if (this.current !== null) this.segments.push(["cubic", this.current, p1, p2, p3]); this.current = p3; }
  rect(x: number, y: number, w: number, h: number) { this.moveTo(x, y); this.lineTo(x + w, y); this.lineTo(x + w, y + h); this.lineTo(x, y + h); this.closePath(); }
  closePath() { if (this.current !== null && this.subpathStart !== null) { this.segments.push(["line", this.current, this.subpathStart]); this.current = this.subpathStart; } }
  pathLength(): number {
    let total = 0.0;
    for (const seg of this.segments) total += seg[0] === "line" ? dist(seg[1], seg[2]) : cubicLength(seg[1], seg[2], seg[3], seg[4]);
    return total;
  }
  private flatPoints(): Pt[] {
    const points: Pt[] = [];
    for (const seg of this.segments) {
      if (seg[0] === "line") points.push(seg[1], seg[2]);
      else for (let i = 0; i <= 24; i++) points.push(cubicPoint(seg[1], seg[2], seg[3], seg[4], i / 24));
    }
    return points;
  }
  pathBbox(includeStroke = true): Bbox | null {
    const points = this.flatPoints();
    if (points.length === 0) return null;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of points) { if (p[0] < minX) minX = p[0]; if (p[1] < minY) minY = p[1]; if (p[0] > maxX) maxX = p[0]; if (p[1] > maxY) maxY = p[1]; }
    const pad = includeStroke ? this.strokeWidth / 2 : 0;
    return [minX - pad, minY - pad, maxX + pad, maxY + pad];
  }
  fillComponentBboxes(): Bbox[] {
    const components: Pt[][] = [];
    let current: Pt[] = [];
    let lastEnd: Pt | null = null;
    for (const seg of this.segments) {
      let start: Pt, end: Pt, points: Pt[];
      if (seg[0] === "line") { start = seg[1]; end = seg[2]; points = [start, end]; }
      else { start = seg[1]; end = seg[4]; points = []; for (let i = 0; i <= 24; i++) points.push(cubicPoint(seg[1], seg[2], seg[3], seg[4], i / 24)); }
      if (lastEnd !== null && dist(start, lastEnd) > 0.5 && current.length) { components.push(current); current = []; }
      current.push(...points);
      lastEnd = end;
    }
    if (current.length) components.push(current);
    const boxes: Bbox[] = [];
    for (const points of components) {
      if (!points.length) continue;
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const p of points) { if (p[0] < minX) minX = p[0]; if (p[1] < minY) minY = p[1]; if (p[0] > maxX) maxX = p[0]; if (p[1] > maxY) maxY = p[1]; }
      const box: Bbox = [minX, minY, maxX, maxY];
      if (bboxArea(box) > 0) boxes.push(box);
    }
    return boxes;
  }
  imageBbox(): Bbox {
    const points = [this.transform(0, 0), this.transform(1, 0), this.transform(0, 1), this.transform(1, 1)];
    const xs = points.map((p) => p[0]);
    const ys = points.map((p) => p[1]);
    return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
  }
  strokeOp(pageIndex: number) {
    const length = this.pathLength();
    const bbox = this.pathBbox();
    if (length > 0 && bbox !== null) {
      this.strokes.push({ page: pageIndex + 1, color: { space: this.strokeColor.space, values: [...this.strokeColor.values] }, widthPt: this.strokeWidth, lengthPt: length, bbox, segments: [...this.segments] });
    }
    this.clearPath();
  }
  fillOp(pageIndex: number, clear = true) {
    let boxes = this.fillComponentBboxes();
    if (!boxes.length) { const bbox = this.pathBbox(false); boxes = bbox !== null ? [bbox] : []; }
    for (const bbox of boxes) {
      if (bbox === null || bboxArea(bbox) <= 0) continue;
      this.fills.push({ page: pageIndex + 1, bbox, segments: [...this.segments] });
    }
    // A single fill operation whose subpaths form several DISJOINT pieces is a
    // compound path (Illustrator Ctrl+8 / Pathfinder-unite) — the artwork's own
    // grouping. Record the group's overall bbox so raster letter detection can
    // keep those pieces together as one record. Plain single-shape fills and
    // letters-with-holes (whose pieces overlap) don't create a group.
    const disjoint = disjointBoxCount(boxes);
    if (disjoint > 1) {
      const union = unionBboxes(boxes);
      if (union !== null && bboxArea(union) > 0) this.fillGroups.push({ page: pageIndex + 1, bbox: union, parts: disjoint });
    }
    if (clear) this.clearPath();
  }
  clipOp(pageIndex: number) { const bbox = this.pathBbox(false); if (bbox !== null) this.clips.push({ page: pageIndex + 1, bbox }); }
  clearPath() { this.segments = []; this.current = null; this.subpathStart = null; }

  runOperator(op: string, args: string[], pageIndex: number, imageNames: Set<string>) {
    try {
      const f = (i: number) => parseFloat(args[args.length + i]);
      if (op === "q") this.push();
      else if (op === "Q") this.pop();
      else if (op === "cm" && args.length >= 6) this.ctm = matMul(this.ctm, args.slice(-6).map(parseFloat) as Mat);
      else if (op === "w" && args.length) this.strokeWidth = Math.abs(parseFloat(args[args.length - 1]));
      else if (op === "RG" && args.length >= 3) this.strokeColor = { space: "RGB", values: args.slice(-3).map(parseFloat) };
      else if (op === "K" && args.length >= 4) this.strokeColor = { space: "CMYK", values: args.slice(-4).map(parseFloat) };
      else if (op === "SCN" && args.length >= 4) this.strokeColor = { space: "CMYK", values: args.slice(-4).map(parseFloat) };
      else if (op === "m" && args.length >= 2) this.moveTo(f(-2), f(-1));
      else if (op === "l" && args.length >= 2) this.lineTo(f(-2), f(-1));
      else if (op === "c" && args.length >= 6) this.curveTo(f(-6), f(-5), f(-4), f(-3), f(-2), f(-1));
      else if (op === "v" && args.length >= 4 && this.current !== null) this.curveToPoints(this.current, this.transform(f(-4), f(-3)), this.transform(f(-2), f(-1)));
      else if (op === "y" && args.length >= 4) { const p1 = this.transform(f(-4), f(-3)); const p3 = this.transform(f(-2), f(-1)); this.curveToPoints(p1, p3, p3); }
      else if (op === "re" && args.length >= 4) this.rect(f(-4), f(-3), f(-2), f(-1));
      else if (op === "h") this.closePath();
      else if (op === "Do" && args.length) { const name = args[args.length - 1]; if (imageNames.has(name)) this.images.push({ page: pageIndex + 1, name, bbox: this.imageBbox() }); }
      else if (op === "W" || op === "W*") this.clipOp(pageIndex);
      else if (op === "S" || op === "s") { if (op === "s") this.closePath(); this.strokeOp(pageIndex); }
      else if (op === "f" || op === "F" || op === "f*") this.fillOp(pageIndex);
      else if (op === "B" || op === "B*") { this.fillOp(pageIndex, false); this.strokeOp(pageIndex); }
      else if (op === "b" || op === "b*") { this.closePath(); this.fillOp(pageIndex, false); this.strokeOp(pageIndex); }
      else if (op === "n") this.clearPath();
    } catch {
      this.clearPath();
    }
  }
  parseStream(content: Uint8Array, pageIndex: number, imageNames: Set<string>) {
    const text = latin1(content);
    const tokenRe = /\/[A-Za-z0-9_.+-]+|[-+]?(?:\d*\.\d+|\d+)|[A-Za-z*]+|[[\]<>]/g;
    const numRe = /^[-+]?(?:\d*\.\d+|\d+)$/;
    let args: string[] = [];
    let match: RegExpExecArray | null;
    while ((match = tokenRe.exec(text)) !== null) {
      const t = match[0];
      if (numRe.test(t)) args.push(t);
      else if (t.startsWith("/")) args.push(t);
      else if (t === "[" || t === "]" || t === "<" || t === ">") continue;
      else { this.runOperator(t, args, pageIndex, imageNames); args = []; }
    }
  }
}
