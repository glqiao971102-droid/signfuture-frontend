// Faithful port of ai_measure_boxup.py analyze_ai(..., fast=True) — the mode the
// original Node server always used. Vector parsing is exact; letter detection
// uses pdfium-WASM rasterization (same engine as the original pypdfium2).
import { extractPdf } from "@/lib/pdf/extract";
import { renderPageRgb, type RenderedPage } from "@/lib/pdf/pdfium";
import { rasterWordDimensions, rasterContentBbox, type RasterEntry } from "@/lib/boxup/raster";
import {
  PdfPathAnalyzer,
  POINTS_PER_INCH,
  METERS_PER_POINT,
  isNeonColor,
  summarizeNeonColors,
  unionBbox,
  chooseClipBbox,
  designBboxesForPage,
  strokesForBbox,
  bboxToInches,
  outlineLetterDimensions,
  type Bbox,
  type BboxIn,
  type ColorRow,
  type LetterEntry,
  type Stroke,
  type FillPath,
} from "@/lib/pdf/vector";
import { fixed0 } from "@/lib/pdf/pyfmt";
import { PNG } from "pngjs";

type AnyLetter = LetterEntry | RasterEntry;

export type BoxupArtboard = {
  name: string;
  page: number;
  page_size_in: { width_in: number; height_in: number };
  content_bbox_in: BboxIn | null;
  letter_dimensions: AnyLetter[];
  clipping_bbox_in: BboxIn | null;
  design_image_bbox_in: BboxIn | null;
  total_length_m_neon: number;
  path_count_neon: number;
  by_color: ColorRow[];
  designs: BoxupDesign[];
  dimension_preview_url: string | null;
  artwork_preview_url: string | null;
  line_preview_url: string | null;
};
type BoxupDesign = {
  name: string;
  page: number;
  design: number;
  content_bbox_in: BboxIn | null;
  letter_dimensions: AnyLetter[];
  total_length_m_neon: number;
  path_count_neon: number;
  by_color: ColorRow[];
  dimension_preview_url: string | null;
  artwork_preview_url: string | null;
  line_preview_url: string | null;
};
export type BoxupResult = {
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
  strokes: never[];
  letter_dimensions: AnyLetter[];
  artboards: BoxupArtboard[];
  dimension_preview_url: string | null;
  artwork_preview_url: string | null;
  line_preview_url: string | null;
};

const RENDER_SCALE = 1.0; // fast mode

export async function analyzeBoxup(bytes: Uint8Array, fileName: string, measurementScale = 1.0): Promise<BoxupResult> {
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

  // Render each page once; reuse for word + content-bbox detection and previews.
  const rendered = new Map<number, RenderedPage | null>();
  const rasterDims = new Map<number, RasterEntry[]>();
  const rasterContent = new Map<number, Bbox | null>();
  for (const page of pages) {
    const r = await renderPageRgb(bytes, page.page - 1, RENDER_SCALE);
    rendered.set(page.page, r);
    rasterDims.set(page.page, r ? rasterWordDimensions(r, scale, 120, RENDER_SCALE) : []);
    rasterContent.set(page.page, r ? rasterContentBbox(r, RENDER_SCALE) : null);
  }

  const artboards: BoxupArtboard[] = [];
  for (const page of pages) {
    const pageNumber = page.page;
    const pageStrokes = analyzer.strokes.filter((s) => s.page === pageNumber);
    const pageFills = analyzer.fills.filter((s) => s.page === pageNumber);
    const pageNeon = pageStrokes.filter((s) => isNeonColor(s.color));
    const pageImages = analyzer.images.filter((i) => i.page === pageNumber);
    const pageClips = analyzer.clips.filter((c) => c.page === pageNumber);
    const pageImageBbox = unionBbox(pageImages);
    const pageClipBbox = chooseClipBbox(pageClips, pageImageBbox);
    const pageContentBbox = rasterContent.get(pageNumber) || pageClipBbox || pageImageBbox || unionBbox(pageNeon);
    if (pageContentBbox === null && pageNeon.length === 0) continue;
    const designBboxes = designBboxesForPage(pageClips, pageImages, pageNeon, [page.width_pt, page.height_pt]);

    const designs: BoxupDesign[] = [];
    designBboxes.forEach((designBbox, idx) => {
      const designIndex = idx + 1;
      const designStrokes = strokesForBbox(pageStrokes, designBbox);
      const designFills = strokesForBbox(pageFills as { bbox: Bbox }[], designBbox) as FillPath[];
      const designNeon = designStrokes.filter((s) => isNeonColor(s.color));
      const letters =
        (designBboxes.length <= 1 ? rasterDims.get(pageNumber) : null) ||
        outlineLetterDimensions((designFills.length ? designFills : designStrokes) as { bbox: Bbox }[], scale, designBbox);
      designs.push({
        name: `Design ${designIndex}`,
        page: pageNumber,
        design: designIndex,
        content_bbox_in: bboxToInches(designBbox, scale),
        letter_dimensions: nonEmpty(letters),
        total_length_m_neon: designNeon.reduce((a, s) => a + s.lengthPt, 0) * METERS_PER_POINT * scale,
        path_count_neon: designNeon.length,
        by_color: summarizeNeonColors(designStrokes, scale),
        dimension_preview_url: buildDimensionPreview(rendered.get(pageNumber) || null, designBbox, page.height_pt, scale),
        // Signboard wants the WHOLE uploaded artboard, not the trimmed content.
        artwork_preview_url: buildArtworkCrop(rendered.get(pageNumber) || null, [0, 0, page.width_pt, page.height_pt], page.height_pt)?.url ?? null,
        line_preview_url: buildLinePreview(designStrokes, designBbox),
      });
    });
    const single = designs.length <= 1;
    const letters =
      rasterDims.get(pageNumber) ||
      outlineLetterDimensions((pageFills.length ? pageFills : pageStrokes) as { bbox: Bbox }[], scale, pageContentBbox);
    artboards.push({
      name: `Artboard ${pageNumber}`,
      page: pageNumber,
      page_size_in: { width_in: page.width_in, height_in: page.height_in },
      content_bbox_in: bboxToInches(pageContentBbox, scale),
      letter_dimensions: nonEmpty(letters),
      clipping_bbox_in: bboxToInches(pageClipBbox, scale),
      design_image_bbox_in: bboxToInches(pageImageBbox, scale),
      total_length_m_neon: pageNeon.reduce((a, s) => a + s.lengthPt, 0) * METERS_PER_POINT * scale,
      path_count_neon: pageNeon.length,
      by_color: summarizeNeonColors(pageStrokes, scale),
      designs,
      dimension_preview_url: single ? buildDimensionPreview(rendered.get(pageNumber) || null, pageContentBbox, page.height_pt, scale) : null,
      artwork_preview_url: single ? (buildArtworkCrop(rendered.get(pageNumber) || null, [0, 0, page.width_pt, page.height_pt], page.height_pt)?.url ?? null) : null,
      line_preview_url: single ? buildLinePreview(pageStrokes, pageContentBbox) : null,
    });
  }

  const page1Content = rasterContent.get(1) || contentBbox;
  const topLetters =
    rasterDims.get(1) ||
    outlineLetterDimensions((analyzer.fills.length ? analyzer.fills : analyzer.strokes) as { bbox: Bbox }[], scale, contentBbox);

  return {
    file: fileName,
    pages,
    path_count_all: analyzer.strokes.length,
    path_count_neon: neonStrokes.length,
    measurement_scale: scale,
    content_bbox_in: bboxToInches(page1Content, scale),
    clipping_bbox_in: bboxToInches(clipBbox, scale),
    design_image_bbox_in: bboxToInches(imageBbox, scale),
    all_stroked_bbox_in: bboxToInches(allStrokedBbox, scale),
    total_length_m_all_stroked_paths: totalPtAll * METERS_PER_POINT * scale,
    total_length_m_neon: totalPtNeon * METERS_PER_POINT * scale,
    by_color: summarizeNeonColors(analyzer.strokes, scale),
    strokes: [],
    letter_dimensions: nonEmpty(topLetters),
    artboards,
    dimension_preview_url: buildDimensionPreview(rendered.get(1) || null, page1Content, pages[0]?.height_pt ?? 0, scale),
    artwork_preview_url: buildArtworkCrop(rendered.get(1) || null, [0, 0, pages[0]?.width_pt ?? 0, pages[0]?.height_pt ?? 0], pages[0]?.height_pt ?? 0)?.url ?? null,
    line_preview_url: buildLinePreview(analyzer.strokes, page1Content),
  };
}

function nonEmpty(list: AnyLetter[]): AnyLetter[] {
  return list.length ? list : [];
}

// ---- previews ----
function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Dimension preview: crop the rendered artwork to the content bbox and add the
// blue dimension lines + integer-inch labels (mirrors save_dimension_preview).
// Clean crop of the artwork to the content bbox (no annotations). Used as the
// 3D Signboard flat-preview texture and embedded inside the dimension preview.
// Returns { url, dw, dh } so callers can reuse the rendered image.
function buildArtworkCrop(
  page: RenderedPage | null,
  contentBbox: Bbox | null,
  pageHeightPt: number,
  maxH = 560,
): { url: string; dw: number; dh: number } | null {
  if (!page || contentBbox === null) return null;
  const { width: imgW, height: imgH, rgb } = page;
  // content bbox (PDF points, y-up) -> pixel rect (y-down)
  const px1 = Math.max(0, Math.round(contentBbox[0] * RENDER_SCALE));
  const py1 = Math.max(0, Math.round((pageHeightPt - contentBbox[3]) * RENDER_SCALE));
  const px2 = Math.min(imgW, Math.round(contentBbox[2] * RENDER_SCALE));
  const py2 = Math.min(imgH, Math.round((pageHeightPt - contentBbox[1]) * RENDER_SCALE));
  const cw = Math.max(1, px2 - px1);
  const ch = Math.max(1, py2 - py1);
  // scale design to max height (keeps aspect) — matches save_dimension_preview
  const ratio = Math.min(maxH / ch, 1);
  const dw = Math.max(1, Math.round(cw * ratio));
  const dh = Math.max(1, Math.round(ch * ratio));
  const out = new PNG({ width: dw, height: dh });
  for (let dy = 0; dy < dh; dy++) {
    const sy = py1 + Math.min(ch - 1, Math.floor((dy / dh) * ch));
    for (let dx = 0; dx < dw; dx++) {
      const sx = px1 + Math.min(cw - 1, Math.floor((dx / dw) * cw));
      const si = (sy * imgW + sx) * 3;
      const di = (dy * dw + dx) * 4;
      out.data[di] = rgb[si];
      out.data[di + 1] = rgb[si + 1];
      out.data[di + 2] = rgb[si + 2];
      out.data[di + 3] = 255;
    }
  }
  return { url: "data:image/png;base64," + PNG.sync.write(out).toString("base64"), dw, dh };
}

function buildDimensionPreview(page: RenderedPage | null, contentBbox: Bbox | null, pageHeightPt: number, scale = 1.0): string | null {
  if (!page || contentBbox === null) return null;
  const crop = buildArtworkCrop(page, contentBbox, pageHeightPt);
  if (!crop) return null;
  const cropUrl = crop.url;
  const dw = crop.dw;
  const dh = crop.dh;

  const widthIn = ((contentBbox[2] - contentBbox[0]) / POINTS_PER_INCH) * scale;
  const heightIn = ((contentBbox[3] - contentBbox[1]) / POINTS_PER_INCH) * scale;
  const ml = 62, mt = 58, mr = 132, mb = 30;
  const W = dw + ml + mr;
  const H = dh + mt + mb;
  const dim = "rgb(28,88,210)";
  const lw = 4, tick = 12;
  const x = ml, y = mt;
  const topY = y - 26;
  const rightX = x + dw + 26;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <rect width="${W}" height="${H}" fill="white"/>
    <image x="${ml}" y="${mt}" width="${dw}" height="${dh}" href="${cropUrl}"/>
    <line x1="${x}" y1="${topY}" x2="${x + dw}" y2="${topY}" stroke="${dim}" stroke-width="${lw}"/>
    <line x1="${x}" y1="${topY - tick}" x2="${x}" y2="${topY + tick}" stroke="${dim}" stroke-width="${lw}"/>
    <line x1="${x + dw}" y1="${topY - tick}" x2="${x + dw}" y2="${topY + tick}" stroke="${dim}" stroke-width="${lw}"/>
    <text x="${x + dw / 2}" y="${topY - 14}" fill="${dim}" font-family="Arial,sans-serif" font-size="26" font-weight="bold" text-anchor="middle">${esc(fixed0(widthIn))} in</text>
    <line x1="${rightX}" y1="${y}" x2="${rightX}" y2="${y + dh}" stroke="${dim}" stroke-width="${lw}"/>
    <line x1="${rightX - tick}" y1="${y}" x2="${rightX + tick}" y2="${y}" stroke="${dim}" stroke-width="${lw}"/>
    <line x1="${rightX - tick}" y1="${y + dh}" x2="${rightX + tick}" y2="${y + dh}" stroke="${dim}" stroke-width="${lw}"/>
    <text x="${rightX + 12}" y="${y + dh / 2 + 8}" fill="${dim}" font-family="Arial,sans-serif" font-size="26" font-weight="bold" text-anchor="start">${esc(fixed0(heightIn))} in</text>
  </svg>`;
  return "data:image/svg+xml;base64," + Buffer.from(svg, "utf8").toString("base64");
}

// Line preview for any neon strokes (matches the neon analyzer's SVG output).
function buildLinePreview(strokes: Stroke[], contentBbox: Bbox | null): string | null {
  const neon = strokes.filter((s) => isNeonColor(s.color));
  if (neon.length === 0 || contentBbox === null) return null;
  const [x1, y1, x2, y2] = contentBbox;
  const widthPt = x2 - x1;
  const heightPt = y2 - y1;
  const sc = Math.min(560 / heightPt, 360 / widthPt);
  const pad = 28;
  const w = Math.round(widthPt * sc) + pad * 2;
  const h = Math.round(heightPt * sc) + pad * 2;
  const tx = (p: [number, number]): [number, number] => [pad + (p[0] - x1) * sc, pad + (y2 - p[1]) * sc];
  const parts: string[] = [];
  for (const stroke of neon) {
    const rgb = stroke.color;
    const colorHex = "#" + require_colorRgb(rgb);
    const sw = Math.max(2, Math.round(stroke.widthPt * sc));
    for (const seg of stroke.segments) {
      const pts: [number, number][] = seg[0] === "line" ? [seg[1], seg[2]] : flattenCubic(seg);
      const d = pts.map(tx).map((p) => `${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(" ");
      parts.push(`<polyline points="${d}" fill="none" stroke="${colorHex}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"/>`);
    }
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" fill="black"/>${parts.join("")}</svg>`;
  return "data:image/svg+xml;base64," + Buffer.from(svg, "utf8").toString("base64");
}
function flattenCubic(seg: ["cubic", [number, number], [number, number], [number, number], [number, number]]): [number, number][] {
  const out: [number, number][] = [];
  const [, p0, p1, p2, p3] = seg;
  for (let i = 0; i <= 24; i++) {
    const t = i / 24;
    const mt = 1 - t;
    out.push([
      mt ** 3 * p0[0] + 3 * mt ** 2 * t * p1[0] + 3 * mt * t ** 2 * p2[0] + t ** 3 * p3[0],
      mt ** 3 * p0[1] + 3 * mt ** 2 * t * p1[1] + 3 * mt * t ** 2 * p2[1] + t ** 3 * p3[1],
    ]);
  }
  return out;
}
function require_colorRgb(color: { space: string; values: number[] }): string {
  // local color->hex without importing (avoid cycle); CMYK/RGB like the python
  let rgb: number[];
  if (color.space === "CMYK") {
    const [c, m, y, k] = color.values;
    rgb = [Math.round(255 * (1 - c) * (1 - k)), Math.round(255 * (1 - m) * (1 - k)), Math.round(255 * (1 - y) * (1 - k))];
  } else if (color.space === "RGB") {
    rgb = color.values.map((v) => Math.max(0, Math.min(255, Math.round(v * 255))));
  } else rgb = [255, 255, 255];
  return rgb.map((v) => (v & 0xff).toString(16).padStart(2, "0")).join("");
}
