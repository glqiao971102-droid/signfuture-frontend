import { renderGet, renderPost, htmlHeaders } from "@/lib/boxup/server-impl";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// pdfium rasterization + tesseract OCR is CPU-bound and much slower on Vercel's
// throttled function CPU than locally, so give it the platform-max headroom
// (default is 300s; we were previously capping ourselves at 120s → 504).
export const maxDuration = 300;

export async function GET() {
  const body = await renderGet();
  return new Response(body, { headers: htmlHeaders });
}

export async function POST(req: Request) {
  const buf = Buffer.from(await req.arrayBuffer());
  const contentType = req.headers.get("content-type") || "";
  const body = await renderPost(buf, contentType);
  return new Response(body, { headers: htmlHeaders });
}
