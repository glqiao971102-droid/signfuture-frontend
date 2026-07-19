"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { useCart } from "@/components/CartProvider";

const PRODUCT_NAME = "PVC Foamboard";
const PRODUCT_HREF = "/catalog/pvc-foamboard";

// Options from the old Sign Future PVC Foamboard product page.
const FINISHING = ["Diecut Only", "Diecut + UV Printing"];
const THICKNESS = ["3mm", "5mm", "10mm", "15mm", "18mm", "25mm", "30mm"];
const HEIGHTS = [6, 12, 18, 24, 30, 36, 48];
const WIDTHS = [6, 12, 18, 24, 30, 36, 42, 48, 54, 60, 66, 72, 78, 84, 90, 96];
// Single combined size list: 6in(H) x 6in(W) ... 48in(H) x 96in(W) (width >= height).
const SIZE_OPTIONS: { label: string; h: number; w: number }[] = [];
HEIGHTS.forEach((h) =>
  WIDTHS.forEach((w) => {
    if (w >= h) SIZE_OPTIONS.push({ label: `${h}in(H) x ${w}in(W)`, h, w });
  }),
);

const THICK_MULT: Record<string, number> = {
  "3mm": 1, "5mm": 1.15, "10mm": 1.4, "15mm": 1.7, "18mm": 1.9, "25mm": 2.3, "30mm": 2.6,
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

export default function PvcFoamboardProduct() {
  const { user } = useAuth();
  const { add } = useCart();

  const [finishing, setFinishing] = useState(FINISHING[0]);
  const [thickness, setThickness] = useState(THICKNESS[0]);
  const [sizeLabel, setSizeLabel] = useState("24in(H) x 24in(W)");
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

  const collectOpt = COLLECT.find((c) => c.key === collect)!;
  const sizeOpt = SIZE_OPTIONS.find((o) => o.label === sizeLabel) || SIZE_OPTIONS[0];
  const areaSqft = (sizeOpt.h * sizeOpt.w) / 144;
  const uvPrinting = finishing.includes("UV Printing");

  // simple live pricing (placeholder; banner-style agent tiers)
  const total =
    areaSqft * RATE * (THICK_MULT[thickness] || 1) * (uvPrinting ? 1.4 : 1) * collectOpt.mult * qty;
  const agents = [
    { name: "Normal Agent Price", price: total },
    { name: "Gold Agent Price", price: total * 0.85 },
    { name: "Platinum Agent Price", price: total * 0.8 },
  ];

  const addToCart = () => {
    if (!agreed) return;
    // Made-to-order CNC-cut product — deliverable, even though cross-listed under Materials.
    add({ label: PRODUCT_NAME, href: PRODUCT_HREF, price: total, image: "/products/pvc-foamboard-hero.png", deliverable: true });
    setAdded(true);
  };

  return (
    <div className="xprod">
      {/* ---- hero (single banner-style image) ---- */}
      <section className="xprod-hero">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/products/pvc-foamboard-hero.png"
          alt="Custom PVC Foamboard — CNC Cut, premium quality"
          className="xprod-hero-img"
        />
      </section>

      {/* ---- options + live quote ---- */}
      <div className="xprod-grid">
        {/* LEFT: options */}
        <section className="xprod-panel">
          <h2 className="xprod-stitle" data-kicker="Options">PVC Foamboard Order</h2>

          <div className="xprod-field">
            <label>Choose Material</label>
            <div className="xprod-fixedfield">PVC Foamboard</div>
          </div>

          <div className="xprod-field">
            <label>Surface Finishing</label>
            <select value={finishing} onChange={(e) => setFinishing(e.target.value)}>
              {FINISHING.map((o) => <option key={o}>{o}</option>)}
            </select>
          </div>

          <div className="xprod-field">
            <label>PVC Thickness</label>
            <select value={thickness} onChange={(e) => setThickness(e.target.value)}>
              {THICKNESS.map((o) => <option key={o}>{o}</option>)}
            </select>
          </div>

          <div className="xprod-field">
            <label>Size (inch)</label>
            <select value={sizeLabel} onChange={(e) => setSizeLabel(e.target.value)}>
              {SIZE_OPTIONS.map((o) => (
                <option key={o.label} value={o.label}>{o.label}</option>
              ))}
            </select>
          </div>

          {/* Collect Date — 4 zoomable images (unchanged) */}
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
                    name="pvccollect"
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

          {/* Upload artwork (unchanged) */}
          <label className="xprod-artwork">
            <span>Upload your Artwork</span>
            <input
              type="file"
              accept=".ai,.pdf,.jpg,.jpeg,.png,.zip"
              onChange={(e) => setArtwork(e.target.files?.[0]?.name ?? "")}
            />
            {artwork && <span className="xprod-artwork-name">✓ {artwork}</span>}
          </label>
        </section>

        {/* RIGHT: two separate frames — Product Detail + Order */}
        <div className="xprod-summary-col">
          <aside className="xprod-summary">
            <h2 className="xprod-stitle" data-kicker="Live Quote">Product Detail</h2>
            <div className="xprod-summary-list">
              <div className="xprod-sline"><span>Material</span><strong>PVC Foamboard</strong></div>
              <div className="xprod-sline"><span>Thickness</span><strong>{thickness}</strong></div>
              <div className="xprod-sline"><span>Size</span><strong>{sizeOpt.h} x {sizeOpt.w} in</strong></div>
              <div className="xprod-sline"><span>Total Area</span><strong>{areaSqft.toFixed(2)} sq.ft.</strong></div>
              <div className="xprod-sline is-wide"><span>Finishing</span><strong>{finishing}</strong></div>
              <div className="xprod-sline is-wide">
                <span>Collect</span>
                <strong>
                  {collectOpt.label}
                  {collectDates[collect] ? ` / ${collectDates[collect]}` : ""}
                </strong>
              </div>
            </div>
          </aside>

          <aside className="xprod-summary">
            <div className="xprod-order" style={{ border: 0, background: "transparent", boxShadow: "none", margin: 0, padding: 0 }}>
              <h3>Order</h3>
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
        <Link href="/category/mounting" className="back-link">
          ← Back to Mounting
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
