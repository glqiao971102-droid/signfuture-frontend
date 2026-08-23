// Auto-nesting / imposition: take an artwork file with scattered pieces, detect
// each piece, pack them tightly onto sheets (default 48"×96"), and emit a new PDF
// that opens already laid-out — vectors and colours preserved by clipping each
// piece out of the source page and re-placing it (pdf-lib embedPage + drawPage).
import { PDFDocument, degrees } from "pdf-lib";
import { extractPdf } from "@/lib/pdf/extract";
import { renderPageRgb } from "@/lib/pdf/pdfium";
import { PNG } from "pngjs";
import { packBest, type NestRect } from "@/lib/nest/pack";

const PT = 72;
const DET_TARGET = 1800; // detection render: long side in px

export type NestOptions = {
  sheetWIn?: number;
  sheetHIn?: number;
  gapIn?: number;
  allowRotate?: boolean;
  minPieceIn?: number;
  trim?: boolean;
};

export type NestSheet = {
  index: number;
  usedWIn: number;
  usedHIn: number;
  pieceCount: number;
  utilPct: number;
  previewDataUrl: string;
};

export type NestResult = {
  file: string;
  sheetWIn: number;
  sheetHIn: number;
  gapIn: number;
  rotated: boolean;
  totalPieces: number;
  placedPieces: number;
  unplaced: number;
  sheets: NestSheet[];
  warnings: string[];
  outName: string;
  outPdfBase64: string;
};

type Box = { minX: number; minY: number; maxX: number; maxY: number };
type Clip = { left: number; bottom: number; right: number; top: number };
type Piece = { clip: Clip; wIn: number; hIn: number; page: number };

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
      // 4-connectivity: avoid bridging pieces that only touch diagonally.
      if (x > 0 && ink[p - 1] && !label[p - 1]) { label[p - 1] = cur; stack.push(p - 1); }
      if (x < w - 1 && ink[p + 1] && !label[p + 1]) { label[p + 1] = cur; stack.push(p + 1); }
      if (y > 0 && ink[p - w] && !label[p - w]) { label[p - w] = cur; stack.push(p - w); }
      if (y < h - 1 && ink[p + w] && !label[p + w]) { label[p + w] = cur; stack.push(p + w); }
    }
    if (area >= minPx) boxes.push({ minX, minY, maxX, maxY });
  }
  return boxes;
}

/**
 * Merge components whose bounding boxes OVERLAP into one piece (union bbox). A
 * rectangular clip captures everything in its rectangle, so two pieces with
 * overlapping bboxes (a frame around a logo, interlocking / L / ring shapes)
 * MUST be treated as one nesting unit — otherwise the clip would duplicate the
 * neighbour's ink. Touching-only bboxes (no positive overlap) stay separate.
 */
function mergeOverlappingBoxes(boxes: Box[]): Box[] {
  const parent = boxes.map((_, i) => i);
  const find = (x: number): number => (parent[x] === x ? x : (parent[x] = find(parent[x])));
  const overlap = (a: Box, b: Box) =>
    a.minX <= b.maxX && b.minX <= a.maxX && a.minY <= b.maxY && b.minY <= a.maxY &&
    Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX) > 0 && Math.min(a.maxY, b.maxY) - Math.max(a.minY, b.minY) > 0;
  // Repeat to convergence: a merged (grown) box can newly overlap a third.
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

/** Render one page of a PDF to a downscaled preview PNG data URL. */
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

  const warnings: string[] = [];
  const pieces: Piece[] = [];

  for (let pi = 0; pi < nPages; pi++) {
    const sp = src.getPage(pi);
    const rot = (((sp.getRotation().angle || 0) % 360) + 360) % 360;
    if (rot !== 0) warnings.push(`Page ${pi + 1} is rotated ${rot}° in the file — its pieces may come out misaligned. Please un-rotate the source page and re-upload.`);
    // pdfium renders the CropBox; map pixels back into that box's user coordinates.
    const cb = sp.getCropBox();
    const detScale = Math.min(0.35, DET_TARGET / (Math.max(cb.width, cb.height) / PT) / PT);
    const page = await renderPageRgb(bytes, pi, detScale);
    if (!page) continue;
    const { width: w, height: h, rgb } = page; // rgb = colour-independent detection buffer (black = drawn ink)
    const ink = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) if (rgb[i * 3] < 128) ink[i] = 1;
    const minPx = Math.max(6, Math.round((minPieceIn * detScale * PT) ** 2 * 0.2));
    const boxes = mergeOverlappingBoxes(componentBoxes(ink, w, h, minPx));
    for (const bx of boxes) {
      const left = cb.x + bx.minX / detScale;
      const right = cb.x + (bx.maxX + 1) / detScale;
      const top = cb.y + cb.height - bx.minY / detScale;
      const bottom = cb.y + cb.height - (bx.maxY + 1) / detScale;
      pieces.push({ clip: { left, bottom, right, top }, wIn: (right - left) / PT, hIn: (top - bottom) / PT, page: pi });
    }
  }
  if (!pieces.length) throw new Error("No pieces were detected in this artwork.");

  const rects: NestRect[] = pieces.map((p, id) => ({ id, w: p.wIn, h: p.hIn }));
  const packed = packBest(rects, sheetWIn, sheetHIn, gapIn, allowRotate);

  // Build the output PDF: one page per sheet (trimmed to the used area by default).
  const out = await PDFDocument.create();
  const nBins = packed.bins.length;
  const pageW = (i: number) => (trim ? Math.min(sheetWIn, packed.bins[i].usedW) : sheetWIn);
  const pageH = (i: number) => (trim ? Math.min(sheetHIn, packed.bins[i].usedH) : sheetHIn);
  const pagesOut = Array.from({ length: nBins }, (_, i) => out.addPage([pageW(i) * PT, pageH(i) * PT]));

  for (const pl of packed.placements) {
    const pc = pieces[pl.id];
    const embedded = await out.embedPage(src.getPage(pc.page), pc.clip);
    const target = pagesOut[pl.bin];
    const X = pl.x * PT, Y = pl.y * PT;
    if (!pl.rotated) target.drawPage(embedded, { x: X, y: Y });
    else target.drawPage(embedded, { x: X + pl.w * PT, y: Y, rotate: degrees(90) });
  }
  const outBytes = await out.save();

  // Per-sheet previews + utilisation.
  const areaByBin = new Map<number, number>();
  for (const pl of packed.placements) areaByBin.set(pl.bin, (areaByBin.get(pl.bin) ?? 0) + pl.w * pl.h);
  const sheets: NestSheet[] = [];
  for (let i = 0; i < nBins; i++) {
    const usedWIn = Math.min(sheetWIn, packed.bins[i].usedW);
    const usedHIn = Math.min(sheetHIn, packed.bins[i].usedH);
    const count = packed.placements.filter((p) => p.bin === i).length;
    const util = usedWIn * usedHIn > 0 ? (areaByBin.get(i) ?? 0) / (usedWIn * usedHIn) : 0;
    sheets.push({
      index: i,
      usedWIn: +usedWIn.toFixed(1),
      usedHIn: +usedHIn.toFixed(1),
      pieceCount: count,
      utilPct: Math.round(util * 100),
      previewDataUrl: await renderPreview(new Uint8Array(outBytes), i, 520),
    });
  }

  const base = fileName.replace(/\.[^.]+$/, "");
  return {
    file: fileName,
    sheetWIn, sheetHIn, gapIn, rotated: allowRotate,
    totalPieces: pieces.length,
    placedPieces: packed.placements.length,
    unplaced: packed.unplaced.length,
    sheets,
    warnings,
    outName: `${base} — nested ${sheetWIn}x${sheetHIn}.pdf`,
    outPdfBase64: Buffer.from(outBytes).toString("base64"),
  };
}
