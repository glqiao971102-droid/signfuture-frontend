"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { useCart } from "@/components/CartProvider";
import { HUMAN_PRICE, HUMAN_STAND_ONLY } from "@/lib/humanStandPrices";

const FINISHING = ["Printing with Stand", "Stand Only"];

// Metal and Mounting are the two stand types this product is sold with; the
// choice drives which sizes are on offer further down the form.
const STANDEE = [
  { label: "Metal", img: "/products/human-stand/metal.svg" },
  { label: "Mounting", img: "/products/human-stand/mounting.svg" },
];

const MATERIAL = ["Paper Foamboard", "PVC Foamboard"];
// Paper is stocked in one thickness only, so it needs no picker of its own.
const PAPER_THICKNESS = "5mm";
const PVC_THICKNESS = ["3mm", "5mm", "8mm"];
const SURFACE = ["Diecut Only"];

// Printed panel sizes. Mounting reaches one size higher than Metal.
const PRINT_SIZE_METAL = [
  '24"(W)X36"(H) (60cm Stand)',
  '24"(W)X48"(H) (90cm Stand)',
  '24"(W)X60"(H) (120cm Stand)',
  '24"(W)X72"(H) (150cm Stand)',
  '30"(W)X48"(H) (90cm Stand)',
  '30"(W)X60"(H) (120cm Stand)',
  '30"(W)X72"(H) (150cm Stand)',
  '36"(W)X48"(H) (90cm Stand)',
  '36"(W)X60"(H) (120cm Stand)',
  '36"(W)X72"(H) (150cm Stand)',
  '48"(W)X60"(H) (120cm Stand)',
  '48"(W)X72"(H) (150cm Stand)',
];
const PRINT_SIZE_MOUNTING = [...PRINT_SIZE_METAL, '48"(W)X96"(H) (180cm Stand)'];

// A bare stand is sold in fewer heights than the printed panels use.
const STAND_SIZE_METAL = ["60cm Stand"];
const STAND_SIZE_MOUNTING = [
  "60cm Stand",
  "90cm Stand",
  "120cm Stand",
  "150cm Stand",
  "180cm Stand",
];

const sizesFor = (standee: string, bareStand: boolean) => {
  if (bareStand) return standee === "Metal" ? STAND_SIZE_METAL : STAND_SIZE_MOUNTING;
  return standee === "Metal" ? PRINT_SIZE_METAL : PRINT_SIZE_MOUNTING;
};

const COLLECT = [
  { key: "normal", label: "4 Working Days", img: "collect-4-working-days.png", mult: 1 },
  { key: "quick3", label: "3 Working Days", img: "collect-3-working-days.png", mult: 1.45 },
  { key: "rush2", label: "2 Working Days", img: "collect-2-working-days.png", mult: 1.55 },
  { key: "next", label: "Next Working Days", img: "collect-next-working-days.png", mult: 1.65 },
];

const money = (v: number) => "RM " + v.toFixed(2);

// Printed sizes read 24"(W)X36"(H) ... - pull the inches back out for the area.
const areaOf = (label: string) => {
  const m = label.match(/(\d+)"\(W\)X(\d+)"\(H\)/);
  if (!m) return null;
  return { w: Number(m[1]), h: Number(m[2]), sqft: (Number(m[1]) * Number(m[2])) / 144 };
};

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

export default function HumanStandProduct() {
  const { user } = useAuth();
  const { add } = useCart();

  const [finishing, setFinishing] = useState(FINISHING[0]);
  const [standee, setStandee] = useState(STANDEE[0].label);
  const [standeeOpen, setStandeeOpen] = useState(false);
  const [material, setMaterial] = useState(MATERIAL[0]);
  const [thickness, setThickness] = useState(PVC_THICKNESS[0]);
  const [surface, setSurface] = useState(SURFACE[0]);
  const [size, setSize] = useState(PRINT_SIZE_METAL[0]);
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
  const sizes = sizesFor(standee, standOnly);
  const collectOpt = COLLECT.find((c) => c.key === collect)!;

  // Thickness is only a choice on PVC; Paper always reads back as 5mm, so the
  // hidden PVC value can never leak into the quote.
  const isPvc = material === "PVC Foamboard";
  const materialLabel = `${material} ${isPvc ? thickness : PAPER_THICKNESS}`;

  // Stand type and finishing both reshuffle the size list, so drop a size that
  // the new list cannot offer instead of letting it linger into the quote.
  const reconcileSize = (nextStandee: string, nextStandOnly: boolean) => {
    const list = sizesFor(nextStandee, nextStandOnly);
    if (!list.includes(size)) setSize(list[0]);
  };

  const area = standOnly ? null : areaOf(size);

  // Per-tier live pricing [Agent, Silver, Gold, Diamond] from the price sheet:
  // Printing depends on Standee + Material/Thickness + Size; Stand Only on
  // Standee + height (material-independent).
  const tierUnit: number[] = standOnly
    ? HUMAN_STAND_ONLY[standee]?.[size] ?? [0, 0, 0, 0]
    : HUMAN_PRICE[standee]?.[materialLabel]?.[size] ?? [0, 0, 0, 0];
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
    add({
      label: `Human Stand (${standee})`,
      href: "/catalog/human-stand",
      price: total,
      image: "/products/human-stand-hero.png",
    });
    setAdded(true);
  };

  return (
    <div className="xprod">
      {/* ---- hero (single banner-style image) ---- */}
      <section className="xprod-hero">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/products/human-stand-hero.png"
          alt="Custom Human Stand — premium quality"
          className="xprod-hero-img"
        />
      </section>

      {/* ---- options + live quote ---- */}
      <div className="xprod-grid">
        {/* LEFT: options */}
        <section className="xprod-panel">
          <div className="xprod-head">
            <span className="xprod-head-icon" aria-hidden="true">▤</span>
            <h2 className="xprod-stitle" data-kicker="Options">Human Stand Order</h2>
          </div>

          <div className="xprod-field" data-icon="✎">
            <label>Finishing</label>
            <select
              value={finishing}
              onChange={(e) => {
                const next = e.target.value;
                setFinishing(next);
                reconcileSize(standee, next === "Stand Only");
              }}
              disabled={FINISHING.length === 1}
            >
              {FINISHING.map((o) => <option key={o}>{o}</option>)}
            </select>
          </div>

          <div className="xprod-field" data-icon="▥">
            <label>Standee</label>
            <button
              type="button"
              className="xprod-picker-trigger"
              aria-expanded={standeeOpen}
              disabled={STANDEE.length === 1}
              onClick={() => setStandeeOpen((o) => !o)}
            >
              <span>{standee}</span>
              <span className={`xprod-caret${standeeOpen ? " up" : ""}`}>▾</span>
            </button>
            {standeeOpen && (
              <div className="xprod-collect-grid cols2 xprod-pick-open">
                {STANDEE.map((o) => (
                  <label
                    key={o.label}
                    className={`xprod-collect-opt${standee === o.label ? " is-selected" : ""}`}
                  >
                    <input
                      type="radio"
                      name="standee"
                      checked={standee === o.label}
                      onChange={() => {
                        setStandee(o.label);
                        reconcileSize(o.label, standOnly);
                        setStandeeOpen(false);
                      }}
                    />
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={o.img} alt={o.label} />
                    <button
                      type="button"
                      className="xprod-zoom"
                      aria-label={`Zoom ${o.label}`}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setViewerSrc(o.img);
                      }}
                    />
                    <strong>{o.label}</strong>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* A bare stand has no printed panel, so the print options drop out. */}
          {!standOnly && (
            <>
              <div className="xprod-field" data-icon="▤">
                <label>Printing Material</label>
                <select
                  value={material}
                  onChange={(e) => setMaterial(e.target.value)}
                  disabled={MATERIAL.length === 1}
                >
                  {MATERIAL.map((o) => <option key={o}>{o}</option>)}
                </select>
              </div>

              {/* PVC comes in three thicknesses; Paper only in one. */}
              {isPvc && (
                <div className="xprod-field" data-icon="▣">
                  <label>Thickness</label>
                  <select
                    value={thickness}
                    onChange={(e) => setThickness(e.target.value)}
                    disabled={PVC_THICKNESS.length === 1}
                  >
                    {PVC_THICKNESS.map((o) => <option key={o}>{o}</option>)}
                  </select>
                </div>
              )}

              <div className="xprod-field" data-icon="◐">
                <label>Surface Finishing</label>
                <select
                  value={surface}
                  onChange={(e) => setSurface(e.target.value)}
                  disabled={SURFACE.length === 1}
                >
                  {SURFACE.map((o) => <option key={o}>{o}</option>)}
                </select>
              </div>
            </>
          )}

          {/* Size stays on for a bare stand - it picks the stand height. */}
          <div className="xprod-field" data-icon="⤢">
            <label>{standOnly ? "Stand Size" : "Size"}</label>
            <select
              value={size}
              onChange={(e) => setSize(e.target.value)}
              disabled={sizes.length === 1}
            >
              {sizes.map((o) => <option key={o}>{o}</option>)}
            </select>
          </div>

          {!standOnly && (
            <label className="xprod-artwork">
              <span>Upload your Artwork</span>
              <input
                type="file"
                accept=".ai,.pdf,.jpg,.jpeg,.png,.zip"
                onChange={(e) => setArtwork(e.target.files?.[0]?.name ?? "")}
              />
              {artwork && <span className="xprod-artwork-name">✓ {artwork}</span>}
            </label>
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
                    name="xcollect"
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
              <div className="xprod-sline"><span data-icon="▥">Standee</span><strong>{standee}</strong></div>
              <div className="xprod-sline"><span data-icon="▤">Material</span><strong>{standOnly ? "Stand only" : materialLabel}</strong></div>
              <div className="xprod-sline"><span data-icon="⤢">Size</span><strong>{area ? `${area.w} x ${area.h} in` : size}</strong></div>
              <div className="xprod-sline"><span data-icon="▦">Total Area</span><strong>{area ? `${area.sqft.toFixed(2)} sq.ft.` : "—"}</strong></div>
              <div className="xprod-sline is-wide"><span data-icon="✎">Finishing</span><strong>{standOnly ? finishing : `${finishing} / ${surface}`}</strong></div>
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
                  <span>✓ Human Stand ({standee}) added to cart — {money(agents[0].price)}</span>
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
            <img src={viewerSrc} alt="Option preview" />
          </div>
        </div>
      )}
    </div>
  );
}
