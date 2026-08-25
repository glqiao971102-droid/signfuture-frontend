import { NextResponse } from "next/server";
import { analyzeUvLayout, type UvBox } from "@/lib/uv/layout";
import { API_BASE } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

// Same internal secret as /api/nest so our backend can call this server-to-server
// (SF Dropbox "Inkjet Printing" auto-layout on Processing).
const RENDER_SECRET =
  process.env.RENDER_ARTWORK_SECRET || "sf-jobrender-9f3c1e7a44b24d8ea1c6b0f2e5d78c31";

async function requireCaller(req: Request): Promise<boolean> {
  if (req.headers.get("x-render-secret") === RENDER_SECRET) return true;
  const auth = req.headers.get("authorization");
  if (!auth) return false;
  try {
    const res = await fetch(`${API_BASE}/api/v1/auth/me`, {
      headers: { Authorization: auth, Accept: "application/json" },
      cache: "no-store",
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Parse the `boxes` param (base64 or raw JSON of UvBox[]). null on any problem. */
function parseBoxes(raw: string | null): UvBox[] | null {
  if (!raw) return null;
  try {
    let txt = raw;
    if (!txt.trimStart().startsWith("[")) txt = Buffer.from(raw, "base64").toString("utf8");
    const arr = JSON.parse(txt);
    if (!Array.isArray(arr)) return null;
    return arr
      .map((b) => ({ xIn: Number(b.xIn), yIn: Number(b.yIn), wIn: Number(b.wIn), hIn: Number(b.hIn) }))
      .filter((b) => [b.xIn, b.yIn, b.wIn, b.hIn].every(Number.isFinite) && b.wIn > 0 && b.hIn > 0);
  } catch {
    return null;
  }
}

/**
 * POST /api/uv-layout — lay out the UV / Inkjet pieces of an artwork on a 48"-wide
 * sheet, each grown 5 mm along its contour, original colours preserved. Returns a
 * colour PNG + PDF (base64). Body = raw AI/PDF bytes.
 * Query: w (sheet in), gap (in), grow (mm), dpi, mscale, boxes (UvBox[] JSON/base64;
 * omit = all pieces), name. Signed-in members or the internal secret.
 */
export async function POST(req: Request) {
  try {
    if (!(await requireCaller(req))) {
      return NextResponse.json({ error: "FORBIDDEN", message: "Please sign in to use this tool." }, { status: 403 });
    }
    const url = new URL(req.url);
    const num = (k: string, d: number) => {
      const v = Number(url.searchParams.get(k));
      return Number.isFinite(v) && v > 0 ? v : d;
    };
    const name = url.searchParams.get("name") ?? "artwork";
    const bytes = new Uint8Array(await req.arrayBuffer());
    if (!bytes.length) return NextResponse.json({ error: "EMPTY", message: "No file uploaded." }, { status: 400 });

    const result = await analyzeUvLayout(bytes, name, {
      sheetWIn: num("w", 48),
      gapIn: Number(url.searchParams.get("gap")) >= 0 ? Number(url.searchParams.get("gap")) : undefined,
      growMm: num("grow", 5),
      dpi: num("dpi", 150),
      measurementScale: num("mscale", 1),
      uvBoxes: parseBoxes(url.searchParams.get("boxes")),
    });
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return NextResponse.json(
      { error: "UV_ERROR", message: err instanceof Error ? err.message : "UV layout failed" },
      { status: 500 },
    );
  }
}
