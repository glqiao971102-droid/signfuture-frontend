// Rectangle nesting (bin packing) for print imposition. MaxRects with 90°
// rotation and multiple bins (sheets). Units are arbitrary but consistent (we use
// inches). `gap` is the spacing/kerf reserved around every piece.
//
// For the tightest result we try several free-rect heuristics × several sort
// orders (packBest) and keep whichever uses the fewest sheets and least area.
//
// Correctness contract (property-tested): within a bin no two placed pieces'
// gap-margin footprints overlap, and every piece lies fully inside the bin. A
// piece larger than the bin (even rotated) is returned in `unplaced`.

export type NestRect = { id: number; w: number; h: number };
export type Placement = {
  id: number;
  bin: number;
  x: number; y: number; // lower-left of the piece (margin excluded), origin bottom-left
  w: number; h: number; // drawn size (rotation already applied)
  rotated: boolean;
};
export type BinUsage = { index: number; usedW: number; usedH: number };
export type PackResult = { placements: Placement[]; bins: BinUsage[]; unplaced: number[] };

export type Heuristic = "bssf" | "blsf" | "baf" | "bl";

type Free = { x: number; y: number; w: number; h: number };
type Node = { x: number; y: number; w: number; h: number; rotated: boolean };

class MaxRectsBin {
  free: Free[];
  constructor(public W: number, public H: number) {
    this.free = [{ x: 0, y: 0, w: W, h: H }];
  }

  /** Score a placement of (w,h); lower (p1,p2) is better. null = no fit. */
  private score(w: number, h: number, heur: Heuristic): { x: number; y: number; p1: number; p2: number } | null {
    let best: { x: number; y: number; p1: number; p2: number } | null = null;
    for (const f of this.free) {
      if (f.w < w - 1e-9 || f.h < h - 1e-9) continue;
      const dw = f.w - w, dh = f.h - h;
      let p1: number, p2: number;
      switch (heur) {
        case "blsf": p1 = Math.max(dw, dh); p2 = Math.min(dw, dh); break;
        case "baf": p1 = f.w * f.h - w * h; p2 = Math.min(dw, dh); break;
        case "bl": p1 = f.y + h; p2 = f.x; break;
        default: p1 = Math.min(dw, dh); p2 = Math.max(dw, dh); break; // bssf
      }
      if (!best || p1 < best.p1 - 1e-9 || (Math.abs(p1 - best.p1) <= 1e-9 && p2 < best.p2)) best = { x: f.x, y: f.y, p1, p2 };
    }
    return best;
  }

  insert(w: number, h: number, allowRotate: boolean, heur: Heuristic): Node | null {
    const a = this.score(w, h, heur);
    const b = allowRotate && w !== h ? this.score(h, w, heur) : null;
    let node: Node | null = null;
    if (a && (!b || a.p1 < b.p1 - 1e-9 || (Math.abs(a.p1 - b.p1) <= 1e-9 && a.p2 <= b.p2))) node = { x: a.x, y: a.y, w, h, rotated: false };
    else if (b) node = { x: b.x, y: b.y, w: h, h: w, rotated: true };
    if (!node) return null;
    this.place(node.x, node.y, node.w, node.h);
    return node;
  }

  private place(x: number, y: number, w: number, h: number) {
    const used = { x, y, w, h };
    const next: Free[] = [];
    for (const f of this.free) {
      if (this.splitInto(f, used, next)) continue;
      next.push(f);
    }
    this.free = next;
    this.prune();
  }

  private splitInto(f: Free, used: Free, out: Free[]): boolean {
    if (used.x >= f.x + f.w || used.x + used.w <= f.x || used.y >= f.y + f.h || used.y + used.h <= f.y) return false;
    if (used.x < f.x + f.w && used.x + used.w > f.x) {
      if (used.y > f.y) out.push({ x: f.x, y: f.y, w: f.w, h: used.y - f.y });
      if (used.y + used.h < f.y + f.h) out.push({ x: f.x, y: used.y + used.h, w: f.w, h: f.y + f.h - (used.y + used.h) });
    }
    if (used.y < f.y + f.h && used.y + used.h > f.y) {
      if (used.x > f.x) out.push({ x: f.x, y: f.y, w: used.x - f.x, h: f.h });
      if (used.x + used.w < f.x + f.w) out.push({ x: used.x + used.w, y: f.y, w: f.x + f.w - (used.x + used.w), h: f.h });
    }
    return true;
  }

  private prune() {
    const f = this.free.filter((r) => r.w > 1e-6 && r.h > 1e-6);
    const keep: boolean[] = f.map(() => true);
    for (let i = 0; i < f.length; i++) {
      if (!keep[i]) continue;
      for (let j = 0; j < f.length; j++) {
        if (i === j || !keep[j]) continue;
        if (this.contains(f[j], f[i])) { keep[i] = false; break; }
        if (this.contains(f[i], f[j])) keep[j] = false;
      }
    }
    this.free = f.filter((_, i) => keep[i]);
  }
  private contains(a: Free, b: Free): boolean {
    return b.x >= a.x - 1e-9 && b.y >= a.y - 1e-9 && b.x + b.w <= a.x + a.w + 1e-9 && b.y + b.h <= a.y + a.h + 1e-9;
  }
}

/** Optional density caps per sheet (used by the 3D-printer Slow/Medium/Fast modes).
 *  timeCap + pieceTime pack pieces so each sheet's total print time stays under a
 *  target (small pieces combined onto plates up to the slowest piece's time). */
export type PackCaps = { maxPerBin?: number; maxFill?: number; timeCap?: number; pieceTime?: number[] };

/** Pack with a fixed heuristic + a pre-sorted piece order. */
export function pack(rects: NestRect[], W: number, H: number, gap: number, allowRotate: boolean, heur: Heuristic = "bssf", order?: NestRect[], caps?: PackCaps): PackResult {
  const g = Math.max(0, gap);
  const half = g / 2;
  const maxPerBin = caps?.maxPerBin ?? Infinity;
  const areaCap = (caps?.maxFill ?? 1) * W * H;
  const timeCap = caps?.timeCap ?? Infinity;
  const pieceTime = caps?.pieceTime;
  const seq = order ?? [...rects].sort((a, b) => b.w * b.h - a.w * a.h);
  const bins: MaxRectsBin[] = [];
  const binCount: number[] = [];
  const binArea: number[] = [];
  const binTime: number[] = [];
  const placements: Placement[] = [];
  const unplaced: number[] = [];
  const put = (r: NestRect, bin: number, n: Node) =>
    placements.push({ id: r.id, bin, x: n.x + half, y: n.y + half, w: n.w - g, h: n.h - g, rotated: n.rotated });

  for (const r of seq) {
    const iw = r.w + g, ih = r.h + g;
    const fitsEmpty = (iw <= W + 1e-6 && ih <= H + 1e-6) || (allowRotate && ih <= W + 1e-6 && iw <= H + 1e-6);
    if (!fitsEmpty) { unplaced.push(r.id); continue; }
    const area = r.w * r.h;
    const t = pieceTime ? pieceTime[r.id] ?? 0 : 0;
    let done = false;
    for (let b = 0; b < bins.length; b++) {
      // Caps: a non-empty bin won't exceed maxPerBin pieces, the fill target, or
      // the time cap (an empty bin always accepts at least one piece).
      if (binCount[b] > 0 && (binCount[b] >= maxPerBin || binArea[b] + area > areaCap + 1e-9 || binTime[b] + t > timeCap + 1e-9)) continue;
      const n = bins[b].insert(iw, ih, allowRotate, heur);
      if (n) { put(r, b, n); binCount[b]++; binArea[b] += area; binTime[b] += t; done = true; break; }
    }
    if (done) continue;
    const bin = new MaxRectsBin(W, H);
    bins.push(bin); binCount.push(0); binArea.push(0); binTime.push(0);
    const n = bin.insert(iw, ih, allowRotate, heur);
    if (n) { put(r, bins.length - 1, n); binCount[bins.length - 1]++; binArea[bins.length - 1] += area; binTime[bins.length - 1] += t; } else unplaced.push(r.id);
  }

  const usage: BinUsage[] = bins.map((_, i) => ({ index: i, usedW: 0, usedH: 0 }));
  for (const p of placements) {
    const u = usage[p.bin];
    u.usedW = Math.max(u.usedW, p.x + p.w + half);
    u.usedH = Math.max(u.usedH, p.y + p.h + half);
  }
  return { placements, bins: usage, unplaced };
}

/**
 * Try several heuristics × sort orders and keep the tightest result — fewest
 * unplaced, then fewest sheets, then least total used area (i.e. least material).
 */
export function packBest(rects: NestRect[], W: number, H: number, gap: number, allowRotate: boolean, caps?: PackCaps): PackResult {
  const heurs: Heuristic[] = ["bssf", "baf", "bl", "blsf"];
  const sorts: ((a: NestRect, b: NestRect) => number)[] = [
    (a, b) => b.w * b.h - a.w * a.h,           // area
    (a, b) => b.h - a.h || b.w - a.w,          // height
    (a, b) => b.w - a.w || b.h - a.h,          // width
    (a, b) => Math.max(b.w, b.h) - Math.max(a.w, a.h), // longest side
    (a, b) => (b.w + b.h) - (a.w + a.h),       // perimeter
  ];
  let best: PackResult | null = null;
  let bestScore = Infinity;
  for (const h of heurs) {
    for (const s of sorts) {
      const order = [...rects].sort(s);
      const r = pack(rects, W, H, gap, allowRotate, h, order, caps);
      const areaSum = r.bins.reduce((acc, b) => acc + b.usedW * b.usedH, 0);
      const score = r.unplaced.length * 1e18 + r.bins.length * 1e12 + areaSum;
      if (score < bestScore) { bestScore = score; best = r; }
    }
  }
  return best as PackResult;
}
