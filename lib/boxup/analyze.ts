// Faithful port of ai_measure_boxup.py analyze_ai(..., fast=True) — the mode the
// original Node server always used. Vector parsing is exact; letter detection
// uses pdfium-WASM rasterization (same engine as the original pypdfium2).
import { extractPdf } from "@/lib/pdf/extract";
import { renderPageRgb, type RenderedPage } from "@/lib/pdf/pdfium";
import { rasterWordDimensions, rasterContentBbox, recordsFromSpec, type RasterEntry, type SpecItem } from "@/lib/boxup/raster";
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
  original_preview_url: string | null;
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
  original_preview_url: string | null;
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
  original_preview_url: string | null;
  artwork_preview_url: string | null;
  line_preview_url: string | null;
};

// Detection resolution is chosen per page. A ~1.2in letter at 72 DPI (scale 1.0)
// is only ~86px, so the sub-pixel gap between two stacked letters is bridged by
// anti-aliasing and they merge into one record. We render small/normal artboards
// at up to 3x so those gaps become real blank rows and letters separate — while
// capping total pixels so a huge signboard (already ~60M px at 1x) stays at 1x
// and never blows up memory.
// Detection runs at the artwork's native 72 DPI. Raising this splits letters that
// touch at sub-pixel gaps, but it also shatters a multi-coloured logo (a mascot)
// into its parts — and since letters and logos can't be told apart by geometry
// alone, the user chose to keep logos whole (touching letters can be split by hand
// with the Group button). MAX_RENDER_SCALE = 1.0 keeps everything at native res.
const RENDER_PIXEL_BUDGET = 48_000_000;
const MAX_RENDER_SCALE = 1.0;
function computeRenderScale(widthPt: number, heightPt: number): number {
  const area = Math.max(1, widthPt * heightPt);
  const s = Math.sqrt(RENDER_PIXEL_BUDGET / area);
  return Math.max(1.0, Math.min(MAX_RENDER_SCALE, s));
}

// A logo/illustration is a DENSE cluster of overlapping vector fills (a mascot =
// 100+ layered shapes, each SMALL relative to the whole); a letter is 1–2 fills.
// We cluster fills by bbox overlap and return the union bbox of clusters that (a)
// have >= minFills members and (b) are DENSE — the average member fill is tiny vs
// the cluster area. Condition (b) is scale-invariant and rejects "chains" of
// letter-sized fills (tight/italic wording, decorative panels) that merely touch
// bboxes, which count alone would wrongly promote to a logo. The union bbox is the
// logo's true extent (matching the AI file); the raster box under-measures it
// because light-coloured edges fall below the non-white threshold. `boxes` must
// already exclude the full-page background (which would chain everything).
const bboxArea = (b: Bbox) => Math.max(0, b[2] - b[0]) * Math.max(0, b[3] - b[1]);
const bboxOverlap = (a: Bbox, b: Bbox) =>
  Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0])) *
  Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]));

// Given the raw member fills of a logo cluster, return the logo's TRUE bbox —
// tight to the artwork, excluding letters that merely touch it above/below.
// The raw union over-reaches: a letter stacked under the mascot bbox-intersects
// its edge and union-find chains it in, stretching the height (e.g. a 3.85in
// mascot read 5.33in tall). Two passes fix it:
//   pass 1 — grow a "core" from the LARGEST fill (the body), absorbing any fill
//     that sits >=50% of its own area inside the core. This settles on the logo's
//     real vertical BAND; a letter above/below only clips the edge (<50%) and stays out.
//   pass 2 — union every member that lives (>=50% of its height) inside that band.
//     This pulls the side props/arms (at the logo's level) back in to recover the
//     true WIDTH, while the out-of-band letters remain excluded.
function refineLogoBbox(members: Bbox[]): Bbox {
  if (members.length === 0) return [0, 0, 0, 0];
  let seed = members[0];
  for (const m of members) if (bboxArea(m) > bboxArea(seed)) seed = m;
  let core: Bbox = [seed[0], seed[1], seed[2], seed[3]];
  const used = new Array(members.length).fill(false);
  let changed = true;
  while (changed) {
    changed = false;
    for (let i = 0; i < members.length; i++) {
      if (used[i]) continue;
      const m = members[i];
      if (bboxOverlap(m, core) >= 0.5 * Math.max(1, bboxArea(m))) {
        core = [Math.min(core[0], m[0]), Math.min(core[1], m[1]), Math.max(core[2], m[2]), Math.max(core[3], m[3])];
        used[i] = true; changed = true;
      }
    }
  }
  const y0 = core[1], y1 = core[3];
  let out: Bbox = [Infinity, Infinity, -Infinity, -Infinity];
  for (const m of members) {
    const yov = Math.max(0, Math.min(m[3], y1) - Math.max(m[1], y0));
    const mh = m[3] - m[1];
    if (mh > 0 && yov >= 0.5 * mh) {
      out = [Math.min(out[0], m[0]), Math.min(out[1], m[1]), Math.max(out[2], m[2]), Math.max(out[3], m[3])];
    }
  }
  return out[0] === Infinity ? core : out;
}

function denseFillClusters(boxes: Bbox[], minFills = 15): Bbox[] {
  const n = boxes.length;
  // O(n^2) — cap to protect the request thread (matches the raster split cap).
  if (n < minFills || n > 4000) return [];
  const area = bboxArea;
  const parent = boxes.map((_, i) => i);
  const find = (i: number): number => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
  const intersects = (a: Bbox, b: Bbox) => Math.min(a[2], b[2]) > Math.max(a[0], b[0]) && Math.min(a[3], b[3]) > Math.max(a[1], b[1]);
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (intersects(boxes[i], boxes[j])) { const a = find(i), b = find(j); if (a !== b) parent[b] = a; }
    }
  }
  const groups = new Map<number, { members: Bbox[]; box: Bbox }>();
  boxes.forEach((b, i) => {
    const r = find(i), g = groups.get(r);
    if (!g) groups.set(r, { members: [b], box: [b[0], b[1], b[2], b[3]] });
    else { g.members.push(b); g.box[0] = Math.min(g.box[0], b[0]); g.box[1] = Math.min(g.box[1], b[1]); g.box[2] = Math.max(g.box[2], b[2]); g.box[3] = Math.max(g.box[3], b[3]); }
  });
  const result: Bbox[] = [];
  for (const g of groups.values()) {
    if (g.members.length < minFills) continue;
    const clusterArea = Math.max(1, area(g.box));
    // MEDIAN member fill vs cluster area — robust to a logo's few big base shapes
    // (body/circle). A logo is mostly tiny details (median tiny); a chain of letters
    // has letter-sized members (median large) and is rejected. Scale-invariant.
    const sorted = g.members.map(area).sort((x, y) => x - y);
    const medianFraction = sorted[sorted.length >> 1] / clusterArea;
    // Trim the raw union to the logo's real extent (drop touching letters).
    if (medianFraction < 0.02) result.push(refineLogoBbox(g.members));
  }
  return result;
}

// A ".spec.json" exported from Illustrator by Specify-Export.jsx: each record's
// exact grouping, size and position (artboard-relative points, y-down from top).
export type BoxupSpec = {
  artboard_w_pt?: number;
  artboard_h_pt?: number;
  records: { name?: string; type?: string; x_pt: number; y_pt: number; w_pt: number; h_pt: number }[];
};

export async function analyzeBoxup(bytes: Uint8Array, fileName: string, measurementScale = 1.0, spec: BoxupSpec | null = null): Promise<BoxupResult> {
  const scale = measurementScale || 1.0;
  const specRecords = spec && Array.isArray(spec.records) && spec.records.length > 0 ? spec : null;
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
  const renderScales = new Map<number, number>();
  const rasterDims = new Map<number, RasterEntry[]>();
  const rasterContent = new Map<number, Bbox | null>();
  for (const page of pages) {
    const renderScale = computeRenderScale(page.width_pt, page.height_pt);
    renderScales.set(page.page, renderScale);
    const r = await renderPageRgb(bytes, page.page - 1, renderScale);
    rendered.set(page.page, r);
    // If an Illustrator spec was uploaded, build records straight from it (exact
    // grouping + sizes from the file) instead of detecting from pixels. Spec coords
    // are artboard-relative points, y-down from the artboard top == the rendered page.
    if (specRecords && page.page === 1 && r) {
      const sx = page.width_pt / (specRecords.artboard_w_pt || page.width_pt);
      const sy = page.height_pt / (specRecords.artboard_h_pt || page.height_pt);
      const items: SpecItem[] = specRecords.records
        .filter((rc) => rc.w_pt > 0 && rc.h_pt > 0)
        .map((rc) => {
          const X = rc.x_pt * sx, Y = rc.y_pt * sy, W = rc.w_pt * sx, H = rc.h_pt * sy;
          const wIn = (W / POINTS_PER_INCH) * scale, hIn = (H / POINTS_PER_INCH) * scale;
          // Label: an explicit text item is a Letter; otherwise big shapes are Logos,
          // small ones Letters (outlined text exports as graphics, so size decides).
          const isLogo = (rc.type || "graphic") === "text" ? false : Math.min(wIn, hIn) >= 2.0;
          return {
            box: [Math.round(X * renderScale), Math.round(Y * renderScale), Math.round((X + W) * renderScale), Math.round((Y + H) * renderScale)] as [number, number, number, number],
            isLogo,
            sizeIn: { x_in: (X / POINTS_PER_INCH) * scale, y_in: (Y / POINTS_PER_INCH) * scale, width_in: wIn, height_in: hIn },
          };
        });
      rasterDims.set(page.page, recordsFromSpec(r, items));
      rasterContent.set(page.page, rasterContentBbox(r, renderScale));
      continue;
    }
    // Compound-path (Ctrl+8) groups for this page, converted PDF points -> pixels
    // (y-up -> y-down), so raster detection keeps each group as one record.
    const toPx = ([x1, y1, x2, y2]: Bbox): Bbox =>
      [x1 * renderScale, (page.height_pt - y2) * renderScale, x2 * renderScale, (page.height_pt - y1) * renderScale];
    const fillGroupsPx: Bbox[] = analyzer.fillGroups.filter((g) => g.page === page.page).map((g) => toPx(g.bbox));
    // Vector fills (minus the full-page background, which would chain everything).
    const pageFillsPt: Bbox[] = analyzer.fills
      .filter((f) => f.page === page.page)
      .filter((f) => !((f.bbox[2] - f.bbox[0]) > page.width_pt * 0.85 && (f.bbox[3] - f.bbox[1]) > page.height_pt * 0.85))
      .map((f) => f.bbox);
    // Individual fills let raster detection split a few touching letters apart.
    const fillBoxesPx: Bbox[] = pageFillsPt.map(toPx);
    // Dense fill clusters = logos; their union bbox is the logo's true size (matches
    // the AI file). Raster logo records get snapped to these so light-edged logos
    // aren't under-measured. Exclude any near-full-page cluster (background/text).
    const logoClustersPt: Bbox[] = denseFillClusters(pageFillsPt)
      .filter((b) => !((b[2] - b[0]) > page.width_pt * 0.85 && (b[3] - b[1]) > page.height_pt * 0.85));
    const logoClustersPx: Bbox[] = logoClustersPt.map(toPx);
    // Clip paths are also true vector geometry: gradient artwork is often drawn as a
    // gradient FILL clipped to a letter/logo-shaped path, so `analyzer.fills` is empty
    // but each clip bbox IS a letter's exact shape (e.g. YOKOGAWA's 9 gradient letters
    // = 9 clips, 0 fills). Feed non-full-page clips into the vector-size snap too.
    const clipBoxesPx: Bbox[] = analyzer.clips
      .filter((c) => c.page === page.page)
      .map((c) => c.bbox)
      .filter((b) => !((b[2] - b[0]) > page.width_pt * 0.85 && (b[3] - b[1]) > page.height_pt * 0.85))
      .map(toPx);
    const recs = r ? rasterWordDimensions(r, scale, 120, renderScale, fillGroupsPx as [number, number, number, number][], fillBoxesPx as [number, number, number, number][], logoClustersPx as [number, number, number, number][], clipBoxesPx as [number, number, number, number][]) : [];
    // Override each logo record's SIZE with the exact vector dimensions (points ->
    // inches, no pixel round-trip), so the reported size equals the AI file exactly.
    // Match by SPATIAL identity — the record whose box contains the cluster centre —
    // not by size alone, so two similar-size logos can't be swapped; a used-set
    // prevents two clusters binding the same record.
    const usedRecs = new Set<RasterEntry>();
    for (const c of logoClustersPt) {
      const wIn = ((c[2] - c[0]) / POINTS_PER_INCH) * scale;
      const hIn = ((c[3] - c[1]) / POINTS_PER_INCH) * scale;
      const xIn = (c[0] / POINTS_PER_INCH) * scale;
      const yIn = ((page.height_pt - c[3]) / POINTS_PER_INCH) * scale;
      const cxIn = xIn + wIn / 2, cyIn = yIn + hIn / 2;
      let best: RasterEntry | null = null, bestDiff = Infinity;
      for (const rec of recs) {
        if (usedRecs.has(rec)) continue;
        const rx = rec.bbox_in.x_in, ry = rec.bbox_in.y_in, rw = rec.bbox_in.width_in, rh = rec.bbox_in.height_in;
        // The snapped logo record's box == the cluster box, so it contains the
        // cluster centre; a stray letter elsewhere does not.
        if (cxIn < rx || cxIn > rx + rw || cyIn < ry || cyIn > ry + rh) continue;
        const diff = Math.abs(rec.width_in - wIn) + Math.abs(rec.height_in - hIn);
        if (diff < bestDiff) { bestDiff = diff; best = rec; }
      }
      if (best) {
        usedRecs.add(best);
        best.width_in = wIn;
        best.height_in = hIn;
        best.bbox_in = { x_in: xIn, y_in: yIn, width_in: wIn, height_in: hIn };
      }
    }
    rasterDims.set(page.page, recs);
    rasterContent.set(page.page, r ? rasterContentBbox(r, renderScale) : null);
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
    let designBboxes = designBboxesForPage(pageClips, pageImages, pageNeon, [page.width_pt, page.height_pt]);

    // Prefer the accurate raster records over the vector-outline fallback. The raster
    // records are the letters/logos actually detected on the page; assign each to the
    // design region whose bbox contains its centre.
    const rasterAll = rasterDims.get(pageNumber) || null;
    // A design bbox is in PDF points (y-up); raster records are inches, y-down from
    // the page top — convert the bbox to that frame so we can test containment.
    const designRectIn = (db: Bbox): [number, number, number, number] => [
      (db[0] / POINTS_PER_INCH) * scale,
      ((page.height_pt - db[3]) / POINTS_PER_INCH) * scale,
      (db[2] / POINTS_PER_INCH) * scale,
      ((page.height_pt - db[1]) / POINTS_PER_INCH) * scale,
    ];
    const recInRect = (rec: RasterEntry, r: [number, number, number, number]): boolean => {
      const cx = rec.bbox_in.x_in + rec.bbox_in.width_in / 2;
      const cy = rec.bbox_in.y_in + rec.bbox_in.height_in / 2;
      return cx >= r[0] - 0.05 && cx <= r[2] + 0.05 && cy >= r[1] - 0.05 && cy <= r[3] + 0.05;
    };
    const relabel = (recs: RasterEntry[]): RasterEntry[] => {
      const counts: Record<string, number> = {};
      return recs.map((r) => {
        const prefix = r.label.startsWith("Logo") ? "Logo" : "Letter";
        counts[prefix] = (counts[prefix] || 0) + 1;
        return { ...r, label: `${prefix} ${counts[prefix]}` };
      });
    };
    // Clip paths are an unreliable design separator: gradient/vignette clips create
    // small clip islands that don't cover the artwork (e.g. a gold-gradient logo).
    // If the clip-based split leaves most raster records OUTSIDE every design bbox,
    // it's spurious — collapse to a single design over the whole page content.
    if (rasterAll && rasterAll.length && designBboxes.length > 1) {
      const rects = designBboxes.map(designRectIn);
      const covered = rasterAll.filter((rec) => rects.some((r) => recInRect(rec, r))).length;
      if (covered < rasterAll.length * 0.8 && pageContentBbox) designBboxes = [pageContentBbox];
    }

    const designs: BoxupDesign[] = [];
    designBboxes.forEach((designBbox, idx) => {
      const designIndex = idx + 1;
      const designStrokes = strokesForBbox(pageStrokes, designBbox);
      const designFills = strokesForBbox(pageFills as { bbox: Bbox }[], designBbox) as FillPath[];
      const designNeon = designStrokes.filter((s) => isNeonColor(s.color));
      const designRaster = rasterAll ? relabel(rasterAll.filter((rec) => recInRect(rec, designRectIn(designBbox)))) : null;
      const letters =
        (designRaster && designRaster.length ? designRaster : null) ||
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
        dimension_preview_url: buildDimensionPreview(rendered.get(pageNumber) || null, designBbox, page.height_pt, scale, renderScales.get(pageNumber) || 1.0),
        // "Original" = the same content region in its REAL colours (image only).
        original_preview_url: buildArtworkCrop(rendered.get(pageNumber) || null, designBbox, page.height_pt, renderScales.get(pageNumber) || 1.0, 560, true)?.url ?? null,
        // Signboard wants the WHOLE uploaded artboard, not the trimmed content.
        artwork_preview_url: buildArtworkCrop(rendered.get(pageNumber) || null, [0, 0, page.width_pt, page.height_pt], page.height_pt, renderScales.get(pageNumber) || 1.0)?.url ?? null,
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
      dimension_preview_url: single ? buildDimensionPreview(rendered.get(pageNumber) || null, pageContentBbox, page.height_pt, scale, renderScales.get(pageNumber) || 1.0) : null,
      original_preview_url: single ? (buildArtworkCrop(rendered.get(pageNumber) || null, pageContentBbox, page.height_pt, renderScales.get(pageNumber) || 1.0, 560, true)?.url ?? null) : null,
      artwork_preview_url: single ? (buildArtworkCrop(rendered.get(pageNumber) || null, [0, 0, page.width_pt, page.height_pt], page.height_pt, renderScales.get(pageNumber) || 1.0)?.url ?? null) : null,
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
    dimension_preview_url: buildDimensionPreview(rendered.get(1) || null, page1Content, pages[0]?.height_pt ?? 0, scale, renderScales.get(1) || 1.0),
    original_preview_url: buildArtworkCrop(rendered.get(1) || null, page1Content, pages[0]?.height_pt ?? 0, renderScales.get(1) || 1.0, 560, true)?.url ?? null,
    artwork_preview_url: buildArtworkCrop(rendered.get(1) || null, [0, 0, pages[0]?.width_pt ?? 0, pages[0]?.height_pt ?? 0], pages[0]?.height_pt ?? 0, renderScales.get(1) || 1.0)?.url ?? null,
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
  renderScale = 1.0,
  maxH = 560,
  useColor = false,
): { url: string; dw: number; dh: number } | null {
  if (!page || contentBbox === null) return null;
  const { width: imgW, height: imgH } = page;
  const rgb = useColor ? page.rgbColor : page.rgb;
  // content bbox (PDF points, y-up) -> pixel rect (y-down)
  const px1 = Math.max(0, Math.round(contentBbox[0] * renderScale));
  const py1 = Math.max(0, Math.round((pageHeightPt - contentBbox[3]) * renderScale));
  const px2 = Math.min(imgW, Math.round(contentBbox[2] * renderScale));
  const py2 = Math.min(imgH, Math.round((pageHeightPt - contentBbox[1]) * renderScale));
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

function buildDimensionPreview(page: RenderedPage | null, contentBbox: Bbox | null, pageHeightPt: number, scale = 1.0, renderScale = 1.0): string | null {
  if (!page || contentBbox === null) return null;
  const crop = buildArtworkCrop(page, contentBbox, pageHeightPt, renderScale);
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
