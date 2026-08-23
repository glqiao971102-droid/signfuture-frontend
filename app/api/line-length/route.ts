import { NextResponse } from "next/server";
import { analyzeLineLength } from "@/lib/linelen/analyze";
import { API_BASE } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** Server-side gate: the caller must be a signed-in member. We verify the bearer
 *  token against the backend (which owns auth) rather than trusting the client. */
async function requireMember(req: Request): Promise<boolean> {
  const auth = req.headers.get("authorization");
  if (!auth) return false;
  try {
    const res = await fetch(`${API_BASE}/api/v1/auth/me`, {
      headers: { Authorization: auth, Accept: "application/json" },
      cache: "no-store",
    });
    return res.ok; // any valid signed-in account may use the tool
  } catch {
    return false;
  }
}

/**
 * POST /api/line-length — measures the total LENGTH (metres) of the black lines
 * in a RASTER black/white artwork, plus the artwork size. Body = raw file bytes
 * (AI/PDF). Query: ?scale=<measurementScale> (1:10-style), ?name=<filename>.
 * Returns the LineLengthResult JSON (incl. a preview PNG data URL). Signed-in members.
 */
export async function POST(req: Request) {
  try {
    if (!(await requireMember(req))) {
      return NextResponse.json({ error: "FORBIDDEN", message: "Please sign in to use this tool." }, { status: 403 });
    }
    const url = new URL(req.url);
    const scale = Number(url.searchParams.get("scale") ?? "1") || 1;
    const name = url.searchParams.get("name") ?? "artwork";
    const renderOverride = Number(url.searchParams.get("render") ?? "0") || undefined;
    const bytes = new Uint8Array(await req.arrayBuffer());
    if (!bytes.length) return NextResponse.json({ error: "EMPTY", message: "No file uploaded." }, { status: 400 });

    const result = await analyzeLineLength(bytes, name, scale, renderOverride);
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return NextResponse.json(
      { error: "ANALYZE_ERROR", message: err instanceof Error ? err.message : "Analyze failed" },
      { status: 500 },
    );
  }
}
