// Auto-nesting / imposition: take an artwork file with scattered pieces, detect
// each piece, pack them tightly onto sheets (default 48"×96"), and emit a new PDF
// that opens already laid-out.
//
// Two extraction modes:
//  • VECTOR (preferred) — parse each object's own paths out of the content stream
//    and re-emit them FLAT at the packed position. Every piece is an independent
//    vector object (no clipping mask, nothing hidden behind it), so in Illustrator
//    you can move/delete each one directly — no ungroup / release-clip needed.
//  • RASTER (fallback, for flattened/image art or spot colours) — clip each piece
//    out of the source page with pdf-lib embedPage and re-place it.
import {
  PDFDocument, PDFName, degrees, StandardFonts,
  pushGraphicsState, popGraphicsState, moveTo, lineTo, closePath, clip, endPath,
} from "pdf-lib";
import { extractPdf } from "@/lib/pdf/extract";
import { renderPageRgb } from "@/lib/pdf/pdfium";
import { PNG } from "pngjs";
import { packBest, type NestRect, type PackResult, type PackCaps } from "@/lib/nest/pack";
import { parseVectorUnits, groupUnits, emitUnit, compose, type VUnit, type VGroup, type Mat } from "@/lib/nest/vector";
import { computePieceHoles, mmToPt, type Hole, type ScrewLevel } from "@/lib/nest/holes";
import { rgb } from "pdf-lib";

const PT = 72;
const DET_TARGET = 1800;

// Drill-hole mark colours (wire = red, screw = cyan) and line weight.
const WIRE_RGB: [number, number, number] = [0.9, 0.1, 0.1];
const SCREW_RGB: [number, number, number] = [0, 0.68, 0.74];
const HOLE_LW = 0.75;
const LEGEND_L1 = "Red circle = 5mm wire hole (power outlet)";
const LEGEND_L2 = "Cyan circle = 3mm screw hole (mounting)";

export type NestOptions = {
  sheetWIn?: number; sheetHIn?: number; gapIn?: number;
  allowRotate?: boolean; minPieceIn?: number; trim?: boolean;
  drillHoles?: boolean; wireDiaMm?: number; screwDiaMm?: number; screwLevel?: ScrewLevel;
  maxPerSheet?: number; fillTarget?: number; // density caps (3D-printer Slow/Medium/Fast)
  measurePerimeter?: boolean; // include each piece's outline length (3D print-time estimate)
  balanceByTime?: number; printHeightMm?: number; // pack plates to ≤ (mult × slowest piece) print time
  vectorFormats?: boolean; // also emit SVG + DXF per sheet (vector artwork only)
  measurementScale?: number; // artwork drawn N× smaller (e.g. 10 for a 1:10 file) → scale up N× before nesting
};

// 3D print-time model (must match the frontend estimate): outline only, layer
// 0.3 mm, head speed 25 mm/s for pieces < 6″, 50 mm/s otherwise.
const PRINT_LAYER_MM = 0.3;
function pieceSecondsFor(perimeterIn: number, wIn: number, hIn: number, heightMm: number): number {
  const speed = Math.max(wIn, hIn) < 6 ? 25 : 50;
  return (heightMm / PRINT_LAYER_MM) * (perimeterIn * 25.4) / speed;
}

/** A vector unit's outline as flattened polylines (beziers sampled), in target
 *  coords via matrix M — used to emit the same shapes as SVG / DXF. */
function unitPolylines(u: VUnit, T: Mat): number[][][] {
  const M = compose(u.ctm, T);
  const tx = (x: number, y: number): [number, number] => [M[0] * x + M[2] * y + M[4], M[1] * x + M[3] * y + M[5]];
  const toks = u.path.split(/\s+/).filter(Boolean);
  const nums: number[] = [];
  const subs: number[][][] = [];
  let cur: number[][] | null = null;
  let sx = 0, sy = 0, cx = 0, cy = 0;
  const push = (x: number, y: number) => { cur!.push(tx(x, y)); cx = x; cy = y; };
  const cubic = (x1: number, y1: number, x2: number, y2: number, x3: number, y3: number) => {
    const N = 16;
    for (let s = 1; s <= N; s++) {
      const t = s / N, mt = 1 - t;
      const bx = mt * mt * mt * cx + 3 * mt * mt * t * x1 + 3 * mt * t * t * x2 + t * t * t * x3;
      const by = mt * mt * mt * cy + 3 * mt * mt * t * y1 + 3 * mt * t * t * y2 + t * t * t * y3;
      cur!.push(tx(bx, by));
    }
    cx = x3; cy = y3;
  };
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    if (/^[-+.\d]/.test(t)) { nums.push(parseFloat(t)); continue; }
    switch (t) {
      case "m": cur = []; subs.push(cur); sx = nums[0]; sy = nums[1]; push(nums[0], nums[1]); break;
      case "l": if (cur) push(nums[0], nums[1]); break;
      case "c": if (cur) cubic(nums[0], nums[1], nums[2], nums[3], nums[4], nums[5]); break;
      case "v": if (cur) cubic(cx, cy, nums[0], nums[1], nums[2], nums[3]); break;
      case "y": if (cur) cubic(nums[0], nums[1], nums[2], nums[3], nums[2], nums[3]); break;
      case "re": { const x = nums[0], y = nums[1], w = nums[2], h = nums[3]; cur = []; subs.push(cur); push(x, y); push(x + w, y); push(x + w, y + h); push(x, y + h); push(x, y); break; }
      case "h": if (cur) push(sx, sy); break;
    }
    nums.length = 0;
  }
  return subs.filter((s) => s.length > 1);
}

/** The (unit, placement-matrix) pairs placed on one sheet/bin. */
function placedUnits(groups: VGroup[], packed: PackResult, bin: number): { u: VUnit; T: Mat }[] {
  const out: { u: VUnit; T: Mat }[] = [];
  for (const pl of packed.placements) {
    if (pl.bin !== bin) continue;
    const g = groups[pl.id];
    const tx = pl.x * PT, ty = pl.y * PT;
    const T: Mat = !pl.rotated ? [1, 0, 0, 1, tx - g.x0, ty - g.y0] : [0, 1, -1, 0, tx + g.y1, ty - g.x0];
    for (const u of g.units) out.push({ u, T });
  }
  return out;
}

const f3 = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(3));

/** One sheet's placed shapes as an SVG (points; y flipped to SVG's top-left origin). */
function sheetSvg(placed: { u: VUnit; T: Mat }[], wPt: number, hPt: number): string {
  let paths = "";
  for (const { u, T } of placed) {
    const subs = unitPolylines(u, T);
    if (!subs.length) continue;
    let d = "";
    for (const sub of subs) d += "M" + sub.map(([x, y], i) => `${i === 0 ? "" : "L"}${f3(x)} ${f3(hPt - y)}`).join(" ") + "Z";
    paths += `<path d="${d}" fill="#000" fill-rule="evenodd"/>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${f3(wPt)}pt" height="${f3(hPt)}pt" viewBox="0 0 ${f3(wPt)} ${f3(hPt)}">${paths}</svg>`;
}

/** One sheet's placed shapes as a DXF (LWPOLYLINEs, millimetres, y up). */
function sheetDxf(placed: { u: VUnit; T: Mat }[]): string {
  const MM = 25.4 / PT; // points → mm
  let ents = "";
  for (const { u, T } of placed) {
    for (const sub of unitPolylines(u, T)) {
      ents += `0\nLWPOLYLINE\n8\nCUT\n90\n${sub.length}\n70\n1\n43\n0\n`;
      for (const [x, y] of sub) ents += `10\n${(x * MM).toFixed(3)}\n20\n${(y * MM).toFixed(3)}\n`;
    }
  }
  return `0\nSECTION\n2\nHEADER\n9\n$INSUNITS\n70\n4\n0\nENDSEC\n0\nSECTION\n2\nENTITIES\n${ents}0\nENDSEC\n0\nEOF\n`;
}

/** Total length (points) of a vector unit's outline path, following its CTM. */
function unitPerimeterPt(u: VUnit): number {
  const M = u.ctm;
  const tx = (x: number, y: number): [number, number] => [M[0] * x + M[2] * y + M[4], M[1] * x + M[3] * y + M[5]];
  const toks = u.path.split(/\s+/).filter(Boolean);
  const nums: number[] = [];
  let curX = 0, curY = 0, startX = 0, startY = 0, px = 0, py = 0, len = 0;
  const setCur = (x: number, y: number) => { curX = x; curY = y; [px, py] = tx(x, y); };
  const lineTo = (x: number, y: number) => { const [nx, ny] = tx(x, y); len += Math.hypot(nx - px, ny - py); px = nx; py = ny; curX = x; curY = y; };
  const cubic = (x1: number, y1: number, x2: number, y2: number, x3: number, y3: number) => {
    const N = 8; let ppx = px, ppy = py;
    for (let s = 1; s <= N; s++) {
      const t = s / N, mt = 1 - t;
      const bx = mt * mt * mt * curX + 3 * mt * mt * t * x1 + 3 * mt * t * t * x2 + t * t * t * x3;
      const by = mt * mt * mt * curY + 3 * mt * mt * t * y1 + 3 * mt * t * t * y2 + t * t * t * y3;
      const [nx, ny] = tx(bx, by); len += Math.hypot(nx - ppx, ny - ppy); ppx = nx; ppy = ny;
    }
    px = ppx; py = ppy; curX = x3; curY = y3;
  };
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    if (/^[-+.\d]/.test(t)) { nums.push(parseFloat(t)); continue; }
    switch (t) {
      case "m": setCur(nums[0], nums[1]); startX = nums[0]; startY = nums[1]; break;
      case "l": lineTo(nums[0], nums[1]); break;
      case "c": cubic(nums[0], nums[1], nums[2], nums[3], nums[4], nums[5]); break;
      case "v": cubic(curX, curY, nums[0], nums[1], nums[2], nums[3]); break;
      case "y": cubic(nums[0], nums[1], nums[2], nums[3], nums[2], nums[3]); break;
      case "re": { const x = nums[0], y = nums[1], w = nums[2], h = nums[3]; setCur(x, y); lineTo(x + w, y); lineTo(x + w, y + h); lineTo(x, y + h); lineTo(x, y); break; }
      case "h": lineTo(startX, startY); break;
    }
    nums.length = 0;
  }
  return len;
}

type PageMask = { mask: Uint8Array; w: number; h: number; cbx: number; cby: number; cbh: number; S: number };

/** Render a source page to a 1-bit ink mask for hole placement. */
async function renderPageMask(bytes: Uint8Array, pi: number, cb: { x: number; y: number; width: number; height: number }): Promise<PageMask | null> {
  const S = Math.min(0.5, Math.max(0.05, 1600 / Math.max(cb.width, cb.height)));
  const page = await renderPageRgb(bytes, pi, S);
  if (!page) return null;
  const { width: w, height: h, rgb: px } = page;
  const mask = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) if (px[i * 3] < 128) mask[i] = 1;
  return { mask, w, h, cbx: cb.x, cby: cb.y, cbh: cb.height, S };
}

/** Holes (LOCAL points from the piece bbox bottom-left) for one piece's page bbox. */
function holesForPieceBox(pm: PageMask, x0: number, y0: number, x1: number, y1: number, wireDiaPt: number, screwDiaPt: number, level: ScrewLevel): Hole[] {
  const ix0 = Math.max(0, Math.floor((x0 - pm.cbx) * pm.S));
  const ix1 = Math.min(pm.w, Math.ceil((x1 - pm.cbx) * pm.S));
  const iyTop = Math.max(0, Math.floor((pm.cby + pm.cbh - y1) * pm.S));
  const iyBot = Math.min(pm.h, Math.ceil((pm.cby + pm.cbh - y0) * pm.S));
  const sw = ix1 - ix0, sh = iyBot - iyTop;
  if (sw <= 0 || sh <= 0) return [];
  const sub = new Uint8Array(sw * sh);
  for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) sub[y * sw + x] = pm.mask[(iyTop + y) * pm.w + (ix0 + x)];
  return computePieceHoles(sub, sw, sh, pm.S, wireDiaPt, screwDiaPt, level);
}

/** Sheet-space centre (points) of a hole, given how its piece was placed. */
function holeCentre(pl: PackResult["placements"][number], hole: Hole): { cx: number; cy: number } {
  if (!pl.rotated) return { cx: pl.x * PT + hole.lx, cy: pl.y * PT + hole.ly };
  return { cx: pl.x * PT + pl.w * PT - hole.ly, cy: pl.y * PT + hole.lx };
}

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(3));

/** A white-filled circle (looks like a real hole, visible on any letter colour)
 *  with a coloured outline + centre cross, as PDF content-stream ops. */
function circleOps(cx: number, cy: number, r: number, col: [number, number, number]): string {
  const k = 0.5522847498 * r;
  const [R, G, B] = col;
  const c = Math.min(r * 0.6, 2.2); // centre cross half-length
  return (
    `q 1 1 1 rg ${R} ${G} ${B} RG ${HOLE_LW} w\n` +
    `${fmt(cx + r)} ${fmt(cy)} m\n` +
    `${fmt(cx + r)} ${fmt(cy + k)} ${fmt(cx + k)} ${fmt(cy + r)} ${fmt(cx)} ${fmt(cy + r)} c\n` +
    `${fmt(cx - k)} ${fmt(cy + r)} ${fmt(cx - r)} ${fmt(cy + k)} ${fmt(cx - r)} ${fmt(cy)} c\n` +
    `${fmt(cx - r)} ${fmt(cy - k)} ${fmt(cx - k)} ${fmt(cy - r)} ${fmt(cx)} ${fmt(cy - r)} c\n` +
    `${fmt(cx + k)} ${fmt(cy - r)} ${fmt(cx + r)} ${fmt(cy - k)} ${fmt(cx + r)} ${fmt(cy)} c\nB\n` +
    `${fmt(cx - c)} ${fmt(cy)} m ${fmt(cx + c)} ${fmt(cy)} l S\n` +
    `${fmt(cx)} ${fmt(cy - c)} m ${fmt(cx)} ${fmt(cy + c)} l S\nQ\n`
  );
}

const pdfStr = (t: string) => t.replace(/([()\\])/g, "\\$1");

/** Legend text ops (needs an /F1 Helvetica in page Resources), top-left corner. */
function legendOps(h: number): string {
  const [wr, wg, wb] = WIRE_RGB;
  const [sr, sg, sb] = SCREW_RGB;
  return (
    `BT /F1 9 Tf ${wr} ${wg} ${wb} rg 6 ${fmt(h - 12)} Td (${pdfStr(LEGEND_L1)}) Tj ET\n` +
    `BT /F1 9 Tf ${sr} ${sg} ${sb} rg 6 ${fmt(h - 24)} Td (${pdfStr(LEGEND_L2)}) Tj ET\n`
  );
}
export type NestSheet = {
  index: number; usedWIn: number; usedHIn: number; pieceCount: number; utilPct: number;
  previewDataUrl: string;
  pdfBase64: string; // this sheet as its OWN single-page PDF
  svg?: string;      // same sheet as SVG (vector artwork only)
  dxf?: string;      // same sheet as DXF for AutoCAD / routers (vector only)
  outName: string;   // download filename (named by the used size)
};
export type NestResult = {
  file: string; mode: "vector" | "raster";
  sheetWIn: number; sheetHIn: number; gapIn: number; rotated: boolean;
  totalPieces: number; placedPieces: number; unplaced: number;
  sheets: NestSheet[]; warnings: string[];
  // Per placed piece (for the 3D print-time estimate): which plate, size, outline length.
  pieces?: { bin: number; wIn: number; hIn: number; perimeterIn: number }[];
};

type Box = { minX: number; minY: number; maxX: number; maxY: number };
type Clip = { left: number; bottom: number; right: number; top: number };
type ClipPiece = { clip: Clip; wIn: number; hIn: number; page: number };

/** 4-connected components of the ink mask, as pixel bounding boxes ≥ minPx area. */
function componentBoxes(ink: Uint8Array, w: number, h: number, minPx: number): Box[] {
  const label = new Int32Array(w * h);
  const boxes: Box[] = [];
  const stack: number[] = [];
  let cur = 0;
  for (let i = 0; i < w * h; i++) {
    if (!ink[i] || label[i]) continue;
    cur++;
    let minX = w, minY = h, maxX = 0, maxY = 0, area = 0;
    stack.length = 0; stack.push(i); label[i] = cur;
    while (stack.length) {
      const p = stack.pop() as number;
      const x = p % w, y = (p / w) | 0;
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
      area++;
      if (x > 0 && ink[p - 1] && !label[p - 1]) { label[p - 1] = cur; stack.push(p - 1); }
      if (x < w - 1 && ink[p + 1] && !label[p + 1]) { label[p + 1] = cur; stack.push(p + 1); }
      if (y > 0 && ink[p - w] && !label[p - w]) { label[p - w] = cur; stack.push(p - w); }
      if (y < h - 1 && ink[p + w] && !label[p + w]) { label[p + w] = cur; stack.push(p + w); }
    }
    if (area >= minPx) boxes.push({ minX, minY, maxX, maxY });
  }
  return boxes;
}

/** Merge components whose bounding boxes overlap (a rectangular clip captures its
 *  whole rectangle, so overlapping-bbox pieces must be one nesting unit). */
function mergeOverlappingBoxes(boxes: Box[]): Box[] {
  const parent = boxes.map((_, i) => i);
  const find = (x: number): number => (parent[x] === x ? x : (parent[x] = find(parent[x])));
  const overlap = (a: Box, b: Box) =>
    Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX) > 0 && Math.min(a.maxY, b.maxY) - Math.max(a.minY, b.minY) > 0;
  let changed = true;
  while (changed) {
    changed = false;
    const groups = new Map<number, Box>();
    for (let i = 0; i < boxes.length; i++) {
      const r = find(i), g = groups.get(r);
      if (!g) groups.set(r, { ...boxes[i] });
      else { g.minX = Math.min(g.minX, boxes[i].minX); g.minY = Math.min(g.minY, boxes[i].minY); g.maxX = Math.max(g.maxX, boxes[i].maxX); g.maxY = Math.max(g.maxY, boxes[i].maxY); }
    }
    const reps = [...groups.entries()];
    for (let a = 0; a < reps.length; a++) for (let b = a + 1; b < reps.length; b++) {
      if (find(reps[a][0]) === find(reps[b][0])) continue;
      if (overlap(reps[a][1], reps[b][1])) { parent[find(reps[a][0])] = find(reps[b][0]); changed = true; }
    }
  }
  const out = new Map<number, Box>();
  for (let i = 0; i < boxes.length; i++) {
    const r = find(i), g = out.get(r);
    if (!g) out.set(r, { ...boxes[i] });
    else { g.minX = Math.min(g.minX, boxes[i].minX); g.minY = Math.min(g.minY, boxes[i].minY); g.maxX = Math.max(g.maxX, boxes[i].maxX); g.maxY = Math.max(g.maxY, boxes[i].maxY); }
  }
  return [...out.values()];
}

async function renderPreview(bytes: Uint8Array, pageIndex: number, targetPx: number): Promise<string> {
  const meta = await extractPdf(bytes);
  const pg = meta[pageIndex];
  const longPt = Math.max(pg.widthPt, pg.heightPt);
  const scale = Math.min(2, Math.max(0.05, (targetPx / longPt) * PT));
  const r = await renderPageRgb(bytes, pageIndex, scale);
  if (!r) return "";
  const { width: w, height: h, rgbColor } = r;
  const step = Math.max(1, Math.ceil(Math.max(w, h) / targetPx));
  const pw = Math.ceil(w / step), ph = Math.ceil(h / step);
  const png = new PNG({ width: pw, height: ph });
  png.data.fill(255);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const k = (y * w + x) * 3, j = (((y / step) | 0) * pw + ((x / step) | 0)) * 4;
    png.data[j] = rgbColor[k]; png.data[j + 1] = rgbColor[k + 1]; png.data[j + 2] = rgbColor[k + 2]; png.data[j + 3] = 255;
  }
  return `data:image/png;base64,${PNG.sync.write(png).toString("base64")}`;
}

/** Flat vector output — ONE single-page PDF per sheet (bin). */
async function buildVectorSheets(groups: VGroup[], packed: PackResult, sheetWIn: number, sheetHIn: number, trim: boolean, holesById?: Hole[][], drawLegend?: boolean): Promise<Uint8Array[]> {
  const out: Uint8Array[] = [];
  for (let i = 0; i < packed.bins.length; i++) {
    let content = "";
    for (const pl of packed.placements) {
      if (pl.bin !== i) continue;
      const g = groups[pl.id];
      const tx = pl.x * PT, ty = pl.y * PT;
      const T: Mat = !pl.rotated
        ? [1, 0, 0, 1, tx - g.x0, ty - g.y0]
        : [0, 1, -1, 0, tx + g.y1, ty - g.x0];
      for (const u of g.units) content += emitUnit(u, T);
      for (const hole of holesById?.[pl.id] ?? []) {
        const { cx, cy } = holeCentre(pl, hole);
        content += circleOps(cx, cy, hole.d / 2, hole.kind === "wire" ? WIRE_RGB : SCREW_RGB);
      }
    }
    const doc = await PDFDocument.create();
    const w = (trim ? Math.min(sheetWIn, packed.bins[i].usedW) : sheetWIn) * PT;
    const h = (trim ? Math.min(sheetHIn, packed.bins[i].usedH) : sheetHIn) * PT;
    const page = doc.addPage([w, h]);
    if (drawLegend) {
      const helv = await doc.embedFont(StandardFonts.Helvetica);
      content += legendOps(h);
      page.node.set(PDFName.of("Resources"), doc.context.obj({ Font: doc.context.obj({ F1: helv.ref }) }));
    }
    page.node.set(PDFName.of("Contents"), doc.context.register(doc.context.stream(content || " ")));
    out.push(await doc.save());
  }
  return out;
}

/** Raster output — ONE single-page PDF per sheet (bin). */
async function buildRasterSheets(src: PDFDocument, pieces: ClipPiece[], packed: PackResult, sheetWIn: number, sheetHIn: number, trim: boolean, holesById?: Hole[][], drawLegend?: boolean): Promise<Uint8Array[]> {
  const out: Uint8Array[] = [];
  for (let i = 0; i < packed.bins.length; i++) {
    const doc = await PDFDocument.create();
    const w = (trim ? Math.min(sheetWIn, packed.bins[i].usedW) : sheetWIn) * PT;
    const h = (trim ? Math.min(sheetHIn, packed.bins[i].usedH) : sheetHIn) * PT;
    const page = doc.addPage([w, h]);
    // Embed each SOURCE page only ONCE (pdf-lib copies the page's image/resources
    // into every embedPage call — embedding per piece duplicates the artwork's big
    // rasters N times and can balloon the output to hundreds of MB, overflowing the
    // base64 string). We then place each piece by drawing the shared embedded page
    // through a CLIP rectangle = the piece's box on the sheet.
    const embCache = new Map<number, Awaited<ReturnType<typeof doc.embedPage>>>();
    const getEmbed = async (p: number) => {
      let e = embCache.get(p);
      if (!e) { e = await doc.embedPage(src.getPage(p)); embCache.set(p, e); }
      return e;
    };
    for (const pl of packed.placements) {
      if (pl.bin !== i) continue;
      const pc = pieces[pl.id];
      const embedded = await getEmbed(pc.page);
      const X = pl.x * PT, Y = pl.y * PT, W = pl.w * PT, H = pl.h * PT;
      const { left, bottom } = pc.clip;
      // Clip the sheet to this piece's placed box, then draw the whole (shared) page
      // offset so the piece's source region lands inside that box.
      page.pushOperators(
        pushGraphicsState(),
        moveTo(X, Y), lineTo(X + W, Y), lineTo(X + W, Y + H), lineTo(X, Y + H), closePath(),
        clip(), endPath(),
      );
      if (!pl.rotated) page.drawPage(embedded, { x: X - left, y: Y - bottom });
      else page.drawPage(embedded, { x: X + W + bottom, y: Y - left, rotate: degrees(90) });
      page.pushOperators(popGraphicsState());
    }
    for (const pl of packed.placements) {
      if (pl.bin !== i) continue;
      for (const hole of holesById?.[pl.id] ?? []) {
        const { cx, cy } = holeCentre(pl, hole);
        const col = hole.kind === "wire" ? WIRE_RGB : SCREW_RGB;
        const border = rgb(col[0], col[1], col[2]);
        page.drawEllipse({ x: cx, y: cy, xScale: hole.d / 2, yScale: hole.d / 2, color: rgb(1, 1, 1), borderColor: border, borderWidth: HOLE_LW });
        page.drawLine({ start: { x: cx - 2, y: cy }, end: { x: cx + 2, y: cy }, color: border, thickness: HOLE_LW });
        page.drawLine({ start: { x: cx, y: cy - 2 }, end: { x: cx, y: cy + 2 }, color: border, thickness: HOLE_LW });
      }
    }
    if (drawLegend) {
      const helv = await doc.embedFont(StandardFonts.Helvetica);
      page.drawText(LEGEND_L1, { x: 6, y: h - 12, size: 9, font: helv, color: rgb(WIRE_RGB[0], WIRE_RGB[1], WIRE_RGB[2]) });
      page.drawText(LEGEND_L2, { x: 6, y: h - 24, size: 9, font: helv, color: rgb(SCREW_RGB[0], SCREW_RGB[1], SCREW_RGB[2]) });
    }
    out.push(await doc.save());
  }
  return out;
}

export async function analyzeNesting(bytes: Uint8Array, fileName: string, opts: NestOptions = {}): Promise<NestResult> {
  const sheetWIn = opts.sheetWIn ?? 48;
  const sheetHIn = opts.sheetHIn ?? 96;
  const gapIn = Math.max(0, opts.gapIn ?? 0.25);
  const allowRotate = opts.allowRotate ?? true;
  const minPieceIn = opts.minPieceIn ?? 0.4;
  const trim = opts.trim ?? true;
  const drillHoles = opts.drillHoles ?? false;
  const wireDiaPt = mmToPt(opts.wireDiaMm ?? 5);
  const screwDiaPt = mmToPt(opts.screwDiaMm ?? 3);
  const screwLevel: ScrewLevel = opts.screwLevel === "medium" ? "medium" : "strong";

  // Measurement scale: when the artwork was drawn N× smaller (e.g. a 1:10 file),
  // scale the whole PDF up N× ONCE here so every downstream step — piece detection,
  // packing, the laid-out output and drill holes — works in real-world size with no
  // other changes. pdf-lib's page.scale() scales the media box AND the content.
  const mScale = opts.measurementScale && opts.measurementScale > 0 ? opts.measurementScale : 1;
  if (mScale !== 1) {
    const doc = await PDFDocument.load(bytes);
    for (const p of doc.getPages()) p.scale(mScale, mScale);
    bytes = await doc.save();
  }

  const src = await PDFDocument.load(bytes);
  const nPages = src.getPageCount();
  if (!nPages) throw new Error("Could not read the artwork.");
  const meta = await extractPdf(bytes);
  const warnings: string[] = [];
  for (let pi = 0; pi < nPages; pi++) {
    const rot = (((src.getPage(pi).getRotation().angle || 0) % 360) + 360) % 360;
    if (rot !== 0) warnings.push(`Page ${pi + 1} is rotated ${rot}° in the file — its pieces may come out misaligned. Please un-rotate the source page and re-upload.`);
  }

  // ---- Try VECTOR extraction (all pages) ----
  const vunits: VUnit[] = [];
  let vectorOk = true;
  for (const pg of meta) {
    const { units, unsupported } = parseVectorUnits(pg.content);
    if (unsupported) { vectorOk = false; break; }
    vunits.push(...units);
  }
  const groups = groupUnits(vunits);
  const minAreaIn2 = minPieceIn * minPieceIn * 0.4;
  const bigGroups = groups.filter((g) => (g.x1 - g.x0) / PT * ((g.y1 - g.y0) / PT) >= minAreaIn2);
  const useVector = vectorOk && bigGroups.length > 0;

  let sizes: { wIn: number; hIn: number }[];
  let clipPieces: ClipPiece[] = [];

  if (useVector) {
    sizes = bigGroups.map((g) => ({ wIn: (g.x1 - g.x0) / PT, hIn: (g.y1 - g.y0) / PT }));
  } else {
    // Raster detection: render each page, threshold ink, connected components.
    for (let pi = 0; pi < nPages; pi++) {
      const sp = src.getPage(pi);
      const cb = sp.getCropBox();
      const detScale = Math.min(0.35, DET_TARGET / Math.max(cb.width, cb.height));
      const page = await renderPageRgb(bytes, pi, detScale);
      if (!page) continue;
      const { width: w, height: h, rgb } = page;
      const ink = new Uint8Array(w * h);
      for (let i = 0; i < w * h; i++) if (rgb[i * 3] < 128) ink[i] = 1;
      const minPx = Math.max(6, Math.round((minPieceIn * detScale * PT) ** 2 * 0.2));
      const boxes = mergeOverlappingBoxes(componentBoxes(ink, w, h, minPx));
      for (const bx of boxes) {
        const left = cb.x + bx.minX / detScale, right = cb.x + (bx.maxX + 1) / detScale;
        const top = cb.y + cb.height - bx.minY / detScale, bottom = cb.y + cb.height - (bx.maxY + 1) / detScale;
        clipPieces.push({ clip: { left, bottom, right, top }, wIn: (right - left) / PT, hIn: (top - bottom) / PT, page: pi });
      }
    }
    sizes = clipPieces.map((p) => ({ wIn: p.wIn, hIn: p.hIn }));
  }
  if (!sizes.length) throw new Error("No pieces were detected in this artwork.");

  const rects: NestRect[] = sizes.map((s, id) => ({ id, w: s.wIn, h: s.hIn }));

  // Outline length per piece (needed for the print-time estimate and, in the
  // time-balanced modes, to decide which pieces share a plate).
  const needPerim = opts.measurePerimeter || !!opts.balanceByTime;
  const perimById = new Map<number, number>();
  if (needPerim) {
    if (useVector) bigGroups.forEach((g, id) => { let pt = 0; for (const u of g.units) pt += unitPerimeterPt(u); perimById.set(id, pt / PT); });
    else clipPieces.forEach((p, id) => perimById.set(id, 2 * (p.wIn + p.hIn)));
  }

  let caps: PackCaps | undefined;
  if (opts.balanceByTime && needPerim) {
    // Time-balanced: fill each plate up to (mult × the slowest single piece).
    const heightMm = opts.printHeightMm ?? 50;
    const pieceTime = sizes.map((s, id) =>
      pieceSecondsFor(perimById.get(id) ?? 2 * (s.wIn + s.hIn), s.wIn, s.hIn, heightMm)
    );
    const timeCap = Math.max(...pieceTime, 1) * opts.balanceByTime;
    caps = { pieceTime, timeCap };
  } else if (opts.maxPerSheet || opts.fillTarget) {
    caps = { maxPerBin: opts.maxPerSheet, maxFill: opts.fillTarget };
  }
  const packed = packBest(rects, sheetWIn, sheetHIn, gapIn, allowRotate, caps);

  // Optional: place a 5 mm wire hole + system-chosen 3 mm screw holes per piece.
  let holesById: Hole[][] | undefined;
  if (drillHoles) {
    holesById = [];
    try {
      if (useVector) {
        const cb = src.getPage(0).getCropBox();
        const pm = await renderPageMask(bytes, 0, cb);
        holesById = bigGroups.map((g) => (pm ? holesForPieceBox(pm, g.x0, g.y0, g.x1, g.y1, wireDiaPt, screwDiaPt, screwLevel) : []));
      } else {
        const masks = new Map<number, PageMask | null>();
        holesById = [];
        for (const pc of clipPieces) {
          if (!masks.has(pc.page)) masks.set(pc.page, await renderPageMask(bytes, pc.page, src.getPage(pc.page).getCropBox()));
          const pm = masks.get(pc.page) ?? null;
          holesById.push(pm ? holesForPieceBox(pm, pc.clip.left, pc.clip.bottom, pc.clip.right, pc.clip.top, wireDiaPt, screwDiaPt, screwLevel) : []);
        }
      }
    } catch {
      holesById = undefined; // holes are best-effort; never fail the whole nest
      warnings.push("Could not place drill holes for this artwork — the layout is fine, just without hole marks.");
    }
  }

  const drawLegend = drillHoles && !!holesById;
  const sheetPdfs = useVector
    ? await buildVectorSheets(bigGroups, packed, sheetWIn, sheetHIn, trim, holesById, drawLegend)
    : await buildRasterSheets(src, clipPieces, packed, sheetWIn, sheetHIn, trim, holesById, drawLegend);

  // Per-sheet previews, utilisation, and a separate PDF each (named by used size).
  const base = fileName.replace(/\.[^.]+$/, "");
  const areaByBin = new Map<number, number>();
  for (const pl of packed.placements) areaByBin.set(pl.bin, (areaByBin.get(pl.bin) ?? 0) + pl.w * pl.h);
  const wantVecFmt = !!opts.vectorFormats && useVector;
  const sheets: NestSheet[] = [];
  for (let i = 0; i < packed.bins.length; i++) {
    const usedWIn = +Math.min(sheetWIn, packed.bins[i].usedW).toFixed(1);
    const usedHIn = +Math.min(sheetHIn, packed.bins[i].usedH).toFixed(1);
    const count = packed.placements.filter((p) => p.bin === i).length;
    const util = usedWIn * usedHIn > 0 ? (areaByBin.get(i) ?? 0) / (usedWIn * usedHIn) : 0;
    let svg: string | undefined, dxf: string | undefined;
    if (wantVecFmt) {
      const placed = placedUnits(bigGroups, packed, i);
      const wPt = (trim ? usedWIn : sheetWIn) * PT;
      const hPt = (trim ? usedHIn : sheetHIn) * PT;
      svg = sheetSvg(placed, wPt, hPt);
      dxf = sheetDxf(placed);
    }
    // A base64 string tops out at ~512 MB; a ~380 MB+ PDF would overflow it and
    // crash. With single-embed output this needs a genuinely huge artwork, but
    // guard anyway so the user gets a clear message instead of a cryptic crash.
    if (sheetPdfs[i].length > 380_000_000) {
      throw new Error("The laid-out file is too large to build — the artwork is very heavy (large embedded images). Try flattening/downsizing the artwork or nesting fewer pieces.");
    }
    sheets.push({
      index: i, usedWIn, usedHIn, pieceCount: count, utilPct: Math.round(util * 100),
      previewDataUrl: await renderPreview(sheetPdfs[i], 0, 520),
      pdfBase64: Buffer.from(sheetPdfs[i]).toString("base64"),
      svg, dxf,
      outName: `${base} — ${usedWIn}x${usedHIn}in.pdf`,
    });
  }

  // Per placed piece (for the 3D print-time estimate): plate, size, outline length.
  let pieces: NestResult["pieces"];
  if (opts.measurePerimeter) {
    pieces = packed.placements.map((pl) => ({
      bin: pl.bin,
      wIn: sizes[pl.id].wIn,
      hIn: sizes[pl.id].hIn,
      perimeterIn: perimById.get(pl.id) ?? 2 * (sizes[pl.id].wIn + sizes[pl.id].hIn),
    }));
  }

  return {
    file: fileName, mode: useVector ? "vector" : "raster",
    sheetWIn, sheetHIn, gapIn, rotated: allowRotate,
    totalPieces: sizes.length, placedPieces: packed.placements.length, unplaced: packed.unplaced.length,
    sheets, warnings, pieces,
  };
}
