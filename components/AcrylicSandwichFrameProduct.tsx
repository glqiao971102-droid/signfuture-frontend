"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useCart } from "@/components/CartProvider";

const PRODUCT_NAME = "Acrylic Sandwich Frame (with Boltnut)";
const PRODUCT_HREF = "/catalog/acrylic-sandwich-frame-boltnut";

// The printed insert that sits between the two acrylic panels.
const MATERIAL = [
  { label: "Synthetic Paper 180micron", img: "/products/acrylic/clear.svg" },
];
const THICKNESS = ["2mm", "3mm", "4mm", "5mm", "6mm", "8mm"];

// Acrylic sizes, taken verbatim from the printed size chart. Hole count and
// bolt-nut size vary with the panel, so each entry carries its own suffix.
// [height, width, suffix]
const SIZE_ROWS: [number, number, string][] = [
  [6, 6, "4holes + bolt nut 12x30mm"], [6, 12, "4holes + bolt nut 12x30mm"],
  [6, 18, "4holes + bolt nut 12x30mm"], [6, 24, "4holes + bolt nut 12x30mm"],
  [6, 30, "4holes + bolt nut 12x30mm"], [6, 36, "4holes + bolt nut 12x30mm"],
  [6, 42, "4holes + bolt nut 12x30mm"], [6, 48, "6holes + bolt nut 12x30mm"],
  [6, 54, "6holes + bolt nut 12x30mm"], [6, 60, "6holes + bolt nut 12x30mm"],
  [6, 66, "6holes + bolt nut 12x30mm"], [6, 72, "6holes + bolt nut 12x30mm"],
  [6, 78, "8holes + bolt nut 12x30mm"], [6, 84, "8holes + bolt nut 12x30mm"],
  [6, 90, "8holes + bolt nut 12x30mm"], [6, 96, "8holes + bolt nut 12x30mm"],
  [12, 12, "4holes + bolt nut 12x30mm"], [12, 18, "4holes + bolt nut 12x30mm"],
  [12, 24, "4holes + bolt nut 12x30mm"], [12, 30, "4holes + bolt nut 12x30mm"],
  [12, 36, "4holes + bolt nut 12x30mm"], [12, 42, "4holes + bolt nut 12x30mm"],
  [12, 48, "4holes + bolt nut 12x30mm"], [12, 54, "6holes + bolt nut 12x30mm"],
  [12, 60, "6holes + bolt nut 12x30mm"], [12, 66, "6holes + bolt nut 12x30mm"],
  [12, 72, "6holes + bolt nut 12x30mm"], [12, 78, "8holes + bolt nut 12x30mm"],
  [12, 84, "8holes + bolt nut 12x30mm"], [12, 90, "8holes + bolt nut 12x30mm"],
  [12, 96, "8holes + bolt nut 12x30mm"],
  [18, 18, "4holes + bolt nut 19x30mm"], [18, 24, "4holes + bolt nut 19x30mm"],
  [18, 30, "4holes + bolt nut 19x30mm"], [18, 36, "4holes + bolt nut 19x30mm"],
  [18, 42, "4holes + bolt nut 19x30mm"], [18, 48, "4holes + bolt nut 19x30mm"],
  [18, 54, "6holes + bolt nut 19x30mm"], [18, 60, "6holes + bolt nut 19x30mm"],
  [18, 66, "6holes + bolt nut 19x30mm"], [18, 72, "6holes + bolt nut 19x30mm"],
  [18, 78, "8holes + bolt nut 19x30mm"], [18, 84, "8holes + bolt nut 19x30mm"],
  [18, 90, "8holes + bolt nut 19x30mm"], [18, 96, "8holes + bolt nut 19x30mm"],
  [24, 24, "4holes + bolt nut 19x30mm"], [24, 30, "4holes + bolt nut 19x30mm"],
  [24, 36, "4holes + bolt nut 19x30mm"], [24, 42, "4holes + bolt nut 19x30mm"],
  [24, 48, "4holes + bolt nut 19x30mm"], [24, 54, "6holes + bolt nut 19x30mm"],
  [24, 60, "6holes + bolt nut 19x30mm"], [24, 66, "6holes + bolt nut 19x30mm"],
  [24, 72, "6holes + bolt nut 19x30mm"], [24, 78, "8holes + bolt nut 19x30mm"],
  [24, 84, "8holes + bolt nut 19x30mm"], [24, 90, "8holes + bolt nut 19x30mm"],
  [24, 96, "8holes + bolt nut 19x30mm"],
  [30, 30, "4holes + bolt nut 19x30mm"], [30, 36, "4holes + bolt nut 19x30mm"],
  [30, 42, "4holes + bolt nut 19x30mm"], [30, 48, "4holes + bolt nut 19x30mm"],
  [30, 54, "6holes + bolt nut 19x30mm"], [30, 60, "6holes + bolt nut 19x30mm"],
  [30, 66, "6holes + bolt nut 19x30mm"], [30, 72, "6holes + bolt nut 19x30mm"],
  [30, 78, "8holes + bolt nut 19x30mm"], [30, 84, "8holes + bolt nut 19x30mm"],
  [30, 90, "8holes + bolt nut 19x30mm"], [30, 96, "8holes + bolt nut 19x30mm"],
  [36, 36, "4holes + bolt nut 19x30mm"], [36, 42, "4holes + bolt nut 19x30mm"],
  [36, 48, "4holes + bolt nut 19x30mm"], [36, 54, "6holes + bolt nut 19x30mm"],
  [36, 60, "6holes + bolt nut 19x30mm"], [36, 66, "6holes + bolt nut 19x30mm"],
  [36, 72, "6holes + bolt nut 19x30mm"], [36, 78, "8holes + bolt nut 19x30mm"],
  [36, 84, "8holes + bolt nut 19x30mm"], [36, 90, "8holes + bolt nut 19x30mm"],
  [36, 96, "8holes + bolt nut 19x30mm"],
  [48, 48, "4holes + bolt nut 19x30mm"], [48, 60, "6holes + bolt nut 19x30mm"],
  [48, 66, "6holes + bolt nut 19x30mm"], [48, 72, "8holes + bolt nut 19x30mm"],
  [48, 78, "10holes + bolt nut 19x30mm"], [48, 84, "10holes + bolt nut 19x30mm"],
  [48, 90, "10holes + bolt nut 19x30mm"], [48, 96, "10holes + bolt nut 19x30mm"],
];
const SIZE_OPTIONS = SIZE_ROWS.map(([h, w, suffix]) => ({
  label: `${h}"(H) X ${w}"(W)(${suffix})`,
  h,
  w,
}));

const THICK_MULT: Record<string, number> = {
  "2mm": 0.9, "3mm": 1, "4mm": 1.1, "5mm": 1.2, "6mm": 1.3, "8mm": 1.45,
};
const RATE = 6; // RM per sq.ft. (placeholder base rate)

const COLLECT = [
  { key: "normal", label: "4 Working Days", img: "collect-4-working-days.png", mult: 1 },
  { key: "quick3", label: "3 Working Days", img: "collect-3-working-days.png", mult: 1.12 },
  { key: "rush2", label: "2 Working Days", img: "collect-2-working-days.png", mult: 1.25 },
  { key: "next", label: "Next Working Days", img: "collect-next-working-days.png", mult: 1.5 },
];

const money = (v: number) => "RM " + v.toFixed(2);

// collect-date calc (mirrors the banner: skip Sundays, after-12:30/Fri-late/Sun pushes start)
const formatDate = (d: Date) =>
  d.toLocaleDateString("en-MY", { weekday: "short", day: "2-digit", month: "short", year: "numeric" });
const startDate = () => {
  const now = new Date();
  const day = now.getDay();
  const afterCutoff = now.getHours() > 12 || (now.getHours() === 12 && now.getMinutes() >= 30);
  const fridayLate = day === 5 && now.getHours() >= 18;
  const start = new Date(now);
  if (afterCutoff || fridayLate || day === 0) start.setDate(start.getDate() + 1);
  while (start.getDay() === 0) start.setDate(start.getDate() + 1);
  return start;
};
const addWorkingDays = (days: number) => {
  const date = startDate();
  let added = 0;
  while (added < days) {
    date.setDate(date.getDate() + 1);
    if (date.getDay() !== 0) added += 1;
  }
  return date;
};

export default function AcrylicSandwichFrameProduct() {
  const { add } = useCart();

  const [material, setMaterial] = useState(MATERIAL[0].label);
  const [thickness, setThickness] = useState(THICKNESS[0]);
  const [sizeLabel, setSizeLabel] = useState(SIZE_OPTIONS[0].label);
  const [collect, setCollect] = useState(COLLECT[0].key);
  const [qty, setQty] = useState(1);
  const [agreed, setAgreed] = useState(false);
  const [artwork, setArtwork] = useState("");
  const [added, setAdded] = useState(false);
  const [viewerSrc, setViewerSrc] = useState<string | null>(null);
  const [collectDates, setCollectDates] = useState<Record<string, string>>({});

  useEffect(() => {
    setCollectDates({
      normal: formatDate(addWorkingDays(4)),
      quick3: formatDate(addWorkingDays(3)),
      rush2: formatDate(addWorkingDays(2)),
      next: formatDate(addWorkingDays(1)),
    });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setViewerSrc(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const thicknessOptions = THICKNESS;
  const onMaterial = (val: string) => setMaterial(val);

  const collectOpt = COLLECT.find((c) => c.key === collect)!;
  const sizeOpt = SIZE_OPTIONS.find((o) => o.label === sizeLabel) || SIZE_OPTIONS[0];
  const areaSqft = (sizeOpt.h * sizeOpt.w) / 144;

  // simple live pricing (placeholder; banner-style agent tiers)
  const total =
    areaSqft * RATE * (THICK_MULT[thickness] || 1) * collectOpt.mult * qty;
  const agents = [
    { name: "Normal Agent Price", price: total },
    { name: "Gold Agent Price", price: total * 0.85 },
    { name: "Platinum Agent Price", price: total * 0.8 },
  ];

  const addToCart = () => {
    if (!agreed) return;
    add({ label: PRODUCT_NAME, href: PRODUCT_HREF, price: total, image: "/products/acrylic-sandwich-frame-hero.png" });
    setAdded(true);
  };

  return (
    <div className="xprod">
      {/* ---- hero (single banner-style image) ---- */}
      <section className="xprod-hero">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/products/acrylic-sandwich-frame-hero.png"
          alt="Custom Acrylic Sandwich Frame (with Boltnut) — CNC Cut, premium quality"
          className="xprod-hero-img"
        />
      </section>

      {/* ---- options + live quote ---- */}
      <div className="xprod-grid">
        {/* LEFT: options */}
        <section className="xprod-panel">
          <div className="xprod-head"><span className="xprod-head-icon" aria-hidden="true">▤</span><h2 className="xprod-stitle" data-kicker="Options">Acrylic Sandwich Frame (with Boltnut) Order</h2></div>

          {/* Plain dropdown, not the image-card picker — there's a single
              printing material and no swatch worth showing. */}
          <div className="xprod-field" data-icon="▤">
            <label>Printing Material</label>
            <select value={material} onChange={(e) => onMaterial(e.target.value)} disabled={MATERIAL.length === 1}>
              {MATERIAL.map((o) => <option key={o.label}>{o.label}</option>)}
            </select>
          </div>

          <div className="xprod-field" data-icon="▦">
            <label>Acrylic Thickness</label>
            <select value={thickness} onChange={(e) => setThickness(e.target.value)} disabled={thicknessOptions.length === 1}>
              {thicknessOptions.map((o) => <option key={o}>{o}</option>)}
            </select>
          </div>

          <div className="xprod-field" data-icon="⤢">
            <label>Acrylic Size</label>
            <select value={sizeLabel} onChange={(e) => setSizeLabel(e.target.value)} disabled={SIZE_OPTIONS.length === 1}>
              {SIZE_OPTIONS.map((o) => (
                <option key={o.label} value={o.label}>{o.label}</option>
              ))}
            </select>
          </div>

          <label className="xprod-artwork">
            <span>Upload your Artwork</span>
            <input
              type="file"
              accept=".ai,.pdf,.jpg,.jpeg,.png,.zip"
              onChange={(e) => setArtwork(e.target.files?.[0]?.name ?? "")}
            />
            {artwork && <span className="xprod-artwork-name">✓ {artwork}</span>}
          </label>

          {/* Collect Date sits last in the form, matching the Inkjet pages. */}
          <div className="xprod-collectp">
            <h3>Collect Date</h3>
            <div className="xprod-collect-grid">
              {COLLECT.map((c) => (
                <label
                  key={c.key}
                  className={`xprod-collect-opt${collect === c.key ? " is-selected" : ""}`}
                >
                  <input
                    type="radio"
                    name="sandwichcollect"
                    checked={collect === c.key}
                    onChange={() => setCollect(c.key)}
                  />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/apps/banner/assets/${c.img}`} alt={c.label} />
                  <button
                    type="button"
                    className="xprod-zoom"
                    aria-label={`Zoom ${c.label}`}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setViewerSrc(`/apps/banner/assets/${c.img}`);
                    }}
                  />
                  <strong>{c.label}</strong>
                </label>
              ))}
            </div>
          </div>

          {/* Upload artwork */}
        </section>

        {/* RIGHT: two separate frames — Product Detail + Order */}
        <div className="xprod-summary-col">
          <aside className="xprod-summary">
            <div className="xprod-head"><span className="xprod-head-icon" aria-hidden="true">◈</span><h2 className="xprod-stitle" data-kicker="Live Quote">Product Detail</h2></div>
            <div className="xprod-summary-list">
              <div className="xprod-sline"><span data-icon="▤">Material</span><strong>{material}</strong></div>
              <div className="xprod-sline"><span data-icon="▦">Thickness</span><strong>{thickness}</strong></div>
              <div className="xprod-sline"><span data-icon="⤢">Size</span><strong>{sizeOpt.h} x {sizeOpt.w} in</strong></div>
              <div className="xprod-sline"><span data-icon="▦">Total Area</span><strong>{areaSqft.toFixed(2)} sq.ft.</strong></div>
              <div className="xprod-sline is-wide">
                <span data-icon="▣">Collect</span>
                <strong>
                  {collectOpt.label}
                  {collectDates[collect] ? ` / ${collectDates[collect]}` : ""}
                </strong>
              </div>
            </div>
          </aside>

          <aside className="xprod-summary">
            <div className="xprod-order" style={{ border: 0, background: "transparent", boxShadow: "none", margin: 0, padding: 0 }}>
              <h3>Order Summary</h3>
              <div className="xprod-agents">
                {agents.map((a) => (
                  <div key={a.name} className="xprod-agent">
                    <span>{a.name}</span>
                    <strong>{money(a.price)}</strong>
                  </div>
                ))}
              </div>

              <div className="xprod-qrow">
                <span>Quantity</span>
                <div className="xprod-stepper">
                  <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))}>−</button>
                  <input type="number" min={1} value={qty} onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))} />
                  <button type="button" onClick={() => setQty((q) => q + 1)}>+</button>
                </div>
              </div>

              <label className="xprod-term">
                <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
                <span>I agree to the <a href="#" onClick={(e) => e.preventDefault()}>Terms and Conditions</a></span>
              </label>

              <button type="button" className="xprod-addcart" disabled={!agreed} onClick={addToCart}>
                Add to Cart
              </button>

              {added && (
                <div className="xprod-added">
                  <span>✓ {PRODUCT_NAME} added to cart — {money(agents[0].price)}</span>
                  <Link href="/cart">View Cart →</Link>
                </div>
              )}

              <p className="xprod-tolerance">
                Finished goods may differ 0.1 mm – 5.0 mm from the actual size.
              </p>
            </div>
          </aside>
        </div>
      </div>

      <div className="xs-back">
        <Link href="/category/acrylic-sheet" className="back-link">
          ← Back to Acrylic Sheet
        </Link>
      </div>

      {/* image viewer / lightbox */}
      {viewerSrc && (
        <div
          className="xprod-viewer is-open"
          onClick={(e) => {
            if (e.target === e.currentTarget) setViewerSrc(null);
          }}
        >
          <div className="xprod-viewer-card">
            <button
              type="button"
              className="xprod-viewer-close"
              aria-label="Close preview"
              onClick={() => setViewerSrc(null)}
            >
              ×
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={viewerSrc} alt="Collect date preview" />
          </div>
        </div>
      )}
    </div>
  );
}
