"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { useCart } from "@/components/CartProvider";

const PRODUCT_NAME = "Wind Flag (Rectangle)";
const PRODUCT_HREF = "/catalog/wind-flag-rectangle";

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
const SIZE = ["2.2 meter", "3.3 meter", "4.4 meter"];

const COLLECT = [
  { key: "normal", label: "4 Working Days", img: "collect-4-working-days.png", mult: 1 },
  { key: "quick3", label: "3 Working Days", img: "collect-3-working-days.png", mult: 1.45 },
  { key: "rush2", label: "2 Working Days", img: "collect-2-working-days.png", mult: 1.55 },
  { key: "next", label: "Next Working Days", img: "collect-next-working-days.png", mult: 1.65 },
];

type Tier4 = number[];
const PRICE_PWS: Record<string, Record<string, Record<string, Tier4>>> = {
  "2.2 meter": {
    "Mesh Fabric 110gsm": {
      "Single Side Printing": [
        189.68,
        158.07,
        158.07,
        158.07
      ],
      "Double Side Printing": [
        209.88,
        174.9,
        174.9,
        174.9
      ]
    },
    "Mesh Hole Fabric 120gsm": {
      "Single Side Printing": [
        200.57,
        167.15,
        167.15,
        167.15
      ],
      "Double Side Printing": [
        220.77,
        183.98,
        183.98,
        183.98
      ]
    },
    "Flag Fabric 80gsm": {
      "Single Side Printing": [
        182.75,
        152.3,
        152.3,
        152.3
      ],
      "Double Side Printing": [
        202.95,
        169.13,
        169.13,
        169.13
      ]
    },
    "Satin Fabric 110gsm": {
      "Single Side Printing": [
        196.61,
        163.85,
        163.85,
        163.85
      ],
      "Double Side Printing": [
        216.81,
        180.68,
        180.68,
        180.68
      ]
    }
  },
  "3.3 meter": {
    "Mesh Fabric 110gsm": {
      "Single Side Printing": [
        236.61,
        197.18,
        197.18,
        197.18
      ],
      "Double Side Printing": [
        267.3,
        222.75,
        222.75,
        222.75
      ]
    },
    "Mesh Hole Fabric 120gsm": {
      "Single Side Printing": [
        252.45,
        210.38,
        210.38,
        210.38
      ],
      "Double Side Printing": [
        283.14,
        235.95,
        235.95,
        235.95
      ]
    },
    "Flag Fabric 80gsm": {
      "Single Side Printing": [
        225.72,
        188.1,
        188.1,
        188.1
      ],
      "Double Side Printing": [
        256.41,
        213.68,
        213.68,
        213.68
      ]
    },
    "Satin Fabric 110gsm": {
      "Single Side Printing": [
        247.5,
        206.25,
        206.25,
        206.25
      ],
      "Double Side Printing": [
        278.19,
        231.83,
        231.83,
        231.83
      ]
    }
  },
  "4.4 meter": {
    "Mesh Fabric 110gsm": {
      "Single Side Printing": [
        292.05,
        243.38,
        243.38,
        243.38
      ],
      "Double Side Printing": [
        337.59,
        281.33,
        281.33,
        281.33
      ]
    },
    "Mesh Hole Fabric 120gsm": {
      "Single Side Printing": [
        315.81,
        263.18,
        263.18,
        263.18
      ],
      "Double Side Printing": [
        361.35,
        301.13,
        301.13,
        301.13
      ]
    },
    "Flag Fabric 80gsm": {
      "Single Side Printing": [
        277.2,
        231,
        231,
        231
      ],
      "Double Side Printing": [
        322.74,
        268.95,
        268.95,
        268.95
      ]
    },
    "Satin Fabric 110gsm": {
      "Single Side Printing": [
        307.89,
        256.58,
        256.58,
        256.58
      ],
      "Double Side Printing": [
        353.43,
        294.53,
        294.53,
        294.53
      ]
    }
  }
};
const PRICE_PO: Record<string, Record<string, Record<string, Tier4>>> = {
  "2.2 meter": {
    "Mesh Fabric 110gsm": {
      "Single Side Printing": [
        73.85,
        61.55,
        61.55,
        61.55
      ],
      "Double Side Printing": [
        94.05,
        78.38,
        78.38,
        78.38
      ]
    },
    "Mesh Hole Fabric 120gsm": {
      "Single Side Printing": [
        84.74,
        70.62,
        70.62,
        70.62
      ],
      "Double Side Printing": [
        104.94,
        87.45,
        87.45,
        87.45
      ]
    },
    "Flag Fabric 80gsm": {
      "Single Side Printing": [
        66.92,
        55.77,
        55.77,
        55.77
      ],
      "Double Side Printing": [
        87.12,
        72.6,
        72.6,
        72.6
      ]
    },
    "Satin Fabric 110gsm": {
      "Single Side Printing": [
        80.78,
        67.32,
        67.32,
        67.32
      ],
      "Double Side Printing": [
        100.98,
        84.15,
        84.15,
        84.15
      ]
    }
  },
  "3.3 meter": {
    "Mesh Fabric 110gsm": {
      "Single Side Printing": [
        102.96,
        85.8,
        85.8,
        85.8
      ],
      "Double Side Printing": [
        133.65,
        111.38,
        111.38,
        111.38
      ]
    },
    "Mesh Hole Fabric 120gsm": {
      "Single Side Printing": [
        118.8,
        99,
        99,
        99
      ],
      "Double Side Printing": [
        149.49,
        124.58,
        124.58,
        124.58
      ]
    },
    "Flag Fabric 80gsm": {
      "Single Side Printing": [
        92.07,
        76.73,
        76.73,
        76.73
      ],
      "Double Side Printing": [
        122.76,
        102.3,
        102.3,
        102.3
      ]
    },
    "Satin Fabric 110gsm": {
      "Single Side Printing": [
        113.85,
        94.88,
        94.88,
        94.88
      ],
      "Double Side Printing": [
        144.54,
        120.45,
        120.45,
        120.45
      ]
    }
  },
  "4.4 meter": {
    "Mesh Fabric 110gsm": {
      "Single Side Printing": [
        142.56,
        118.8,
        118.8,
        118.8
      ],
      "Double Side Printing": [
        188.1,
        156.75,
        156.75,
        156.75
      ]
    },
    "Mesh Hole Fabric 120gsm": {
      "Single Side Printing": [
        166.32,
        138.6,
        138.6,
        138.6
      ],
      "Double Side Printing": [
        211.86,
        176.55,
        176.55,
        176.55
      ]
    },
    "Flag Fabric 80gsm": {
      "Single Side Printing": [
        127.71,
        106.43,
        106.43,
        106.43
      ],
      "Double Side Printing": [
        173.25,
        144.38,
        144.38,
        144.38
      ]
    },
    "Satin Fabric 110gsm": {
      "Single Side Printing": [
        158.4,
        132,
        132,
        132
      ],
      "Double Side Printing": [
        203.94,
        169.95,
        169.95,
        169.95
      ]
    }
  }
};
const STAND_ONLY: Record<string, Tier4> = {
  "2.2 meter": [
    115.83,
    96.53,
    96.53,
    96.53
  ],
  "3.3 meter": [
    133.65,
    111.38,
    111.38,
    111.38
  ],
  "4.4 meter": [
    149.49,
    124.58,
    124.58,
    124.58
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

export default function WindFlagRectangleProduct() {
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
    add({ label: PRODUCT_NAME, href: PRODUCT_HREF, price: total, image: "/products/wind-flag-rectangle-hero.png" });
    setAdded(true);
  };

  return (
    <div className="xprod">
      {/* ---- hero (single banner-style image) ---- */}
      <section className="xprod-hero">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/products/wind-flag-rectangle-hero.png"
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
