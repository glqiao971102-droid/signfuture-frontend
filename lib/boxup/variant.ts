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
  if (v.litMode) {
    // The 3D preview reads this off <body> when it builds the scene.
    out = out.replace("<body>", `<body data-lit-mode="${v.litMode}">`);
  }
  if (v.optionOverrides?.length) {
    out = applyOptionOverrides(out, v.optionOverrides);
  }
  if (v.extraFields?.length) {
    out = applyExtraFields(out, v.extraFields);
  }
  return out;
};

export function boxUpRoutes(v: BoxUpVariant) {
  return {
    async GET() {
      return new Response(brand(await renderGet(v.appRoute), v), {
        headers: htmlHeaders,
      });
    },
    async POST(req: Request) {
      const buf = Buffer.from(await req.arrayBuffer());
      const contentType = req.headers.get("content-type") || "";
      return new Response(brand(await renderPost(buf, contentType, v.appRoute), v), {
        headers: htmlHeaders,
      });
    },
  };
}
