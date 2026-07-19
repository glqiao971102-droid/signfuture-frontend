// Faithful TypeScript port of neon line/tools/ai_measure.py (analyze_ai + helpers).
// Produces the same result object the original Python printed as JSON, plus
// dimension/line previews rendered as inline SVG data URLs (built from the same
// vector data the Python PIL previews used).
import { extractPdf } from "@/lib/pdf/extract";
import { pyRound, pyG, fixed0 } from "@/lib/pdf/pyfmt";

const POINTS_PER_INCH = 72.0;
const METERS_PER_POINT = 0.0254 / POINTS_PER_INCH;

type Pt = [number, number];
type Bbox = [number, number, number, number];
type Color = { space: string; values: number[] };
type Segment =
  | ["line", Pt, Pt]
  | ["cubic", Pt, Pt, Pt, Pt];

type Stroke = {
  page: number;
  color: Color;
  widthPt: number;
  lengthPt: number;
  bbox: Bbox;
  segments: Segment[];
};
type ImagePlacement = { page: number; name: string; bbox: Bbox };
type ClipPath = { page: number; bbox: Bbox };

type Mat = [number, number, number, number, number, number];

// ---------------------------------------------------------------- geometry
function matMul(a: Mat, b: Mat): Mat {
  return [
    a[0] * b[0] + a[2] * b[1],
    a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3],
    a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4],
    a[1] * b[4] + a[3] * b[5] + a[5],
  ];
}
function applyMat(m: Mat, x: number, y: number): Pt {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}
function dist(a: Pt, b: Pt): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}
function cubicPoint(p0: Pt, p1: Pt, p2: Pt, p3: Pt, t: number): Pt {
  const mt = 1 - t;
  return [
    mt ** 3 * p0[0] + 3 * mt ** 2 * t * p1[0] + 3 * mt * t ** 2 * p2[0] + t ** 3 * p3[0],
    mt ** 3 * p0[1] + 3 * mt ** 2 * t * p1[1] + 3 * mt * t ** 2 * p2[1] + t ** 3 * p3[1],
  ];
}
function cubicLength(p0: Pt, p1: Pt, p2: Pt, p3: Pt, steps = 32): number {
  let total = 0.0;
  let last = p0;
  for (let i = 1; i <= steps; i++) {
    const point = cubicPoint(p0, p1, p2, p3, i / steps);
    total += dist(last, point);
    last = point;
  }
  return total;
}

// ---------------------------------------------------------------- color
function cmykToRgb(c: number, m: number, y: number, k: number): [number, number, number] {
  return [
    pyRound(255 * (1 - c) * (1 - k)),
    pyRound(255 * (1 - m) * (1 - k)),
    pyRound(255 * (1 - y) * (1 - k)),
  ];
}
function rgbHex(rgb: number[]): string {
  return "#" + rgb.map((v) => (v & 0xff).toString(16).padStart(2, "0")).join("");
}
function colorLabel(color: Color): string {
  if (color.space === "CMYK") {
    const [c, m, y, k] = color.values;
    const rgb = cmykToRgb(c, m, y, k);
    return `${rgbHex(rgb)}  CMYK(${pyG(c)}, ${pyG(m)}, ${pyG(y)}, ${pyG(k)})`;
  }
  if (color.space === "RGB") {
    const rgb = color.values.map((v) => pyRound(v * 255));
    return `${rgbHex(rgb)}  RGB(${color.values.map((v) => pyG(v)).join(", ")})`;
  }
  return "Unknown";
}
function isNeonColor(color: Color): boolean {
  let rgb: number[];
  if (color.space === "CMYK") {
    const [c, m, y, k] = color.values;
    rgb = cmykToRgb(c, m, y, k);
  } else if (color.space === "RGB") {
    rgb = color.values.map((v) => pyRound(v * 255));
  } else {
    return false;
  }
  const mx = Math.max(...rgb);
  const mn = Math.min(...rgb);
  return mx > 35 && (mx - mn > 20 || mx > 180);
}
function colorRgbTuple(color: Color): [number, number, number] {
  if (color.space === "CMYK") return cmykToRgb(color.values[0], color.values[1], color.values[2], color.values[3]);
  if (color.space === "RGB")
    return color.values.map((v) => Math.max(0, Math.min(255, pyRound(v * 255)))) as [number, number, number];
  return [255, 255, 255];
}

// ---------------------------------------------------------------- bbox
function unionBboxes(boxes: (Bbox | null)[]): Bbox | null {
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  let any = false;
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
function unionBbox(items: { bbox: Bbox | null }[]): Bbox | null {
  return unionBboxes(items.map((i) => i.bbox));
}
function bboxArea(bbox: Bbox | null): number {
  if (bbox === null) return 0;
  return Math.max(0, bbox[2] - bbox[0]) * Math.max(0, bbox[3] - bbox[1]);
}
function bboxIntersects(a: Bbox | null, b: Bbox | null): boolean {
  if (a === null || b === null) return false;
  return Math.min(a[2], b[2]) > Math.max(a[0], b[0]) && Math.min(a[3], b[3]) > Math.max(a[1], b[1]);
}
function bboxCenter(bbox: Bbox): Pt {
  return [(bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2];
}
function pointInBbox(p: Pt, bbox: Bbox): boolean {
  return bbox[0] <= p[0] && p[0] <= bbox[2] && bbox[1] <= p[1] && p[1] <= bbox[3];
}
function expandBbox(bbox: Bbox, pad: number): Bbox {
  return [bbox[0] - pad, bbox[1] - pad, bbox[2] + pad, bbox[3] + pad];
}
function bboxesClose(a: Bbox, b: Bbox, gap: number): boolean {
  return bboxIntersects(expandBbox(a, gap), expandBbox(b, gap));
}
function dedupeBboxes(boxes: Bbox[], tolerance = 6): Bbox[] {
  const unique: Bbox[] = [];
  for (const box of boxes) {
    let dup = false;
    for (const ex of unique) {
      if ([0, 1, 2, 3].every((i) => Math.abs(box[i] - ex[i]) <= tolerance)) {
        dup = true;
        break;
      }
    }
    if (!dup) unique.push(box);
  }
  return unique;
}
function clusterStrokeBboxes(strokes: Stroke[], gap = POINTS_PER_INCH * 4): Bbox[] {
  const boxes = strokes.map((s) => s.bbox).filter((b): b is Bbox => b !== null && bboxArea(b) > 0);
  const clusters: Bbox[][] = [];
  for (const box of boxes) {
    const matches: number[] = [];
    clusters.forEach((cluster, i) => {
      const u = unionBboxes(cluster);
      if (u && bboxesClose(u, box, gap)) matches.push(i);
    });
    if (matches.length === 0) {
      clusters.push([box]);
      continue;
    }
    const first = matches[0];
    clusters[first].push(box);
    for (const index of matches.slice(1).reverse()) {
      clusters[first].push(...clusters[index]);
      clusters.splice(index, 1);
    }
  }
  return clusters.map((c) => unionBboxes(c)).filter((b): b is Bbox => b !== null);
}
function chooseClipBbox(clips: ClipPath[], imageBbox: Bbox | null = null): Bbox | null {
  let boxes = clips.map((c) => c.bbox).filter((b): b is Bbox => b !== null && bboxArea(b) > 0);
  if (imageBbox !== null) {
    boxes = boxes.filter((box) => bboxIntersects(box, imageBbox));
    const imageArea = bboxArea(imageBbox);
    if (imageArea > 0) boxes = boxes.filter((box) => bboxArea(box) <= imageArea * 1.02);
  }
  if (boxes.length === 0) return null;
  return boxes.reduce((a, b) => (bboxArea(b) > bboxArea(a) ? b : a));
}
function snapDisplayMeasurement(value: number): number {
  const rounded = pyRound(value);
  if (Math.abs(value - rounded) <= 0.03) return rounded;
  return value;
}
type BboxIn = { x_in: number; y_in: number; width_in: number; height_in: number };
function bboxToInches(bbox: Bbox | null, scale = 1.0): BboxIn | null {
  if (bbox === null) return null;
  const [x1, y1, x2, y2] = bbox;
  return {
    x_in: (x1 / POINTS_PER_INCH) * scale,
    y_in: (y1 / POINTS_PER_INCH) * scale,
    width_in: snapDisplayMeasurement(((x2 - x1) / POINTS_PER_INCH) * scale),
    height_in: snapDisplayMeasurement(((y2 - y1) / POINTS_PER_INCH) * scale),
  };
}

function designBboxesForPage(
  pageClips: ClipPath[],
  pageImages: ImagePlacement[],
  pageNeon: Stroke[],
  pageSizePt: [number, number]
): Bbox[] {
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
  if (clipBoxes.length > 1) {
    return clipBoxes.sort((a, b) => a[0] - b[0] || -a[1] - -b[1]);
  }
  let clusterBoxes = clusterStrokeBboxes(pageNeon);
  clusterBoxes = clusterBoxes.filter((b) => bboxArea(b) >= minArea);
  if (clusterBoxes.length > 1) {
    return clusterBoxes.sort((a, b) => a[0] - b[0] || -a[1] - -b[1]);
  }
  const single = chooseClipBbox(pageClips, imageBbox) || imageBbox || unionBbox(pageNeon);
  return single !== null ? [single] : [];
}
function strokesForBbox(strokes: Stroke[], bbox: Bbox): Stroke[] {
  const selected: Stroke[] = [];
  for (const stroke of strokes) {
    const center = bboxCenter(stroke.bbox);
    if (pointInBbox(center, bbox) || bboxIntersects(stroke.bbox, bbox)) selected.push(stroke);
  }
  return selected;
}

type ColorRow = { color: string; rgb_hex: string; rgb: number[]; paths: number; length_m: number };
function summarizeNeonColors(strokes: Stroke[], scale = 1.0): ColorRow[] {
  const byColor = new Map<string, ColorRow>();
  for (const stroke of strokes) {
    if (!isNeonColor(stroke.color)) continue;
    const rgb = colorRgbTuple(stroke.color);
    const hex = rgbHex(rgb);
    let item = byColor.get(hex);
    if (!item) {
      item = { color: colorLabel(stroke.color), rgb_hex: hex, rgb: [...rgb], paths: 0, length_m: 0.0 };
      byColor.set(hex, item);
    }
    item.paths += 1;
    item.length_m += stroke.lengthPt * METERS_PER_POINT * scale;
  }
  return [...byColor.values()].sort((a, b) => b.length_m - a.length_m);
}

// ---------------------------------------------------------------- parser
class PdfPathAnalyzer {
  ctm: Mat = [1, 0, 0, 1, 0, 0];
  strokeColor: Color = { space: "Unknown", values: [] };
  strokeWidth = 1.0;
  stack: { ctm: Mat; strokeColor: Color; strokeWidth: number }[] = [];
  segments: Segment[] = [];
  current: Pt | null = null;
  subpathStart: Pt | null = null;
  strokes: Stroke[] = [];
  images: ImagePlacement[] = [];
  clips: ClipPath[] = [];

  push() {
    this.stack.push({ ctm: this.ctm, strokeColor: { space: this.strokeColor.space, values: [...this.strokeColor.values] }, strokeWidth: this.strokeWidth });
  }
  pop() {
    const s = this.stack.pop();
    if (s) {
      this.ctm = s.ctm;
      this.strokeColor = s.strokeColor;
      this.strokeWidth = s.strokeWidth;
    }
  }
  transform(x: number, y: number): Pt {
    return applyMat(this.ctm, x, y);
  }
  moveTo(x: number, y: number) {
    this.current = this.transform(x, y);
    this.subpathStart = this.current;
  }
  lineTo(x: number, y: number) {
    const end = this.transform(x, y);
    if (this.current !== null) this.segments.push(["line", this.current, end]);
    this.current = end;
  }
  curveTo(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number) {
    this.curveToPoints(this.transform(x1, y1), this.transform(x2, y2), this.transform(x3, y3));
  }
  curveToPoints(p1: Pt, p2: Pt, p3: Pt) {
    if (this.current !== null) this.segments.push(["cubic", this.current, p1, p2, p3]);
    this.current = p3;
  }
  rect(x: number, y: number, w: number, h: number) {
    this.moveTo(x, y);
    this.lineTo(x + w, y);
    this.lineTo(x + w, y + h);
    this.lineTo(x, y + h);
    this.closePath();
  }
  closePath() {
    if (this.current !== null && this.subpathStart !== null) {
      this.segments.push(["line", this.current, this.subpathStart]);
      this.current = this.subpathStart;
    }
  }
  pathLength(): number {
    let total = 0.0;
    for (const seg of this.segments) {
      if (seg[0] === "line") total += dist(seg[1], seg[2]);
      else total += cubicLength(seg[1], seg[2], seg[3], seg[4]);
    }
    return total;
  }
  pathBbox(includeStroke = true): Bbox | null {
    const points: Pt[] = [];
    for (const seg of this.segments) {
      if (seg[0] === "line") points.push(seg[1], seg[2]);
      else {
        for (let i = 0; i <= 24; i++) points.push(cubicPoint(seg[1], seg[2], seg[3], seg[4], i / 24));
      }
    }
    if (points.length === 0) return null;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of points) {
      if (p[0] < minX) minX = p[0];
      if (p[1] < minY) minY = p[1];
      if (p[0] > maxX) maxX = p[0];
      if (p[1] > maxY) maxY = p[1];
    }
    const pad = includeStroke ? this.strokeWidth / 2 : 0;
    return [minX - pad, minY - pad, maxX + pad, maxY + pad];
  }
  imageBbox(): Bbox {
    const points = [this.transform(0, 0), this.transform(1, 0), this.transform(0, 1), this.transform(1, 1)];
    const xs = points.map((p) => p[0]);
    const ys = points.map((p) => p[1]);
    return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
  }
  stroke(pageIndex: number) {
    const length = this.pathLength();
    const bbox = this.pathBbox();
    if (length > 0 && bbox !== null) {
      this.strokes.push({
        page: pageIndex + 1,
        color: { space: this.strokeColor.space, values: [...this.strokeColor.values] },
        widthPt: this.strokeWidth,
        lengthPt: length,
        bbox,
        segments: [...this.segments],
      });
    }
    this.clearPath();
  }
  clip(pageIndex: number) {
    const bbox = this.pathBbox(false);
    if (bbox !== null) this.clips.push({ page: pageIndex + 1, bbox });
  }
  clearPath() {
    this.segments = [];
    this.current = null;
    this.subpathStart = null;
  }
  runOperator(op: string, args: string[], pageIndex: number, imageNames: Set<string>) {
    try {
      const f = (i: number) => parseFloat(args[args.length + i]);
      if (op === "q") this.push();
      else if (op === "Q") this.pop();
      else if (op === "cm" && args.length >= 6) {
        const m = args.slice(-6).map(parseFloat) as Mat;
        this.ctm = matMul(this.ctm, m);
      } else if (op === "w" && args.length) this.strokeWidth = Math.abs(parseFloat(args[args.length - 1]));
      else if (op === "RG" && args.length >= 3) this.strokeColor = { space: "RGB", values: args.slice(-3).map(parseFloat) };
      else if (op === "K" && args.length >= 4) this.strokeColor = { space: "CMYK", values: args.slice(-4).map(parseFloat) };
      else if (op === "SCN" && args.length >= 4) this.strokeColor = { space: "CMYK", values: args.slice(-4).map(parseFloat) };
      else if (op === "m" && args.length >= 2) this.moveTo(f(-2), f(-1));
      else if (op === "l" && args.length >= 2) this.lineTo(f(-2), f(-1));
      else if (op === "c" && args.length >= 6) this.curveTo(f(-6), f(-5), f(-4), f(-3), f(-2), f(-1));
      else if (op === "v" && args.length >= 4 && this.current !== null) {
        this.curveToPoints(this.current, this.transform(f(-4), f(-3)), this.transform(f(-2), f(-1)));
      } else if (op === "y" && args.length >= 4) {
        const p1 = this.transform(f(-4), f(-3));
        const p3 = this.transform(f(-2), f(-1));
        this.curveToPoints(p1, p3, p3);
      } else if (op === "re" && args.length >= 4) this.rect(f(-4), f(-3), f(-2), f(-1));
      else if (op === "h") this.closePath();
      else if (op === "Do" && args.length) {
        const name = args[args.length - 1];
        if (imageNames.has(name)) this.images.push({ page: pageIndex + 1, name, bbox: this.imageBbox() });
      } else if (op === "W" || op === "W*") this.clip(pageIndex);
      else if (op === "S" || op === "s") {
        if (op === "s") this.closePath();
        this.stroke(pageIndex);
      } else if (["n", "f", "F", "f*", "B", "B*", "b", "b*"].includes(op)) this.clearPath();
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
      else {
        this.runOperator(t, args, pageIndex, imageNames);
        args = [];
      }
    }
  }
}

function latin1(bytes: Uint8Array): string {
  let s = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    s += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK) as unknown as number[]);
  }
  return s;
}

// ---------------------------------------------------------------- previews (SVG)
function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function svgDataUrl(svg: string): string {
  return "data:image/svg+xml;base64," + Buffer.from(svg, "utf8").toString("base64");
}

function flattenSegment(seg: Segment): Pt[] {
  if (seg[0] === "line") return [seg[1], seg[2]];
  const out: Pt[] = [];
  for (let i = 0; i <= 24; i++) out.push(cubicPoint(seg[1], seg[2], seg[3], seg[4], i / 24));
  return out;
}

// Line preview — mirrors save_line_preview (black bg, neon strokes by colour).
function buildLinePreview(strokes: Stroke[], contentBbox: Bbox | null): string | null {
  const neon = strokes.filter((s) => isNeonColor(s.color));
  if (neon.length === 0 || contentBbox === null) return null;
  const [x1, y1, x2, y2] = contentBbox;
  const widthPt = x2 - x1;
  const heightPt = y2 - y1;
  const scale = Math.min(560 / heightPt, 360 / widthPt);
  const pad = 28;
  const w = pyRound(widthPt * scale) + pad * 2;
  const h = pyRound(heightPt * scale) + pad * 2;
  const tx = (p: Pt): Pt => [pad + (p[0] - x1) * scale, pad + (y2 - p[1]) * scale];
  const parts: string[] = [];
  for (const stroke of neon) {
    const color = rgbHex(colorRgbTuple(stroke.color));
    const sw = Math.max(2, pyRound(stroke.widthPt * scale));
    for (const seg of stroke.segments) {
      const pts = flattenSegment(seg).map(tx);
      if (pts.length >= 2) {
        const d = pts.map((p) => `${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(" ");
        parts.push(`<polyline points="${d}" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"/>`);
      }
    }
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" fill="black"/>${parts.join("")}</svg>`;
  return svgDataUrl(svg);
}

// Dimension preview — mirrors save_dimension_preview layout (white bg, artwork
// drawn from vector strokes, blue dimension lines + integer-inch labels).
function buildDimensionPreview(strokes: Stroke[], contentBbox: Bbox | null, scale = 1.0): string | null {
  if (contentBbox === null) return null;
  const [x1, y1, x2, y2] = contentBbox;
  const widthPt = Math.max(1, x2 - x1);
  const heightPt = Math.max(1, y2 - y1);
  const aspect = widthPt / heightPt;
  let designWidth = Math.min(360, pyRound(560 * aspect));
  let designHeight = pyRound(designWidth / aspect);
  if (designHeight > 560) {
    designHeight = 560;
    designWidth = pyRound(designHeight * aspect);
  }
  designWidth = Math.max(1, designWidth);
  designHeight = Math.max(1, designHeight);
  const ml = 62, mt = 58, mr = 132, mb = 30;
  const cw = designWidth + ml + mr;
  const ch = designHeight + mt + mb;
  const dscale = Math.min(designWidth / widthPt, designHeight / heightPt);
  const offX = ml + (designWidth - widthPt * dscale) / 2;
  const offY = mt + (designHeight - heightPt * dscale) / 2;
  const tx = (p: Pt): Pt => [offX + (p[0] - x1) * dscale, offY + (y2 - p[1]) * dscale];

  const within = strokes.filter((s) => bboxIntersects(s.bbox, contentBbox));
  const art: string[] = [];
  for (const stroke of within) {
    const isNeon = isNeonColor(stroke.color);
    const color = isNeon ? rgbHex(colorRgbTuple(stroke.color)) : "#1a1a1a";
    const sw = Math.max(1, stroke.widthPt * dscale);
    for (const seg of stroke.segments) {
      const pts = flattenSegment(seg).map(tx);
      if (pts.length >= 2) {
        const d = pts.map((p) => `${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(" ");
        art.push(`<polyline points="${d}" fill="none" stroke="${color}" stroke-width="${sw.toFixed(2)}" stroke-linecap="round" stroke-linejoin="round"/>`);
      }
    }
  }

  const widthIn = ((x2 - x1) / POINTS_PER_INCH) * scale;
  const heightIn = ((y2 - y1) / POINTS_PER_INCH) * scale;
  const dim = "rgb(28,88,210)";
  const lw = 4, tick = 12;
  const x = ml, y = mt;
  const topY = y - 26;
  const rightX = x + designWidth + 26;
  const lines = `
    <line x1="${x}" y1="${topY}" x2="${x + designWidth}" y2="${topY}" stroke="${dim}" stroke-width="${lw}"/>
    <line x1="${x}" y1="${topY - tick}" x2="${x}" y2="${topY + tick}" stroke="${dim}" stroke-width="${lw}"/>
    <line x1="${x + designWidth}" y1="${topY - tick}" x2="${x + designWidth}" y2="${topY + tick}" stroke="${dim}" stroke-width="${lw}"/>
    <text x="${x + designWidth / 2}" y="${topY - 14}" fill="${dim}" font-family="Arial,sans-serif" font-size="26" font-weight="bold" text-anchor="middle">${fixed0(widthIn)} in</text>
    <line x1="${rightX}" y1="${y}" x2="${rightX}" y2="${y + designHeight}" stroke="${dim}" stroke-width="${lw}"/>
    <line x1="${rightX - tick}" y1="${y}" x2="${rightX + tick}" y2="${y}" stroke="${dim}" stroke-width="${lw}"/>
    <line x1="${rightX - tick}" y1="${y + designHeight}" x2="${rightX + tick}" y2="${y + designHeight}" stroke="${dim}" stroke-width="${lw}"/>
    <text x="${rightX + 12}" y="${y + designHeight / 2 + 8}" fill="${dim}" font-family="Arial,sans-serif" font-size="26" font-weight="bold" text-anchor="start">${fixed0(heightIn)} in</text>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${cw}" height="${ch}" viewBox="0 0 ${cw} ${ch}"><rect width="${cw}" height="${ch}" fill="white"/><rect x="${ml}" y="${mt}" width="${designWidth}" height="${designHeight}" fill="#fbfaf6" stroke="#000" stroke-width="3" rx="14"/>${art.join("")}${lines}</svg>`;
  return svgDataUrl(svg);
}

// ---------------------------------------------------------------- main
export type NeonResult = {
  file: string;
  pages: { page: number; width_in: number; height_in: number; width_pt: number; height_pt: number }[];
  path_count_all: number;
  path_count_neon: number;
  measurement_scale: number;
  content_bbox_in: BboxIn | null;
  clipping_bbox_in: BboxIn | null;
  design_image_bbox_in: BboxIn | null;
  all_stroked_bbox_in: BboxIn | null;
  total_length_m_all_stroked_paths: number;
  total_length_m_neon: number;
  by_color: ColorRow[];
  artboards: NeonArtboard[];
  dimension_preview_url: string | null;
  line_preview_url: string | null;
};
type NeonDesign = {
  name: string;
  page: number;
  design: number;
  content_bbox_in: BboxIn | null;
  total_length_m_neon: number;
  path_count_neon: number;
  by_color: ColorRow[];
  dimension_preview_url: string | null;
  line_preview_url: string | null;
};
type NeonArtboard = {
  name: string;
  page: number;
  page_size_in: { width_in: number; height_in: number };
  content_bbox_in: BboxIn | null;
  clipping_bbox_in: BboxIn | null;
  design_image_bbox_in: BboxIn | null;
  total_length_m_neon: number;
  path_count_neon: number;
  by_color: ColorRow[];
  designs: NeonDesign[];
  dimension_preview_url: string | null;
  line_preview_url: string | null;
};

export async function analyzeNeon(bytes: Uint8Array, fileName: string, measurementScale = 1.0): Promise<NeonResult> {
  const scale = measurementScale || 1.0;
  const extracted = await extractPdf(bytes);
  const analyzer = new PdfPathAnalyzer();
  const pages = extracted.map((p) => {
    analyzer.parseStream(p.content, p.page - 1, p.imageNames);
    return {
      page: p.page,
      width_in: (p.widthPt / POINTS_PER_INCH) * scale,
      height_in: (p.heightPt / POINTS_PER_INCH) * scale,
      width_pt: p.widthPt,
      height_pt: p.heightPt,
    };
  });

  const totalPtAll = analyzer.strokes.reduce((a, s) => a + s.lengthPt, 0);
  const neonStrokes = analyzer.strokes.filter((s) => isNeonColor(s.color));
  const totalPtNeon = neonStrokes.reduce((a, s) => a + s.lengthPt, 0);
  const imageBbox = unionBbox(analyzer.images);
  const clipBbox = chooseClipBbox(analyzer.clips, imageBbox);
  const contentBbox = clipBbox || imageBbox || unionBbox(neonStrokes);
  const allStrokedBbox = unionBbox(analyzer.strokes);

  const artboards: NeonArtboard[] = [];
  for (const page of pages) {
    const pageNumber = page.page;
    const pageStrokes = analyzer.strokes.filter((s) => s.page === pageNumber);
    const pageNeon = pageStrokes.filter((s) => isNeonColor(s.color));
    const pageImages = analyzer.images.filter((i) => i.page === pageNumber);
    const pageClips = analyzer.clips.filter((c) => c.page === pageNumber);
    const pageImageBbox = unionBbox(pageImages);
    const pageClipBbox = chooseClipBbox(pageClips, pageImageBbox);
    const pageContentBbox = pageClipBbox || pageImageBbox || unionBbox(pageNeon);
    if (pageContentBbox === null && pageNeon.length === 0) continue;
    const designBboxes = designBboxesForPage(pageClips, pageImages, pageNeon, [page.width_pt, page.height_pt]);
    const designs: NeonDesign[] = [];
    designBboxes.forEach((designBbox, idx) => {
      const designIndex = idx + 1;
      const designStrokes = strokesForBbox(pageStrokes, designBbox);
      const designNeon = designStrokes.filter((s) => isNeonColor(s.color));
      designs.push({
        name: `Design ${designIndex}`,
        page: pageNumber,
        design: designIndex,
        content_bbox_in: bboxToInches(designBbox, scale),
        total_length_m_neon: designNeon.reduce((a, s) => a + s.lengthPt, 0) * METERS_PER_POINT * scale,
        path_count_neon: designNeon.length,
        by_color: summarizeNeonColors(designStrokes, scale),
        dimension_preview_url: buildDimensionPreview(designStrokes, designBbox, scale),
        line_preview_url: buildLinePreview(designStrokes, designBbox),
      });
    });
    const single = designs.length <= 1;
    artboards.push({
      name: `Artboard ${pageNumber}`,
      page: pageNumber,
      page_size_in: { width_in: page.width_in, height_in: page.height_in },
      content_bbox_in: bboxToInches(pageContentBbox, scale),
      clipping_bbox_in: bboxToInches(pageClipBbox, scale),
      design_image_bbox_in: bboxToInches(pageImageBbox, scale),
      total_length_m_neon: pageNeon.reduce((a, s) => a + s.lengthPt, 0) * METERS_PER_POINT * scale,
      path_count_neon: pageNeon.length,
      by_color: summarizeNeonColors(pageStrokes, scale),
      designs,
      dimension_preview_url: single ? buildDimensionPreview(pageStrokes, pageContentBbox, scale) : null,
      line_preview_url: single ? buildLinePreview(pageStrokes, pageContentBbox) : null,
    });
  }

  return {
    file: fileName,
    pages,
    path_count_all: analyzer.strokes.length,
    path_count_neon: neonStrokes.length,
    measurement_scale: scale,
    content_bbox_in: bboxToInches(contentBbox, scale),
    clipping_bbox_in: bboxToInches(clipBbox, scale),
    design_image_bbox_in: bboxToInches(imageBbox, scale),
    all_stroked_bbox_in: bboxToInches(allStrokedBbox, scale),
    total_length_m_all_stroked_paths: totalPtAll * METERS_PER_POINT * scale,
    total_length_m_neon: totalPtNeon * METERS_PER_POINT * scale,
    by_color: summarizeNeonColors(analyzer.strokes, scale),
    artboards,
    dimension_preview_url: buildDimensionPreview(analyzer.strokes, contentBbox, scale),
    line_preview_url: buildLinePreview(analyzer.strokes, contentBbox),
  };
}
