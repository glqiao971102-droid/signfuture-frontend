import { renderGet, renderPost, htmlHeaders } from "@/lib/neon/server-impl";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// CPU-bound pdfium analysis; give it the platform-max headroom (default 300s).
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
