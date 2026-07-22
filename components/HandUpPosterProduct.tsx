"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { useCart } from "@/components/CartProvider";

// Sold as a bare stand only - there is no printed panel, so the whole print
// side of the form (material, printing, size, artwork, collect date) is gone.
const FINISHING = ["Stand Only"];

const BASE: Record<string, number> = {
  "Stand Only": 55,
};

const REMARK_MAX = 200;

const money = (v: number) => "RM " + v.toFixed(2);

export default function HandUpPosterProduct() {
  const { user } = useAuth();
  const { add } = useCart();

  const [finishing, setFinishing] = useState(FINISHING[0]);
  const [remark, setRemark] = useState("");
  const [qty, setQty] = useState(1);
  const [agreed, setAgreed] = useState(false);
  const [added, setAdded] = useState(false);

  const unit = BASE[finishing];
  const total = unit * qty;
  const agents = [
    { name: "Normal Agent Price", price: total },
    { name: "Gold Agent Price", price: total * 0.85 },
    { name: "Platinum Agent Price", price: total * 0.8 },
  ];

  const addToCart = () => {
    if (!agreed) return;
    add({ label: "Hand Up Poster", href: "/catalog/hand-up-poster", price: total, image: "/products/hand-up-poster-hero.png" });
    setAdded(true);
  };

  return (
    <div className="xprod">
      {/* ---- hero (single banner-style image) ---- */}
      <section className="xprod-hero">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/products/hand-up-poster-hero.png"
          alt="Custom Hand Up Poster — premium quality"
          className="xprod-hero-img"
        />
      </section>

      {/* ---- options + live quote ---- */}
      <div className="xprod-grid">
        {/* LEFT: options */}
        <section className="xprod-panel">
          <div className="xprod-head">
            <span className="xprod-head-icon" aria-hidden="true">▤</span>
            <h2 className="xprod-stitle" data-kicker="Options">Hand Up Poster Order</h2>
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

          <label className="xprod-field">
            <span className="xprod-remark-label">
              Remark <span className="xprod-optional">(Optional)</span>
            </span>
            <div className="xprod-textarea-wrap">
              <textarea
                maxLength={REMARK_MAX}
                value={remark}
                /* maxLength only guards typing, so clamp here too - the count
                   must never be able to read past the limit. */
                onChange={(e) => setRemark(e.target.value.slice(0, REMARK_MAX))}
                placeholder="Delivery notes, preferred stand colour, collection details..."
              />
              <span className="xprod-charcount">{remark.length} / {REMARK_MAX}</span>
            </div>
          </label>
        </section>

        {/* RIGHT: two separate frames — Product Detail + Order */}
        <div className="xprod-summary-col">
          <aside className="xprod-summary">
            <div className="xprod-head">
              <span className="xprod-head-icon" aria-hidden="true">◈</span>
              <h2 className="xprod-stitle" data-kicker="Live Quote">Product Detail</h2>
            </div>
            <div className="xprod-summary-list">
              <div className="xprod-sline is-wide"><span data-icon="✎">Finishing</span><strong>{finishing}</strong></div>
              <div className="xprod-sline is-wide"><span data-icon="✍">Remark</span><strong>{remark.trim() || "—"}</strong></div>
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
                  <span>✓ Hand Up Poster added to cart — {money(agents[0].price)}</span>
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
    </div>
  );
}
