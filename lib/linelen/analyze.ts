// Black-line LENGTH analyzer for artwork (size + total metres of the black lines).
//
// Two modes, chosen automatically:
//  • VECTOR — if the file carries real drawn paths, we measure their exact length
//    (the same number Illustrator's Document Info reports). Preferred; accurate.
//  • RASTER — for a genuinely flattened image (e.g. an .ai whose PDF only holds a
//    rasterised preview), we render it (pdfium), threshold the dark pixels, and
//    estimate length as ink AREA ÷ stroke WIDTH. This is inherently an estimate
//    (~±20%): a thick-stroke drawing's pixels carry more line-area than the ideal
//    centerline (corners/joins/caps), and a thinned skeleton over-counts even more.
import { PNG } from "pngjs";
import { renderPageRgb } from "@/lib/pdf/pdfium";
import { extractPdf } from "@/lib/pdf/extract";
import { analyzeNeon } from "@/lib/neon/analyze";

const POINTS_PER_INCH = 72;
const CM_PER_INCH = 2.54;
// A pixel is a black line when its real colour is genuinely dark (luminance below
// this). We threshold the ORIGINAL-colour buffer — NOT the box-up normalised
// buffer, which turns a photo's white background black too.
const DARK = 128;
// Render pixel budget — kept within serverless memory/time (one render ≈ 4–5s).
const BUDGET_HI = 20_000_000;

export type LineLengthResult = {
  file: string;
  // "vector": exact length read from the file's real vector paths (matches
  // Illustrator). "raster": estimate from the flattened pixels (~±20%).
  mode: "vector" | "raster";
  measurementScale: number;
  renderScale: number;
  dpi: number;
  pageWidthIn: number;
  pageHeightIn: number;
  contentWidthIn: number;
  contentHeightIn: number;
  // The headline: total length of the black lines.
  lengthMetres: number;
  lengthFeet: number;
  lineWidthMm: number;
  inkPixels: number;
  skeletonPixels: number;
  vectorPaths: number;
  previewDataUrl: string;
};

/** Does the PDF content actually contain drawn vector paths (not just an image)? */
function hasVectorPaths(pages: Awaited<ReturnType<typeof extractPdf>>): boolean {
  for (const p of pages) {
    const t = Buffer.from(p.content).toString("latin1");
    // path construction (m/l/c/v/y/re) AND a paint op (S/s/f/F/B/b) present.
    if (/(^|\s)(m|l|c|v|y|re)\s/.test(t) && /(^|\s)(S|s|f|F|B|b|f\*|B\*)\s/.test(t)) return true;
  }
  return false;
}

type Measured = {
  w: number;
  h: number;
  ink: Uint8Array;
  skel: Uint8Array;
  inkCount: number;
  minX: number; minY: number; maxX: number; maxY: number;
  dpi: number;
};

/**
 * Typical stroke width (px), measured on the "clean body" of the strokes — the
 * skeleton with a margin around every junction and line-end removed (those spots
 * distort any width reading). Width is the PERPENDICULAR ink run-length across the
 * stroke at each body point, which — unlike a distance transform — is immune to
 * neighbouring strokes running close by (the transform would report the gap to the
 * neighbour, reading too thin in dense art and making the length read too long).
 */
function cleanBodyWidthPx(ink: Uint8Array, skel: Uint8Array, dt: Float32Array, w: number, h: number): number {
  const nbrsOf = (i: number): number[] => {
    const x = i % w, y = (i / w) | 0;
    const out: number[] = [];
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < w && ny < h && skel[ny * w + nx]) out.push(ny * w + nx);
    }
    return out;
  };
  let sum0 = 0, n0 = 0;
  for (let i = 0; i < skel.length; i++) if (skel[i]) { sum0 += dt[i]; n0++; }
  if (!n0) return 0;
  const meanHalf = sum0 / n0;
  const R = Math.max(2, Math.round(meanHalf * 1.5));

  // Exclude junctions (≥3 neighbours) and ends (≤1), plus R skeleton-steps around
  // them, so widths are read only where a stroke runs cleanly on its own.
  const excl = new Uint8Array(skel.length);
  let frontier: number[] = [];
  for (let i = 0; i < skel.length; i++) {
    if (skel[i] && nbrsOf(i).length !== 2) { excl[i] = 1; frontier.push(i); }
  }
  for (let step = 0; step < R && frontier.length; step++) {
    const next: number[] = [];
    for (const p of frontier) for (const q of nbrsOf(p)) if (!excl[q]) { excl[q] = 1; next.push(q); }
    frontier = next;
  }

  const inkAt = (x: number, y: number) => (x >= 0 && y >= 0 && x < w && y < h && ink[y * w + x] ? 1 : 0);
  // Walk K steps along the skeleton from `start` heading away from `prev`, to get
  // a point for a SMOOTHED tangent (an immediate-neighbour tangent is quantised to
  // 45°, so the perpendicular crosses obliquely and over-measures the width).
  const walkK = (start: number, prev: number, K: number): number => {
    let cur = start, pr = prev;
    for (let k = 0; k < K; k++) {
      const nx = nbrsOf(cur).filter((q) => q !== pr);
      if (nx.length !== 1) break;
      pr = cur; cur = nx[0];
    }
    return cur;
  };
  const maxW = Math.max(6, Math.round(meanHalf * 4)); // cap the perpendicular walk
  const widths: number[] = [];
  for (let i = 0; i < skel.length; i++) {
    if (!skel[i] || excl[i]) continue;
    const ns = nbrsOf(i);
    if (ns.length !== 2) continue;
    const x = i % w, y = (i / w) | 0;
    const a = walkK(ns[0], i, 3), b = walkK(ns[1], i, 3); // smoothed tangent endpoints
    const tx = (b % w) - (a % w), ty = ((b / w) | 0) - ((a / w) | 0);
    const tl = Math.hypot(tx, ty) || 1;
    const pxv = -ty / tl, pyv = tx / tl;
    let dp = 0; for (let t = 0.5; t <= maxW; t += 0.5) { if (inkAt(Math.round(x + pxv * t), Math.round(y + pyv * t))) dp = t; else break; }
    let dm = 0; for (let t = 0.5; t <= maxW; t += 0.5) { if (inkAt(Math.round(x - pxv * t), Math.round(y - pyv * t))) dm = t; else break; }
    widths.push(dp + dm + 1);
  }
  if (widths.length < n0 * 0.05) return meanHalf * 2; // dense art fallback
  // TRIMMED MEAN width: since ink area = Σ (segment length × its width), area ÷
  // mean-width = total length (exact even for mixed stroke weights). We trim the
  // extreme 20% each end first, so leftover junction/edge outliers don't skew it.
  widths.sort((a, b) => a - b);
  const lo = Math.floor(widths.length * 0.2), hi2 = Math.ceil(widths.length * 0.8);
  let s = 0, c = 0;
  for (let k = lo; k < hi2; k++) { s += widths[k]; c++; }
  const wPx = c ? s / c : widths[widths.length >> 1];
  // Anti-aliased edges make the run-length read ~4% wide (the last <50%-covered
  // pixel is still counted). Correcting it centres the length on the true value
  // instead of reading a few % low — validated across the line/circle/shrimp cases.
  return wPx * 0.96;
}

/** In-place Zhang-Suen thinning of a binary mask (1 = foreground). */
function zhangSuenThin(bin: Uint8Array, w: number, h: number): number {
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : bin[y * w + x]);
  let changed = true;
  let guard = 0;
  while (changed && guard < 5000) {
    changed = false;
    guard++;
    for (let step = 0; step < 2; step++) {
      const remove: number[] = [];
      for (let y = 1; y < h - 1; y++) {
        const row = y * w;
        for (let x = 1; x < w - 1; x++) {
          if (!bin[row + x]) continue;
          const p2 = at(x, y - 1), p3 = at(x + 1, y - 1), p4 = at(x + 1, y), p5 = at(x + 1, y + 1);
          const p6 = at(x, y + 1), p7 = at(x - 1, y + 1), p8 = at(x - 1, y), p9 = at(x - 1, y - 1);
          const B = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9;
          if (B < 2 || B > 6) continue;
          const seq = [p2, p3, p4, p5, p6, p7, p8, p9];
          let A = 0;
          for (let i = 0; i < 8; i++) if (seq[i] === 0 && seq[(i + 1) % 8] === 1) A++;
          if (A !== 1) continue;
          if (step === 0) {
            if (p2 * p4 * p6 !== 0) continue;
            if (p4 * p6 * p8 !== 0) continue;
          } else {
            if (p2 * p4 * p8 !== 0) continue;
            if (p2 * p6 * p8 !== 0) continue;
          }
          remove.push(row + x);
        }
      }
      if (remove.length) {
        changed = true;
        for (const i of remove) bin[i] = 0;
      }
    }
  }
  let count = 0;
  for (let i = 0; i < bin.length; i++) if (bin[i]) count++;
  return count;
}

/** Two-pass chamfer distance transform → each ink pixel's distance to background. */
function distanceTransform(ink: Uint8Array, w: number, h: number): Float32Array {
  const dt = new Float32Array(w * h);
  for (let i = 0; i < dt.length; i++) dt[i] = ink[i] ? 1e9 : 0;
  const d1 = 1, d2 = Math.SQRT2;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x; if (dt[i] === 0) continue;
    let m = dt[i];
    if (x > 0) m = Math.min(m, dt[i - 1] + d1);
    if (y > 0) m = Math.min(m, dt[i - w] + d1);
    if (x > 0 && y > 0) m = Math.min(m, dt[i - w - 1] + d2);
    if (x < w - 1 && y > 0) m = Math.min(m, dt[i - w + 1] + d2);
    dt[i] = m;
  }
  for (let y = h - 1; y >= 0; y--) for (let x = w - 1; x >= 0; x--) {
    const i = y * w + x; if (dt[i] === 0) continue;
    let m = dt[i];
    if (x < w - 1) m = Math.min(m, dt[i + 1] + d1);
    if (y < h - 1) m = Math.min(m, dt[i + w] + d1);
    if (x < w - 1 && y < h - 1) m = Math.min(m, dt[i + w + 1] + d2);
    if (x > 0 && y < h - 1) m = Math.min(m, dt[i + w - 1] + d2);
    dt[i] = m;
  }
  return dt;
}

/** Render one scale, threshold, thin — the per-scale measurement. */
async function measureAt(bytes: Uint8Array, scale: number): Promise<Measured | null> {
  const page = await renderPageRgb(bytes, 0, scale);
  if (!page) return null;
  const { width: w, height: h, rgbColor } = page;
  const ink = new Uint8Array(w * h);
  let inkCount = 0;
  let minX = w, minY = h, maxX = -1, maxY = -1;
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      const k = (row + x) * 3;
      const lum = 0.299 * rgbColor[k] + 0.587 * rgbColor[k + 1] + 0.114 * rgbColor[k + 2];
      if (lum < DARK) {
        ink[row + x] = 1;
        inkCount++;
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
    }
  }
  const skel = ink.slice();
  zhangSuenThin(skel, w, h);
  return { w, h, ink, skel, inkCount, minX, minY, maxX, maxY, dpi: scale * POINTS_PER_INCH };
}

/** Downscaled preview PNG: black lines in grey, measured centerline in red. */
function buildPreview(ink: Uint8Array, skel: Uint8Array, w: number, h: number): string {
  const step = Math.max(1, Math.ceil(Math.max(w, h) / 1100));
  const pw = Math.max(1, Math.ceil(w / step));
  const ph = Math.max(1, Math.ceil(h / step));
  const png = new PNG({ width: pw, height: ph });
  png.data.fill(255);
  for (let y = 0; y < h; y++) {
    const oy = Math.floor(y / step);
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!ink[i] && !skel[i]) continue;
      const j = (oy * pw + Math.floor(x / step)) * 4;
      if (skel[i]) { png.data[j] = 235; png.data[j + 1] = 40; png.data[j + 2] = 60; png.data[j + 3] = 255; }
      else if (png.data[j] === 255 && png.data[j + 1] === 255) { png.data[j] = 178; png.data[j + 1] = 184; png.data[j + 2] = 194; }
    }
  }
  return `data:image/png;base64,${PNG.sync.write(png).toString("base64")}`;
}

export async function analyzeLineLength(
  bytes: Uint8Array,
  fileName: string,
  measurementScale = 1,
  renderScaleOverride?: number
): Promise<LineLengthResult> {
  const scaleReq = measurementScale > 0 ? measurementScale : 1;
  const r2 = (n: number) => Math.round(n * 100) / 100;

  const pages = await extractPdf(bytes);
  if (!pages.length) throw new Error("Could not read the artwork pages.");
  const p0 = pages[0];
  const wPt = p0.widthPt || POINTS_PER_INCH;
  const hPt = p0.heightPt || POINTS_PER_INCH;
  const areaPt = Math.max(1, wPt * hPt);

  // ---- Vector path: if the file carries real drawn paths, measure them exactly
  // (this is what Illustrator's Document Info "length" reports). Only a genuinely
  // flattened raster image falls through to the pixel estimate below.
  if (!renderScaleOverride && hasVectorPaths(pages)) {
    const neon = await analyzeNeon(bytes, fileName, scaleReq);
    if (neon.path_count_all > 0) {
      const cb = neon.content_bbox_in ?? neon.all_stroked_bbox_in ?? { width_in: 0, height_in: 0 };
      return {
        file: fileName,
        mode: "vector",
        measurementScale: scaleReq,
        renderScale: 1,
        dpi: 0,
        pageWidthIn: r2(wPt / POINTS_PER_INCH * scaleReq),
        pageHeightIn: r2(hPt / POINTS_PER_INCH * scaleReq),
        contentWidthIn: r2(cb.width_in),
        contentHeightIn: r2(cb.height_in),
        lengthMetres: r2(neon.total_length_m_all_stroked_paths),
        lengthFeet: r2(neon.total_length_m_all_stroked_paths * 3.28084),
        lineWidthMm: 0,
        inkPixels: 0,
        skeletonPixels: 0,
        vectorPaths: neon.path_count_all,
        previewDataUrl: neon.line_preview_url || neon.dimension_preview_url || "",
      };
    }
  }

  const hiScale = renderScaleOverride && renderScaleOverride > 0
    ? renderScaleOverride
    : Math.min(4, Math.max(0.9, Math.sqrt(BUDGET_HI / areaPt)));

  const hi = await measureAt(bytes, hiScale);
  if (!hi) throw new Error("Could not render the artwork.");

  const pxPerCmHi = (hi.dpi / scaleReq) / CM_PER_INCH;

  // Stroke width = trimmed-mean perpendicular thickness over the clean stroke
  // bodies, so ink AREA ÷ WIDTH recovers the centerline length. Validated to
  // within ~5% against known vector lengths (line, circle, and this shrimp/fish).
  const dt = distanceTransform(hi.ink, hi.w, hi.h);
  const widthPx = cleanBodyWidthPx(hi.ink, hi.skel, dt, hi.w, hi.h);
  const lineWidthMm = pxPerCmHi > 0 ? (widthPx / pxPerCmHi) * 10 : 0;

  // Length = total black-ink AREA ÷ mean stroke WIDTH. For a line drawing this
  // equals the centerline length, is stable across resolution, and (unlike a
  // thinned skeleton) does not over-count every corner/junction of a thick stroke.
  const lengthMetres = widthPx > 0 ? hi.inkCount / widthPx / pxPerCmHi / 100 : 0;

  // Real-inch sizes: page from points; content from the ink bounding box.
  const pageWidthIn = wPt / POINTS_PER_INCH * scaleReq;
  const pageHeightIn = hPt / POINTS_PER_INCH * scaleReq;
  const inchPerPx = (1 / hi.dpi) * scaleReq;
  const contentWidthIn = hi.maxX >= hi.minX ? (hi.maxX - hi.minX + 1) * inchPerPx : 0;
  const contentHeightIn = hi.maxY >= hi.minY ? (hi.maxY - hi.minY + 1) * inchPerPx : 0;

  return {
    file: fileName,
    mode: "raster",
    measurementScale: scaleReq,
    renderScale: r2(hiScale),
    dpi: Math.round(hi.dpi),
    pageWidthIn: r2(pageWidthIn),
    pageHeightIn: r2(pageHeightIn),
    contentWidthIn: r2(contentWidthIn),
    contentHeightIn: r2(contentHeightIn),
    lengthMetres: r2(lengthMetres),
    lengthFeet: r2(lengthMetres * 3.28084),
    lineWidthMm: r2(lineWidthMm),
    inkPixels: hi.inkCount,
    skeletonPixels: hi.skel.reduce((a: number, v: number) => a + v, 0),
    vectorPaths: 0,
    previewDataUrl: buildPreview(hi.ink, hi.skel, hi.w, hi.h),
  };
}
