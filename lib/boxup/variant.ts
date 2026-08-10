import { renderGet, renderPost, htmlHeaders } from "@/lib/boxup/server-impl";

/**
 * Every Box Up product shares one calculator engine; only the route it posts
 * back to, the displayed product name, and the cart link differ.
 *
 * The renderer hardcodes "3D Box Up" and "/3d-box-up", so those are rewritten
 * here rather than in the 250KB generated bundle. The slug rewrite deliberately
 * refuses to match "/3d-box-up/..." — asset paths (hero image, three.js vendor
 * files, LED render PNGs) all live under that prefix and must keep pointing at
 * the original folder.
 */
const SLUG_ONLY = /\/3d-box-up(?![\w/-])/g;

export type BoxUpVariant = {
  /** Route this page's calculator posts back to. */
  appRoute: string;
  /** Product name shown in the title and heading. */
  name: string;
  /** Storefront page the cart entry links to. */
  href: string;
  /**
   * "back" lights the wall behind the letter and leaves the front panel opaque.
   * "both" keeps the face lit and adds the same rear halo.
   * Omit for the standard front-lit look.
   */
  litMode?: "back" | "both";
  /** Per-product option lists; omit to keep the shared defaults. */
  optionOverrides?: OptionOverride[];
  /** Extra controls this product needs that the shared renderer lacks. */
  extraFields?: ExtraField[];
};

/**
 * Option lists that differ per product. Each entry replaces the whole <option>
 * run of one select.
 *
 * Where a renamed option keeps an explicit `value`, that is deliberate: the
 * calculator and the 3D preview branch on those exact strings (for example
 * `isBlack = surface === "3mm Black Acrylic"`), so the value stays put and only
 * the customer-facing label changes.
 */
type OptionOverride = { selectClass: string; options: string };

/**
 * Extra markup placed next to an existing field. Used to add controls the
 * shared renderer does not know about. Give exactly one anchor.
 */
type ExtraField =
  | { afterFieldClass: string; beforeFieldClass?: never; html: string }
  | { beforeFieldClass: string; afterFieldClass?: never; html: string };

const applyExtraFields = (html: string, fields: ExtraField[]) => {
  let out = html;
  for (const f of fields) {
    if (f.beforeFieldClass) {
      // Anchor on the opening tag only - safe even when the field wraps nested
      // divs, which a closing-tag match would terminate on early.
      const re = new RegExp(`(<div class="${f.beforeFieldClass}">)`, "g");
      out = out.replace(re, `${f.html}$1`);
    } else {
      const re = new RegExp(
        `(<div class="${f.afterFieldClass}">(?:(?!</div>)[\\s\\S])*?</select></div>)`,
        "g",
      );
      out = out.replace(re, `$1${f.html}`);
    }
  }
  return out;
};

const applyOptionOverrides = (html: string, overrides: OptionOverride[]) => {
  let out = html;
  for (const o of overrides) {
    const re = new RegExp(
      `(class="[^"]*\\b${o.selectClass}\\b[^"]*">)(?:<option[^>]*>[^<]*</option>)+`,
      "g",
    );
    out = out.replace(re, `$1${o.options}`);
  }
  return out;
};

const brand = (html: string, v: BoxUpVariant) => {
  let out = html.split("3D Box Up").join(v.name).replace(SLUG_ONLY, v.href);
  // The 3D-print filament estimate only applies to 3D-printed letters. The base
  // renderer emits it (it IS the frontlit 3D printer); strip it from the other
  // box-up products (stainless steel, aluminium channel), whose returns are not
  // printed layer-by-layer. Every 3D-printer variant is named "3D Printer (...)".
  if (!v.name.startsWith("3D Printer")) {
    out = out.replace(/<!--FILAMENT-START-->[\s\S]*?<!--FILAMENT-END-->/g, "");
  }
  if (v.litMode) {
    // The 3D preview reads this off the body when it builds the scene.
    out = out.replace("<body>", `<body data-lit-mode="${v.litMode}">`);
  }
  // Tag the body with the product name so the client price logic can scope
  // per-product rules reliably (e.g. Aluminum Channel vs Stainless, which share
  // Mirror/Hairline colour options and can't be told apart from option text).
  const nameAttr = v.name.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
  out = out.replace(/<body/, `<body data-boxup-name="${nameAttr}"`);
  if (v.optionOverrides?.length) {
    out = applyOptionOverrides(out, v.optionOverrides);
  }
  if (v.extraFields?.length) {
    out = applyExtraFields(out, v.extraFields);
  }
  return out;
};

/**
 * Fetches the admin-editable box-up price tables from the backend and returns a
 * <script> that exposes them as window.__BOXUP_PRICES__ (the calculator reads
 * this, falling back to its built-in literals). Best-effort: on any error /
 * timeout it returns "" so the calculator uses its defaults and behaves exactly
 * as before. Injected into <head> so it runs before the calculator script.
 */
async function boxUpPricesScript(): Promise<string> {
  try {
    const base =
      process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "http://localhost:3333";
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 2500);
    const res = await fetch(`${base}/api/v1/pricing/boxup`, {
      signal: ctrl.signal,
      cache: "no-store",
    });
    clearTimeout(timer);
    if (!res.ok) return "";
    const body = await res.json();
    if (!body?.config || typeof body.config !== "object") return "";
    // JSON.stringify output is safe inside a <script> except for "</" sequences.
    const json = JSON.stringify(body.config).replace(/<\//g, "<\\/");
    return `<script>window.__BOXUP_PRICES__=${json};</script>`;
  } catch {
    return "";
  }
}

function injectPrices(html: string, script: string): string {
  if (!script) return html;
  return html.includes("</head>")
    ? html.replace("</head>", `${script}</head>`)
    : script + html;
}

export function boxUpRoutes(v: BoxUpVariant) {
  return {
    async GET() {
      const [html, script] = await Promise.all([
        renderGet(v.appRoute).then((h) => brand(h, v)),
        boxUpPricesScript(),
      ]);
      return new Response(injectPrices(html, script), { headers: htmlHeaders });
    },
    async POST(req: Request) {
      const buf = Buffer.from(await req.arrayBuffer());
      const contentType = req.headers.get("content-type") || "";
      const [html, script] = await Promise.all([
        renderPost(buf, contentType, v.appRoute).then((h) => brand(h, v)),
        boxUpPricesScript(),
      ]);
      return new Response(injectPrices(html, script), { headers: htmlHeaders });
    },
  };
}
