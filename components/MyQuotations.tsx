"use client";

import { useEffect, useState } from "react";
import { api, ApiError, type QuotationRow } from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";

const money = (n: number) => `RM ${n.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function fmtDate(v: string | null | undefined): string {
  if (!v) return "";
  const d = new Date(v.includes("T") ? v : v.replace(" ", "T"));
  return Number.isNaN(d.getTime())
    ? v
    : d.toLocaleDateString("en-MY", { day: "2-digit", month: "short", year: "numeric" });
}

/** Whole days from now until `v` (negative if past). */
function daysLeft(v: string | null | undefined): number | null {
  if (!v) return null;
  const d = new Date(v.includes("T") ? v : v.replace(" ", "T"));
  if (Number.isNaN(d.getTime())) return null;
  return Math.ceil((d.getTime() - Date.now()) / 86400000);
}

function statusInfo(q: QuotationRow): { label: string; cls: string } {
  if (q.expired) return { label: "Expired", cls: "rs-fail" };
  if (q.status === "converted" || q.status === "confirmed") return { label: "Order placed", cls: "rs-success" };
  if (q.status === "quoted") return { label: "Quoted", cls: "rs-ready" };
  if (q.status === "new") return { label: "Submitted", cls: "rs-pending" };
  return { label: q.status, cls: "rs-pending" };
}

export default function MyQuotations() {
  const { user, refresh } = useAuth();
  const [rows, setRows] = useState<QuotationRow[] | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirmingId, setConfirmingId] = useState<number | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const load = () => {
    api.myQuotations().then((r) => setRows(r.data)).catch(() => setRows([]));
  };
  useEffect(load, []);

  const myTierKey = user?.tier ? user.tier.toLowerCase() : "agent";
  function tierPrice(q: QuotationRow): number | null {
    const p = q.prices;
    if (!p) return null;
    if (user?.tier === "Diamond") return p.diamond;
    if (user?.tier === "Gold") return p.gold;
    if (user?.tier === "Silver") return p.silver;
    return p.agent;
  }

  async function placeOrder(q: QuotationRow, mode: "confirm" | "repeat") {
    const price = tierPrice(q);
    const priceStr = price != null ? money(price) : "the quoted price";
    const verb = mode === "repeat" ? "Repeat this order" : "Place this order";
    if (!window.confirm(`${verb} at ${priceStr}? This will be paid from your wallet.`)) return;
    setConfirmingId(q.id);
    setMsg(null);
    try {
      const res = mode === "repeat" ? await api.reorderQuotation(q.id) : await api.confirmQuotation(q.id);
      await refresh();
      load();
      setSelectedId(null);
      setMsg({ ok: true, text: `Order placed${res.orderRef ? ` — ${res.orderRef}` : ""}! It's now Waiting Order. Track it under Order Status.` });
    } catch (err) {
      if (err instanceof ApiError && err.code === "INSUFFICIENT_WALLET") {
        if (window.confirm(`Your wallet balance isn't enough for ${priceStr}. Top up now?`)) {
          window.location.href = "/package";
        }
      } else {
        setMsg({ ok: false, text: err instanceof ApiError ? err.message : "Could not place the order." });
      }
    } finally {
      setConfirmingId(null);
    }
  }

  const selected = selectedId != null && rows ? rows.find((r) => r.id === selectedId) ?? null : null;

  return (
    <section className="acct-card acct-section-card">
      <div className="acct-card-head">
        <h2>My Quotation</h2>
        <span>Your quotation requests — click View to see the quote and confirm your order.</span>
      </div>

      {msg && <p className="edit-detail-msg" style={{ color: msg.ok ? "#34d399" : "#f87171" }}>{msg.text}</p>}

      {rows === null ? (
        <p className="acct-card-sub" style={{ padding: "8px 0" }}>Loading…</p>
      ) : rows.length === 0 ? (
        <p className="acct-card-sub" style={{ padding: "8px 0" }}>No quotations yet. Submit one from “Request Quotation”.</p>
      ) : (
        <div className="rec-list">
          {rows.map((q) => {
            const si = statusInfo(q);
            const price = tierPrice(q);
            return (
              <article key={q.id} className="rec-card">
                <div className="rec-main">
                  <div className="rec-top">
                    <strong className="rec-ref">{q.title}</strong>
                    <span className={`rec-status ${si.cls}`}>{si.label}</span>
                  </div>
                  <span className="rec-date">{fmtDate(q.createdAt)}</span>
                  <p className="rec-desc">
                    {q.category} · Qty {q.quantity}
                    {q.width || q.height ? ` · ${q.width ?? "?"} × ${q.height ?? "?"} ${q.unit ?? ""}` : ""}
                  </p>
                </div>
                <div className="rec-side">
                  {q.prices?.agent != null && price != null && <span className="rec-amount">{money(price)}</span>}
                  <button type="button" className="hero-btn primary rec-btn" onClick={() => setSelectedId(q.id)}>View →</button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Detail modal */}
      {selected && (() => {
        const q = selected;
        const si = statusInfo(q);
        return (
          <div className="adm-modal-overlay" onClick={() => setSelectedId(null)}>
            <div className="adm-modal adm-drawer" onClick={(e) => e.stopPropagation()}>
              <div className="adm-card-head-row">
                <h2>{q.title} <span className={`rec-status ${si.cls}`}>{si.label}</span></h2>
                <button type="button" className="adm-logout" onClick={() => setSelectedId(null)}>Close</button>
              </div>

              <div className="adm-drawer-meta">
                <div><span className="adm-key-label">Submitted</span>{fmtDate(q.createdAt)}</div>
                <div><span className="adm-key-label">Product</span>{q.category}</div>
                <div><span className="adm-key-label">Quantity</span>{q.quantity}</div>
                <div><span className="adm-key-label">Size</span>{q.width || q.height ? `${q.width ?? "?"} × ${q.height ?? "?"} ${q.unit ?? ""}` : "—"}</div>
                {q.workingDays != null && <div><span className="adm-key-label">Completion</span>{q.workingDays} working days</div>}
                <div><span className="adm-key-label">Installation</span>{q.installation ? "Yes" : "No"}</div>
                {q.orderRef && <div><span className="adm-key-label">Order</span>{q.orderRef}</div>}
              </div>

              {q.remark && (
                <>
                  <h3 className="adm-drawer-sub">Process notes</h3>
                  <p className="adm-drawer-addr">{q.remark}</p>
                </>
              )}
              {q.files.length > 0 && (
                <>
                  <h3 className="adm-drawer-sub">Files</h3>
                  <div className="adm-artwork-list">
                    {q.files.map((f, i) => (
                      <a key={i} href={f.url} target="_blank" rel="noreferrer" className="adm-artwork-chip">↓ {f.name}</a>
                    ))}
                  </div>
                </>
              )}

              {/* Quote + confirm */}
              {q.prices?.agent != null && (
                <div className="rfq-quote">
                  <h3 className="adm-drawer-sub">Quote</h3>
                  <div className="rfq-quote-table">
                    {([
                      ["agent", "Agent", q.prices.agent],
                      ["silver", "Silver", q.prices.silver],
                      ["gold", "Gold", q.prices.gold],
                      ["diamond", "Diamond", q.prices.diamond],
                    ] as const).map(([key, label, val]) => (
                      <div key={key} className={`rfq-quote-cell${myTierKey === key ? " is-mine" : ""}`}>
                        <span className="rfq-quote-tier">{label}{myTierKey === key ? " · you" : ""}</span>
                        <span className="rfq-quote-price">{val != null ? money(val) : "—"}</span>
                      </div>
                    ))}
                  </div>

                  {q.status === "quoted" && q.expired ? (
                    <p className="rfq-quote-expired">⚠ This quote has expired. Please submit a new request under “Request Quotation”.</p>
                  ) : q.status === "quoted" ? (
                    <>
                      <p className="rfq-quote-valid">
                        This price is valid until <strong>{fmtDate(q.expiresAt)}</strong>
                        {daysLeft(q.expiresAt) != null ? ` · ${Math.max(0, daysLeft(q.expiresAt)!)} day${daysLeft(q.expiresAt) === 1 ? "" : "s"} left` : ""}.
                        After 30 days it closes automatically and you'll need to request a new quotation.
                      </p>
                      <div className="rfq-quote-actions">
                        <span className="rfq-quote-your">
                          Your price: <strong>{tierPrice(q) != null ? money(tierPrice(q)!) : "—"}</strong>
                          {user?.tier ? ` (${user.tier} member)` : " (Agent price)"}
                        </span>
                        <button type="button" className="hero-btn primary rfq-confirm-btn" disabled={confirmingId === q.id} onClick={() => placeOrder(q, "confirm")}>
                          {confirmingId === q.id ? "Confirming…" : "Confirm order"}
                        </button>
                      </div>
                    </>
                  ) : q.status === "converted" || q.status === "confirmed" ? (
                    <div className="rfq-quote-actions">
                      <span className="rfq-quote-confirmed">✓ Order placed{q.orderRef ? ` — ${q.orderRef}` : ""} · Waiting Order.</span>
                      <button type="button" className="rfq-repeat-btn" disabled={confirmingId === q.id} onClick={() => placeOrder(q, "repeat")}>
                        {confirmingId === q.id ? "Placing…" : "↻ Request Repeat Order"}
                      </button>
                    </div>
                  ) : null}
                </div>
              )}
              {q.prices?.agent == null && (
                <p className="acct-card-sub" style={{ marginTop: 12 }}>Waiting for your consultant to quote a price.</p>
              )}
            </div>
          </div>
        );
      })()}
    </section>
  );
}
