"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { useCart } from "@/components/CartProvider";
import { api } from "@/lib/api";

const PRODUCT_NAME = "Wind Flag (Water Base)";
const PRODUCT_HREF = "/catalog/wind-flag-water-base";

// Options from the old Sign Future wind-flag product page.
const FINISHING = ["Printing with Stand", "Printing Only", "Stand Only"];
const PRINT_TECH = ["Sublimation 720Dpi"];
const PRINT_SIDE = ["Single Side Printing", "Double Side Printing"];
const SEWING = [
  { label: "Bow", img: "/products/wind-flag/sewing-bow.svg" },
  { label: "Teardrop", img: "/products/wind-flag/sewing-teardrop.svg" },
];
const MATERIAL = [
  { label: "Mesh Fabric 110gsm", img: "/products/wind-flag/fabric-mesh.svg" },
  { label: "Mesh Hole Fabric 120gsm", img: "/products/wind-flag/fabric-mesh-hole.svg" },
  { label: "Flag Fabric 80gsm", img: "/products/wind-flag/fabric-flag.svg" },
  { label: "Satin Fabric 110gsm", img: "/products/wind-flag/fabric-satin.svg" },
];
const SIZE = ["3.4 meter", "5 meter"];

const COLLECT = [
  { key: "normal", label: "4 Working Days", img: "collect-4-working-days.png", mult: 1 },
  { key: "quick3", label: "3 Working Days", img: "collect-3-working-days.png", mult: 1.45 },
  { key: "rush2", label: "2 Working Days", img: "collect-2-working-days.png", mult: 1.55 },
  { key: "next", label: "Next Working Days", img: "collect-next-working-days.png", mult: 1.65 },
];

type Tier4 = number[];
const PRICE_PWS: Record<string, Record<string, Record<string, Tier4>>> = {
  "3.4 meter": {
    "Mesh Fabric 110gsm": {
      "Single Side Printing": [
        191.66,
        159.72,
        159.72,
        159.72
      ],
      "Double Side Printing": [
        213.84,
        178.2,
        178.2,
        178.2
      ]
    },
    "Mesh Hole Fabric 120gsm": {
      "Single Side Printing": [
        203.54,
        169.62,
        169.62,
        169.62
      ],
      "Double Side Printing": [
        225.72,
        188.1,
        188.1,
        188.1
      ]
    },
    "Flag Fabric 80gsm": {
      "Single Side Printing": [
        183.74,
        153.12,
        153.12,
        153.12
      ],
      "Double Side Printing": [
        205.92,
        171.6,
        171.6,
        171.6
      ]
    },
    "Satin Fabric 110gsm": {
      "Single Side Printing": [
        199.58,
        166.32,
        166.32,
        166.32
      ],
      "Double Side Printing": [
        221.76,
        184.8,
        184.8,
        184.8
      ]
    }
  },
  "5 meter": {
    "Mesh Fabric 110gsm": {
      "Single Side Printing": [
        279.18,
        232.65,
        232.65,
        232.65
      ],
      "Double Side Printing": [
        329.67,
        274.73,
        274.73,
        274.73
      ]
    },
    "Mesh Hole Fabric 120gsm": {
      "Single Side Printing": [
        304.92,
        254.1,
        254.1,
        254.1
      ],
      "Double Side Printing": [
        355.41,
        296.18,
        296.18,
        296.18
      ]
    },
    "Flag Fabric 80gsm": {
      "Single Side Printing": [
        261.36,
        217.8,
        217.8,
        217.8
      ],
      "Double Side Printing": [
        311.85,
        259.88,
        259.88,
        259.88
      ]
    },
    "Satin Fabric 110gsm": {
      "Single Side Printing": [
        297,
        247.5,
        247.5,
        247.5
      ],
      "Double Side Printing": [
        347.49,
        289.58,
        289.58,
        289.58
      ]
    }
  }
};
const PRICE_PO: Record<string, Record<string, Record<string, Tier4>>> = {
  "3.4 meter": {
    "Mesh Fabric 110gsm": {
      "Single Side Printing": [
        81.77,
        68.15,
        68.15,
        68.15
      ],
      "Double Side Printing": [
        103.95,
        86.63,
        86.63,
        86.63
      ]
    },
    "Mesh Hole Fabric 120gsm": {
      "Single Side Printing": [
        93.65,
        78.05,
        78.05,
        78.05
      ],
      "Double Side Printing": [
        115.83,
        96.53,
        96.53,
        96.53
      ]
    },
    "Flag Fabric 80gsm": {
      "Single Side Printing": [
        73.85,
        61.55,
        61.55,
        61.55
      ],
      "Double Side Printing": [
        96.03,
        80.03,
        80.03,
        80.03
      ]
    },
    "Satin Fabric 110gsm": {
      "Single Side Printing": [
        89.69,
        74.75,
        74.75,
        74.75
      ],
      "Double Side Printing": [
        111.87,
        93.23,
        93.23,
        93.23
      ]
    }
  },
  "5 meter": {
    "Mesh Fabric 110gsm": {
      "Single Side Printing": [
        151.47,
        126.23,
        126.23,
        126.23
      ],
      "Double Side Printing": [
        201.96,
        168.3,
        168.3,
        168.3
      ]
    },
    "Mesh Hole Fabric 120gsm": {
      "Single Side Printing": [
        177.21,
        147.68,
        147.68,
        147.68
      ],
      "Double Side Printing": [
        227.7,
        189.75,
        189.75,
        189.75
      ]
    },
    "Flag Fabric 80gsm": {
      "Single Side Printing": [
        133.65,
        111.38,
        111.38,
        111.38
      ],
      "Double Side Printing": [
        184.14,
        153.45,
        153.45,
        153.45
      ]
    },
    "Satin Fabric 110gsm": {
      "Single Side Printing": [
        169.29,
        141.08,
        141.08,
        141.08
      ],
      "Double Side Printing": [
        219.78,
        183.15,
        183.15,
        183.15
      ]
    }
  }
};
const STAND_ONLY: Record<string, Tier4> = {
  "3.4 meter": [
    109.89,
    91.58,
    91.58,
    91.58
  ],
  "5 meter": [
    127.71,
    106.43,
    106.43,
    106.43
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

export default function WindFlagWaterBaseProduct() {
  const { user } = useAuth();
  const { add } = useCart();

  const [finishing, setFinishing] = useState(FINISHING[0]);
  const [tech, setTech] = useState(PRINT_TECH[0]);
  const [side, setSide] = useState(PRINT_SIDE[0]);
  const [sewing, setSewing] = useState(SEWING[0].label);
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
  const [sewingOpen, setSewingOpen] = useState(false);
  const [materialOpen, setMaterialOpen] = useState(false);
  const [qty, setQty] = useState(1);
  const [agreed, setAgreed] = useState(false);
  const [artwork, setArtwork] = useState("");
  const [artworkFile, setArtworkFile] = useState<File | null>(null);
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

  const addToCart = async () => {
    if (!agreed) return;
    let artworks: { url: string; name: string }[] | undefined;
    if (artworkFile) {
      try {
        const __up = await api.uploadArtwork(artworkFile);
        artworks = [{ url: __up.url, name: artworkFile.name }];
      } catch { /* keep going; artwork can be re-attached later */ }
    }
    add({ artworks, label: PRODUCT_NAME, href: PRODUCT_HREF, price: total, image: "/products/wind-flag-water-base-hero.png", meta: `Finishing: ${finishing} · Printing: ${tech} · Side: ${side} · Material: ${material} · Sewing Type: ${sewing} · Size: ${size} · Qty: ${qty} · ${collectOpt.label}` });
    setAdded(true);
  };

  return (
    <div className="xprod">
      {/* ---- hero (single banner-style image) ---- */}
      <section className="xprod-hero">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/products/wind-flag-water-base-hero.png"
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

              <div className="xprod-field" data-icon="✎">
                <label>Sewing Type</label>
                <button
                  type="button"
                  className="xprod-picker-trigger"
                  aria-expanded={sewingOpen}
                  disabled={SEWING.length === 1}
                  onClick={() => setSewingOpen((o) => !o)}
                >
                  <span>{sewing}</span>
                  <span className={`xprod-caret${sewingOpen ? " up" : ""}`}>▾</span>
                </button>
                {sewingOpen && (
                  <div className="xprod-collect-grid cols2 xprod-pick-open">
                    {SEWING.map((o) => (
                      <label
                        key={o.label}
                        className={`xprod-collect-opt${sewing === o.label ? " is-selected" : ""}`}
                      >
                        <input
                          type="radio"
                          name="wfsewing"
                          checked={sewing === o.label}
                          onChange={() => {
                            setSewing(o.label);
                            setSewingOpen(false);
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
              onChange={(e) => { const f = e.target.files?.[0] ?? null; setArtworkFile(f); setArtwork(f?.name ?? ""); }}
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
              <div className="xprod-sline"><span data-icon="✎">Sewing Type</span><strong>{standOnly ? "—" : sewing}</strong></div>
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
