"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { useCart } from "@/components/CartProvider";

const PRODUCT_NAME = "Giant Wind Flag";
const PRODUCT_HREF = "/catalog/giant-wind-flag";

// Options from the old Sign Future wind-flag product page.
const FINISHING = ["Printing with Stand", "Printing Only", "Stand Only"];
const PRINT_TECH = ["Sublimation 720Dpi"];
const PRINT_SIDE = ["Single Side Printing", "Double Side Printing"];
const MATERIAL = [
  { label: "Mesh Fabric 110gsm", img: "/products/wind-flag/fabric-mesh.svg" },
  { label: "Mesh Hole Fabric 120gsm", img: "/products/wind-flag/fabric-mesh-hole.svg" },
  { label: "Flag Fabric 80gsm", img: "/products/wind-flag/fabric-flag.svg" },
  { label: "Satin Fabric 110gsm", img: "/products/wind-flag/fabric-satin.svg" },
];
const SIZE = ['43" x 146"'];

const COLLECT = [
  { key: "normal", label: "4 Working Days", img: "collect-4-working-days.png", mult: 1 },
  { key: "quick3", label: "3 Working Days", img: "collect-3-working-days.png", mult: 1.45 },
  { key: "rush2", label: "2 Working Days", img: "collect-2-working-days.png", mult: 1.55 },
  { key: "next", label: "Next Working Days", img: "collect-next-working-days.png", mult: 1.65 },
];

type Tier4 = number[];
const PRICE_PWS: Record<string, Record<string, Record<string, Tier4>>> = {
  "43\" x 146\"": {
    "Mesh Fabric 110gsm": {
      "Single Side Printing": [
        541.53,
        451.28,
        451.28,
        451.28
      ],
      "Double Side Printing": [
        600.93,
        500.78,
        500.78,
        500.78
      ]
    },
    "Mesh Hole Fabric 120gsm": {
      "Single Side Printing": [
        572.22,
        476.85,
        476.85,
        476.85
      ],
      "Double Side Printing": [
        631.62,
        526.35,
        526.35,
        526.35
      ]
    },
    "Flag Fabric 80gsm": {
      "Single Side Printing": [
        520.74,
        433.95,
        433.95,
        433.95
      ],
      "Double Side Printing": [
        580.14,
        483.45,
        483.45,
        483.45
      ]
    },
    "Satin Fabric 110gsm": {
      "Single Side Printing": [
        561.33,
        467.78,
        467.78,
        467.78
      ],
      "Double Side Printing": [
        620.73,
        517.28,
        517.28,
        517.28
      ]
    }
  }
};
const PRICE_PO: Record<string, Record<string, Record<string, Tier4>>> = {
  "43\" x 146\"": {
    "Mesh Fabric 110gsm": {
      "Single Side Printing": [
        197.01,
        164.18,
        164.18,
        164.18
      ],
      "Double Side Printing": [
        256.41,
        213.68,
        213.68,
        213.68
      ]
    },
    "Mesh Hole Fabric 120gsm": {
      "Single Side Printing": [
        227.7,
        189.75,
        189.75,
        189.75
      ],
      "Double Side Printing": [
        287.1,
        239.25,
        239.25,
        239.25
      ]
    },
    "Flag Fabric 80gsm": {
      "Single Side Printing": [
        176.22,
        146.85,
        146.85,
        146.85
      ],
      "Double Side Printing": [
        235.62,
        196.35,
        196.35,
        196.35
      ]
    },
    "Satin Fabric 110gsm": {
      "Single Side Printing": [
        216.81,
        180.68,
        180.68,
        180.68
      ],
      "Double Side Printing": [
        276.21,
        230.18,
        230.18,
        230.18
      ]
    }
  }
};
const STAND_ONLY: Record<string, Tier4> = {
  "43\" x 146\"": [
    344.52,
    287.1,
    287.1,
    287.1
  ]
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

export default function GiantWindFlagProduct() {
  const { user } = useAuth();
  const { add } = useCart();

  const [finishing, setFinishing] = useState(FINISHING[0]);
  const [tech, setTech] = useState(PRINT_TECH[0]);
  const [side, setSide] = useState(PRINT_SIDE[0]);
  const [material, setMaterial] = useState(MATERIAL[0].label);
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
  const [materialOpen, setMaterialOpen] = useState(false);
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

  // Per-tier live pricing from the price sheet: printing by Size + Material +
  // Print Side; Stand Only by Size.
  let tierUnit: number[];
  if (standOnly) {
    tierUnit = STAND_ONLY[size] ?? [0, 0, 0, 0];
  } else {
    const table = finishing === "Printing Only" ? PRICE_PO : PRICE_PWS;
    tierUnit = table[size]?.[material]?.[side] ?? [0, 0, 0, 0];
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
    add({ label: PRODUCT_NAME, href: PRODUCT_HREF, price: total, image: "/products/giant-wind-flag-hero.png", meta: `Finishing: ${finishing}${standOnly ? "" : ` · Printing: ${tech} · Side: ${side} · Material: ${material}`} · Size: ${size} · Qty: ${qty} · ${collectOpt.label}` });
    setAdded(true);
  };

  return (
    <div className="xprod">
      {/* ---- hero (single banner-style image) ---- */}
      <section className="xprod-hero">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/products/giant-wind-flag-hero.png"
          alt={`Custom ${PRODUCT_NAME} — premium quality`}
          className="xprod-hero-img"
        />
      </section>

      {/* ---- options + live quote ---- */}
      <div className="xprod-grid">
        {/* LEFT: options */}
        <section className="xprod-panel">
          <div className="xprod-head"><span className="xprod-head-icon" aria-hidden="true">▤</span><h2 className="xprod-stitle" data-kicker="Options">{PRODUCT_NAME} Order</h2></div>

          <div className="xprod-field" data-icon="✎">
            <label>Finishing</label>
            <select value={finishing} onChange={(e) => setFinishing(e.target.value)} disabled={FINISHING.length === 1}>
              {FINISHING.map((o) => <option key={o}>{o}</option>)}
            </select>
          </div>

          {!standOnly && (
            <>
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

              <div className="xprod-field" data-icon="◑">
                <label>Choose Printing</label>
                <select
                  value={side}
                  onChange={(e) => setSide(e.target.value)}
                  disabled={PRINT_SIDE.length === 1}
                >
                  {PRINT_SIDE.map((o) => <option key={o}>{o}</option>)}
                </select>
              </div>

              <div className="xprod-field" data-icon="▤">
                <label>Choose Material</label>
                <button
                  type="button"
                  className="xprod-picker-trigger"
                  aria-expanded={materialOpen}
                  disabled={MATERIAL.length === 1}
                  onClick={() => setMaterialOpen((o) => !o)}
                >
                  <span>{material}</span>
                  <span className={`xprod-caret${materialOpen ? " up" : ""}`}>▾</span>
                </button>
                {materialOpen && (
                  <div className="xprod-collect-grid xprod-pick-open">
                    {MATERIAL.map((o) => (
                      <label
                        key={o.label}
                        className={`xprod-collect-opt${material === o.label ? " is-selected" : ""}`}
                      >
                        <input
                          type="radio"
                          name="wfmaterial"
                          checked={material === o.label}
                          onChange={() => {
                            setMaterial(o.label);
                            setMaterialOpen(false);
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
            </>
          )}

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
                    name="wfcollect"
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
            <div className="xprod-head"><span className="xprod-head-icon" aria-hidden="true">◈</span><h2 className="xprod-stitle" data-kicker="Live Quote">Product Detail</h2></div>
            <div className="xprod-summary-list">
              <div className="xprod-sline"><span data-icon="◈">Printing</span><strong>{standOnly ? "—" : tech}</strong></div>
              <div className="xprod-sline"><span data-icon="◑">Side</span><strong>{standOnly ? "—" : side}</strong></div>
              <div className="xprod-sline"><span data-icon="▤">Material</span><strong>{standOnly ? "Stand only" : material}</strong></div>
              <div className="xprod-sline"><span data-icon="⤢">Size</span><strong>{size}</strong></div>
              <div className="xprod-sline"><span data-icon="✎">Finishing</span><strong>{finishing}</strong></div>
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

              <button type="button" className="xprod-addcart" disabled={!agreed || !artwork} onClick={addToCart}>
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
        <Link href="/category/fabric-display" className="back-link">
          ← Back to Fabric Display
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
