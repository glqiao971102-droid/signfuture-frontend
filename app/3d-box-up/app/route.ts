import { renderGet, renderPost, htmlHeaders } from "@/lib/boxup/server-impl";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Rasterizing large artboards via pdfium can take a few seconds.
export const maxDuration = 120;

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
