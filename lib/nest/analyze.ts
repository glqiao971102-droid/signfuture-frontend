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
import { PDFDocument, PDFName, degrees, StandardFonts } from "pdf-lib";
import { extractPdf } from "@/lib/pdf/extract";
import { renderPageRgb } from "@/lib/pdf/pdfium";
import { PNG } from "pngjs";
import { packBest, type NestRect, type PackResult } from "@/lib/nest/pack";
import { parseVectorUnits, groupUnits, emitUnit, type VUnit, type VGroup, type Mat } from "@/lib/nest/vector";
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
};

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
    for (const pl of packed.placements) {
      if (pl.bin !== i) continue;
      const pc = pieces[pl.id];
      const embedded = await doc.embedPage(src.getPage(pc.page), pc.clip);
      const X = pl.x * PT, Y = pl.y * PT;
      if (!pl.rotated) page.drawPage(embedded, { x: X, y: Y });
      else page.drawPage(embedded, { x: X + pl.w * PT, y: Y, rotate: degrees(90) });
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
