"use client";

import { useState } from "react";
import Link from "next/link";
import { useCart } from "@/components/CartProvider";

const PRODUCT_NAME = "Paper Foamboard";
const PRODUCT_HREF = "/catalog/paper-foamboard";

// Full-width cinematic banner (like PVC Foamboard).
const HERO_IMAGE = "/products/paper-foamboard-hero.webp";

// Variations from the old Sign Future product page (material – paper foamboard).
// price is RM0.00 on the old site (price on request), kept as 0 here.
const VARIATIONS = [
  {
    label: "5mm Paper Foamboard (1220mm x 2440mm) - (1pack x20pcs)",
    thickness: "5mm",
    sheet: "1220mm x 2440mm",
    pack: "1 pack x 20 pcs",
    price: 0,
  },
];

const money = (v: number) => "RM " + v.toFixed(2);

export default function PaperFoamboardProduct() {
  const { add } = useCart();

  const [variationLabel, setVariationLabel] = useState(VARIATIONS[0].label);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  const variation =
    VARIATIONS.find((v) => v.label === variationLabel) || VARIATIONS[0];
  const lineTotal = variation.price * qty;

  const addToCart = () => {
    for (let i = 0; i < qty; i++) {
      add({
        label: PRODUCT_NAME,
        href: PRODUCT_HREF,
        price: variation.price,
        image: HERO_IMAGE,
        meta: variation.label,
        deliverable: false, // materials are self-collect only
      });
    }
    setAdded(true);
  };

  return (
    <div className="xprod">
      {/* ---- hero: full-width cinematic banner, like PVC Foamboard ---- */}
      <section className="xprod-hero">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={HERO_IMAGE} alt={PRODUCT_NAME} className="xprod-hero-img" />
      </section>

      {/* ---- options + product detail (below), like PVC Foamboard ---- */}
      <div className="xprod-grid">
        {/* LEFT: options */}
        <section className="xprod-panel">
          <h2 className="xprod-stitle" data-kicker="Options">Paper Foamboard Order</h2>

          <div className="xprod-field">
            <label>Choose Material</label>
            <div className="xprod-fixedfield">Paper Foamboard</div>
          </div>

          <div className="xprod-field">
            <label>Choose an Option</label>
            <select
              value={variationLabel}
              onChange={(e) => setVariationLabel(e.target.value)}
            >
              {VARIATIONS.map((v) => (
                <option key={v.label} value={v.label}>
                  {v.label}
                </option>
              ))}
            </select>
          </div>
        </section>

        {/* RIGHT: product detail + order */}
        <div className="xprod-summary-col">
          <aside className="xprod-summary">
            <h2 className="xprod-stitle" data-kicker="Materials · Mounting Boards">
              Product Detail
            </h2>
            <div className="xprod-summary-list">
              <div className="xprod-sline"><span>Material</span><strong>Paper Foamboard</strong></div>
              <div className="xprod-sline"><span>Thickness</span><strong>{variation.thickness}</strong></div>
              <div className="xprod-sline"><span>Sheet Size</span><strong>{variation.sheet}</strong></div>
              <div className="xprod-sline is-wide"><span>Pack</span><strong>{variation.pack}</strong></div>
            </div>
          </aside>

          <aside className="xprod-summary">
            <div
              className="xprod-order"
              style={{ border: 0, background: "transparent", boxShadow: "none", margin: 0, padding: 0 }}
            >
              <h3>Order</h3>

              <div className="xprod-agents">
                <div className="xprod-agent">
                  <span>Price</span>
                  <strong>{money(variation.price)}</strong>
                </div>
                <div className="xprod-agent">
                  <span>Subtotal</span>
                  <strong>{money(lineTotal)}</strong>
                </div>
              </div>

              <div className="xprod-qrow">
                <span>Quantity</span>
                <div className="xprod-stepper">
                  <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))}>−</button>
                  <input
                    type="number"
                    min={1}
                    value={qty}
                    onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
                  />
                  <button type="button" onClick={() => setQty((q) => q + 1)}>+</button>
                </div>
              </div>

              <button type="button" className="xprod-addcart" onClick={addToCart}>
                Add to Cart
              </button>

              {added && (
                <div className="xprod-added">
                  <span>✓ {PRODUCT_NAME} added to cart</span>
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
