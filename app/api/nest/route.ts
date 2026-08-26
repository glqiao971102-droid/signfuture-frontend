import { NextResponse } from "next/server";
import { analyzeNesting } from "@/lib/nest/analyze";
import { API_BASE } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

// Shared internal secret so our own backend can call this server-to-server (for
// the SF Dropbox "Cnc router file" auto-nesting). Matches the render-artwork
// route's default; set RENDER_ARTWORK_SECRET on both sides to rotate it.
const RENDER_SECRET =
  process.env.RENDER_ARTWORK_SECRET || "sf-jobrender-9f3c1e7a44b24d8ea1c6b0f2e5d78c31";

/** The caller must be a signed-in member, OR our backend via the internal secret. */
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

/**
 * POST /api/nest — auto-nest the pieces in an uploaded artwork onto sheets and
 * return an already-laid-out PDF (base64) plus per-sheet previews + stats.
 * Body = raw file bytes (AI/PDF). Query: w,h (sheet inches), gap (inches),
 * rot (0 to disable rotation), name (filename). Signed-in members.
 */
export async function POST(req: Request) {
  try {
    if (!(await requireCaller(req))) {
      return NextResponse.json({ error: "FORBIDDEN", message: "Please sign in to use this tool." }, { status: 403 });
    }
    const url = new URL(req.url);
    const num = (k: string, d: number, allowZero = false) => {
      const v = Number(url.searchParams.get(k));
      return Number.isFinite(v) && (allowZero ? v >= 0 : v > 0) ? v : d;
    };
    const name = url.searchParams.get("name") ?? "artwork";
    const bytes = new Uint8Array(await req.arrayBuffer());
    if (!bytes.length) return NextResponse.json({ error: "EMPTY", message: "No file uploaded." }, { status: 400 });

    // 3D-printer mode: slow = pack tight (fewest plates). medium/fast are
    // TIME-BALANCED — combine small pieces onto plates up to (mult × the slowest
    // single piece), so no plate is slower than the biggest letter and the total
    // parallel time stays the same while using fewer plates/machines.
    const mode = url.searchParams.get("mode");
    const balanceByTime = mode === "fast" ? 1 : mode === "medium" ? 2 : undefined;
    const printHeightMm = (Number(url.searchParams.get("h3d")) || 5) * 10;
    // trim=0 keeps every sheet the FULL bed size (3D printer shows the 80×80 plate
    // with the piece placed inside, not cropped to the piece).
    const trim = url.searchParams.get("trim") === "0" ? false : undefined;

    const result = await analyzeNesting(bytes, name, {
      sheetWIn: num("w", 48),
      sheetHIn: num("h", 96),
      gapIn: num("gap", 0.25, true),
      allowRotate: url.searchParams.get("rot") !== "0",
      drillHoles: url.searchParams.get("holes") === "1",
      wireDiaMm: num("wire", 5),
      screwDiaMm: num("screw", 3),
      // Extra stable (4 corners + coverage) is the default; only "medium" opts out.
      screwLevel: url.searchParams.get("level") === "medium" ? "medium" : "strong",
      balanceByTime,
      printHeightMm,
      trim,
      measurePerimeter: url.searchParams.get("perim") === "1",
      vectorFormats: (url.searchParams.get("fmt") ?? "").split(",").some((f) => f === "svg" || f === "dxf"),
      // Artwork drawn N× smaller (e.g. mscale=10 for a 1:10 file) → scaled up before nesting.
      measurementScale: num("mscale", 1),
    });
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return NextResponse.json(
      { error: "NEST_ERROR", message: err instanceof Error ? err.message : "Nesting failed" },
      { status: 500 },
    );
  }
}
