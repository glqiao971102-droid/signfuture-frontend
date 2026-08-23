import { NextResponse } from "next/server";
import { analyzeNesting } from "@/lib/nest/analyze";
import { API_BASE } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** The caller must be a signed-in member (verified against the backend). */
async function requireMember(req: Request): Promise<boolean> {
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
    if (!(await requireMember(req))) {
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

    const result = await analyzeNesting(bytes, name, {
      sheetWIn: num("w", 48),
      sheetHIn: num("h", 96),
      gapIn: num("gap", 0.25, true),
      allowRotate: url.searchParams.get("rot") !== "0",
    });
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return NextResponse.json(
      { error: "NEST_ERROR", message: err instanceof Error ? err.message : "Nesting failed" },
      { status: 500 },
    );
  }
}
