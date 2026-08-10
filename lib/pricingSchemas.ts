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

/** Box-up: one variant's Logo/Wording brackets + per-m² row. */
function boxCat(section: string, base: (string | number)[]): PricingSection {
  return {
    title: section,
    rows: [
      { kind: "brackets", label: "By size (RM per cm)", path: [...base, "cm"] },
      { kind: "tiers", label: "Over 100 cm (RM per m²)", path: [...base, "m2"] },
    ],
  };
}

const BOXUP_SCHEMA: PricingSchema = {
  key: "boxup",
  label: "3D Box Up",
  tierLabels: TIERS,
  sections: [
    boxCat("3D Printer Frontlit — Logo", ["FRONTLIT", "LOGO"]),
    boxCat("3D Printer Frontlit — Wording", ["FRONTLIT", "WORDING"]),
    {
      title: "3D Printer Frontlit — Add-ons (RM per cm)",
      rows: [
        { kind: "tiers", label: "LED White", path: ["FRONTLIT", "addon", "LED"] },
        { kind: "tiers", label: "UV Printing", path: ["FRONTLIT", "addon", "UV"] },
        { kind: "tiers", label: "2K Spray", path: ["FRONTLIT", "addon", "Spray"] },
      ],
    },
    boxCat("3D Printer Backlit — Logo", ["BACKLIT", "LOGO"]),
    boxCat("3D Printer Backlit — Wording", ["BACKLIT", "WORDING"]),
    {
      title: "3D Printer Backlit — Add-ons",
      rows: [
        { kind: "tiers", label: "LED White (RM/cm)", path: ["BACKLIT", "ledWhite"] },
        { kind: "tiers", label: "Clear Acrylic (RM/m²)", path: ["BACKLIT", "acrylicM2"] },
      ],
    },
    boxCat("3D Printer Front & Backlit — Logo", ["FRONT_BACKLIT", "LOGO"]),
    boxCat("3D Printer Front & Backlit — Wording", ["FRONT_BACKLIT", "WORDING"]),
    {
      title: "3D Printer Front & Backlit — Add-ons",
      rows: [
        { kind: "tiers", label: "LED White (RM/cm)", path: ["FRONT_BACKLIT", "addon", "LED"] },
        { kind: "tiers", label: "UV Printing (RM/cm)", path: ["FRONT_BACKLIT", "addon", "UV"] },
        { kind: "tiers", label: "2K Spray (RM/cm)", path: ["FRONT_BACKLIT", "addon", "Spray"] },
        { kind: "tiers", label: "Clear Acrylic (RM/m²)", path: ["FRONT_BACKLIT", "acrylicM2"] },
      ],
    },
    boxCat("Aluminium Channel — Logo", ["ALU_CHANNEL", "LOGO"]),
    boxCat("Aluminium Channel — Wording", ["ALU_CHANNEL", "WORDING"]),
    {
      title: "Aluminium Channel — Finish & Add-ons (RM per cm)",
      rows: [
        { kind: "tiers", label: "Mirror finish", path: ["ALU_CHANNEL", "finish", "mirror"] },
        { kind: "tiers", label: "Hairline finish", path: ["ALU_CHANNEL", "finish", "hairline"] },
        { kind: "tiers", label: "LED White", path: ["ALU_CHANNEL", "addon", "LED"] },
        { kind: "tiers", label: "UV Printing", path: ["ALU_CHANNEL", "addon", "UV"] },
      ],
    },
    boxCat("Stainless Frontlit — 201", ["STAINLESS", "frontlit", "base", "201"]),
    boxCat("Stainless Frontlit — 304", ["STAINLESS", "frontlit", "base", "304"]),
    {
      title: "Stainless Frontlit — Finish (304) & Add-ons (RM/cm)",
      rows: [
        { kind: "tiers", label: "304 Mirror", path: ["STAINLESS", "frontlit", "finish304", "mirror"] },
        { kind: "tiers", label: "304 Hairline", path: ["STAINLESS", "frontlit", "finish304", "hairline"] },
        { kind: "tiers", label: "LED White", path: ["STAINLESS", "frontlit", "ledWhite"] },
        { kind: "tiers", label: "UV Printing", path: ["STAINLESS", "frontlit", "uv"] },
      ],
    },
    boxCat("Stainless Backlit — 201", ["STAINLESS", "backlit", "base", "201"]),
    boxCat("Stainless Backlit — 304", ["STAINLESS", "backlit", "base", "304"]),
    {
      title: "Stainless Backlit — Finish (304) & Add-ons (RM/cm)",
      rows: [
        { kind: "tiers", label: "304 Mirror", path: ["STAINLESS", "backlit", "finish304", "mirror"] },
        { kind: "tiers", label: "304 Hairline", path: ["STAINLESS", "backlit", "finish304", "hairline"] },
        { kind: "tiers", label: "LED White", path: ["STAINLESS", "backlit", "ledWhite"] },
        { kind: "tiers", label: "UV Printing", path: ["STAINLESS", "backlit", "uv"] },
      ],
    },
    boxCat("Stainless Backlit + Acrylic — 201", ["STAINLESS", "backlitAcrylic", "base", "201"]),
    boxCat("Stainless Backlit + Acrylic — 304", ["STAINLESS", "backlitAcrylic", "base", "304"]),
    {
      title: "EG Frontlit",
      rows: [
        { kind: "brackets", label: "By size (RM per cm)", path: ["EG", "frontlit", "cm"] },
        { kind: "tiers", label: "Over 100 cm (RM/m²)", path: ["EG", "frontlit", "m2"] },
        { kind: "tiers", label: "LED White (RM/cm)", path: ["EG", "frontlit", "ledWhite"] },
        { kind: "tiers", label: "UV Printing (RM/cm)", path: ["EG", "frontlit", "uv"] },
      ],
    },
    {
      title: "EG Backlit",
      rows: [
        { kind: "brackets", label: "By size (RM per cm)", path: ["EG", "backlit", "cm"] },
        { kind: "tiers", label: "LED White (RM/cm)", path: ["EG", "backlit", "ledWhite"] },
        { kind: "tiers", label: "UV Printing (RM/cm)", path: ["EG", "backlit", "uv"] },
      ],
    },
    {
      title: "EG Backlit + Acrylic",
      rows: [
        { kind: "brackets", label: "By size (RM per cm)", path: ["EG", "backlitAcrylic", "cm"] },
        { kind: "tiers", label: "LED White (RM/cm)", path: ["EG", "backlitAcrylic", "ledWhite"] },
        { kind: "tiers", label: "UV Printing (RM/cm)", path: ["EG", "backlitAcrylic", "uv"] },
      ],
    },
  ],
};

export const PRICING_SCHEMAS: Record<string, PricingSchema> = {
  boxup: BOXUP_SCHEMA,
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
