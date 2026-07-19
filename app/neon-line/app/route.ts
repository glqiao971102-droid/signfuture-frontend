import { renderGet, renderPost, htmlHeaders } from "@/lib/neon/server-impl";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
