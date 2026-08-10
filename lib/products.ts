export type Product = {
  slug: string;
  /** Route path under the Next.js app. */
  href: string;
  /** Source the embedded app is loaded from inside the product page iframe. */
  appSrc: string;
  name: string;
  tagline: string;
  /** Short emoji/symbol used on the home cards. */
  glyph: string;
  accent: string;
};

export const PRODUCTS: Product[] = [
  {
    slug: "banner",
    href: "/banner",
    appSrc: "/apps/banner/index.html",
    name: "Inkjet Banner",
    tagline: "Inkjet printing banner calculator — size, finishing, and instant pricing.",
    glyph: "▭",
    accent: "var(--cyan)",
  },
  {
    slug: "bunting",
    href: "/bunting",
    appSrc: "/apps/bunting/index.html",
    name: "Bunting",
    tagline: "Inkjet printing bunting calculator — size, finishing, and instant pricing.",
    glyph: "▭",
    accent: "var(--cyan)",
  },
  {
    slug: "billboard-backdrop",
    href: "/billboard-backdrop",
    appSrc: "/apps/billboard-backdrop/index.html",
    name: "Billboard / Backdrop",
    tagline: "Large-format billboard and backdrop calculator — size, finishing, and instant pricing.",
    glyph: "▭",
    accent: "var(--cyan)",
  },
  {
    slug: "zigzag-banner",
    href: "/zigzag-banner",
    appSrc: "/apps/zigzag-banner/index.html",
    name: "Zigzag Banner",
    tagline: "Zigzag banner calculator — size, finishing, and instant pricing.",
    glyph: "▭",
    accent: "var(--cyan)",
  },
  {
    slug: "poster",
    href: "/poster",
    appSrc: "/apps/poster/index.html",
    name: "Poster",
    tagline: "Poster printing calculator — size, finishing, and instant pricing.",
    glyph: "▭",
    accent: "var(--cyan)",
  },
  {
    slug: "lightbox-printing-material",
    href: "/lightbox-printing-material",
    appSrc: "/apps/lightbox-printing-material/index.html",
    name: "Lightbox Printing Material",
    tagline: "Lightbox printing material calculator — size, finishing, and instant pricing.",
    glyph: "▭",
    accent: "var(--cyan)",
  },
  {
    slug: "draft-paper",
    href: "/draft-paper",
    appSrc: "/apps/draft-paper/index.html",
    name: "Draft Paper",
    tagline: "Draft paper printing calculator — size, finishing, and instant pricing.",
    glyph: "▭",
    accent: "var(--cyan)",
  },
  {
    slug: "sticker",
    href: "/sticker",
    appSrc: "/apps/sticker/index.html",
    name: "Sticker",
    tagline: "Sticker printing calculator — size, finishing, and instant pricing.",
    glyph: "▭",
    accent: "var(--cyan)",
  },
  {
    slug: "lightbox-sticker",
    href: "/lightbox-sticker",
    appSrc: "/apps/lightbox-sticker/index.html",
    name: "Lightbox Sticker",
    tagline: "Lightbox sticker calculator — size, finishing, and instant pricing.",
    glyph: "▭",
    accent: "var(--cyan)",
  },
  {
    slug: "car-sticker",
    href: "/car-sticker",
    appSrc: "/apps/car-sticker/index.html",
    name: "Car Sticker",
    tagline: "Car sticker calculator — size, finishing, and instant pricing.",
    glyph: "▭",
    accent: "var(--cyan)",
  },
  {
    slug: "diecut-sticker",
    href: "/diecut-sticker",
    appSrc: "/apps/diecut-sticker/index.html",
    name: "Diecut Sticker",
    tagline: "Diecut sticker calculator — size, finishing, and instant pricing.",
    glyph: "▭",
    accent: "var(--cyan)",
  },
  {
    slug: "window-clear-sticker",
    href: "/window-clear-sticker",
    appSrc: "/apps/window-clear-sticker/index.html",
    name: "Window Clear Sticker",
    tagline: "Window clear sticker calculator — size, finishing, and instant pricing.",
    glyph: "▭",
    accent: "var(--cyan)",
  },
  {
    slug: "window-one-way-vision-sticker",
    href: "/window-one-way-vision-sticker",
    appSrc: "/apps/window-one-way-vision-sticker/index.html",
    name: "Window One Way Vision Sticker",
    tagline: "Window one way vision sticker calculator — size, finishing, and instant pricing.",
    glyph: "▭",
    accent: "var(--cyan)",
  },
  {
    slug: "window-frosted-sticker",
    href: "/window-frosted-sticker",
    appSrc: "/apps/window-frosted-sticker/index.html",
    name: "Window Frosted Sticker",
    tagline: "Window frosted sticker calculator — size, finishing, and instant pricing.",
    glyph: "▭",
    accent: "var(--cyan)",
  },
  {
    slug: "neon-line",
    href: "/neon-line",
    appSrc: "/neon-line/app",
    name: "Neon Line",
    tagline: "Measure neon tube length straight from your artwork and price it.",
    glyph: "〰",
    accent: "var(--pink)",
  },
  {
    slug: "3d-box-up",
    href: "/3d-box-up",
    appSrc: "/3d-box-up/app",
    name: "3D Box Up",
    tagline: "3D LED letter / box-up estimator with a live 3D preview.",
    glyph: "◆",
    accent: "var(--blue)",
  },
];

export const productBySlug = (slug: string) =>
  PRODUCTS.find((p) => p.slug === slug);

/**
 * Items shown in the "Product" dropdown in the top navigation. A node either
 * links somewhere (leaf, has `href`) or opens a submenu (has `children`).
 */
export type ProductMenuItem = {
  label: string;
  href?: string;
  /** True when a working calculator exists; false leaves render a "coming soon" page. */
  available?: boolean;
  children?: ProductMenuItem[];
};

export const PRODUCT_MENU: ProductMenuItem[] = [
  {
    label: "Inkjet Printing",
    children: [
      { label: "Bunting", href: "/bunting", available: true },
      { label: "Banner", href: "/banner", available: true },
      { label: "Billboard / Backdrop", href: "/billboard-backdrop", available: true },
      { label: "Zigzag Banner", href: "/zigzag-banner", available: true },
      { label: "Poster", href: "/poster", available: true },
      { label: "Lightbox Printing Material", href: "/lightbox-printing-material", available: true },
      {
        label: "Sticker",
        children: [
          { label: "Sticker", href: "/sticker", available: true },
          { label: "Lightbox Sticker", href: "/lightbox-sticker", available: true },
          { label: "Car Sticker", href: "/car-sticker", available: true },
          { label: "Diecut Sticker", href: "/diecut-sticker", available: true },
          { label: "Window Clear Sticker", href: "/window-clear-sticker", available: true },
          { label: "Window One Way Vision Sticker", href: "/window-one-way-vision-sticker", available: true },
          { label: "Window Frosted Sticker", href: "/window-frosted-sticker", available: true },
        ],
      },
      { label: "Draft Paper", href: "/draft-paper", available: true },
    ],
  },
  {
    label: "3D Led Box Up",
    children: [
      {
        label: "3D Printer Box Up",
        children: [
          { label: "3D Printer (Frontlit)", href: "/3d-box-up", available: true },
          { label: "3D Printer (Backlit)", href: "/catalog/3d-printer-backlit", available: true },
          { label: "3D Printer (Backlit with 10mm Clear Acrylic)", href: "/catalog/3d-printer-backlit-acrylic", available: true },
          { label: "3D Printer (Front & Backlit)", href: "/catalog/3d-printer-front-backlit", available: true },
          { label: "3D Printer (Front & Backlit with 10mm Clear Acrylic)", href: "/catalog/3d-printer-front-backlit-acrylic", available: true },
        ],
      },
      {
        label: "Stainless Steel Box Up",
        children: [
          { label: "3D Stainless Steel Box Up (Frontlit)", href: "/catalog/stainless-steel-box-up-frontlit", available: true },
          { label: "3D Stainless Steel Box Up (Backlit)", href: "/catalog/stainless-steel-box-up-backlit", available: true },
          { label: "3D Stainless Steel Box Up (Backlit with 10mm Clear Acrylic)", href: "/catalog/stainless-steel-box-up-backlit-acrylic", available: true },
        ],
      },
      {
        label: "EG Box Up",
        children: [
          { label: "EG Box Up (Frontlit)", href: "/catalog/eg-box-up-frontlit", available: true },
          { label: "EG Box Up (Backlit)", href: "/catalog/eg-box-up-backlit", available: true },
          { label: "EG Box Up (Backlit with 10mm Clear Acrylic)", href: "/catalog/eg-box-up-backlit-acrylic", available: true },
        ],
      },
      { label: "Aluminum Channel Box Up", href: "/catalog/aluminum-channel-box-up", available: true },
    ],
  },
  {
    label: "Led Sign",
    children: [
      { label: "Neon Sign", href: "/neon-line", available: true },
      {
        label: "Fabric Lightbox",
        children: [
          { label: "Fabric Lightbox Sign", href: "/catalog/fabric-lightbox-sign", available: true },
          { label: "Fabric Lightbox Sign (Circle)", href: "/catalog/fabric-lightbox-sign-circle", available: true },
        ],
      },
      { label: "Lightbox Poster Film", href: "/catalog/lightbox-poster-film", available: true },
      { label: "Modern Wall Sign", href: "/catalog/modern-wall-sign", available: true },
    ],
  },
  {
    label: "Display System",
    children: [
      { label: "X Stand", href: "/catalog/x-stand", available: true },
      {
        label: "T Stand",
        children: [
          { label: "Tripod Stand", href: "/catalog/tripod-stand", available: true },
          { label: "T Bar Stand", href: "/catalog/t-bar-stand", available: true },
        ],
      },
      {
        label: "Roll Up Stand",
        children: [
          { label: "Roll Up Stand 76cm x 200cm (Economy)", href: "/catalog/roll-up-stand-76x200-economy", available: true },
          { label: "Roll Up Stand 85cm x 200cm (Economy)", href: "/catalog/roll-up-stand-85x200-economy", available: true },
          { label: "Roll Up Stand 85cm x 200cm (Luxury)", href: "/catalog/roll-up-stand-85x200-luxury", available: true },
          { label: "Roll Up Stand 85cm x 200cm (Luxury) (2 Side)", href: "/catalog/roll-up-stand-85x200-luxury-2side", available: true },
          { label: "Roll Up Stand 120cm x 200cm (Luxury)", href: "/catalog/roll-up-stand-120x200-luxury", available: true },
        ],
      },
      { label: "Door Bunting Stand", href: "/catalog/door-bunting-stand", available: true },
      { label: "Human Stand", href: "/catalog/human-stand", available: true },
      {
        label: "Poster Stand",
        children: [
          { label: "Easel Stand", href: "/catalog/easel-stand", available: true },
          { label: "H Stand (Slanted)", href: "/catalog/h-stand-slanted", available: true },
          { label: "H Stand (Straight)", href: "/catalog/h-stand-straight", available: true },
          { label: "Wooden Easel Stand", href: "/catalog/wooden-easel-stand", available: true },
        ],
      },
      { label: "Promotion Counter", href: "/catalog/promotion-counter", available: true },
      {
        label: "Pop Up Backdrop Display (Soft Case)",
        children: [
          { label: "Pop Up Backdrop Display (Curve)", href: "/catalog/pop-up-backdrop-display-curve", available: true },
          { label: "Pop Up Backdrop Display (Straight)", href: "/catalog/pop-up-backdrop-display-straight", available: true },
        ],
      },
      { label: "Jumbo Banner", href: "/catalog/jumbo-banner", available: true },
      {
        label: "Aluminium Aboard Stand",
        children: [
          { label: "Aluminium Aboard Stand 80cm x 150cm", href: "/catalog/aluminium-aboard-stand-80x150", available: true },
          { label: "Aluminium Aboard Stand 100cm x 200cm", href: "/catalog/aluminium-aboard-stand-100x200", available: true },
          { label: "Aluminium Aboard Stand 100cm x 300cm", href: "/catalog/aluminium-aboard-stand-100x300", available: true },
        ],
      },
      { label: "Hand Up Poster", href: "/catalog/hand-up-poster", available: true },
    ],
  },
  {
    label: "Fabric Display",
    children: [
      {
        label: "Wind Flags",
        children: [
          { label: "Wind Flag (Cross Base)", href: "/catalog/wind-flag-cross-base", available: true },
          { label: "Wind Flag (Water Base)", href: "/catalog/wind-flag-water-base", available: true },
          { label: "Wind Flag (Rectangle)", href: "/catalog/wind-flag-rectangle", available: true },
          { label: "Giant Wind Flag", href: "/catalog/giant-wind-flag", available: true },
        ],
      },
      { label: "Straight Backdrop", href: "/catalog/straight-backdrop", available: true },
      { label: "Curve Backdrop", href: "/catalog/curve-backdrop", available: true },
      { label: "Tension Fabric Barricade", href: "/catalog/tension-fabric-barricade", available: true },
      { label: "Door Bunting Stand (Fabric Display)", href: "/catalog/door-bunting-stand-fabric", available: true },
      { label: "Tension Fabric Promotion Table", href: "/catalog/tension-fabric-promotion-table", available: true },
      { label: "Air Dancer", href: "/catalog/air-dancer", available: true },
      { label: "Hand Flag", href: "/catalog/hand-flag", available: true },
      {
        label: "Backpack Flag",
        children: [
          { label: "Backpack Flag (Bow)", href: "/catalog/backpack-flag-bow", available: true },
          { label: "Backpack Flag (Rectangle)", href: "/catalog/backpack-flag-rectangle", available: true },
          { label: "Backpack Flag (Teardrop)", href: "/catalog/backpack-flag-teardrop", available: true },
        ],
      },
      { label: "S Shape Display", href: "/catalog/s-shape-display", available: true },
      { label: "Tower (Curve)", href: "/catalog/tower-curve", available: true },
      { label: "Tower (Oblique)", href: "/catalog/tower-oblique", available: true },
    ],
  },
  {
    label: "Mounting",
    children: [
      { label: "PVC Foamboard", href: "/catalog/pvc-foamboard", available: true },
      { label: "Paper Foamboard", href: "/catalog/paper-foamboard", available: true },
      { label: "PP Sheet", href: "/catalog/pp-sheet", available: true },
    ],
  },
  {
    label: "Acrylic Sheet",
    children: [
      { label: "Acrylic Sheet", href: "/catalog/acrylic-sheet", available: true },
      { label: "Acrylic Bevel Edge Frame (with Boltnut)", href: "/catalog/acrylic-bevel-edge-frame-boltnut", available: true },
      { label: "Acrylic Sandwich Frame (with Boltnut)", href: "/catalog/acrylic-sandwich-frame-boltnut", available: true },
    ],
  },
  {
    label: "Materials",
    children: [
      {
        label: "Mounting Boards",
        children: [
          { label: "Paper Foamboard", href: "/catalog/paper-foamboard", available: false },
          { label: "PP Sheet Board", href: "/catalog/pp-sheet-board", available: false },
          { label: "PVC Foamboard", href: "/catalog/pvc-foamboard", available: false },
          { label: "Transparent Board", href: "/catalog/transparent-board", available: false },
        ],
      },
      { label: "Soldering Item", href: "/catalog/soldering-item", available: false },
      { label: "LED 60 Light Strip", href: "/catalog/led-60-light-strip", available: false },
      { label: "LED 120 Neon Light Strip", href: "/catalog/led-120-neon-light-strip", available: false },
      { label: "6mm Neon Silicone Rubber (Roll)", href: "/catalog/6mm-neon-silicone-rubber-roll", available: false },
      { label: "Neon Cutter", href: "/catalog/neon-cutter", available: false },
      { label: "Router Bit & Collet", href: "/catalog/router-bit-collet", available: false },
      { label: "Power Supply", href: "/catalog/power-supply", available: false },
    ],
  },
];

/** All leaf items (with an href), flattened from the menu tree. */
export const flattenMenu = (
  nodes: ProductMenuItem[] = PRODUCT_MENU
): ProductMenuItem[] =>
  nodes.flatMap((n) => (n.children ? flattenMenu(n.children) : n.href ? [n] : []));

export const menuItemBySlug = (slug: string) =>
  flattenMenu().find((m) => m.href === `/catalog/${slug}`);

/**
 * Hrefs of every product under the top-level "Materials" category.
 * Materials are self-collect only (not delivered), so the cart uses this to
 * flag/disable delivery for them automatically — no per-product tagging needed.
 */
export const MATERIAL_HREFS: Set<string> = new Set(
  (() => {
    const cat = PRODUCT_MENU.find((n) => n.label === "Materials");
    return cat?.children
      ? flattenMenu(cat.children).map((m) => m.href).filter((h): h is string => !!h)
      : [];
  })(),
);

/** Is this product deliverable? Materials are not; an explicit flag overrides. */
export const isDeliverable = (item: { href: string; deliverable?: boolean }): boolean =>
  item.deliverable === true
    ? true
    : item.deliverable === false
      ? false
      : !MATERIAL_HREFS.has(item.href);

export const slugify = (label: string): string =>
  label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

/** A node is a "category" when it has children. */
export const isCategory = (node: ProductMenuItem): boolean => !!node.children?.length;

/** The link a menu node points to: its category page, calculator, or catalog stub. */
export const nodeHref = (node: ProductMenuItem): string =>
  node.children ? `/category/${slugify(node.label)}` : node.href ?? "#";

/** Find a category node (one with children) by its slug, searching the whole tree. */
export const findCategoryBySlug = (
  slug: string,
  nodes: ProductMenuItem[] = PRODUCT_MENU
): ProductMenuItem | null => {
  for (const n of nodes) {
    if (n.children?.length) {
      if (slugify(n.label) === slug) return n;
      const found = findCategoryBySlug(slug, n.children);
      if (found) return found;
    }
  }
  return null;
};

/** Glyph shown on category cards / list headers, keyed by top-level label. */
export const CATEGORY_GLYPH: Record<string, string> = {
  "Inkjet Printing": "▭",
  "3D Led Box Up": "◆",
  "Led Sign": "〰",
  "Display System": "⊞",
  "Fabric Display": "⚑",
  Mounting: "▣",
  "Acrylic Sheet": "◫",
  Materials: "✦",
};

/** Top-level site links shown after the Product dropdown in the navigation. */
export type SiteNavItem = { label: string; href: string; newTab?: boolean };

export const SITE_NAV: SiteNavItem[] = [
  { label: "User Guide", href: "/user-guide" },
  { label: "FAQ", href: "/faq" },
  { label: "Contact Us", href: "/contact-us" },
  { label: "Package", href: "/package" },
  // Opens the company profile PDF in a new browser tab.
  { label: "Company Profile", href: "/sign-future-company-profile.pdf", newTab: true },
];
