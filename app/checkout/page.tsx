"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import { useCart, formatRM } from "@/components/CartProvider";
import { useAuth } from "@/components/AuthProvider";
import { api, ApiError } from "@/lib/api";
import { tierIndex } from "@/lib/tier";

const CHECKOUT_KEY = "sign-studio-checkout";

const COLLECT_OPTIONS = [
  "Normal (4 Working Days)",
  "Express (2 Working Days)",
  "Urgent (Next Working Day)",
];

// Turn a product's readable spec summary into structured option rows so the
// admin order view lists every submitted field (Material, Size, Qty, …). The
// summary is a "·"- or newline-separated list of "Label: Value" pairs; any
// piece without a colon is kept whole as a "Specification" row.
function metaToOptions(meta?: string): { label: string; value: string }[] {
  if (!meta || !meta.trim()) return [];
  return meta
    .split(/·|\n|;/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((piece) => {
      const idx = piece.indexOf(":");
      if (idx === -1) return { label: "Specification", value: piece };
      const label = piece.slice(0, idx).trim();
      const value = piece.slice(idx + 1).trim();
      return label && value ? { label, value } : { label: "Specification", value: piece };
    });
}

type Artwork = { url: string; name: string };
type OrderItem = { label: string; meta?: string; qty: number; price: number; image?: string; href: string; spec?: Record<string, unknown>; artworks?: Artwork[]; requiresConfirmation?: boolean };
type Address = {
  profile?: string; receiver?: string; mobile?: string; tel?: string;
  address1?: string; address2?: string; postcode?: string; city?: string; state?: string;
};
type Order = {
  items: OrderItem[];
  subtotal: number;
  coupon: { code: string; discount: number } | null;
  voucher?: { code: string; discount: number } | null;
  shipping: { id: string; label: string; cost: number };
  address: Address | null;
  total: number;
  tier?: number;
};

export default function CheckoutPage() {
  const { user, openLogin, refresh } = useAuth();
  const { clear } = useCart();

  const [order, setOrder] = useState<Order | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [placed, setPlaced] = useState<{ ref: string; label: string; paid: number; pending: boolean } | null>(null);

  const [collectDate] = useState(COLLECT_OPTIONS[0]);
  const [agree, setAgree] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Voucher + artwork are chosen on the cart page; checkout only shows them.
  const voucherCode = order?.voucher?.code ?? "";
  const voucherDiscount = order?.voucher?.discount ?? 0;
  const artworks = (order?.items ?? []).flatMap((it) => it.artworks ?? []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(CHECKOUT_KEY);
      if (raw) setOrder(JSON.parse(raw));
    } catch {
      /* ignore */
    }
    setLoaded(true);
    // Pull the member's CURRENT tier so checkout always prices at their live
    // tier — not a stale value cached when the cart was built.
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const MIN_ORDER = 15; // RM — minimum spend per order
  const wallet = user?.wallet.balance ?? 0;
  // order.total already nets the voucher chosen on the cart page.
  const rawTotal = Math.max(0, order?.total ?? 0);
  const belowMin = rawTotal > 0 && rawTotal < MIN_ORDER;
  const minAdjustment = belowMin ? Math.round((MIN_ORDER - rawTotal) * 100) / 100 : 0;
  const total = belowMin ? MIN_ORDER : rawTotal;
  const enough = wallet >= total;

  // One-time popup letting the customer know their order was topped up to the
  // RM15 minimum. Re-shows if they change the cart back below the minimum.
  const [minNoticeOpen, setMinNoticeOpen] = useState(false);
  const [minNoticeDismissed, setMinNoticeDismissed] = useState(false);
  useEffect(() => {
    if (belowMin && !minNoticeDismissed) setMinNoticeOpen(true);
    if (!belowMin) { setMinNoticeOpen(false); setMinNoticeDismissed(false); }
  }, [belowMin, minNoticeDismissed]);

  async function submit(paymentMethod: "wallet" | "pending") {
    if (!order || !user) return;
    if (!agree) {
      setError("Please agree to the Terms & Conditions.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const items = order.items.map((it) => ({
        productName: it.label,
        qty: it.qty,
        unitPrice: it.price,
        // Break the readable spec summary ("Material: X · Size: Y · Qty: Z")
        // into one option row per field so admins see every submitted detail.
        options: metaToOptions(it.meta),
        // Structured spec → server recomputes the authoritative price.
        spec: it.spec as Record<string, unknown> | undefined,
        // This line's own artwork (first one attached to the line for back-compat).
        artworkUrl: it.artworks && it.artworks[0] ? it.artworks[0].url : undefined,
        // All files on this line (e.g. 3D wording + Draft Paper) — the admin
        // shows each under the line item for download.
        artworks: it.artworks && it.artworks.length ? it.artworks : undefined,
        // Express-date / special requests start as Pending Confirmation.
        requiresConfirmation: it.requiresConfirmation || undefined,
      }));
      const a = order.address;
      const res = await api.createOrder({
        items,
        billing: a
          ? {
              name: a.receiver || a.profile || "",
              phone: a.mobile || a.tel || "",
              address_1: a.address1 || "",
              address_2: a.address2 || "",
              city: a.city || "",
              state: a.state || "",
              postcode: a.postcode || "",
            }
          : undefined,
        customerName: a?.receiver || a?.profile || user.name,
        customerPhone: a?.mobile || a?.tel || user.phone || undefined,
        deliveryMethod: order.shipping.label || "Self Pickup",
        collectDate,
        paymentMethod,
        voucherCode: voucherCode || undefined,
        // Always the member's LIVE tier (server also clamps to what they
        // actually qualify for), so the price follows their current tier.
        tier: tierIndex(user.tier),
        // Order-level artwork = every line's files, so staff can review them all.
        artworks: artworks.length ? artworks : undefined,
      });
      // Real balance changed on the server when paid by wallet.
      if (paymentMethod === "wallet") void refresh();
      clear();
      try { localStorage.removeItem(CHECKOUT_KEY); } catch { /* ignore */ }
      setPlaced({ ref: res.ref, label: res.statusLabel, paid: paymentMethod === "wallet" ? total : 0, pending: paymentMethod === "pending" });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not place the order. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Nav />

      {/* Minimum-spend notice popup */}
      {minNoticeOpen && !placed && (
        <div className="adm-modal-overlay" onClick={() => { setMinNoticeOpen(false); setMinNoticeDismissed(true); }}>
          <div className="checkout-min-modal" onClick={(e) => e.stopPropagation()}>
            <span className="checkout-min-glyph">🧾</span>
            <h2>Minimum spend RM{MIN_ORDER.toFixed(2)}</h2>
            <p>
              Your order total is <strong>{formatRM(rawTotal)}</strong>, which is below our
              minimum spend of <strong>RM{MIN_ORDER.toFixed(2)}</strong> per order.
            </p>
            <p>We&apos;ll adjust your total up to <strong>RM{MIN_ORDER.toFixed(2)}</strong> (+{formatRM(minAdjustment)}) so you can continue.</p>
            <button type="button" className="hero-btn primary" onClick={() => { setMinNoticeOpen(false); setMinNoticeDismissed(true); }}>
              Got it
            </button>
          </div>
        </div>
      )}

      <main className="home-main">
        <section className="cart-head">
          <div>
            <h1>Checkout</h1>
            {!placed && order && <p>Review and confirm your order</p>}
          </div>
          {!placed && <Link href="/cart" className="cart-continue">← Back to cart</Link>}
        </section>

        {placed ? (
          <section className="checkout-done">
            <span className="checkout-done-icon">✓</span>
            <h2>Order placed!</h2>
            <p>Your order <strong>{placed.ref}</strong> has been received — status <strong>{placed.label}</strong>.</p>
            {placed.pending ? (
              <p className="checkout-wallet-note">Payment pending — we&apos;ll confirm your order shortly.</p>
            ) : (
              <div className="checkout-done-row"><span>Paid from wallet</span><strong>{formatRM(placed.paid)}</strong></div>
            )}
            <div className="checkout-done-actions">
              <Link href="/order-status" className="hero-btn primary">Track order</Link>
              <Link href="/#categories" className="cart-dd-btn ghost">Continue shopping</Link>
            </div>
          </section>
        ) : !loaded ? null : !order || order.items.length === 0 ? (
          <section className="cart-empty">
            <span className="cart-empty-glyph">🧾</span>
            <p>No order to check out.</p>
            <Link href="/cart" className="hero-btn primary">Go to cart</Link>
          </section>
        ) : (
          <section className="cart-layout">
            <div className="checkout-review">
              {/* Items */}
              <div className="checkout-block">
                <h3 className="checkout-block-title">Order summary ({order.items.length} item{order.items.length === 1 ? "" : "s"})</h3>
                {order.items.map((it, i) => (
                  <div key={i} className="checkout-item">
                    <span className="cart-prod-thumb">
                      {it.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={it.image} alt={it.label} />
                      ) : (
                        <span className="cart-prod-glyph">◆</span>
                      )}
                    </span>
                    <div className="checkout-item-info">
                      <span className="checkout-item-title">{it.label}</span>
                      {it.meta && <span className="checkout-item-meta">{it.meta}</span>}
                      <span className="checkout-item-qty">Qty {it.qty} × {formatRM(it.price)}</span>
                      {it.artworks && it.artworks.length > 0 ? (
                        <span className="checkout-item-art">
                          🎨 {it.artworks.map((a, k) => (
                            <a key={a.url} href={a.url} target="_blank" rel="noreferrer">{a.name}{k < it.artworks!.length - 1 ? ", " : ""}</a>
                          ))}
                        </span>
                      ) : (
                        <span className="checkout-item-art none">No artwork attached — add it on the cart page.</span>
                      )}
                    </div>
                    <strong className="checkout-item-line">{formatRM(it.price * it.qty)}</strong>
                  </div>
                ))}
              </div>

              {/* Delivery */}
              <div className="checkout-block">
                <h3 className="checkout-block-title">Delivery</h3>
                <div className="checkout-ship">
                  <span className="checkout-ship-method">{order.shipping.label || "Self Collect"}</span>
                  <span className="checkout-ship-cost">{order.shipping.cost === 0 ? "Free" : formatRM(order.shipping.cost)}</span>
                </div>
                {order.address ? (
                  <div className="checkout-addr">
                    <p className="cart-addr-name">{order.address.receiver || order.address.profile}</p>
                    {order.address.mobile && <p>{order.address.mobile}{order.address.tel ? " / " + order.address.tel : ""}</p>}
                    <p>{[order.address.address1, order.address.address2].filter(Boolean).join(", ")}</p>
                    <p>{[order.address.postcode, order.address.city].filter(Boolean).join(" ")}{order.address.state ? ", " + order.address.state : ""}</p>
                  </div>
                ) : (
                  <p className="checkout-pickup-note">Pick up at our outlet — no delivery address needed.</p>
                )}
              </div>

            </div>

            {/* Payment */}
            <aside className="cart-summary checkout-pay">
              <h2>Payment</h2>
              <div className="cart-sum-row"><span>Subtotal</span><span>{formatRM(order.subtotal)}</span></div>
              {order.coupon && (
                <div className="cart-sum-row discount">
                  <span>Coupon <strong>{order.coupon.code}</strong></span>
                  <span>− {formatRM(order.coupon.discount)}</span>
                </div>
              )}
              <div className="cart-sum-row"><span>Shipping</span><span>{order.shipping.cost === 0 ? "Free" : formatRM(order.shipping.cost)}</span></div>
              {voucherDiscount > 0 && (
                <div className="cart-sum-row discount"><span>Voucher <strong>{voucherCode}</strong></span><span>− {formatRM(voucherDiscount)}</span></div>
              )}
              {minAdjustment > 0 && (
                <div className="cart-sum-row"><span>Minimum charge <em>(below RM{MIN_ORDER})</em></span><span>+ {formatRM(minAdjustment)}</span></div>
              )}
              <div className="cart-sum-row total"><span>Total</span><strong>{formatRM(total)}</strong></div>
              {minAdjustment > 0 && (
                <p className="checkout-hint">Minimum spend is RM{MIN_ORDER.toFixed(2)} per order — your total has been adjusted up to the minimum.</p>
              )}

              <div className="checkout-wallet">
                <div className="checkout-wallet-head">
                  <span>Wallet balance</span>
                  <strong className={enough ? "" : "low"}>{formatRM(wallet)}</strong>
                </div>
                {!user ? (
                  <p className="checkout-wallet-note">Please sign in to place your order.</p>
                ) : enough ? (
                  <p className="checkout-wallet-note ok">Balance after wallet payment: {formatRM(wallet - total)}</p>
                ) : (
                  <p className="checkout-wallet-note low">Not enough to pay by wallet — please top up to place your order.</p>
                )}
              </div>

              <label className="checkout-tnc">
                <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
                <span>I agree to the Terms &amp; Conditions</span>
              </label>

              {error && <p className="login-error" role="alert">{error}</p>}

              {!user ? (
                <button type="button" className="hero-btn primary cart-checkout" onClick={openLogin}>Sign in to continue</button>
              ) : enough ? (
                <button type="button" className="hero-btn primary cart-checkout" disabled={submitting} onClick={() => submit("wallet")}>
                  {submitting ? "Placing…" : "Submit order"}
                </button>
              ) : (
                <Link href="/package" className="hero-btn primary cart-checkout checkout-topup">Top up wallet</Link>
              )}
              <p className="cart-sum-note">Final quote is confirmed after our team checks your artwork.</p>
            </aside>
          </section>
        )}
      </main>
      <Footer />
    </>
  );
}
