"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { useCart } from "@/components/CartProvider";

const FINISHING = ["Printing with Stand", "Printing with Accessories", "Stand Only"];
const MATERIAL = "White Sticker Matt 80 Micron";
// Backdrop panels are quoted by booth size; both are 230cm tall.
const SIZE = [
  { label: "3x3 (230cm X 359cm)", w: 359, h: 230 },
  { label: "4x3 (230cm X 434cm)", w: 434, h: 230 },
];
const CM2_PER_SQFT = 929.0304;
// Matt options first, then gloss - the order the printed chart lists them in.
const LAMINATION = [
  "No Laminate",
  "Matt Lam 100micron",
  "Gloss Lam 100micron",
];

const COLLECT = [
  { key: "normal", label: "4 Working Days", img: "collect-4-working-days.png", mult: 1 },
  { key: "quick3", label: "3 Working Days", img: "collect-3-working-days.png", mult: 1.45 },
  { key: "rush2", label: "2 Working Days", img: "collect-2-working-days.png", mult: 1.55 },
  { key: "next", label: "Next Working Days", img: "collect-next-working-days.png", mult: 1.65 },
];

// Per-tier price [Agent, Silver, Gold, Diamond] from the Pop Up Backdrop price sheet.
// Printing (with Stand / with Accessories) depends on Size + Lamination; Stand Only by Size.
type Tier4 = number[];
const PRICE: Record<string, Record<string, Record<string, Tier4>>> = {
  "Printing with Stand": {
    "3x3 (230cm X 359cm)": { "No Laminate": [1079.54, 1002.43, 1002.43, 1002.43], "Matt Lam 100micron": [1195.96, 1110.5, 1110.5, 1110.5], "Gloss Lam 100micron": [1195.96, 1110.5, 1110.5, 1110.5] },
    "4x3 (230cm X 434cm)": { "No Laminate": [1247.4, 1158.3, 1158.3, 1158.3], "Matt Lam 100micron": [1391.5, 1292.1, 1292.1, 1292.1], "Gloss Lam 100micron": [1391.5, 1292.1, 1292.1, 1292.1] },
  },
  "Printing with Accessories": {
    "3x3 (230cm X 359cm)": { "No Laminate": [646.8, 600.6, 600.6, 600.6], "Matt Lam 100micron": [763.2, 708.7, 708.7, 708.7], "Gloss Lam 100micron": [763.2, 708.7, 708.7, 708.7] },
    "4x3 (230cm X 434cm)": { "No Laminate": [794.5, 737.9, 737.9, 737.9], "Matt Lam 100micron": [938.8, 871.7, 871.7, 871.7], "Gloss Lam 100micron": [938.8, 871.7, 871.7, 871.7] },
  },
};
const STAND_ONLY: Record<string, Tier4> = {
  "3x3 (230cm X 359cm)": [793.1, 736.4, 736.4, 736.4],
  "4x3 (230cm X 434cm)": [887, 823.7, 823.7, 823.7],
};

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

export default function PopUpBackdropStraightProduct() {
  const { user } = useAuth();
  const { add } = useCart();

  const [finishing, setFinishing] = useState(FINISHING[0]);
  const [lam, setLam] = useState(LAMINATION[0]);
  const [size, setSize] = useState(SIZE[0].label);
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

  const standOnly = finishing === "Stand Only";
  const collectOpt = COLLECT.find((c) => c.key === collect)!;

  const sizeOpt = SIZE.find((s) => s.label === size)!;
  // Per-tier live pricing from the price sheet: printing by Finishing + Size +
  // Lamination; Stand Only by Size.
  const tierUnit: number[] = standOnly
    ? STAND_ONLY[size] ?? [0, 0, 0, 0]
    : PRICE[finishing]?.[size]?.[lam] ?? [0, 0, 0, 0];
  const tierTotals = tierUnit.map((v) => Math.max(0, v * qty * collectOpt.mult));
  const total = tierTotals[0];
  const agents = [
    { name: "Agent Price", price: tierTotals[0] },
    { name: "Silver Agent Price", price: tierTotals[1] },
    { name: "Gold Agent Price", price: tierTotals[2] },
    { name: "Diamond Agent Price", price: tierTotals[3] },
  ];

  const addToCart = () => {
    if (!agreed) return;
    add({ label: "Pop Up Backdrop Display (Straight)", href: "/catalog/pop-up-backdrop-display-straight", price: total, image: "/products/pop-up-backdrop-straight-hero.png" });
    setAdded(true);
  };

  return (
    <div className="xprod">
      {/* ---- hero (single banner-style image) ---- */}
      <section className="xprod-hero">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/products/pop-up-backdrop-straight-hero.png"
          alt="Custom Pop Up Backdrop Display (Straight) — premium quality"
          className="xprod-hero-img"
        />
      </section>

      {/* ---- options + live quote ---- */}
      <div className="xprod-grid">
        {/* LEFT: options */}
        <section className="xprod-panel">
          <div className="xprod-head">
            <span className="xprod-head-icon" aria-hidden="true">▤</span>
            <h2 className="xprod-stitle" data-kicker="Options">Pop Up Backdrop Display (Straight) Order</h2>
          </div>

          <div className="xprod-field" data-icon="✎">
            <label>Finishing</label>
            <select value={finishing} onChange={(e) => setFinishing(e.target.value)} disabled={FINISHING.length === 1}>
              {FINISHING.map((o) => <option key={o}>{o}</option>)}
            </select>
          </div>

          {/* A bare stand has no printed panel, so the print options drop out. */}
          {/* Size is chosen for both printing and Stand Only (frame size). */}
          <div className="xprod-field" data-icon="⤢">
            <label>Size</label>
            <select value={size} onChange={(e) => setSize(e.target.value)} disabled={SIZE.length === 1}>
              {SIZE.map((o) => <option key={o.label}>{o.label}</option>)}
            </select>
          </div>

          {!standOnly && (
            <>
              <div className="xprod-field" data-icon="▤">
                <label>Printing Material</label>
                <select disabled value={MATERIAL}>
                  <option>{MATERIAL}</option>
                </select>
              </div>

              <div className="xprod-field" data-icon="◐">
                <label>Lamination</label>
                <select value={lam} onChange={(e) => setLam(e.target.value)} disabled={LAMINATION.length === 1}>
                  {LAMINATION.map((o) => <option key={o}>{o}</option>)}
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
            </>
          )}

          {/* Collect Date sits last in the form, matching the Inkjet pages.
              A bare stand ships from stock, so it skips this step. */}
          {!standOnly && (
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
                    name="popupstraightcollect"
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
          )}
        </section>

        {/* RIGHT: two separate frames — Product Detail + Order */}
        <div className="xprod-summary-col">
          <aside className="xprod-summary">
            <div className="xprod-head">
              <span className="xprod-head-icon" aria-hidden="true">◈</span>
              <h2 className="xprod-stitle" data-kicker="Live Quote">Product Detail</h2>
            </div>
            <div className="xprod-summary-list">
              <div className="xprod-sline is-wide"><span data-icon="▤">Material</span><strong>{standOnly ? "Stand only" : MATERIAL}</strong></div>
              <div className="xprod-sline"><span data-icon="⤢">Size</span><strong>{standOnly ? "—" : `${sizeOpt.h} x ${sizeOpt.w} cm`}</strong></div>
              <div className="xprod-sline"><span data-icon="▦">Total Area</span><strong>{standOnly ? "—" : `${((sizeOpt.w * sizeOpt.h) / CM2_PER_SQFT).toFixed(2)} sq.ft.`}</strong></div>
              <div className="xprod-sline is-wide"><span data-icon="◐">Lamination</span><strong>{standOnly ? "—" : lam}</strong></div>
              <div className="xprod-sline is-wide"><span data-icon="✎">Finishing</span><strong>{finishing}</strong></div>
              {!standOnly && (
              <div className="xprod-sline is-wide">
                <span data-icon="▣">Collect</span>
                <strong>
                  {collectOpt.label}
                  {collectDates[collect] ? ` / ${collectDates[collect]}` : ""}
                </strong>
              </div>
              )}
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
                  <span>✓ Pop Up Backdrop Display (Straight) added to cart — {money(agents[0].price)}</span>
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
