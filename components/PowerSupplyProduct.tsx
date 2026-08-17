"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { useCart } from "@/components/CartProvider";
import { tierIndex } from "@/lib/tier";

const PRODUCT_NAME = "Power Supply";
const PRODUCT_HREF = "/catalog/power-supply";
const HERO_IMAGE = "/products/power-supply-hero.png";

// Power Supply "Type" options + unit price (RM each). Flat price for all tiers.
// A stock component — no artwork, no size, no collect-date lead time.
const TYPES: { label: string; price: number }[] = [
  { label: "12V 200W (Outdoor)", price: 50 },
  { label: "12V 400W (Outdoor)", price: 60 },
];

const money = (v: number) => "RM " + v.toFixed(2);

export default function PowerSupplyProduct() {
  const { user } = useAuth();
  const { add } = useCart();

  const [typeLabel, setTypeLabel] = useState(TYPES[0].label);
  const [qty, setQty] = useState(1);
  const [agreed, setAgreed] = useState(false);
  const [added, setAdded] = useState(false);

  const typeOpt = TYPES.find((t) => t.label === typeLabel) || TYPES[0];
  // Flat price (same for every tier).
  const unit = typeOpt.price * qty;
  const tierTotals = [unit, unit, unit, unit];
  const total = tierTotals[tierIndex(user?.tier)];
  const agents = [
    { name: "Agent Price", price: tierTotals[0] },
    { name: "Silver Agent Price", price: tierTotals[1] },
    { name: "Gold Agent Price", price: tierTotals[2] },
    { name: "Diamond Agent Price", price: tierTotals[3] },
  ];

  const addToCart = () => {
    if (!agreed) return;
    add({
      label: PRODUCT_NAME,
      href: PRODUCT_HREF,
      price: total,
      image: HERO_IMAGE,
      deliverable: true,
      tierPrices: tierTotals,
      meta: `Material: Power Supply · Type: ${typeLabel} · Qty: ${qty}`,
    });
    setAdded(true);
  };

  return (
    <div className="xprod">
      {/* ---- hero (single banner-style image) ---- */}
      <section className="xprod-hero">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={HERO_IMAGE} alt="Power Supply — LED sign transformer" className="xprod-hero-img" />
      </section>

      {/* ---- options + live quote ---- */}
      <div className="xprod-grid">
        {/* LEFT: options */}
        <section className="xprod-panel">
          <div className="xprod-head"><span className="xprod-head-icon" aria-hidden="true">▤</span><h2 className="xprod-stitle" data-kicker="Options">Power Supply Order</h2></div>

          <div className="xprod-field" data-icon="▤">
            <label>Choose Material</label>
            <div className="xprod-fixedfield">Power Supply</div>
          </div>

          <div className="xprod-field" data-icon="⚡">
            <label>Type</label>
            <select value={typeLabel} onChange={(e) => setTypeLabel(e.target.value)}>
              {TYPES.map((t) => (
                <option key={t.label} value={t.label}>{t.label}</option>
              ))}
            </select>
          </div>
        </section>

        {/* RIGHT: two separate frames — Product Detail + Order */}
        <div className="xprod-summary-col">
          <aside className="xprod-summary">
            <div className="xprod-head"><span className="xprod-head-icon" aria-hidden="true">◈</span><h2 className="xprod-stitle" data-kicker="Live Quote">Product Detail</h2></div>
            <div className="xprod-summary-list">
              <div className="xprod-sline"><span data-icon="▤">Material</span><strong>Power Supply</strong></div>
              <div className="xprod-sline is-wide"><span data-icon="⚡">Type</span><strong>{typeLabel}</strong></div>
              <div className="xprod-sline"><span data-icon="▦">Unit Price</span><strong>{money(typeOpt.price)}</strong></div>
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
                  <span>✓ {PRODUCT_NAME} added to cart — {money(total)}</span>
                  <Link href="/cart">View Cart →</Link>
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>

      <div className="xs-back">
        <Link href="/category/materials" className="back-link">
          ← Back to Materials
        </Link>
      </div>
    </div>
  );
}
