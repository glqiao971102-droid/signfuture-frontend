"use client";

import { useEffect, useMemo, useState } from "react";
import { api, type NativeOrderRow } from "@/lib/api";

/**
 * The member's real orders — the NATIVE orders placed through this site's
 * checkout (the ones the customer actually submits). Statuses mirror the
 * backend ORDER_STATUSES.
 */
const STATUS_META: Record<string, { label: string; cls: string; pct: number }> = {
  waiting: { label: "Waiting Order", cls: "rs-pending", pct: 10 },
  processing: { label: "Processing", cls: "rs-progress", pct: 35 },
  production: { label: "In Production", cls: "rs-progress", pct: 55 },
  ready: { label: "Available for Collection", cls: "rs-ready", pct: 80 },
  collection: { label: "Pickup Already", cls: "rs-success", pct: 100 },
  delivery: { label: "Delivery Arranged", cls: "rs-progress", pct: 88 },
  delivered: { label: "Delivered", cls: "rs-success", pct: 100 },
  completed: { label: "Completed", cls: "rs-success", pct: 100 },
  cancelled: { label: "Cancelled", cls: "rs-fail", pct: 0 },
  refunded: { label: "Refunded", cls: "rs-fail", pct: 0 },
  failed: { label: "Failed", cls: "rs-fail", pct: 0 },
};

// Chip order — only statuses that make sense as customer filters.
const STATUS_ORDER = [
  "waiting",
  "processing",
  "production",
  "ready",
  "collection",
  "delivery",
  "delivered",
  "completed",
  "cancelled",
];

const PER_PAGE = 10;

const money = (n: number) =>
  n.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function formatDate(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value.includes("T") ? value : value.replace(" ", "T"));
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-MY", { day: "2-digit", month: "short", year: "numeric" });
}

const meta = (s: string) => STATUS_META[s] ?? { label: s, cls: "rs-pending", pct: 10 };

export default function OrderStatusList() {
  const [orders, setOrders] = useState<NativeOrderRow[]>([]);
  const [status, setStatus] = useState<string | "All">("All");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    api
      .myNativeOrders()
      .then((r) => {
        if (alive) setOrders(r.data);
      })
      .catch((err) => {
        if (alive) setError(err instanceof Error ? err.message : "Could not load your orders");
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  // Which statuses the member actually has — only show those chips (+ All).
  const presentStatuses = useMemo(() => {
    const set = new Set(orders.map((o) => o.status));
    return STATUS_ORDER.filter((s) => set.has(s));
  }, [orders]);

  const filtered = useMemo(
    () => (status === "All" ? orders : orders.filter((o) => o.status === status)),
    [orders, status],
  );

  const lastPage = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const pageRows = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  function changeStatus(s: string | "All") {
    setStatus(s);
    setPage(1);
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
              : `${filtered.length.toLocaleString()} order${filtered.length === 1 ? "" : "s"} · click a status to filter`}
          </span>
        </div>
        <div className="flow-chips">
          <button
            type="button"
            onClick={() => changeStatus("All")}
            className={`flow-chip rs-all${status === "All" ? " is-active" : ""}`}
          >
            All
          </button>
          {presentStatuses.map((s) => (
            <button
              type="button"
              key={s}
              onClick={() => changeStatus(s)}
              className={`flow-chip ${meta(s).cls}${status === s ? " is-active" : ""}`}
            >
              {meta(s).label}
            </button>
          ))}
        </div>
      </section>

      {error && <div className="quote-empty">{error}</div>}
      {loading && !error && <div className="quote-empty">Loading orders…</div>}
      {!loading && !error && filtered.length === 0 && (
        <div className="quote-empty">
          {status === "All" ? "You have no orders yet." : "No orders with this status."}
        </div>
      )}

      {!loading && !error && pageRows.length > 0 && (
        <>
          <div className="rec-list">
            {pageRows.map((o) => {
              const m = meta(o.status);
              const cancelled = o.status === "cancelled" || o.status === "refunded" || o.status === "failed";
              return (
                <article key={o.id} className="rec-card">
                  <div className="rec-main">
                    <div className="rec-top">
                      <strong className="rec-ref">{o.ref || `#${o.id}`}</strong>
                      <span className={`rec-status ${m.cls}`}>{o.statusLabel || m.label}</span>
                    </div>
                    <span className="rec-date">{formatDate(o.date)}</span>
                    <p className="rec-desc">
                      {o.items.length} item{o.items.length === 1 ? "" : "s"}
                    </p>

                    {cancelled ? (
                      <p className="rec-need" style={{ color: "#ff6f8b" }}>
                        This order was {(o.statusLabel || m.label).toLowerCase()}.
                      </p>
                    ) : (
                      <div className="rec-progress">
                        <div
                          className={`rec-progress-fill${m.pct === 100 ? " full" : ""}`}
                          style={{ width: `${m.pct}%` }}
                        />
                      </div>
                    )}

                    {openId === o.id && (
                      <div className="order-lines">
                        {o.items.map((l, k) => (
                          <div key={k} className="order-line">
                            <span className="order-line-name">
                              {l.name}
                              {l.status && l.status !== o.status && (
                                <span className={`rec-status ${meta(l.status).cls}`} style={{ marginLeft: 8, fontSize: 11 }}>
                                  {l.statusLabel || meta(l.status).label}
                                </span>
                              )}
                              {l.artworkUrl && (
                                <>
                                  {" "}
                                  <a href={l.artworkUrl} target="_blank" rel="noreferrer" className="adm-edit-link">↓ Artwork</a>
                                </>
                              )}
                            </span>
                            <span className="order-line-qty">×{l.qty}</span>
                            <span className="order-line-total">RM {money(l.total)}</span>
                          </div>
                        ))}
                      </div>
                    )}
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
              <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
                ← Prev
              </button>
              <span>Page {page} of {lastPage}</span>
              <button type="button" onClick={() => setPage((p) => Math.min(lastPage, p + 1))} disabled={page >= lastPage}>
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </>
  );
}
