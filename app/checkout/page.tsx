"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import { useCart, formatRM } from "@/components/CartProvider";
import { useAuth } from "@/components/AuthProvider";

const CHECKOUT_KEY = "sign-studio-checkout";

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
  const { user, openLogin, adjustWallet } = useAuth();
  const { clear } = useCart();

  const [order, setOrder] = useState<Order | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [placed, setPlaced] = useState<{ ref: string; paid: number } | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(CHECKOUT_KEY);
      if (raw) setOrder(JSON.parse(raw));
    } catch {
      /* ignore */
    }
    setLoaded(true);
  }, []);

  const wallet = user?.wallet.balance ?? 0;
  const total = order?.total ?? 0;
  const enough = wallet >= total;

  const placeOrder = () => {
    if (!order || !user || !enough) return;
    const ref = "SF" + Date.now().toString(36).toUpperCase().slice(-7);
    adjustWallet(-total);
    clear();
    try {
      localStorage.removeItem(CHECKOUT_KEY);
    } catch {
      /* ignore */
    }
    setPlaced({ ref, paid: total });
  };

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
            <p>Your order <strong>{placed.ref}</strong> has been confirmed and paid from your wallet.</p>
            <div className="checkout-done-row"><span>Paid</span><strong>{formatRM(placed.paid)}</strong></div>
            <div className="checkout-done-row"><span>Wallet balance</span><strong>{formatRM(user?.wallet.balance ?? 0)}</strong></div>
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
              <div className="cart-sum-row total"><span>Total</span><strong>{formatRM(order.total)}</strong></div>

              <div className="checkout-wallet">
                <div className="checkout-wallet-head">
                  <span>Pay with Wallet</span>
                  <strong className={enough ? "" : "low"}>{formatRM(wallet)}</strong>
                </div>
                {!user ? (
                  <p className="checkout-wallet-note">Please sign in to pay with your wallet.</p>
                ) : enough ? (
                  <p className="checkout-wallet-note ok">Balance after payment: {formatRM(wallet - total)}</p>
                ) : (
                  <p className="checkout-wallet-note low">Insufficient balance — top up {formatRM(total - wallet)} more.</p>
                )}
              </div>

              {!user ? (
                <button type="button" className="hero-btn primary cart-checkout" onClick={openLogin}>Sign in to continue</button>
              ) : enough ? (
                <button type="button" className="hero-btn primary cart-checkout" onClick={placeOrder}>Place order</button>
              ) : (
                <Link href="/package" className="hero-btn primary cart-checkout checkout-topup">Top up wallet</Link>
              )}
              <p className="cart-sum-note">By placing this order you agree to our terms. Final quote is confirmed after artwork check.</p>
            </aside>
          </section>
        )}
      </main>
      <Footer />
    </>
  );
}
