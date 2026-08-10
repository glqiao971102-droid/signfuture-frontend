"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { useCart } from "@/components/CartProvider";

const FINISHING = ["Printing with Stand", "Printing Only", "Stand Only"];
const PRINT_TECH = ["UV Ink 1200dpi", "Eco Solvent 1400dpi"];
const LAMINATION = ["No Laminate", "Matt Laminate", "Gloss Laminate"];
const SIZE = [
  '24"(W) X 72"(H) with Pvc Pipe',
  '24"(W) X 60"(H) with Pvc Pipe',
  '30"(W) X 72"(H) with Pvc Pipe',
  '30"(W) X 60"(H) with Pvc Pipe',
  '36"(W) X 72"(H) with Pvc Pipe',
  '36"(W) X 60"(H) with Pvc Pipe',
  '48"(W) X 72"(H) with Pvc Pipe',
  '48"(W) X 60"(H) with Pvc Pipe',
];

const COLLECT = [
  { key: "normal", label: "4 Working Days", img: "collect-4-working-days.png", mult: 1 },
  { key: "quick3", label: "3 Working Days", img: "collect-3-working-days.png", mult: 1.45 },
  { key: "rush2", label: "2 Working Days", img: "collect-2-working-days.png", mult: 1.55 },
  { key: "next", label: "Next Working Days", img: "collect-next-working-days.png", mult: 1.65 },
];

// Per-size, per-tier price [Agent, Silver, Gold, Diamond] from the Tripod Stand price sheet.
// UV Ink 1200dpi has no laminate; Eco Solvent has No Laminate vs Laminate (Matt = Gloss).
// Rows follow the SIZE array order. Stand Only is size-independent.
type SizePrice = {
  pwUv: number[]; pwEcoNone: number[]; pwEcoLam: number[];
  poUv: number[]; poEcoNone: number[]; poEcoLam: number[];
};
const PRICE: SizePrice[] = [
  { pwUv:[55.95,46.63,46.63,46.63], pwEcoNone:[51.4,42.83,42.83,42.83], pwEcoLam:[74.21,61.84,61.84,61.84], poUv:[31.2,26,26,26], poEcoNone:[26.65,22.21,22.21,22.21], poEcoLam:[49.46,41.22,41.22,41.22] },
  { pwUv:[50.93,42.44,42.44,42.44], pwEcoNone:[47.12,39.27,39.27,39.27], pwEcoLam:[66.13,55.11,55.11,55.11], poUv:[26.18,21.81,21.81,21.81], poEcoNone:[22.37,18.65,18.65,18.65], poEcoLam:[41.38,34.49,34.49,34.49] },
  { pwUv:[63.52,52.93,52.93,52.93], pwEcoNone:[57.82,48.18,48.18,48.18], pwEcoLam:[86.33,71.94,71.94,71.94], poUv:[38.77,32.31,32.31,32.31], poEcoNone:[33.07,27.56,27.56,27.56], poEcoLam:[61.58,51.32,51.32,51.32] },
  { pwUv:[57.22,47.69,47.69,47.69], pwEcoNone:[52.47,43.73,43.73,43.73], pwEcoLam:[76.23,63.53,63.53,63.53], poUv:[32.47,27.06,27.06,27.06], poEcoNone:[27.72,23.1,23.1,23.1], poEcoLam:[51.48,42.9,42.9,42.9] },
  { pwUv:[71.08,59.24,59.24,59.24], pwEcoNone:[64.23,53.53,53.53,53.53], pwEcoLam:[98.45,82.04,82.04,82.04], poUv:[46.33,38.61,38.61,38.61], poEcoNone:[39.48,32.9,32.9,32.9], poEcoLam:[73.7,61.41,61.41,61.41] },
  { pwUv:[63.52,52.93,52.93,52.93], pwEcoNone:[57.82,48.18,48.18,48.18], pwEcoLam:[86.33,71.94,71.94,71.94], poUv:[38.77,32.31,32.31,32.31], poEcoNone:[33.07,27.56,27.56,27.56], poEcoLam:[61.58,51.32,51.32,51.32] },
  { pwUv:[86.19,71.82,71.82,71.82], pwEcoNone:[77.06,64.22,64.22,64.22], pwEcoLam:[122.68,102.23,102.23,102.23], poUv:[61.44,51.2,51.2,51.2], poEcoNone:[52.31,43.59,43.59,43.59], poEcoLam:[97.93,81.61,81.61,81.61] },
  { pwUv:[95.91,79.93,79.93,79.93], pwEcoNone:[68.51,57.09,57.09,57.09], pwEcoLam:[126.32,105.27,105.27,105.27], poUv:[71.16,59.3,59.3,59.3], poEcoNone:[63.56,52.97,52.97,52.97], poEcoLam:[101.57,84.65,84.65,84.65] },
];
const STAND_ONLY: number[] = [20.6, 19.5, 19.5, 19.5];

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

export default function TripodStandProduct() {
  const { user } = useAuth();
  const { add } = useCart();

  const [finishing, setFinishing] = useState(FINISHING[0]);
  const [tech, setTech] = useState(PRINT_TECH[0]);
  const [lam, setLam] = useState(LAMINATION[0]);
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

  const standOnly = finishing === "Stand Only";
  const printingOnly = finishing === "Printing Only";
  const collectOpt = COLLECT.find((c) => c.key === collect)!;

  // Per-tier live pricing from the price sheet: pick the row for the chosen
  // Size, then the column set for Finishing + Print Tech + Lamination.
  const sizeIdx = Math.max(0, SIZE.indexOf(size));
  const sizeDims = size.match(/(\d+)"\(W\) X (\d+)"\(H\)/);
  const sizeW = sizeDims ? Number(sizeDims[1]) : 24;
  const sizeH = sizeDims ? Number(sizeDims[2]) : 72;
  const sizeArea = (sizeW * sizeH) / 144;
  let tierUnit: number[];
  if (standOnly) {
    tierUnit = STAND_ONLY;
  } else {
    const rec = PRICE[sizeIdx] || PRICE[0];
    const isUv = tech === "UV Ink 1200dpi";
    const hasLam = lam !== "No Laminate"; // Matt & Gloss share the Laminate price
    if (printingOnly) {
      tierUnit = isUv ? rec.poUv : hasLam ? rec.poEcoLam : rec.poEcoNone;
    } else {
      tierUnit = isUv ? rec.pwUv : hasLam ? rec.pwEcoLam : rec.pwEcoNone;
    }
  }
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
    add({ label: "Tripod Stand", href: "/catalog/tripod-stand", price: total, image: "/products/tripod-stand-hero.png" });
    setAdded(true);
  };

  return (
    <div className="xprod">
      {/* ---- hero (single banner-style image) ---- */}
      <section className="xprod-hero">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/products/tripod-stand-hero.png"
          alt="Custom Tripod Stand — premium quality"
          className="xprod-hero-img"
        />
      </section>

      {/* ---- options + live quote ---- */}
      <div className="xprod-grid">
        {/* LEFT: options */}
        <section className="xprod-panel">
          <div className="xprod-head">
            <span className="xprod-head-icon" aria-hidden="true">▤</span>
            <h2 className="xprod-stitle" data-kicker="Options">Tripod Stand Order</h2>
          </div>

          <div className="xprod-field" data-icon="✎">
            <label>Finishing</label>
            <select value={finishing} onChange={(e) => setFinishing(e.target.value)} disabled={FINISHING.length === 1}>
              {FINISHING.map((o) => <option key={o}>{o}</option>)}
            </select>
          </div>

          {!standOnly && (
            <>
              <div className="xprod-field" data-icon="▤">
                <label>Choose Material</label>
                <select disabled value="Synthetic Paper 180 Micron">
                  <option>Synthetic Paper 180 Micron</option>
                </select>
              </div>
              <div className="xprod-field" data-icon="◈">
                <label>Printing</label>
                <select
                  value={tech}
                  onChange={(e) => {
                    const next = e.target.value;
                    setTech(next);
                    // Lamination is Eco Solvent only - drop a stale choice so
                    // it cannot linger hidden when switching back to UV.
                    if (!next.includes("Eco Solvent")) setLam(LAMINATION[0]);
                  }}
                  disabled={PRINT_TECH.length === 1}
                >
                  {PRINT_TECH.map((o) => <option key={o}>{o}</option>)}
                </select>
              </div>
              {/* Lamination is only offered on Eco Solvent prints. */}
              {tech.includes("Eco Solvent") && (
                <div className="xprod-field" data-icon="◐">
                  <label>Lamination</label>
                  <select value={lam} onChange={(e) => setLam(e.target.value)} disabled={LAMINATION.length === 1}>
                    {LAMINATION.map((o) => <option key={o}>{o}</option>)}
                  </select>
                </div>
              )}
            </>
          )}

          {/* Stand-only orders skip the printed panel entirely, so size and
              artwork upload drop out with the print options. */}
          {!standOnly && (
            <>
              <div className="xprod-field" data-icon="⤢">
                <label>Size</label>
                <select value={size} onChange={(e) => setSize(e.target.value)} disabled={SIZE.length === 1}>
                  {SIZE.map((o) => <option key={o}>{o}</option>)}
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
                    name="tripodcollect"
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
              <div className="xprod-sline"><span data-icon="◈">Printing</span><strong>{standOnly ? "—" : tech}</strong></div>
              <div className="xprod-sline"><span data-icon="▤">Material</span><strong>{standOnly ? "Stand only" : "Synthetic Paper 180 Micron"}</strong></div>
              <div className="xprod-sline"><span data-icon="⤢">Size</span><strong>{standOnly ? "—" : `${sizeW} x ${sizeH} in`}</strong></div>
              <div className="xprod-sline"><span data-icon="▦">Total Area</span><strong>{standOnly ? "—" : `${sizeArea.toFixed(2)} sq.ft.`}</strong></div>
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
                  <span>✓ Tripod Stand added to cart — {money(agents[0].price)}</span>
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
