"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import { useCart, formatRM } from "@/components/CartProvider";
import { useAuth } from "@/components/AuthProvider";
import { api, ApiError, type MemberVoucher } from "@/lib/api";

const CHECKOUT_KEY = "sign-studio-checkout";

const COLLECT_OPTIONS = [
  "Normal (4 Working Days)",
  "Express (2 Working Days)",
  "Urgent (Next Working Day)",
];

type OrderItem = { label: string; meta?: string; qty: number; price: number; image?: string; href: string };
type Address = {
  profile?: string; receiver?: string; mobile?: string; tel?: string;
  address1?: string; address2?: string; postcode?: string; city?: string; state?: string;
};
type Order = {
  items: OrderItem[];
  subtotal: number;
  coupon: { code: string; discount: number } | null;
  shipping: { id: string; label: string; cost: number };
  address: Address | null;
  total: number;
};

export default function CheckoutPage() {
  const { user, openLogin, refresh } = useAuth();
  const { clear } = useCart();

  const [order, setOrder] = useState<Order | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [placed, setPlaced] = useState<{ ref: string; label: string; paid: number; pending: boolean } | null>(null);

  // Extra order details (mirrors the old system).
  const [collectDate, setCollectDate] = useState(COLLECT_OPTIONS[0]);
  const [notes, setNotes] = useState("");
  const [agree, setAgree] = useState(false);
  const [artworkUrl, setArtworkUrl] = useState<string | null>(null);
  const [artworkName, setArtworkName] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Vouchers
  const [vouchers, setVouchers] = useState<MemberVoucher[]>([]);
  const [voucherCode, setVoucherCode] = useState("");
  const [voucherDiscount, setVoucherDiscount] = useState(0);
  const [voucherMsg, setVoucherMsg] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(CHECKOUT_KEY);
      if (raw) setOrder(JSON.parse(raw));
    } catch {
      /* ignore */
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (user) api.myVouchers().then((r) => setVouchers(r.data)).catch(() => setVouchers([]));
  }, [user]);

  function orderScopeItems() {
    return (order?.items ?? []).map((it) => ({ productName: it.label, lineTotal: it.price * it.qty }));
  }

  async function applyVoucher(code: string) {
    setVoucherMsg(null);
    setVoucherDiscount(0);
    setVoucherCode(code);
    if (!code) return;
    try {
      const r = await api.previewVoucher(code, orderScopeItems());
      if (!r.applicable) {
        setVoucherMsg("This voucher doesn't apply to any item in your cart.");
        return;
      }
      setVoucherDiscount(r.discount);
      setVoucherMsg(`✓ − RM ${r.discount.toFixed(2)} on: ${r.eligibleNames.join(", ")}`);
    } catch (err) {
      setVoucherMsg(err instanceof ApiError ? err.message : "Could not apply voucher.");
      setVoucherCode("");
    }
  }

  const wallet = user?.wallet.balance ?? 0;
  // Member (tier) discount on the items subtotal — the server applies the same.
  const tierPct = user?.tierDiscount ?? 0;
  const memberDiscount = order ? Math.round(order.subtotal * tierPct) / 100 : 0;
  const total = Math.max(0, (order?.total ?? 0) - memberDiscount - voucherDiscount);
  const enough = wallet >= total;

  async function handleArtwork(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const res = await api.uploadArtwork(file);
      setArtworkUrl(res.url);
      setArtworkName(file.name);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Artwork upload failed.");
    } finally {
      setUploading(false);
    }
  }

  async function submit(paymentMethod: "wallet" | "pending") {
    if (!order || !user) return;
    if (!agree) {
      setError("Please agree to the Terms & Conditions.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const items = order.items.map((it, i) => ({
        productName: it.label,
        qty: it.qty,
        unitPrice: it.price,
        options: it.meta ? [{ label: "Specification", value: it.meta }] : [],
        // Attach the uploaded artwork to the first line item.
        artworkUrl: i === 0 && artworkUrl ? artworkUrl : undefined,
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
        notes: notes.trim() || undefined,
        paymentMethod,
        voucherCode: voucherCode || undefined,
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

              {/* Collection + artwork + notes */}
              <div className="checkout-block">
                <h3 className="checkout-block-title">Order details</h3>
                <label className="checkout-field">
                  <span>Collection timeline</span>
                  <select value={collectDate} onChange={(e) => setCollectDate(e.target.value)}>
                    {COLLECT_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                </label>
                <label className="checkout-field">
                  <span>Upload artwork <em>(optional — JPG/PNG/PDF/AI/EPS/ZIP)</em></span>
                  <input ref={fileRef} type="file" accept=".jpg,.jpeg,.png,.webp,.gif,.svg,.pdf,.ai,.eps,.psd,.tif,.tiff,.zip" onChange={handleArtwork} />
                  {uploading && <em className="checkout-hint">Uploading…</em>}
                  {artworkName && !uploading && <em className="checkout-hint ok">✓ {artworkName}</em>}
                </label>
                <label className="checkout-field">
                  <span>Order notes <em>(optional)</em></span>
                  <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any special instructions…" />
                </label>
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
              {memberDiscount > 0 && (
                <div className="cart-sum-row discount"><span>Member <strong>{user?.tier} −{tierPct}%</strong></span><span>− {formatRM(memberDiscount)}</span></div>
              )}
              {voucherDiscount > 0 && (
                <div className="cart-sum-row discount"><span>Voucher <strong>{voucherCode}</strong></span><span>− {formatRM(voucherDiscount)}</span></div>
              )}
              <div className="cart-sum-row total"><span>Total</span><strong>{formatRM(total)}</strong></div>

              {user && (
                <div className="checkout-voucher">
                  <span className="checkout-block-title">Voucher</span>
                  {vouchers.length > 0 && (
                    <select className="adm-select" value={voucherCode} onChange={(e) => applyVoucher(e.target.value)}>
                      <option value="">No voucher</option>
                      {vouchers.map((v) => (
                        <option key={v.code} value={v.code}>
                          {v.code} — {v.discountType === "percent" ? `${v.discountValue}%` : `RM${v.discountValue}`} off {v.scopeType === "all" ? "" : v.scopeValues.join("/")}
                        </option>
                      ))}
                    </select>
                  )}
                  <div className="checkout-voucher-manual">
                    <input type="text" placeholder="Or enter a code" value={voucherCode} onChange={(e) => setVoucherCode(e.target.value.toUpperCase())} />
                    <button type="button" className="cart-dd-btn ghost" onClick={() => applyVoucher(voucherCode)}>Apply</button>
                  </div>
                  {voucherMsg && <p className={`checkout-hint ${voucherMsg.startsWith("✓") ? "ok" : ""}`}>{voucherMsg}</p>}
                </div>
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
                  <p className="checkout-wallet-note low">Not enough to pay by wallet — submit and pay later, or top up.</p>
                )}
              </div>

              <label className="checkout-tnc">
                <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
                <span>I agree to the Terms &amp; Conditions</span>
              </label>

              {error && <p className="login-error" role="alert">{error}</p>}

              {!user ? (
                <button type="button" className="hero-btn primary cart-checkout" onClick={openLogin}>Sign in to continue</button>
              ) : (
                <>
                  {enough && (
                    <button type="button" className="hero-btn primary cart-checkout" disabled={submitting || uploading} onClick={() => submit("wallet")}>
                      {submitting ? "Placing…" : "Place order & pay by wallet"}
                    </button>
                  )}
                  <button type="button" className={`hero-btn cart-checkout ${enough ? "ghost" : "primary"}`} disabled={submitting || uploading} onClick={() => submit("pending")}>
                    {submitting ? "Submitting…" : "Submit order (pay later)"}
                  </button>
                  {!enough && <Link href="/package" className="cart-dd-btn ghost checkout-topup">Top up wallet</Link>}
                </>
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
