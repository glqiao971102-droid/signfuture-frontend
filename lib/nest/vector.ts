// Vector-native piece extraction for nesting. Illustrator exports each object as
// its own `q … cm … <paths> … f/S Q` block in the page content stream. We parse
// those blocks into independent "units" (path ops + device colour + CTM + bbox),
// so the nester can re-emit each piece as its OWN flat vector object — instead of
// clipping the whole page (which leaves every other object hidden behind a
// clipping mask that spills out when released in Illustrator).

export type Mat = [number, number, number, number, number, number];
export const ID: Mat = [1, 0, 0, 1, 0, 0];

/** Compose: the returned matrix applies A first, then B. */
export function compose(A: Mat, B: Mat): Mat {
  const [a1, b1, c1, d1, e1, f1] = A;
  const [a2, b2, c2, d2, e2, f2] = B;
  return [
    a2 * a1 + c2 * b1, b2 * a1 + d2 * b1,
    a2 * c1 + c2 * d1, b2 * c1 + d2 * d1,
    a2 * e1 + c2 * f1 + e2, b2 * e1 + d2 * f1 + f2,
  ];
}
function apply(M: Mat, x: number, y: number): [number, number] {
  return [M[0] * x + M[2] * y + M[4], M[1] * x + M[3] * y + M[5]];
}

export type VUnit = {
  path: string;           // raw path-construction ops (m/l/c/v/y/re/h), local coords
  paint: string;          // f | f* | S | B | ...
  color: string;          // fill colour ops, e.g. "0.191 0 0.931 0 k" (device only)
  ctm: Mat;               // local → page transform
  x0: number; y0: number; x1: number; y1: number; // bbox in page coords
};

export type ParseResult = { units: VUnit[]; unsupported: boolean };

/**
 * Convert an sc/scn colour (set in some named colour space) to a device colour by
 * component count: 4→CMYK (k), 3→RGB (rg), 1→Gray (g). Returns null for a pattern
 * fill (a /Name operand) or an unusual component count — the caller then treats
 * the file as unsupported and falls back to the raster clip method.
 */
function scnToDevice(ops: string[]): string | null {
  if (ops.some((o) => o.startsWith("/"))) return null; // pattern fill
  const nums = ops.filter((o) => /^[-+.\d]/.test(o));
  if (nums.length !== ops.length) return null;
  if (nums.length === 4) return `${nums.join(" ")} k`;
  if (nums.length === 3) return `${nums.join(" ")} rg`;
  if (nums.length === 1) return `${nums[0]} g`;
  return null;
}

const WS = new Set([" ", "\t", "\r", "\n", "\f", "\0"]);
const DELIM = new Set(["(", ")", "<", ">", "[", "]", "{", "}", "/", "%"]);

type Tok = { t: "num" | "name" | "op" | "other"; v: string };
function* tokenize(s: string): Generator<Tok> {
  let i = 0;
  const n = s.length;
  while (i < n) {
    const c = s[i];
    if (WS.has(c)) { i++; continue; }
    if (c === "%") { while (i < n && s[i] !== "\n" && s[i] !== "\r") i++; continue; }
    if (c === "/") { let j = i + 1; while (j < n && !WS.has(s[j]) && !DELIM.has(s[j])) j++; yield { t: "name", v: s.slice(i, j) }; i = j; continue; }
    if (c === "(") {
      let depth = 0, j = i;
      for (; j < n; j++) { const ch = s[j]; if (ch === "\\") { j++; continue; } if (ch === "(") depth++; else if (ch === ")") { depth--; if (depth === 0) { j++; break; } } }
      yield { t: "other", v: "(str)" }; i = j; continue;
    }
    if (c === "<") { if (s[i + 1] === "<") { yield { t: "op", v: "<<" }; i += 2; continue; } let j = s.indexOf(">", i); if (j < 0) j = n; yield { t: "other", v: "<hex>" }; i = j + 1; continue; }
    if (c === ">") { if (s[i + 1] === ">") { yield { t: "op", v: ">>" }; i += 2; continue; } i++; continue; }
    if (c === "[" || c === "]" || c === "{" || c === "}") { i++; continue; }
    if ((c >= "0" && c <= "9") || c === "+" || c === "-" || c === ".") {
      let j = i + 1; while (j < n && ((s[j] >= "0" && s[j] <= "9") || s[j] === "." || s[j] === "-" || s[j] === "+" || s[j] === "e" || s[j] === "E")) j++;
      yield { t: "num", v: s.slice(i, j) }; i = j; continue;
    }
    let j = i; while (j < n && !WS.has(s[j]) && !DELIM.has(s[j])) j++;
    yield { t: "op", v: s.slice(i, j) }; i = j;
  }
}

/**
 * Parse a page content stream into independent fill/stroke units. Returns
 * unsupported=true when the content uses features we can't safely re-emit flat
 * (named colour spaces / spot colours via sc/scn, or drawn image XObjects) —
 * the caller should then fall back to the whole-page clip method.
 */
export function parseVectorUnits(contentBytes: Uint8Array): ParseResult {
  const s = Buffer.from(contentBytes).toString("latin1");
  const units: VUnit[] = [];
  let ctm: Mat = ID;
  const stack: { ctm: Mat; fill: string; stroke: string }[] = [];
  let fill = "", stroke = "";
  let ops: string[] = [];
  let path = "", hasPath = false, clip = false;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  let unsupported = false;

  const nums = () => ops.map(Number);
  const addPt = (lx: number, ly: number) => { const [x, y] = apply(ctm, lx, ly); if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; };
  const emit = (opname: string) => { path += ops.join(" ") + " " + opname + "\n"; hasPath = true; };
  const resetPath = () => { path = ""; hasPath = false; clip = false; minX = Infinity; minY = Infinity; maxX = -Infinity; maxY = -Infinity; };

  for (const tk of tokenize(s)) {
    if (tk.t === "num" || tk.t === "name" || tk.t === "other") { ops.push(tk.v); continue; }
    if (tk.t !== "op") continue;
    const op = tk.v;
    switch (op) {
      case "q": stack.push({ ctm, fill, stroke }); break;
      case "Q": { const st = stack.pop(); if (st) { ctm = st.ctm; fill = st.fill; stroke = st.stroke; } break; }
      case "cm": { const [a, b, c, d, e, f] = nums(); ctm = compose([a, b, c, d, e, f], ctm); break; }
      case "m": case "l": { const [x, y] = nums(); emit(op); addPt(x, y); break; }
      case "c": { const u = nums(); emit(op); addPt(u[0], u[1]); addPt(u[2], u[3]); addPt(u[4], u[5]); break; }
      case "v": case "y": { const u = nums(); emit(op); addPt(u[0], u[1]); addPt(u[2], u[3]); break; }
      case "re": { const [x, y, w, h] = nums(); emit(op); addPt(x, y); addPt(x + w, y); addPt(x + w, y + h); addPt(x, y + h); break; }
      case "h": path += "h\n"; break;
      case "W": case "W*": clip = true; break;
      case "n": resetPath(); break;
      case "f": case "F": case "f*": case "S": case "s": case "b": case "b*": case "B": case "B*": {
        if (hasPath && !clip && maxX > minX && maxY > minY) {
          units.push({ path, paint: op === "F" ? "f" : op, color: op === "S" || op === "s" ? stroke : fill, ctm, x0: minX, y0: minY, x1: maxX, y1: maxY });
        }
        resetPath();
        break;
      }
      case "k": case "g": case "rg": fill = ops.join(" ") + " " + op; break;
      case "K": case "G": case "RG": stroke = ops.join(" ") + " " + op; break;
      case "cs": case "CS": break; // colourspace selected; sc/scn colours are mapped to device by component count
      case "sc": case "scn": { const c = scnToDevice(ops); if (c === null) unsupported = true; else fill = c; break; }
      case "SC": case "SCN": { const c = scnToDevice(ops); if (c === null) unsupported = true; else stroke = c; break; }
      case "Do": unsupported = true; break; // drawn XObject (image/form) — can't flatten safely
      default: break;
    }
    ops = [];
  }
  return { units, unsupported };
}

export type VGroup = { units: VUnit[]; x0: number; y0: number; x1: number; y1: number };

/**
 * Group units whose bounding boxes overlap into one nesting piece — a shape and
 * its hole/outline (drawn as separate fills at the same spot) must move together,
 * or they'd be nested apart and torn in two. Spatially separate objects stay
 * separate pieces.
 */
export function groupUnits(units: VUnit[]): VGroup[] {
  const parent = units.map((_, i) => i);
  const find = (x: number): number => (parent[x] === x ? x : (parent[x] = find(parent[x])));
  const overlap = (a: { x0: number; y0: number; x1: number; y1: number }, b: typeof a) =>
    Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0) > 0 && Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0) > 0;
  let changed = true;
  while (changed) {
    changed = false;
    const grp = new Map<number, { x0: number; y0: number; x1: number; y1: number }>();
    for (let i = 0; i < units.length; i++) {
      const r = find(i), u = units[i], g = grp.get(r);
      if (!g) grp.set(r, { x0: u.x0, y0: u.y0, x1: u.x1, y1: u.y1 });
      else { g.x0 = Math.min(g.x0, u.x0); g.y0 = Math.min(g.y0, u.y0); g.x1 = Math.max(g.x1, u.x1); g.y1 = Math.max(g.y1, u.y1); }
    }
    const reps = [...grp.entries()];
    for (let a = 0; a < reps.length; a++) for (let b = a + 1; b < reps.length; b++) {
      if (find(reps[a][0]) === find(reps[b][0])) continue;
      if (overlap(reps[a][1], reps[b][1])) { parent[find(reps[a][0])] = find(reps[b][0]); changed = true; }
    }
  }
  const out = new Map<number, VGroup>();
  for (let i = 0; i < units.length; i++) {
    const r = find(i), u = units[i];
    let g = out.get(r);
    if (!g) { g = { units: [], x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity }; out.set(r, g); }
    g.units.push(u); g.x0 = Math.min(g.x0, u.x0); g.y0 = Math.min(g.y0, u.y0); g.x1 = Math.max(g.x1, u.x1); g.y1 = Math.max(g.y1, u.y1);
  }
  return [...out.values()];
}

/** Re-emit a unit as a flat vector block placed by page→target matrix T. */
export function emitUnit(u: VUnit, T: Mat): string {
  const m = compose(u.ctm, T).map((n) => (Number.isInteger(n) ? String(n) : n.toFixed(4))).join(" ");
  const stroke = u.paint === "S" || u.paint === "s" || u.paint.startsWith("B");
  const col = u.color ? u.color + "\n" : "";
  return `q\n${col}${m} cm\n${u.path}${u.paint}\nQ\n`;
  void stroke;
}
