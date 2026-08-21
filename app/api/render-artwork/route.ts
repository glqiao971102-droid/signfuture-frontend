import { NextResponse } from "next/server";
import { PNG } from "pngjs";
import { extractPdf } from "@/lib/pdf/extract";
import { renderPageRgb } from "@/lib/pdf/pdfium";
import { POINTS_PER_INCH } from "@/lib/pdf/vector";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

// Shared internal secret so ONLY our backend can call this rasteriser (it is a
// server-to-server helper for the Job Order PDF, never called from a browser).
// Both this route and the BE fall back to the same baked default, so it is
// locked out of the box; set RENDER_ARTWORK_SECRET on both sides to rotate it.
const RENDER_SECRET =
  process.env.RENDER_ARTWORK_SECRET || "sf-jobrender-9f3c1e7a44b24d8ea1c6b0f2e5d78c31";

/**
 * POST /api/render-artwork — rasterises the FIRST page of an uploaded PDF/AI
 * (both are PDF-format) into a PNG so it can be shown as an image on the
 * production Job Order sheet. Body = the raw file bytes. Returns image/png.
 * Requires the internal x-render-secret header.
 */
export async function POST(req: Request) {
  try {
    if (req.headers.get("x-render-secret") !== RENDER_SECRET) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }
    const bytes = new Uint8Array(await req.arrayBuffer());
    if (!bytes.length) return NextResponse.json({ error: "EMPTY" }, { status: 400 });

    const pages = await extractPdf(bytes);
    if (!pages.length) return NextResponse.json({ error: "NO_PAGES" }, { status: 422 });
    const p0 = pages[0];
    const maxPt = Math.max(p0.widthPt || POINTS_PER_INCH, p0.heightPt || POINTS_PER_INCH);
    // Target ~1500px on the longest side — sharp when printed, but bounded so a
    // huge artboard doesn't blow up memory. (scale 1.0 ≈ 72 DPI.)
    const scale = Math.min(2.5, Math.max(0.3, 1500 / maxPt));

    const r = await renderPageRgb(bytes, 0, scale);
    if (!r) return NextResponse.json({ error: "RENDER_FAILED" }, { status: 422 });

    // rgbColor = the artwork's real colours composited on white.
    const png = new PNG({ width: r.width, height: r.height });
    const src = r.rgbColor;
    for (let i = 0, j = 0; i < r.width * r.height; i++, j += 3) {
      png.data[i * 4] = src[j];
      png.data[i * 4 + 1] = src[j + 1];
      png.data[i * 4 + 2] = src[j + 2];
      png.data[i * 4 + 3] = 255;
    }
    const buf = PNG.sync.write(png);
    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: { "Content-Type": "image/png", "Cache-Control": "no-store" },
    });
  } catch (err) {
    return NextResponse.json(
      { error: "RENDER_ERROR", message: err instanceof Error ? err.message : "render failed" },
      { status: 500 },
    );
  }
}
