"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { useCart } from "@/components/CartProvider";

const PRODUCT_NAME = "Straight Backdrop";
const PRODUCT_HREF = "/catalog/straight-backdrop";

// Options from the old Sign Future wind-flag product page.
const FINISHING = ["Printing with Stand", "Printing Only", "Stand Only"];
const PRINT_SIDE = ["1 Side Printing", "2 Side Printing"];
const MATERIAL = "Tension Fabric 260gsm";
// Panel sizes carry their own millimetre dimensions so area - and the price
// multiplier derived from it - stays correct when the list changes.
const SIZE = [
  { label: '8 x 8 (2330mm (H) x 2330mm (W))',   h: 2330, w: 2330 },
  { label: '8 x 10 (2330mm (H) x 3030mm (W))',  h: 2330, w: 3030 },
  { label: '8 x 12 (2330mm (H) x 3630mm (W))',  h: 2330, w: 3630 },
  { label: '8 x 16 (2330mm (H) x 4930mm (W))',  h: 2330, w: 4930 },
  { label: '8 x 20 (2330mm (H) x 6040mm (W))',  h: 2330, w: 6040 },
  { label: '10 x 10 (3030mm (H) x 3030mm (W))', h: 3030, w: 3030 },
  { label: '10 x 12 (3030mm (H) x 3630mm (W))', h: 3030, w: 3630 },
  { label: '10 x 16 (3030mm (H) x 4930mm (W))', h: 3030, w: 4930 },
  { label: '10 x 20 (3030mm (H) x 6030mm (W))', h: 3030, w: 6030 },
];
const MM2_PER_SQFT = 92903.04;
const areaOf = (s: { h: number; w: number }) => (s.h * s.w) / MM2_PER_SQFT;

const COLLECT = [
  { key: "normal", label: "4 Working Days", img: "collect-4-working-days.png", mult: 1 },
  { key: "quick3", label: "3 Working Days", img: "collect-3-working-days.png", mult: 1.45 },
  { key: "rush2", label: "2 Working Days", img: "collect-2-working-days.png", mult: 1.55 },
  { key: "next", label: "Next Working Days", img: "collect-next-working-days.png", mult: 1.65 },
];

type Tier4 = number[];
const PRICE_PWS: Record<string, Record<string, Tier4>> = {
  "8 x 8 (2330mm (H) x 2330mm (W))": {
    "1 Side Printing": [
      1168.7,
      701.25,
      701.25,
      701.25
    ],
    "2 Side Printing": [
      1526.2,
      915.75,
      915.75,
      915.75
    ]
  },
  "8 x 10 (2330mm (H) x 3030mm (W))": {
    "1 Side Printing": [
      1386,
      831.6,
      831.6,
      831.6
    ],
    "2 Side Printing": [
      1826,
      1095.6,
      1095.6,
      1095.6
    ]
  },
  "8 x 12 (2330mm (H) x 3630mm (W))": {
    "1 Side Printing": [
      1636.25,
      981.75,
      981.75,
      981.75
    ],
    "2 Side Printing": [
      2158.75,
      1295.25,
      1295.25,
      1295.25
    ]
  },
  "8 x 16 (2330mm (H) x 4930mm (W))": {
    "1 Side Printing": [
      2112,
      1267.2,
      1267.2,
      1267.2
    ],
    "2 Side Printing": [
      2827,
      1696.2,
      1696.2,
      1696.2
    ]
  },
  "8 x 20 (2330mm (H) x 6040mm (W))": {
    "1 Side Printing": [
      2576.75,
      1546.05,
      1546.05,
      1546.05
    ],
    "2 Side Printing": [
      3456.75,
      2074.05,
      2074.05,
      2074.05
    ]
  },
  "10 x 10 (3030mm (H) x 3030mm (W))": {
    "1 Side Printing": [
      1661,
      996.6,
      996.6,
      996.6
    ],
    "2 Side Printing": [
      2211,
      1326.6,
      1326.6,
      1326.6
    ]
  },
  "10 x 12 (3030mm (H) x 3630mm (W))": {
    "1 Side Printing": [
      1944.25,
      1166.55,
      1166.55,
      1166.55
    ],
    "2 Side Printing": [
      2604.25,
      1562.55,
      1562.55,
      1562.55
    ]
  },
  "10 x 16 (3030mm (H) x 4930mm (W))": {
    "1 Side Printing": [
      2521.75,
      1513.05,
      1513.05,
      1513.05
    ],
    "2 Side Printing": [
      3401.75,
      2041.05,
      2041.05,
      2041.05
    ]
  },
  "10 x 20 (3030mm (H) x 6030mm (W))": {
    "1 Side Printing": [
      3038.75,
      1823.25,
      1823.25,
      1823.25
    ],
    "2 Side Printing": [
      4138.75,
      2483.25,
      2483.25,
      2483.25
    ]
  }
};
const PRICE_PO: Record<string, Record<string, Tier4>> = {
  "8 x 8 (2330mm (H) x 2330mm (W))": {
    "1 Side Printing": [
      748,
      448.8,
      448.8,
      448.8
    ],
    "2 Side Printing": [
      1105.5,
      663.3,
      663.3,
      663.3
    ]
  },
  "8 x 10 (2330mm (H) x 3030mm (W))": {
    "1 Side Printing": [
      926.75,
      556.05,
      556.05,
      556.05
    ],
    "2 Side Printing": [
      1366.75,
      820.05,
      820.05,
      820.05
    ]
  },
  "8 x 12 (2330mm (H) x 3630mm (W))": {
    "1 Side Printing": [
      1091.75,
      655.05,
      655.05,
      655.05
    ],
    "2 Side Printing": [
      1614.25,
      968.55,
      968.55,
      968.55
    ]
  },
  "8 x 16 (2330mm (H) x 4930mm (W))": {
    "1 Side Printing": [
      1421.75,
      853.05,
      853.05,
      853.05
    ],
    "2 Side Printing": [
      2136.75,
      1282.05,
      1282.05,
      1282.05
    ]
  },
  "8 x 20 (2330mm (H) x 6040mm (W))": {
    "1 Side Printing": [
      1765.5,
      1059.3,
      1059.3,
      1059.3
    ],
    "2 Side Printing": [
      2645.5,
      1587.3,
      1587.3,
      1587.3
    ]
  },
  "10 x 10 (3030mm (H) x 3030mm (W))": {
    "1 Side Printing": [
      1119.25,
      671.55,
      671.55,
      671.55
    ],
    "2 Side Printing": [
      1669.25,
      1001.55,
      1001.55,
      1001.55
    ]
  },
  "10 x 12 (3030mm (H) x 3630mm (W))": {
    "1 Side Printing": [
      1325.5,
      795.3,
      795.3,
      795.3
    ],
    "2 Side Printing": [
      1985.5,
      1191.3,
      1191.3,
      1191.3
    ]
  },
  "10 x 16 (3030mm (H) x 4930mm (W))": {
    "1 Side Printing": [
      1738,
      1042.8,
      1042.8,
      1042.8
    ],
    "2 Side Printing": [
      2618,
      1570.8,
      1570.8,
      1570.8
    ]
  },
  "10 x 20 (3030mm (H) x 6030mm (W))": {
    "1 Side Printing": [
      2136.75,
      1282.05,
      1282.05,
      1282.05
    ],
    "2 Side Printing": [
      3236.75,
      1942.05,
      1942.05,
      1942.05
    ]
  }
};
const STAND_ONLY: Record<string, Tier4> = {
  "8 x 8 (2330mm (H) x 2330mm (W))": [
    420.75,
    252.4,
    252.4,
    252.4
  ],
  "8 x 10 (2330mm (H) x 3030mm (W))": [
    459.2,
    275.5,
    275.5,
    275.5
  ],
  "8 x 12 (2330mm (H) x 3630mm (W))": [
    544.5,
    326.7,
    326.7,
    326.7
  ],
  "8 x 16 (2330mm (H) x 4930mm (W))": [
    690.2,
    414.1,
    414.1,
    414.1
  ],
  "8 x 20 (2330mm (H) x 6040mm (W))": [
    811.2,
    486.7,
    486.7,
    486.7
  ],
  "10 x 10 (3030mm (H) x 3030mm (W))": [
    541.7,
    325,
    325,
    325
  ],
  "10 x 12 (3030mm (H) x 3630mm (W))": [
    618.7,
    371.2,
    371.2,
    371.2
  ],
  "10 x 16 (3030mm (H) x 4930mm (W))": [
    783.7,
    470.2,
    470.2,
    470.2
  ],
  "10 x 20 (3030mm (H) x 6030mm (W))": [
    902,
    541.2,
    541.2,
    541.2
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

export default function StraightBackdropProduct() {
  const { user } = useAuth();
  const { add } = useCart();

  const [finishing, setFinishing] = useState(FINISHING[0]);
  const [side, setSide] = useState(PRINT_SIDE[0]);
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
  // Per-tier live pricing from the price sheet: printing by Size + Print Side;
  // Stand Only by Size.
  let tierUnit: number[];
  if (standOnly) {
    tierUnit = STAND_ONLY[size] ?? [0, 0, 0, 0];
  } else {
    const table = finishing === "Printing Only" ? PRICE_PO : PRICE_PWS;
    tierUnit = table[size]?.[side] ?? [0, 0, 0, 0];
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
    add({ label: PRODUCT_NAME, href: PRODUCT_HREF, price: total, image: "/products/straight-backdrop-hero.png", meta: `Material: ${MATERIAL} · Finishing: ${finishing} · Side: ${side} · Size: ${size} · Qty: ${qty} · ${collectOpt.label}` });
    setAdded(true);
  };

  return (
    <div className="xprod">
      {/* ---- hero (single banner-style image) ---- */}
      <section className="xprod-hero">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/products/straight-backdrop-hero.png"
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
                <select disabled value={MATERIAL}>
                  <option>{MATERIAL}</option>
                </select>
              </div>
            </>
          )}

          <div className="xprod-field" data-icon="⤢">
            <label>Size</label>
            <select value={size} onChange={(e) => setSize(e.target.value)} disabled={SIZE.length === 1}>
              {SIZE.map((o) => <option key={o.label}>{o.label}</option>)}
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
              <div className="xprod-sline"><span data-icon="◑">Side</span><strong>{standOnly ? "—" : side}</strong></div>
              <div className="xprod-sline is-wide"><span data-icon="▤">Material</span><strong>{standOnly ? "Stand only" : MATERIAL}</strong></div>
              <div className="xprod-sline is-wide"><span data-icon="⤢">Size</span><strong>{size}</strong></div>
              <div className="xprod-sline"><span data-icon="▦">Total Area</span><strong>{areaOf(sizeOpt).toFixed(2)} sq.ft.</strong></div>
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
