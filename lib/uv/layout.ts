// Inkjet / UV Printing auto-layout — VECTOR pipeline.
//
// Given a box-up artwork (.ai/.pdf), lay the UV-printed pieces out on a fixed-width
// sheet (auto height, whole-inch board), each GROWN 5 mm along its contour, keeping
// each piece's ORIGINAL colour (CMYK preserved). The master output is a VECTOR PDF:
//  • infinite resolution (no pixelation)
//  • exact original colours (CMYK operators kept — no RGB round-trip)
//  • the 5 mm outset is a same-colour stroke (round join/cap) UNDER the fill, which
//    is exactly Illustrator's "Offset Path +5 mm / Round joins".
// PNG + JPG are high-DPI RGB PREVIEWS rendered from that PDF (with DPI embedded so a
// viewer/print shop sees the correct physical size). Print from the PDF for colour.

import { PDFDocument, PDFName, PDFBool } from "pdf-lib";
import { PNG } from "pngjs";
import jpeg from "jpeg-js";
import { renderPageRgb } from "@/lib/pdf/pdfium";
import { extractPdf } from "@/lib/pdf/extract";
import { parseVectorUnits, groupUnits, compose, type VUnit, type VGroup, type Mat } from "@/lib/nest/vector";
import { pack, type NestRect, type Heuristic } from "@/lib/nest/pack";

const PT = 72;
const MM_PER_IN = 25.4;

/** A UV region to keep, in artboard inches (top-left origin, y down) — case A. */
export type UvBox = { xIn: number; yIn: number; wIn: number; hIn: number };

export type UvOptions = {
  sheetWIn?: number; // max sheet width (default 60)
  gapIn?: number; // spacing between pieces (default 2 cm)
  growMm?: number; // contour outset per piece (default 5)
  dpi?: number; // preview raster resolution (default 300, capped for big sheets)
  measurementScale?: number; // 1 = real size file, 10 = drawn at 1:10 (default 1)
  uvBoxes?: UvBox[] | null; // case A: keep only these regions; null/empty = all pieces
  allowRotate?: boolean; // rotate pieces 90° to save material (default true)
};

export type UvResult = {
  file: string;
  pieceCount: number;
  sheetWIn: number;
  sheetHIn: number;
  dpi: number;
  grownMm: number;
  mode: "vector" | "raster";
  pngBase64: string;
  jpgBase64: string;
  pdfBase64: string;
  previewDataUrl: string;
  warnings: string[];
};

// Cap the preview raster so a huge sheet doesn't blow up memory. The PDF is vector
// (true resolution); PNG/JPG are previews, so a lower effective DPI is acceptable.
const RASTER_BUDGET_PX = 64_000_000;

/**
 * Build the Inkjet / UV vector layout. Returns a colour-accurate vector PDF plus a
 * high-DPI PNG + JPG preview (RGB). Throws if the artwork has no vector paths
 * (a flattened image) — box-up uploads are vector, and UV print needs vector anyway.
 */
export async function analyzeUvLayout(
  bytes: Uint8Array,
  fileName: string,
  opts: UvOptions = {},
): Promise<UvResult> {
  const warnings: string[] = [];
  const sheetWIn = opts.sheetWIn && opts.sheetWIn > 0 ? opts.sheetWIn : 60;
  const gapPt = (opts.gapIn != null && opts.gapIn >= 0 ? opts.gapIn : 20 / MM_PER_IN) * PT;
  const growMm = opts.growMm != null && opts.growMm >= 0 ? opts.growMm : 5;
  const offsetPt = (growMm / MM_PER_IN) * PT; // 5 mm outset, in points
  const mScale = opts.measurementScale && opts.measurementScale > 0 ? opts.measurementScale : 1;
  const allowRotate = opts.allowRotate !== false;
  const targetDpi = opts.dpi && opts.dpi > 0 ? opts.dpi : 300;

  // ---- Extract vector paths (with their CMYK/RGB colours) from every page ----
  const pages = await extractPdf(bytes);
  if (!pages.length) throw new Error("Could not read the artwork.");
  const heightPt = pages[0].heightPt; // for case-A y-flip (artboard top-down → PDF up)
  const vunits: VUnit[] = [];
  let vectorOk = true;
  for (const pg of pages) {
    const { units, unsupported } = parseVectorUnits(pg.content);
    if (unsupported) { vectorOk = false; break; }
    vunits.push(...units);
  }
  let groups = groupUnits(vunits);
  const minAreaPt = 0.2 * 0.2 * PT * PT; // drop specks < ~0.2"
  groups = groups.filter((g) => (g.x1 - g.x0) * (g.y1 - g.y0) >= minAreaPt);
  if (!vectorOk || !groups.length) {
    // Bitmap artwork (embedded images / clipping-mask logos): fall back to a raster
    // pipeline — render, keep each logo whole, grow 5 mm, pack. Lower quality than
    // vector (source-resolution, RGB), but handles image logos.
    return rasterUvLayout(bytes, fileName, {
      sheetWIn, gapPt, growMm, offsetPt, mScale, allowRotate, targetDpi,
      uvBoxes: opts.uvBoxes ?? null, heightPt,
    }, warnings);
  }

  // ---- Case A: keep only the groups inside the requested UV regions ----
  if (opts.uvBoxes && opts.uvBoxes.length) {
    const s = PT / mScale; // real inch → file points
    const rects = opts.uvBoxes.map((b) => ({
      x0: b.xIn * s,
      x1: (b.xIn + b.wIn) * s,
      // artboard y is top-down; PDF y is bottom-up.
      y0: heightPt - (b.yIn + b.hIn) * s,
      y1: heightPt - b.yIn * s,
    }));
    groups = groups.filter((g) => {
      const cx = (g.x0 + g.x1) / 2, cy = (g.y0 + g.y1) / 2;
      return rects.some((r) => cx >= r.x0 - 1 && cx <= r.x1 + 1 && cy >= r.y0 - 1 && cy <= r.y1 + 1);
    });
    if (!groups.length) throw new Error("None of the UV-marked pieces matched the artwork.");
  }

  // ---- Pack tightly onto a fixed-width strip, minimising HEIGHT (material) ----
  const maxWpt = sheetWIn * PT;
  const rects: NestRect[] = groups.map((g, i) => ({
    id: i,
    w: g.x1 - g.x0 + 2 * offsetPt, // grown bbox (stroke extends offset each side)
    h: g.y1 - g.y0 + 2 * offsetPt,
  }));
  const totalH = rects.reduce((s, r) => s + r.h + gapPt, 0) + gapPt; // generous → 1 bin
  const packed = packStrip(rects, maxWpt, totalH, gapPt, allowRotate);
  const placed = packed.placements.filter((pl) => pl.bin === 0);
  if (packed.unplaced.length) warnings.push(`${packed.unplaced.length} piece(s) too large for a ${sheetWIn}" sheet.`);

  let usedWpt = 0, usedHpt = 0;
  for (const pl of placed) {
    usedWpt = Math.max(usedWpt, pl.x + pl.w);
    usedHpt = Math.max(usedHpt, pl.y + pl.h);
  }
  usedWpt = Math.max(1, usedWpt);
  usedHpt = Math.max(1, usedHpt);

  // Whole-inch board (e.g. 47.5×59.5 → 48×60). Content is NOT scaled — pieces keep
  // their exact size; the board just gets a little white margin to reach whole inches.
  const boardWIn = Math.max(1, Math.ceil(usedWpt / PT));
  const boardHIn = Math.max(1, Math.ceil(usedHpt / PT));
  const boardWpt = boardWIn * PT;
  const boardHpt = boardHIn * PT;
  const shift = boardHpt - usedHpt; // push content to the top of the board

  // ---- Build the VECTOR PDF (offset stroke + fill, original colours) ----
  let content = "";
  for (const pl of placed) {
    const g = groups[pl.id];
    // Place the grown bbox's lower-left at (pl.x, pl.y+shift); the fill's bbox is
    // offsetPt inside that (the stroke fills the ring out to the grown edge).
    const tx = pl.x + offsetPt;
    const ty = pl.y + shift + offsetPt;
    const T: Mat = !pl.rotated
      ? [1, 0, 0, 1, tx - g.x0, ty - g.y0]
      : [0, 1, -1, 0, tx + g.y1, ty - g.x0];
    for (const u of g.units) content += emitUnitOffset(u, T, offsetPt);
  }
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([boardWpt, boardHpt]);
  page.node.set(PDFName.of("Contents"), pdf.context.register(pdf.context.stream(content || " ")));
  const pdfBytes = await pdf.save();

  // ---- Render a high-DPI RGB preview (PNG + JPG) from the vector PDF ----
  let dpi = Math.min(targetDpi, Math.sqrt(RASTER_BUDGET_PX / (boardWIn * boardHIn)));
  dpi = Math.max(72, dpi);
  if (dpi < targetDpi - 1) warnings.push(`Preview rendered at ~${Math.round(dpi)} DPI (large sheet). The PDF is vector — print from it for full quality.`);
  const rp = await renderPageRgb(pdfBytes, 0, dpi / PT);
  if (!rp) throw new Error("Could not render the layout preview.");
  const outW = rp.width, outH = rp.height;
  const png = new PNG({ width: outW, height: outH });
  for (let i = 0, j = 0; i < outW * outH * 4; i += 4, j += 3) {
    png.data[i] = rp.rgbColor[j];
    png.data[i + 1] = rp.rgbColor[j + 1];
    png.data[i + 2] = rp.rgbColor[j + 2];
    png.data[i + 3] = 255;
  }
  const effDpi = Math.round(outW / boardWIn);
  const pngBytes = withPngDpi(new Uint8Array(PNG.sync.write(png)), effDpi);
  const jpgBytes = withJpgDpi(new Uint8Array(jpeg.encode({ data: Buffer.from(png.data), width: outW, height: outH }, 92).data), effDpi);
  const preview = downscalePngDataUrl(png, outW, outH, 720);

  return {
    file: fileName,
    pieceCount: placed.length,
    sheetWIn: boardWIn,
    sheetHIn: boardHIn,
    dpi: effDpi,
    grownMm: growMm,
    mode: "vector",
    pngBase64: Buffer.from(pngBytes).toString("base64"),
    jpgBase64: Buffer.from(jpgBytes).toString("base64"),
    pdfBase64: Buffer.from(pdfBytes).toString("base64"),
    previewDataUrl: preview,
    warnings,
  };
}

// ---------------------------------------------------------------------------
// Vector emit — 5 mm outset via a same-colour round stroke UNDER the fill.
// ---------------------------------------------------------------------------
const fmtNum = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(4));

/** Turn a fill colour op into its stroke equivalent (k→K, rg→RG, g→G). */
function fillToStroke(color: string): string | null {
  const m = color.match(/^(.*)\s(k|rg|g)\s*$/i);
  if (!m) return null;
  return `${m[1]} ${m[2].toUpperCase()}`;
}

/** Emit one unit: for a FILL, draw a same-colour round stroke (line width = 2×offset,
 *  so it extends `offset` each side) under the fill — an exact +offset outset. */
function emitUnitOffset(u: VUnit, T: Mat, offsetPt: number): string {
  const M = compose(u.ctm, T);
  const m = M.map(fmtNum).join(" ");
  const col = u.color ? u.color + "\n" : "";
  const isFill = /[fFbB]/.test(u.paint);
  let out = "";
  if (isFill && offsetPt > 0) {
    const scale = Math.sqrt(Math.abs(M[0] * M[3] - M[1] * M[2])) || 1;
    const lw = (2 * offsetPt) / scale; // device stroke width in the cm space
    const sc = u.color ? fillToStroke(u.color) : null;
    if (sc) out += `q\n${sc}\n${fmtNum(lw)} w\n1 J\n1 j\n${m} cm\n${u.path}S\nQ\n`;
  }
  out += `q\n${col}${m} cm\n${u.path}${u.paint}\nQ\n`;
  return out;
}

/**
 * Pack rectangles into a FIXED-WIDTH strip, minimising the used HEIGHT (material
 * length on a roll) — not the bounding-box area. Tries every heuristic × sort and
 * keeps the shortest single-bin result (fewest unplaced first). This is what makes
 * the pieces tile side-by-side instead of stacking in one narrow column.
 */
function packStrip(rects: NestRect[], W: number, H: number, gap: number, allowRotate: boolean) {
  const heurs: Heuristic[] = ["bl", "bssf", "baf", "blsf"];
  const sorts: ((a: NestRect, b: NestRect) => number)[] = [
    (a, b) => b.h - a.h || b.w - a.w,
    (a, b) => b.w * b.h - a.w * a.h,
    (a, b) => Math.max(b.w, b.h) - Math.max(a.w, a.h),
    (a, b) => b.w - a.w || b.h - a.h,
  ];
  let best = null as ReturnType<typeof pack> | null;
  let bestScore = Infinity;
  for (const h of heurs) {
    for (const s of sorts) {
      const order = [...rects].sort(s);
      const r = pack(rects, W, H, gap, allowRotate, h, order);
      let usedH = 0;
      for (const pl of r.placements) if (pl.bin === 0) usedH = Math.max(usedH, pl.y + pl.h);
      const score = r.unplaced.length * 1e15 + Math.max(0, r.bins.length - 1) * 1e12 + usedH;
      if (score < bestScore) { bestScore = score; best = r; }
    }
  }
  return best as ReturnType<typeof pack>;
}

// ===========================================================================
// RASTER fallback — for bitmap / clipping-mask logos (no vector paths).
// Renders the artwork, keeps each logo whole (morphological close), grows 5 mm,
// packs, and outputs PNG/JPG + a PDF that embeds the PNG. Lower quality than the
// vector path (source-resolution, RGB), but handles image logos.
// ===========================================================================
type RasterOpts = {
  sheetWIn: number; gapPt: number; growMm: number; offsetPt: number; mScale: number;
  allowRotate: boolean; targetDpi: number; uvBoxes: UvBox[] | null; heightPt: number;
};
type PxBox = { x0: number; y0: number; x1: number; y1: number };

/**
 * Set /Interpolate = true on every embedded image XObject so the PDF renderer upscales
 * them with SMOOTH (bilinear) sampling instead of nearest-neighbour. Best-effort: if the
 * file can't be parsed/re-serialised we return the original bytes unchanged (rendering
 * still works, just without the smoothing). Only touches image dictionaries — vector
 * paths, clips and colours are left exactly as they were.
 */
async function enableImageInterpolation(bytes: Uint8Array): Promise<Uint8Array> {
  try {
    const doc = await PDFDocument.load(bytes, { throwOnInvalidObject: false });
    let n = 0;
    for (const [, obj] of doc.context.enumerateIndirectObjects()) {
      const dict = (obj as { dict?: { get?: (k: unknown) => unknown; set?: (k: unknown, v: unknown) => void } }).dict;
      if (!dict || typeof dict.get !== "function" || typeof dict.set !== "function") continue;
      const st = dict.get(PDFName.of("Subtype"));
      if (st && String(st) === "/Image") { dict.set(PDFName.of("Interpolate"), PDFBool.True); n++; }
    }
    if (!n) return bytes;
    return await doc.save();
  } catch {
    return bytes;
  }
}

async function rasterUvLayout(bytes: Uint8Array, fileName: string, o: RasterOpts, warnings: string[]): Promise<UvResult> {
  // Turn ON /Interpolate for the embedded images so pdfium upscales them SMOOTHLY
  // (bilinear) to print resolution instead of nearest-neighbour. A clipping-mask logo's
  // source image is often low-res (~740 px); nearest-neighbour upscaling to the print
  // sheet produces blocky stair-stepped edges ("hatching") and blocky colour banding —
  // exactly the "蒙蒙"/speckled look. Interpolation makes the edges + colour smooth. The
  // clip silhouette (alpha) is a vector path, so it stays crisp regardless.
  const srcBytes = await enableImageInterpolation(bytes);
  // Render scale so px-per-real-inch ≈ targetDpi, capped so the page fits memory.
  const probe = await renderPageRgb(srcBytes, 0, 1.0);
  if (!probe) throw new Error("Could not render the artwork.");
  const areaAt1 = probe.width * probe.height;
  let scale = (o.mScale * o.targetDpi) / PT;
  if (areaAt1 * scale * scale > RASTER_BUDGET_PX) scale = Math.sqrt(RASTER_BUDGET_PX / areaAt1);
  const page = scale === 1.0 ? probe : await renderPageRgb(srcBytes, 0, scale);
  if (!page) throw new Error("Could not render the artwork at the chosen resolution.");
  const { width: W, height: H, rgbColor, alpha } = page;
  const pxPerIn = (scale * PT) / o.mScale;

  // Shape = the DRAWN pixels (clip/silhouette), from the render's alpha. This is the
  // crisp vector clip mask (a clipping-mask logo's exact outline), and crucially it
  // INCLUDES white parts of the design (e.g. Instagram's white ring) — unlike a
  // "non-white" test, which drops them and speckles the edge. Threshold at half
  // coverage for detection; the 5 mm outset itself uses the CONTINUOUS alpha for a
  // smooth (anti-aliased) offset — see growPiece.
  const shape = new Uint8Array(W * H);
  for (let p = 0; p < W * H; p++) if (alpha[p] >= 128) shape[p] = 1;
  const ink = shape; // detection (case B) groups on the same drawn mask

  // Case A: use the requested UV regions DIRECTLY as pieces — each box is one whole
  // logo (these are box-up's own detected logo bboxes), so this matches the tool
  // exactly (no re-detection that could over/under-split). Case B (whole board):
  // detect each logo from the pixels (close + connected blobs).
  let boxes: PxBox[];
  if (o.uvBoxes && o.uvBoxes.length) {
    const s = pxPerIn;
    boxes = o.uvBoxes
      .map((b) => ({
        x0: Math.max(0, Math.round(b.xIn * s)),
        y0: Math.max(0, Math.round(b.yIn * s)),
        x1: Math.min(W - 1, Math.round((b.xIn + b.wIn) * s)),
        y1: Math.min(H - 1, Math.round((b.yIn + b.hIn) * s)),
      }))
      .filter((b) => b.x1 > b.x0 && b.y1 > b.y0);
    if (!boxes.length) throw new Error("None of the UV-marked logos matched the artwork.");
  } else {
    boxes = detectLogoBoxes(ink, W, H, pxPerIn);
    if (!boxes.length) throw new Error("No printable content found in the artwork.");
  }

  // Grow each piece 5 mm along its contour (Offset Path), keeping original colour.
  const growPx = Math.max(0, Math.round((o.growMm / MM_PER_IN) * pxPerIn));
  const pieces = boxes.map((b) => growPiece(alpha, rgbColor, W, H, b, growPx)).filter((p): p is Piece => !!p);
  if (!pieces.length) throw new Error("No printable pieces after processing.");

  // Pack (fixed width, min height) in px.
  const gapPx = Math.round((o.gapPt / PT) * pxPerIn);
  const sheetWpx = Math.round(o.sheetWIn * pxPerIn);
  const rects: NestRect[] = pieces.map((p, i) => ({ id: i, w: p.w, h: p.h }));
  const totalH = pieces.reduce((s, p) => s + p.h + gapPx, 0) + gapPx;
  const packed = packStrip(rects, sheetWpx, totalH, gapPx, o.allowRotate);
  const placed = packed.placements.filter((pl) => pl.bin === 0);
  if (packed.unplaced.length) warnings.push(`${packed.unplaced.length} logo(s) too large for a ${o.sheetWIn}" sheet.`);

  let usedWpx = 0, usedHpx = 0;
  for (const pl of placed) { usedWpx = Math.max(usedWpx, pl.x + pl.w); usedHpx = Math.max(usedHpx, pl.y + pl.h); }
  usedWpx = Math.max(1, usedWpx); usedHpx = Math.max(1, usedHpx);
  const boardWIn = Math.max(1, Math.ceil(usedWpx / pxPerIn));
  const boardHIn = Math.max(1, Math.ceil(usedHpx / pxPerIn));
  const outW = Math.round(boardWIn * pxPerIn), outH = Math.round(boardHIn * pxPerIn);
  const shift = outH - usedHpx;

  const png = new PNG({ width: outW, height: outH });
  png.data.fill(255);
  for (const pl of placed) {
    const piece = pieces[pl.id];
    const dxTop = pl.x;
    const dyTop = (usedHpx - (pl.y + pl.h)) + shift; // flip to top-origin, keep at top
    blit(png, outW, outH, piece, pl.rotated, dxTop, dyTop);
  }

  const effDpi = Math.round(pxPerIn);
  if (effDpi < o.targetDpi - 1) warnings.push(`Rendered at ~${effDpi} DPI (bitmap source, large sheet).`);
  warnings.push("Bitmap artwork — RGB at source resolution (not vector CMYK). Use a vector logo for exact colour + full sharpness.");
  const pngBytes = withPngDpi(new Uint8Array(PNG.sync.write(png)), effDpi);
  const jpgBytes = withJpgDpi(new Uint8Array(jpeg.encode({ data: Buffer.from(png.data), width: outW, height: outH }, 92).data), effDpi);

  const pdf = await PDFDocument.create();
  const pdfPage = pdf.addPage([boardWIn * PT, boardHIn * PT]);
  const emb = await pdf.embedPng(pngBytes);
  pdfPage.drawImage(emb, { x: 0, y: 0, width: boardWIn * PT, height: boardHIn * PT });
  const pdfBytes = await pdf.save();

  return {
    file: fileName, pieceCount: placed.length, sheetWIn: boardWIn, sheetHIn: boardHIn,
    dpi: effDpi, grownMm: o.growMm, mode: "raster",
    pngBase64: Buffer.from(pngBytes).toString("base64"),
    jpgBase64: Buffer.from(jpgBytes).toString("base64"),
    pdfBase64: Buffer.from(pdfBytes).toString("base64"),
    previewDataUrl: downscalePngDataUrl(png, outW, outH, 720),
    warnings,
  };
}

type Piece = { w: number; h: number; rgba: Uint8Array };

/** Detect whole logos: close (dilate) the ink mask so a logo's fragments join, label
 *  connected components, then merge boxes still within ~1 cm of each other. */
function detectLogoBoxes(ink: Uint8Array, W: number, H: number, pxPerIn: number): PxBox[] {
  const closePx = Math.max(1, Math.round((6 / MM_PER_IN) * pxPerIn)); // 6 mm close radius
  // Dilate by closePx (separable box approximation via distance-to-ink threshold).
  const dt = distanceToInk(ink, W, H, closePx + 1);
  const dil = new Uint8Array(W * H);
  for (let p = 0; p < W * H; p++) if (dt[p] <= closePx) dil[p] = 1;
  // Connected components (8-conn) on the dilated mask.
  const label = new Int32Array(W * H);
  const stack = new Int32Array(W * H);
  const raw: PxBox[] = [];
  let next = 1;
  const minArea = Math.max(9, Math.round((0.5 * pxPerIn) * (0.5 * pxPerIn))); // ≥0.5" square
  for (let s = 0; s < W * H; s++) {
    if (!dil[s] || label[s]) continue;
    let sp = 0; stack[sp++] = s; label[s] = next;
    let x0 = s % W, x1 = x0, y0 = (s / W) | 0, y1 = y0, area = 0, inkArea = 0;
    while (sp > 0) {
      const q = stack[--sp]; const x = q % W, y = (q / W) | 0; area++; if (ink[q]) inkArea++;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      for (let dy = -1; dy <= 1; dy++) { const ny = y + dy; if (ny < 0 || ny >= H) continue;
        for (let dx = -1; dx <= 1; dx++) { const nx = x + dx; if (nx < 0 || nx >= W || (!dx && !dy)) continue;
          const np = ny * W + nx; if (dil[np] && !label[np]) { label[np] = next; stack[sp++] = np; } } }
    }
    next++;
    if (inkArea >= minArea) raw.push({ x0, y0, x1, y1 });
  }
  return raw;
}

/** Chamfer distance (in px) from every pixel to the nearest ink pixel, capped. */
function distanceToInk(ink: Uint8Array, W: number, H: number, cap: number): Float32Array {
  const INF = cap + 1;
  const d = new Float32Array(W * H);
  for (let p = 0; p < W * H; p++) d[p] = ink[p] ? 0 : INF;
  const relax = (p: number, q: number, c: number) => { const v = d[q] + c; if (v < d[p]) d[p] = v; };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const p = y * W + x;
    if (x > 0) relax(p, p - 1, 1); if (y > 0) relax(p, p - W, 1);
    if (x > 0 && y > 0) relax(p, p - W - 1, 1.414); if (x < W - 1 && y > 0) relax(p, p - W + 1, 1.414); }
  for (let y = H - 1; y >= 0; y--) for (let x = W - 1; x >= 0; x--) { const p = y * W + x;
    if (x < W - 1) relax(p, p + 1, 1); if (y < H - 1) relax(p, p + W, 1);
    if (x < W - 1 && y < H - 1) relax(p, p + W + 1, 1.414); if (x > 0 && y < H - 1) relax(p, p + W - 1, 1.414); }
  return d;
}

/**
 * Grow one piece by `growPx` (= Illustrator "Offset Path" +5 mm / Round joins), keeping
 * ORIGINAL colours and a SMOOTH anti-aliased boundary — matching the user's rule exactly:
 * the 5 mm is added ONLY to the OUTERMOST contour (grows outward) and to genuine enclosed
 * HOLES (grows inward, e.g. the middle of an O/A/B). All INTERNAL design detail — the thin
 * decorative gaps between a logo's elements — is preserved untouched, so we never ring
 * every little internal piece.
 *
 * How:
 *   • `alpha` (the clip silhouette's sub-pixel coverage) → a smooth signed distance to the
 *     0.5-coverage contour, seeded at the SUB-PIXEL crossings so the offset is serration-
 *     free even where the source image edge is soft/low-res.
 *   • Flood the background from the border to tell EXTERIOR (outer) from ENCLOSED (holes +
 *     internal gaps). An enclosed region is a real HOLE only if it is wider than the bleed
 *     (something deeper than growPx survives the inset) — thin design gaps are left as-is.
 *   • Compose over the ORIGINAL artwork: the outward ring + the inward hole bleed are the
 *     nearest solid colour with a 1-px AA falloff; everything else is the original pixel.
 */
function growPiece(alpha: Uint8Array, rgbColor: Uint8Array, W: number, H: number, b: PxBox, growPx: number): Piece | null {
  const pad = growPx + 3;
  const w = b.x1 - b.x0 + 1 + pad * 2, h = b.y1 - b.y0 + 1 + pad * 2;
  if (w <= 0 || h <= 0) return null;
  const cov = new Float32Array(w * h);   // continuous silhouette coverage 0..1
  const la = new Uint8Array(w * h);      // local source alpha 0..255 (the original design)
  let any = false;
  for (let y = b.y0; y <= b.y1; y++) for (let x = b.x0; x <= b.x1; x++) {
    const li = (y - b.y0 + pad) * w + (x - b.x0 + pad);
    const a = alpha[y * W + x];
    la[li] = a; cov[li] = a / 255;
    if (a >= 240) any = true;
  }
  if (!any) return null;

  // --- 1. Distance to the 0.5-coverage contour (sub-pixel seeds, jump flood) ---
  const seedX = new Float32Array(w * h).fill(-1);
  const seedY = new Float32Array(w * h);
  const consider = (idx: number, cx: number, cy: number) => {
    const px = idx % w, py = (idx / w) | 0;
    if (seedX[idx] < 0) { seedX[idx] = cx; seedY[idx] = cy; return; }
    const dOld = (px - seedX[idx]) * (px - seedX[idx]) + (py - seedY[idx]) * (py - seedY[idx]);
    const dNew = (px - cx) * (px - cx) + (py - cy) * (py - cy);
    if (dNew < dOld) { seedX[idx] = cx; seedY[idx] = cy; }
  };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const p = y * w + x; const cp = cov[p];
    if (x + 1 < w) { const cq = cov[p + 1]; if ((cp < 0.5) !== (cq < 0.5) && cp !== cq) { const t = (0.5 - cp) / (cq - cp); consider(p, x + t, y); consider(p + 1, x + t, y); } }
    if (y + 1 < h) { const cq = cov[p + w]; if ((cp < 0.5) !== (cq < 0.5) && cp !== cq) { const t = (0.5 - cp) / (cq - cp); consider(p, x, y + t); consider(p + w, x, y + t); } }
  }
  const jfaPass = (step: number) => {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const p = y * w + x; let bx = seedX[p], by = seedY[p];
      let bd = bx < 0 ? Infinity : (x - bx) * (x - bx) + (y - by) * (y - by);
      for (let dy = -1; dy <= 1; dy++) { const ny = y + dy * step; if (ny < 0 || ny >= h) continue;
        for (let dx = -1; dx <= 1; dx++) { const nx = x + dx * step; if (nx < 0 || nx >= w || (dx === 0 && dy === 0)) continue;
          const sx = seedX[ny * w + nx]; if (sx < 0) continue; const sy = seedY[ny * w + nx];
          const d = (x - sx) * (x - sx) + (y - sy) * (y - sy); if (d < bd) { bd = d; bx = sx; by = sy; } } }
      seedX[p] = bx; seedY[p] = by;
    }
  };
  let step = 1; const limit = Math.min(Math.max(w, h), growPx + 3);
  while (step < limit) step <<= 1;
  for (; step >= 1; step >>= 1) jfaPass(step);
  // JFA+2: two extra unit passes correct the small nearest-seed errors plain JFA leaves,
  // which otherwise wobble the offset distance and comb the high-contrast (black-on-white) edge.
  jfaPass(1); jfaPass(1);
  const distAt = (p: number): number => {
    const sx = seedX[p]; if (sx < 0) return growPx + 3;
    const px = p % w, py = (p / w) | 0;
    return Math.sqrt((px - sx) * (px - sx) + (py - seedY[p]) * (py - seedY[p]));
  };

  // --- 2. Compose: original design, then grow the 5 mm bleed outward ---
  // The 5 mm grows EACH element's edge outward (and holes inward) = "enlarge every element by
  // 5 mm": the outer outline grows out, gaps between elements close from both sides, holes
  // shrink. The bleed COLOUR is grown by grassfire diffusion (each new pixel = the average of
  // the already-coloured pixels nearer the ink, in increasing-distance order) so it stays
  // perfectly smooth — nearest-pixel sampling would band it at the source-pixel grid.
  //
  // Two colour fields are kept apart so the bleed follows the TRUE element colour:
  //   • the DISPLAY buffer reproduces the source exactly (own colour, own soft coverage);
  //   • a separate CLEAN-colour field is seeded ONLY from solid interior pixels and diffused
  //     out, so the ~5 px white-blended anti-aliased rim (an artefact of upscaling the low-res
  //     source) never bleeds a washed-out grey into the ring.
  const rgba = new Uint8Array(w * h * 4);
  const ccR = new Uint8Array(w * h), ccG = new Uint8Array(w * h), ccB = new Uint8Array(w * h), ccSet = new Uint8Array(w * h);
  const solidMask = new Uint8Array(w * h);
  for (let p = 0; p < w * h; p++) {
    const px = p % w, py = (p / w) | 0; const j = ((b.y0 + py - pad) * W + (b.x0 + px - pad)) * 3, o = p * 4;
    if (la[p] >= 8) { rgba[o] = rgbColor[j]; rgba[o + 1] = rgbColor[j + 1]; rgba[o + 2] = rgbColor[j + 2]; rgba[o + 3] = la[p]; } // display = source
    if (la[p] >= 230) { solidMask[p] = 1; ccR[p] = rgbColor[j]; ccG[p] = rgbColor[j + 1]; ccB[p] = rgbColor[j + 2]; ccSet[p] = 1; } // clean-colour seed
  }
  // 2b. Diffuse the CLEAN colour outward from the solid interior across the soft rim + ring.
  const dSolid = distanceToInk(solidMask, w, h, growPx + 8); // distance to clean colour source
  const spread: number[] = [];
  for (let p = 0; p < w * h; p++) if (!solidMask[p] && dSolid[p] <= growPx + 6) spread.push(p);
  spread.sort((a, c) => dSolid[a] - dSolid[c]);
  for (let k = 0; k < spread.length; k++) {
    const p = spread[k]; const px = p % w, py = (p / w) | 0;
    let r = 0, g = 0, bl = 0, n = 0;
    for (let dy = -1; dy <= 1; dy++) { const ny = py + dy; if (ny < 0 || ny >= h) continue;
      for (let dx = -1; dx <= 1; dx++) { const nx = px + dx; if (nx < 0 || nx >= w || (!dx && !dy)) continue;
        const q = ny * w + nx; if (ccSet[q]) { r += ccR[q]; g += ccG[q]; bl += ccB[q]; n++; } } }
    if (!n) continue;
    ccR[p] = Math.round(r / n); ccG[p] = Math.round(g / n); ccB[p] = Math.round(bl / n); ccSet[p] = 1;
  }
  // 2c. Paint the ring: background pixels within growPx of the ink, coloured by the clean field.
  for (let p = 0; p < w * h; p++) {
    if (la[p] >= 8 || !ccSet[p]) continue;
    const d = distAt(p); const cover = (growPx + 1 - d) / 2; // 2 px AA ramp; d = growPx is 50 %
    if (cover <= 0) continue;
    const o = p * 4;
    rgba[o] = ccR[p]; rgba[o + 1] = ccG[p]; rgba[o + 2] = ccB[p]; rgba[o + 3] = cover >= 1 ? 255 : Math.round(cover * 255);
  }
  return { w, h, rgba };
}

/** Alpha-blit a piece (optionally rotated 90°) onto the sheet at (dx,dy) top-left.
 *  COMPOSITES over whatever is on the sheet (white background) using the piece's alpha,
 *  so the anti-aliased outset edge blends smoothly to white instead of a hard cut. */
function blit(png: PNG, outW: number, outH: number, piece: Piece, rotated: boolean, dx: number, dy: number) {
  const pw = piece.w, ph = piece.h;
  const dw = rotated ? ph : pw, dh = rotated ? pw : ph;
  for (let y = 0; y < dh; y++) { const oy = dy + y; if (oy < 0 || oy >= outH) continue;
    for (let x = 0; x < dw; x++) { const ox = dx + x; if (ox < 0 || ox >= outW) continue;
      let srx: number, sry: number;
      if (!rotated) { srx = x; sry = y; } else { srx = y; sry = pw - 1 - x; }
      const sIdx = (sry * pw + srx) * 4; const a = piece.rgba[sIdx + 3]; if (a < 1) continue;
      const oIdx = (oy * outW + ox) * 4;
      if (a >= 255) {
        png.data[oIdx] = piece.rgba[sIdx]; png.data[oIdx + 1] = piece.rgba[sIdx + 1];
        png.data[oIdx + 2] = piece.rgba[sIdx + 2];
      } else {
        const ia = 255 - a;
        png.data[oIdx] = (piece.rgba[sIdx] * a + png.data[oIdx] * ia + 127) / 255 | 0;
        png.data[oIdx + 1] = (piece.rgba[sIdx + 1] * a + png.data[oIdx + 1] * ia + 127) / 255 | 0;
        png.data[oIdx + 2] = (piece.rgba[sIdx + 2] * a + png.data[oIdx + 2] * ia + 127) / 255 | 0;
      }
      png.data[oIdx + 3] = 255; } }
}

// ---------------------------------------------------------------------------
// DPI metadata — so a JPG/PNG opens at the correct physical size in print shops.
// ---------------------------------------------------------------------------
const CRC_TBL = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
function crc32(buf: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TBL[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
/** Insert a pHYs chunk (pixels-per-metre) after IHDR so the PNG carries its DPI. */
function withPngDpi(png: Uint8Array, dpi: number): Uint8Array {
  const ppm = Math.round(dpi / 0.0254);
  const chunk = new Uint8Array(21);
  const dv = new DataView(chunk.buffer);
  dv.setUint32(0, 9);
  chunk[4] = 0x70; chunk[5] = 0x48; chunk[6] = 0x59; chunk[7] = 0x73; // "pHYs"
  dv.setUint32(8, ppm); dv.setUint32(12, ppm); chunk[16] = 1;
  dv.setUint32(17, crc32(chunk.subarray(4, 17)));
  const pos = 33;
  const out = new Uint8Array(png.length + chunk.length);
  out.set(png.subarray(0, pos), 0);
  out.set(chunk, pos);
  out.set(png.subarray(pos), pos + chunk.length);
  return out;
}
/** Set the JFIF density (dots-per-inch) in a jpeg-js JPEG's APP0 segment. */
function withJpgDpi(jpg: Uint8Array, dpi: number): Uint8Array {
  const out = jpg.slice();
  if (out[2] === 0xff && out[3] === 0xe0) {
    out[13] = 1;
    out[14] = (dpi >> 8) & 0xff; out[15] = dpi & 0xff;
    out[16] = (dpi >> 8) & 0xff; out[17] = dpi & 0xff;
  }
  return out;
}

/** Downscale the composited sheet to a small preview PNG data URL (max side). */
function downscalePngDataUrl(png: PNG, w: number, h: number, maxSide: number): string {
  const scale = Math.min(1, maxSide / Math.max(w, h));
  const pw = Math.max(1, Math.round(w * scale)), ph = Math.max(1, Math.round(h * scale));
  const out = new PNG({ width: pw, height: ph });
  for (let y = 0; y < ph; y++) {
    const sy = Math.min(h - 1, Math.floor(y / scale));
    for (let x = 0; x < pw; x++) {
      const sx = Math.min(w - 1, Math.floor(x / scale));
      const s = (sy * w + sx) * 4, o = (y * pw + x) * 4;
      out.data[o] = png.data[s]; out.data[o + 1] = png.data[s + 1];
      out.data[o + 2] = png.data[s + 2]; out.data[o + 3] = 255;
    }
  }
  return "data:image/png;base64," + PNG.sync.write(out).toString("base64");
}

// VGroup is used only structurally above; keep the import referenced for types.
export type { VGroup };
