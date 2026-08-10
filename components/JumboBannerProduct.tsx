"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { useCart } from "@/components/CartProvider";

const MATERIAL = ["Tarpaulin 380gsm"];

// Per-tier price [Agent, Silver, Gold, Diamond] by Size (single material).
const PRICE: Record<string, number[]> = {
  "48in x 48in": [278.8, 232.3, 232.3, 232.3],
  "60in x 60in": [299.7, 249.8, 249.8, 249.8],
  "72in x 72in": [325.4, 271.1, 271.1, 271.1],
  "84in x 84in": [355.6, 296.3, 296.3, 296.3],
  "94in x 94in": [390.6, 325.5, 325.5, 325.5],
};
const PRINT_TECH = ["UV Ink 1200dpi"];
const FINISHING = ["Welded 3inch pocket (top & bottom)"];

// Fixed size options (square banners). No free-entry sizing.
const SIZE = [
  "48in x 48in",
  "60in x 60in",
  "72in x 72in",
  "84in x 84in",
  "94in x 94in",
];

const COLLECT = [
  { key: "normal", label: "4 Working Days", img: "collect-4-working-days.png", mult: 1 },
  { key: "quick3", label: "3 Working Days", img: "collect-3-working-days.png", mult: 1.45 },
  { key: "rush2", label: "2 Working Days", img: "collect-2-working-days.png", mult: 1.55 },
  { key: "next", label: "Next Working Days", img: "collect-next-working-days.png", mult: 1.65 },
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

export default function JumboBannerProduct() {
  const { user } = useAuth();
  const { add } = useCart();

  const [material, setMaterial] = useState(MATERIAL[0]);
  const [tech, setTech] = useState(PRINT_TECH[0]);
  const [finishing, setFinishing] = useState(FINISHING[0]);
  const [size, setSize] = useState(SIZE[0]);
  const [collect, setCollect] = useState(COLLECT[0].key);
  // 'Next Working Days' closes daily at 4pm; re-checked on a timer.
  const [nowHour, setNowHour] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNowHour(new Date().getHours());
    tick();
    const id = setInterval(tick, 30000);
    return () => clearInterval(id);
  }, []);
  const nextClosed = nowHour !== null && nowHour >= 16;
  useEffect(() => {
    if (nextClosed && collect === "next") setCollect(COLLECT[0].key);
  }, [nextClosed, collect]);
  const [qty, setQty] = useState(1);
  const [agreed, setAgreed] = useState(false);
  const [artwork, setArtwork] = useState("");
  const [added, setAdded] = useState(false);
  const [viewerSrc, setViewerSrc] = useState<string | null>(null);
  const [collectDates, setCollectDates] = useState<Record<string, string>>({});

  // compute collect dates on the client (avoids hydration mismatch from new Date())
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

  const sizeDims = size.match(/(\d+)in x (\d+)in/);
  const sizeW = sizeDims ? Number(sizeDims[1]) : 0;
  const sizeH = sizeDims ? Number(sizeDims[2]) : 0;
  const area = (sizeW * sizeH) / 144;

  // Per-tier live pricing from the price sheet, by Size.
  const tierUnit: number[] = PRICE[size] ?? [0, 0, 0, 0];
  const tierTotals = tierUnit.map((v) => Math.max(0, v * qty * collectOpt.mult));
  const total = tierTotals[0];
  const agents = [
    { name: "Agent Price", price: tierTotals[0] },
    { name: "Silver Agent Price", price: tierTotals[1] },
    { name: "Gold Agent Price", price: tierTotals[2] },
    { name: "Diamond Agent Price", price: tierTotals[3] },
  ];

  // A blank or zero dimension quotes RM 0.00, so hold the order until both are set.
  const hasSize = area > 0;
  const canOrder = agreed && hasSize;

  const addToCart = () => {
    if (!canOrder) return;
    add({
      label: "Jumbo Banner",
      href: "/catalog/jumbo-banner",
      price: total,
      image: "/products/jumbo-banner-hero.png",
    });
    setAdded(true);
  };

  return (
    <div className="xprod">
      {/* ---- hero (single banner-style image) ---- */}
      <section className="xprod-hero">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/products/jumbo-banner-hero.png"
          alt="Custom Jumbo Banner — premium quality"
          className="xprod-hero-img"
        />
      </section>

      {/* ---- options + live quote ---- */}
      <div className="xprod-grid">
        {/* LEFT: options */}
        <section className="xprod-panel">
          <div className="xprod-head">
            <span className="xprod-head-icon" aria-hidden="true">▤</span>
            <h2 className="xprod-stitle" data-kicker="Options">Jumbo Banner Order</h2>
          </div>

          <div className="xprod-field" data-icon="▤">
            <label>Choose Material</label>
            <select
              value={material}
              onChange={(e) => setMaterial(e.target.value)}
              disabled={MATERIAL.length === 1}
            >
              {MATERIAL.map((o) => <option key={o}>{o}</option>)}
            </select>
          </div>

          <div className="xprod-field" data-icon="◈">
            <label>Printing</label>
            <select
              value={tech}
              onChange={(e) => setTech(e.target.value)}
              disabled={PRINT_TECH.length === 1}
            >
              {PRINT_TECH.map((o) => <option key={o}>{o}</option>)}
            </select>
          </div>

          <div className="xprod-field" data-icon="⤢">
            <label>Size</label>
            <select value={size} onChange={(e) => setSize(e.target.value)} disabled={SIZE.length === 1}>
              {SIZE.map((o) => <option key={o}>{o}</option>)}
            </select>
          </div>

          <div className="xprod-field" data-icon="✎">
            <label>Finishing</label>
            <select
              value={finishing}
              onChange={(e) => setFinishing(e.target.value)}
              disabled={FINISHING.length === 1}
            >
              {FINISHING.map((o) => <option key={o}>{o}</option>)}
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
                  className={`xprod-collect-opt${collect === c.key ? " is-selected" : ""}${c.key === "next" && nextClosed ? " is-disabled" : ""}`}
                >
                  <input
                    type="radio"
                    name="jumbocollect"
                    checked={collect === c.key}
                    disabled={c.key === "next" && nextClosed}
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
        </section>

        {/* RIGHT: two separate frames — Product Detail + Order */}
        <div className="xprod-summary-col">
          <aside className="xprod-summary">
            <div className="xprod-head">
              <span className="xprod-head-icon" aria-hidden="true">◈</span>
              <h2 className="xprod-stitle" data-kicker="Live Quote">Product Detail</h2>
            </div>
            <div className="xprod-summary-list">
              <div className="xprod-sline"><span data-icon="◈">Printing</span><strong>{tech}</strong></div>
              <div className="xprod-sline"><span data-icon="▤">Material</span><strong>{material}</strong></div>
              <div className="xprod-sline"><span data-icon="⤢">Size</span><strong>{size}</strong></div>
              <div className="xprod-sline"><span data-icon="▦">Total Area</span><strong>{area.toFixed(2)} sq.ft.</strong></div>
              <div className="xprod-sline is-wide"><span data-icon="✎">Finishing</span><strong>{finishing}</strong></div>
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

              <button type="button" className="xprod-addcart" disabled={!canOrder} onClick={addToCart}>
                Add to Cart
              </button>

              {added && (
                <div className="xprod-added">
                  <span>✓ Jumbo Banner added to cart — {money(agents[0].price)}</span>
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
        <Link href="/category/display-system" className="back-link">
          ← Back to Display System
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
