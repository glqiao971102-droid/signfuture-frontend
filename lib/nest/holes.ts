// Drill-hole placement for nested letters/logos.
//
// For each detected piece we place:
//   • ONE wire hole (5 mm) — for the power wire to exit; put at the "deepest"
//     interior point (max distance-to-edge) so it sits well inside the body.
//   • Several screw holes (3 mm) — mounting points for a backlit channel letter.
//     The system decides how many and where so the piece is held firmly and can't
//     wobble: it spreads them across the shape (farthest-point sampling from
//     eligible interior points), pushing them out to the extremities, with the
//     count scaled to the letter's size.
//
// Everything is computed on a rasterised ink mask of the piece, then returned in
// LOCAL points relative to the piece's bounding-box bottom-left, so the caller
// can place them with the same transform it uses to place the piece itself.

export type Hole = { lx: number; ly: number; d: number; kind: "wire" | "screw" };

const PT_PER_IN = 72;
const SQRT2 = Math.SQRT2;

/** Two-pass chamfer distance transform: distance (px) from each ink pixel to the
 *  nearest non-ink pixel. Background pixels are 0. Anything OUTSIDE the mask
 *  counts as background too, so a piece that fills its whole bounding box (a solid
 *  square) still measures distance to its outline (the box edge) rather than INF. */
function distanceTransform(mask: Uint8Array, w: number, h: number): Float32Array {
  const INF = 1e9;
  const d = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) d[i] = mask[i] ? INF : 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (d[i] === 0) continue;
      let v = d[i];
      v = Math.min(v, (x > 0 ? d[i - 1] : 0) + 1);
      v = Math.min(v, (y > 0 ? d[i - w] : 0) + 1);
      v = Math.min(v, (x > 0 && y > 0 ? d[i - w - 1] : 0) + SQRT2);
      v = Math.min(v, (x < w - 1 && y > 0 ? d[i - w + 1] : 0) + SQRT2);
      d[i] = v;
    }
  }
  for (let y = h - 1; y >= 0; y--) {
    for (let x = w - 1; x >= 0; x--) {
      const i = y * w + x;
      if (d[i] === 0) continue;
      let v = d[i];
      v = Math.min(v, (x < w - 1 ? d[i + 1] : 0) + 1);
      v = Math.min(v, (y < h - 1 ? d[i + w] : 0) + 1);
      v = Math.min(v, (x < w - 1 && y < h - 1 ? d[i + w + 1] : 0) + SQRT2);
      v = Math.min(v, (x > 0 && y < h - 1 ? d[i + w - 1] : 0) + SQRT2);
      d[i] = v;
    }
  }
  return d;
}

export type ScrewLevel = "medium" | "strong";

/**
 * Compute the drill holes for ONE piece from its ink sub-mask.
 * @param mask   1 = ink, row-major, size w×h (top-down image orientation)
 * @param S      pixels per point of the mask
 * @returns holes in LOCAL points from the piece bbox bottom-left (y up)
 */
export function computePieceHoles(
  mask: Uint8Array,
  w: number,
  h: number,
  S: number,
  wireDiaPt: number,
  screwDiaPt: number,
  level: ScrewLevel = "medium"
): Hole[] {
  const pxPerPt = S;
  let inkCount = 0;
  for (let i = 0; i < w * h; i++) if (mask[i]) inkCount++;
  if (!inkCount) return [];

  const dist = distanceTransform(mask, w, h);

  // Convert a mask pixel (top-down) to LOCAL points (y up from bbox bottom).
  const toLocal = (px: number, py: number) => ({ lx: (px + 0.5) / pxPerPt, ly: (h - (py + 0.5)) / pxPerPt });

  const holes: Hole[] = [];
  const MARGIN_PX = 0.75;

  // Centroid + the deepest interior point (deepDist = half the stroke width at
  // the thickest place).
  let sumX = 0, sumY = 0, cnt = 0, deepIdx = -1, deepDist = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    if (mask[i]) { sumX += x; sumY += y; cnt++; }
    if (dist[i] > deepDist) { deepDist = dist[i]; deepIdx = i; }
  }
  const cenX = sumX / cnt, cenY = sumY / cnt;

  const wireRadPx = (wireDiaPt / 2) * pxPerPt;
  const screwRadPx = (screwDiaPt / 2) * pxPerPt;
  // Holes sit IN from the edge (not hugging the outline). The inset scales with
  // the letter size — ~2 cm on a normal letter, up to ~3 cm on a big one (thicker
  // strokes, more room) — but never deeper than the stroke is thick, so a narrow
  // stroke still lands on its centre-line.
  const maxIn = Math.max(w, h) / (pxPerPt * PT_PER_IN);
  const insetMm = Math.min(30, Math.max(20, 20 + (maxIn - 16) * 0.6));
  const targetInsetPx = (insetMm / 25.4) * PT_PER_IN * pxPerPt;
  const screwInset = Math.max(screwRadPx + MARGIN_PX, Math.min(targetInsetPx, deepDist * 0.85));
  const wireInset = Math.max(wireRadPx + MARGIN_PX, Math.min(targetInsetPx, deepDist * 0.9));

  // --- Wire hole: deep in the stroke (≈2 cm inset), nearest the centroid. ---
  let wireIdx = -1, bestCen = Infinity;
  for (let i = 0; i < w * h; i++) {
    if (dist[i] >= wireInset) {
      const x = i % w, y = (i / w) | 0;
      const dc = (x - cenX) * (x - cenX) + (y - cenY) * (y - cenY);
      if (dc < bestCen) { bestCen = dc; wireIdx = i; }
    }
  }
  if (wireIdx < 0) wireIdx = deepIdx; // piece too small/thin — best-effort centre
  let wirePx: { x: number; y: number } | null = null;
  if (wireIdx >= 0 && deepDist >= 1.5) {
    const wx = wireIdx % w, wy = (wireIdx / w) | 0;
    wirePx = { x: wx, y: wy };
    const { lx, ly } = toLocal(wx, wy);
    holes.push({ lx, ly, d: wireDiaPt, kind: "wire" });
  }

  // --- Screw holes: deep interior points (≈2 cm inset / stroke centre-line),
  //     spread along the strokes for stability. ---
  const collect = (thr: number) => {
    const pts: { x: number; y: number }[] = [];
    const stepPx = Math.max(1, Math.floor(screwRadPx));
    for (let y = 0; y < h; y += stepPx) {
      for (let x = 0; x < w; x += stepPx) {
        if (dist[y * w + x] >= thr) pts.push({ x, y });
      }
    }
    return pts;
  };
  // Aim for the 2 cm inset; relax toward the stroke centre-line only if that's
  // too deep to place two screws.
  let eligible: { x: number; y: number }[] = [];
  for (const thr of [screwInset, deepDist * 0.7, screwRadPx + MARGIN_PX]) {
    eligible = collect(thr);
    if (eligible.length >= 2) break;
  }

  if (eligible.length) {
    // Screws must keep well clear of the wire hole (≈ inset + 1.2 cm from its
    // centre, so ~3 cm on a normal letter and more on a big one) and spread OUT
    // from one another so the piece is held on opposite sides (no wobble).
    const wireGapPx = Math.max(
      (wireDiaPt / 2 + screwDiaPt / 2) * pxPerPt * 1.6,
      ((insetMm + 12) / 25.4) * PT_PER_IN * pxPerPt
    );
    const minSpreadPx = screwDiaPt * pxPerPt * 1.5;
    const distSq = (a: { x: number; y: number }, b: { x: number; y: number }) =>
      (a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y);
    const minSpread = (p: { x: number; y: number }, set: { x: number; y: number }[]) => {
      let m = Infinity;
      for (const q of set) m = Math.min(m, distSq(p, q));
      return Math.sqrt(m);
    };
    const clearOfWire = (p: { x: number; y: number }) => !wirePx || Math.sqrt(distSq(p, wirePx)) >= wireGapPx;
    const usable = eligible.filter(clearOfWire);
    const pool = usable.length ? usable : eligible;

    // CORNER-PRIORITY: put a screw in each corner of the piece first — the
    // eligible point nearest each bbox corner (already ≈2 cm inset). Corners hold
    // the piece best against wobble. Only a large piece that needs `want` > its
    // distinct corners gets extra interior screws for reinforcement.
    const bboxCorners = [
      { x: 0, y: 0 }, { x: w - 1, y: 0 }, { x: 0, y: h - 1 }, { x: w - 1, y: h - 1 },
    ];
    const cornerPts: { x: number; y: number }[] = [];
    for (const c of bboxCorners) {
      let best: { x: number; y: number } | null = null;
      let bd = Infinity;
      for (const p of pool) { const d = distSq(p, c); if (d < bd) { bd = d; best = p; } }
      // Keep it only if it's a distinct spot (thin shapes collapse corners).
      if (best && !cornerPts.some((q) => distSq(best!, q) < minSpreadPx * minSpreadPx)) cornerPts.push(best);
    }

    // Pick `want` screws, most-spread, corners first.
    const pickSpread = (cands: { x: number; y: number }[], k: number) => {
      if (cands.length <= k) return cands.slice();
      let seed = cands[0], sd = -1;
      for (const p of cands) { const d = (p.x - cenX) * (p.x - cenX) + (p.y - cenY) * (p.y - cenY); if (d > sd) { sd = d; seed = p; } }
      const out = [seed];
      while (out.length < k) {
        let best: { x: number; y: number } | null = null, bs = -1;
        for (const p of cands) { const s = minSpread(p, out); if (s > bs) { bs = s; best = p; } }
        if (!best) break;
        out.push(best);
      }
      return out;
    };

    // Seed with the corners: a triangle for Standard, all four for Extra stable.
    const baseCorners = level === "strong" ? 4 : 3;
    const chosen = pickSpread(cornerPts, baseCorners);

    // COVERAGE — a professional install screws densely enough that no part of the
    // letter is left unsupported. Keep adding a screw at the least-supported spot
    // (the eligible point farthest from every placed screw) until every point is
    // within the max spacing of one. So a big / complex letter — the middle of a
    // long arm, the inner junction of a "K" — gets the extra screws it needs, and
    // the count scales with size and shape automatically.
    const spacingPx = ((level === "strong" ? 250 : 350) / 25.4) * PT_PER_IN * pxPerPt;
    const MAX_SCREWS = 40;
    while (chosen.length < MAX_SCREWS) {
      let best: { x: number; y: number } | null = null;
      let bestD = -1;
      for (const p of pool) {
        const d = minSpread(p, chosen);
        if (d > bestD) { bestD = d; best = p; }
      }
      if (!best || bestD < spacingPx) break;
      chosen.push(best);
    }
    // Minimum TWO screws even on a small piece — a single screw lets it spin.
    // Add the point farthest from the first, relaxing the spacing rule if needed.
    if (chosen.length < 2 && pool.length) {
      let best: { x: number; y: number } | null = null;
      let bd = -1;
      for (const p of pool) {
        const d = distSq(p, chosen[0]);
        if (d > bd) { bd = d; best = p; }
      }
      if (best && bd > 1) chosen.push(best);
    }

    for (const p of chosen) {
      const { lx, ly } = toLocal(p.x, p.y);
      holes.push({ lx, ly, d: screwDiaPt, kind: "screw" });
    }
  }

  return holes;
}

/** Diameter in points from millimetres. */
export function mmToPt(mm: number): number {
  return (mm / 25.4) * PT_PER_IN;
}
