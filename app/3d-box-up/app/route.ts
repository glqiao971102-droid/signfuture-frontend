import { existsSync } from "node:fs";
import { join } from "node:path";
import { renderGet, renderPost, htmlHeaders } from "@/lib/boxup/server-impl";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// pdfium rasterization + tesseract OCR is CPU-bound and much slower on Vercel's
// throttled function CPU than locally, so give it the platform-max headroom
// (default is 300s; we were previously capping ourselves at 120s → 504).
export const maxDuration = 300;

// The base page IS "3D Printer (Frontlit)". When a dedicated banner has been
// added at public/3d-box-up/hero-3d-printer-frontlit.png, swap it in for the
// shared hero.png (which stays the generic box-up fallback for grouping cards).
function withFrontlitHero(html: string): string {
  const file = "hero-3d-printer-frontlit.png";
  if (existsSync(join(process.cwd(), "public", "3d-box-up", file))) {
    return html.split('src="/3d-box-up/hero.png"').join(`src="/3d-box-up/${file}"`);
  }
  return html;
}

export async function GET() {
  const body = withFrontlitHero(await renderGet());
  return new Response(body, { headers: htmlHeaders });
}

export async function POST(req: Request) {
  const buf = Buffer.from(await req.arrayBuffer());
  const contentType = req.headers.get("content-type") || "";
  const body = withFrontlitHero(await renderPost(buf, contentType));
  return new Response(body, { headers: htmlHeaders });
}
