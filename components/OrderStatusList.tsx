"use client";

import { useCallback, useEffect, useState } from "react";
import { api, type OrderStage, type OrderSummary, type OrderDetail } from "@/lib/api";

/**
 * The member's real orders, from the legacy WooCommerce data.
 *
 * Stages mirror the backend's mapping of WooCommerce statuses (including the
 * operator's custom ones such as `wc-custom-compick`) onto the handful of steps
 * worth showing a customer.
 */
const STAGE_META: Record<OrderStage, { label: string; cls: string; pct: number }> = {
  pending: { label: "Waiting Payment", cls: "rs-pending", pct: 10 },
  processing: { label: "Processing", cls: "rs-progress", pct: 35 },
  production: { label: "In Production", cls: "rs-progress", pct: 55 },
  ready: { label: "Ready for Collection", cls: "rs-ready", pct: 78 },
  shipped: { label: "Out for Delivery", cls: "rs-progress", pct: 90 },
  completed: { label: "Completed", cls: "rs-success", pct: 100 },
  cancelled: { label: "Cancelled", cls: "rs-fail", pct: 0 },
};

const STAGE_ORDER: OrderStage[] = [
  "pending",
  "processing",
  "production",
  "ready",
  "shipped",
  "completed",
  "cancelled",
];

const PER_PAGE = 10;

const money = (n: number) =>
  n.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function formatDate(value: string): string {
  const d = new Date(value.includes("T") ? value : value.replace(" ", "T"));
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-MY", { day: "2-digit", month: "short", year: "numeric" });
}

export default function OrderStatusList() {
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [stage, setStage] = useState<OrderStage | "All">("All");
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);

  const load = useCallback(async (p: number, s: OrderStage | "All") => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.orders(p, PER_PAGE, s === "All" ? undefined : s);
      setOrders(res.data);
      setLastPage(res.meta.lastPage);
      setTotal(res.meta.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load your orders");
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(page, stage);
  }, [page, stage, load]);

  function changeStage(s: OrderStage | "All") {
    setStage(s);
    setPage(1); // a filtered list has different pages; never keep the old index
    setOpenId(null);
  }

  return (
    <>
      <section className="acct-card order-flow">
        <div className="acct-card-head">
          <h2>Order Statuses</h2>
          <span>
            {loading
              ? "Loading your orders…"
              : `${total.toLocaleString()} order${total === 1 ? "" : "s"} · click a status to filter`}
          </span>
        </div>
        <div className="flow-chips">
          <button
            type="button"
            onClick={() => changeStage("All")}
            className={`flow-chip rs-all${stage === "All" ? " is-active" : ""}`}
          >
            All
          </button>
          {STAGE_ORDER.map((s) => (
            <button
              type="button"
              key={s}
              onClick={() => changeStage(s)}
              className={`flow-chip ${STAGE_META[s].cls}${stage === s ? " is-active" : ""}`}
            >
              {STAGE_META[s].label}
            </button>
          ))}
        </div>
      </section>

      {error && <div className="quote-empty">{error}</div>}
      {loading && !error && <div className="quote-empty">Loading orders…</div>}
      {!loading && !error && orders.length === 0 && (
        <div className="quote-empty">
          {stage === "All" ? "You have no orders yet." : "No orders with this status."}
        </div>
      )}

      {!loading && !error && orders.length > 0 && (
        <>
          <div className="rec-list">
            {orders.map((o) => {
              const meta = STAGE_META[o.stage];
              const cancelled = o.stage === "cancelled";
              return (
                <article key={o.id} className="rec-card">
                  <div className="rec-main">
                    <div className="rec-top">
                      <strong className="rec-ref">#{o.id}</strong>
                      <span className={`rec-status ${meta.cls}`}>{o.statusLabel}</span>
                    </div>
                    <span className="rec-date">{formatDate(o.date)}</span>
                    <p className="rec-desc">
                      {o.itemCount} item{o.itemCount === 1 ? "" : "s"}
                      {o.shippingMethod ? ` · ${o.shippingMethod}` : ""}
                      {o.invoiceNumber ? ` · Invoice ${o.invoiceNumber}` : ""}
                    </p>

                    {cancelled ? (
                      <p className="rec-need" style={{ color: "#ff6f8b" }}>
                        This order was {o.statusLabel.toLowerCase()}.
                      </p>
                    ) : (
                      <div className="rec-progress">
                        <div
                          className={`rec-progress-fill${meta.pct === 100 ? " full" : ""}`}
                          style={{ width: `${meta.pct}%` }}
                        />
                      </div>
                    )}

                    {openId === o.id && <OrderLines orderId={o.id} />}
                  </div>
                  <div className="rec-side">
                    <span className="rec-amount">RM {money(o.total)}</span>
                    <button
                      type="button"
                      className="hero-btn ghost rec-btn"
                      onClick={() => setOpenId(openId === o.id ? null : o.id)}
                    >
                      {openId === o.id ? "Hide" : "Details"}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>

          {lastPage > 1 && (
            <div className="wallet-tx-pager">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                ← Prev
              </button>
              <span>
                Page {page} of {lastPage}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(lastPage, p + 1))}
                disabled={page >= lastPage}
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </>
  );
}

/** Line items for one order, fetched on demand when the row is expanded. */
function OrderLines({ orderId }: { orderId: number }) {
  const [detail, setDetail] = useState<OrderDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const d = await api.order(orderId);
        if (!cancelled) setDetail(d);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load details");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  if (error) return <p className="order-lines-msg">{error}</p>;
  if (!detail) return <p className="order-lines-msg">Loading details…</p>;

  // Shipping and fee rows are shown apart from the purchased products.
  const products = detail.lines.filter((l) => l.type === "line_item");
  const extras = detail.lines.filter((l) => l.type !== "line_item" && l.name);

  return (
    <div className="order-lines">
      {products.map((l) => (
        <div key={l.id} className="order-line">
          <span className="order-line-name">{l.name}</span>
          <span className="order-line-qty">×{l.quantity}</span>
          <span className="order-line-total">RM {money(l.total)}</span>
        </div>
      ))}

      {extras.map((l) => (
        <div key={l.id} className="order-line is-extra">
          <span className="order-line-name">{l.name}</span>
          <span className="order-line-qty" />
          <span className="order-line-total">{l.total ? `RM ${money(l.total)}` : "—"}</span>
        </div>
      ))}

      {detail.shipping.address_1 && (
        <p className="order-ship-to">
          <strong>Ship to:</strong> {detail.shipping.address_1}
          {detail.shipping.city ? `, ${detail.shipping.city}` : ""}
          {detail.shipping.postcode ? ` ${detail.shipping.postcode}` : ""}
        </p>
      )}
      {detail.paymentMethod && (
        <p className="order-ship-to">
          <strong>Paid by:</strong> {detail.paymentMethod}
        </p>
      )}
    </div>
  );
}
