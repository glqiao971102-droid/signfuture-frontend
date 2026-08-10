/**
 * UI schemas describing how to render each product's pricing config as editable
 * tables (the admin "table form"). A row points at a path in the config JSON;
 * paths are arrays so keys containing spaces/dots work (e.g. "Printing with Stand").
 *
 * row kinds:
 *  - "tiers":     path -> number[4]  ([Agent, Silver, Gold, Diamond])
 *  - "brackets":  path -> [maxCm, number[4]][]  (box-up size brackets)
 */
export type PricingRow =
  | { kind: "tiers"; label: string; path: (string | number)[] }
  | { kind: "brackets"; label: string; path: (string | number)[] };

export type PricingSection = { title: string; note?: string; rows: PricingRow[] };

export type PricingSchema = {
  key: string;
  label: string;
  tierLabels: string[];
  sections: PricingSection[];
};

const TIERS = ["Agent", "Silver", "Gold", "Diamond"];

/** The three display stands share one shape. */
function standSchema(key: string, label: string): PricingSchema {
  return {
    key,
    label,
    tierLabels: TIERS,
    sections: [
      {
        title: "Printing with Stand (RM / piece)",
        rows: [
          { kind: "tiers", label: "UV Ink 1200dpi", path: ["PRICE", "Printing with Stand", "uv"] },
          { kind: "tiers", label: "Eco Solvent — No Laminate", path: ["PRICE", "Printing with Stand", "eco", "none"] },
          { kind: "tiers", label: "Eco Solvent — Laminated", path: ["PRICE", "Printing with Stand", "eco", "lam"] },
        ],
      },
      {
        title: "Printing Only (RM / piece)",
        rows: [
          { kind: "tiers", label: "UV Ink 1200dpi", path: ["PRICE", "Printing Only", "uv"] },
          { kind: "tiers", label: "Eco Solvent — No Laminate", path: ["PRICE", "Printing Only", "eco", "none"] },
          { kind: "tiers", label: "Eco Solvent — Laminated", path: ["PRICE", "Printing Only", "eco", "lam"] },
        ],
      },
      {
        title: "Stand Only (RM / piece)",
        rows: [{ kind: "tiers", label: "Stand only", path: ["STAND_ONLY_PRICE"] }],
      },
    ],
  };
}

export const PRICING_SCHEMAS: Record<string, PricingSchema> = {
  banner: {
    key: "banner",
    label: "Banner (Inkjet)",
    tierLabels: TIERS,
    sections: [
      {
        title: "UV Ink — per sq.ft.",
        rows: [
          { kind: "tiers", label: "Tarpaulin 380gsm", path: ["RATE_TABLE", "uv", "380"] },
          { kind: "tiers", label: "Tarpaulin 440gsm", path: ["RATE_TABLE", "uv", "440"] },
          { kind: "tiers", label: "Tarpaulin 510gsm", path: ["RATE_TABLE", "uv", "510"] },
          { kind: "tiers", label: "Mesh Vinyl 380gsm", path: ["RATE_TABLE", "uv", "mesh"] },
        ],
      },
      {
        title: "Eco Solvent — per sq.ft.",
        rows: [
          { kind: "tiers", label: "Tarpaulin 280gsm", path: ["RATE_TABLE", "solvent", "280"] },
          { kind: "tiers", label: "Tarpaulin 380gsm", path: ["RATE_TABLE", "solvent", "380"] },
          { kind: "tiers", label: "Tarpaulin 440gsm", path: ["RATE_TABLE", "solvent", "440"] },
          { kind: "tiers", label: "Tarpaulin 510gsm", path: ["RATE_TABLE", "solvent", "510"] },
          { kind: "tiers", label: "Mesh Vinyl 380gsm", path: ["RATE_TABLE", "solvent", "mesh"] },
        ],
      },
      {
        title: "Finishing add-on — per sq.ft.",
        note: "Added on top of the material rate.",
        rows: [
          { kind: "tiers", label: "Welded rope with eyelets", path: ["FINISHING_RATE", "rope_eyelets"] },
          { kind: "tiers", label: "Welded edge with eyelets", path: ["FINISHING_RATE", "edge_eyelets"] },
          { kind: "tiers", label: "Cut to size", path: ["FINISHING_RATE", "cut"] },
          { kind: "tiers", label: "All-round welded edge", path: ["FINISHING_RATE", "welded"] },
        ],
      },
    ],
  },
  "x-stand": standSchema("x-stand", "X Stand"),
  "roll-up-85x200-economy": standSchema("roll-up-85x200-economy", "Roll Up Stand 85×200 (Economy)"),
  "roll-up-85x200-luxury": standSchema("roll-up-85x200-luxury", "Roll Up Stand 85×200 (Luxury)"),
};

/** Read a value at an array path. */
export function getPath(obj: any, path: (string | number)[]): any {
  return path.reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

/** Immutably set a value at an array path, returning a new object. */
export function setPath(obj: any, path: (string | number)[], value: any): any {
  if (!path.length) return value;
  const [head, ...rest] = path;
  const clone = Array.isArray(obj) ? [...obj] : { ...(obj ?? {}) };
  clone[head] = setPath(obj?.[head], rest, value);
  return clone;
}
