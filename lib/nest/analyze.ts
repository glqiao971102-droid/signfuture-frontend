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
import { PDFDocument, PDFName, degrees } from "pdf-lib";
import { extractPdf } from "@/lib/pdf/extract";
import { renderPageRgb } from "@/lib/pdf/pdfium";
import { PNG } from "pngjs";
import { packBest, type NestRect, type PackResult } from "@/lib/nest/pack";
import { parseVectorUnits, groupUnits, emitUnit, type VUnit, type VGroup, type Mat } from "@/lib/nest/vector";

const PT = 72;
const DET_TARGET = 1800;

export type NestOptions = {
  sheetWIn?: number; sheetHIn?: number; gapIn?: number;
  allowRotate?: boolean; minPieceIn?: number; trim?: boolean;
};
export type NestSheet = {
  index: number; usedWIn: number; usedHIn: number; pieceCount: number; utilPct: number;
  previewDataUrl: string;
  pdfBase64: string; // this sheet as its OWN single-page PDF
  outName: string;   // download filename (named by the used size)
};
export type NestResult = {
  file: string; mode: "vector" | "raster";
  sheetWIn: number; sheetHIn: number; gapIn: number; rotated: boolean;
  totalPieces: number; placedPieces: number; unplaced: number;
  sheets: NestSheet[]; warnings: string[];
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
async function buildVectorSheets(groups: VGroup[], packed: PackResult, sheetWIn: number, sheetHIn: number, trim: boolean): Promise<Uint8Array[]> {
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
    }
    const doc = await PDFDocument.create();
    const w = (trim ? Math.min(sheetWIn, packed.bins[i].usedW) : sheetWIn) * PT;
    const h = (trim ? Math.min(sheetHIn, packed.bins[i].usedH) : sheetHIn) * PT;
    const page = doc.addPage([w, h]);
    page.node.set(PDFName.of("Contents"), doc.context.register(doc.context.stream(content || " ")));
    out.push(await doc.save());
  }
  return out;
}

/** Raster output — ONE single-page PDF per sheet (bin). */
async function buildRasterSheets(src: PDFDocument, pieces: ClipPiece[], packed: PackResult, sheetWIn: number, sheetHIn: number, trim: boolean): Promise<Uint8Array[]> {
  const out: Uint8Array[] = [];
  for (let i = 0; i < packed.bins.length; i++) {
    const doc = await PDFDocument.create();
    const w = (trim ? Math.min(sheetWIn, packed.bins[i].usedW) : sheetWIn) * PT;
    const h = (trim ? Math.min(sheetHIn, packed.bins[i].usedH) : sheetHIn) * PT;
    const page = doc.addPage([w, h]);
    for (const pl of packed.placements) {
      if (pl.bin !== i) continue;
      const pc = pieces[pl.id];
      const embedded = await doc.embedPage(src.getPage(pc.page), pc.clip);
      const X = pl.x * PT, Y = pl.y * PT;
      if (!pl.rotated) page.drawPage(embedded, { x: X, y: Y });
      else page.drawPage(embedded, { x: X + pl.w * PT, y: Y, rotate: degrees(90) });
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
  const packed = packBest(rects, sheetWIn, sheetHIn, gapIn, allowRotate);

  const sheetPdfs = useVector
    ? await buildVectorSheets(bigGroups, packed, sheetWIn, sheetHIn, trim)
    : await buildRasterSheets(src, clipPieces, packed, sheetWIn, sheetHIn, trim);

  // Per-sheet previews, utilisation, and a separate PDF each (named by used size).
  const base = fileName.replace(/\.[^.]+$/, "");
  const areaByBin = new Map<number, number>();
  for (const pl of packed.placements) areaByBin.set(pl.bin, (areaByBin.get(pl.bin) ?? 0) + pl.w * pl.h);
  const sheets: NestSheet[] = [];
  for (let i = 0; i < packed.bins.length; i++) {
    const usedWIn = +Math.min(sheetWIn, packed.bins[i].usedW).toFixed(1);
    const usedHIn = +Math.min(sheetHIn, packed.bins[i].usedH).toFixed(1);
    const count = packed.placements.filter((p) => p.bin === i).length;
    const util = usedWIn * usedHIn > 0 ? (areaByBin.get(i) ?? 0) / (usedWIn * usedHIn) : 0;
    sheets.push({
      index: i, usedWIn, usedHIn, pieceCount: count, utilPct: Math.round(util * 100),
      previewDataUrl: await renderPreview(sheetPdfs[i], 0, 520),
      pdfBase64: Buffer.from(sheetPdfs[i]).toString("base64"),
      outName: `${base} — ${usedWIn}x${usedHIn}in.pdf`,
    });
  }

  return {
    file: fileName, mode: useVector ? "vector" : "raster",
    sheetWIn, sheetHIn, gapIn, rotated: allowRotate,
    totalPieces: sizes.length, placedPieces: packed.placements.length, unplaced: packed.unplaced.length,
    sheets, warnings,
  };
}
