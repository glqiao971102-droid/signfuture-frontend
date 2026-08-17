"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api, type AdminOrderRow, type OrderDetail, type NativeOrderDetail } from "@/lib/api";

const PER_PAGE = 25;

const money = (n: number) =>
  n.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function formatDate(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value.includes("T") ? value : value.replace(" ", "T"));
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-MY", { day: "2-digit", month: "short", year: "numeric" });
}

// Valid collect lead-times (working days). Older orders sometimes stored the
// resolved collect DATE ("collect Wed, 19 Aug 2026") instead of "N working
// days" — we derive the number from the order date → collect date, and snap it
// to one of these so the admin always shows working days.
const COLLECT_DAYS = [1, 2, 3, 4, 7];
function snapWorkingDays(n: number): number {
  return COLLECT_DAYS.reduce((best, v) => (Math.abs(v - n) < Math.abs(best - n) ? v : best), COLLECT_DAYS[0]);
}
// Working days (Mon–Sat; Sundays excluded) strictly after `from`, up to `to`.
function businessDaysBetween(from: Date, to: Date): number {
  const a = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const b = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  let count = 0;
  const d = new Date(a);
  while (d < b) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 0) count += 1;
  }
  return count;
}
/** Working days derived from a "collect <date>" in a value, or null. */
function collectWorkingDays(value: string, orderDate: string | null | undefined): number | null {
  const m = /collect\s+(.+)$/i.exec(value.trim());
  if (!m) return null;
  const od = orderDate ? new Date(orderDate) : null;
  if (!od || Number.isNaN(od.getTime())) return null;
  const cd = new Date(m[1].replace(/^[A-Za-z]{3,},\s*/, "").trim()); // drop leading "Wed, "
  if (Number.isNaN(cd.getTime())) return null;
  return snapWorkingDays(businessDaysBetween(od, cd));
}

// The ONLY valid collect lead-times. Any day-count is normalised to one of
// these, so the admin always shows exactly: 7 / 4 / 3 / 2 / next working days.
function workingDaysLabel(n: number): string {
  if (n <= 1) return "next working days";
  const snapped = [2, 3, 4, 7].reduce((best, v) => (Math.abs(v - n) < Math.abs(best - n) ? v : best), 2);
  return `${snapped} working days`;
}

/** Pulls the collect lead-time out of a line item's spec/options, as one of the
 *  five valid labels (7 / 4 / 3 / 2 / next working days), or "—" if none. */
function workingDaysOf(options: { label: string; value: string }[], orderDate?: string | null): string {
  for (const o of options) {
    const text = `${o.value} ${o.label}`;
    if (/next\s*working\s*days?/i.test(text)) return "next working days";
    const m = /(\d+)\s*working\s*days?/i.exec(text);
    if (m) return workingDaysLabel(parseInt(m[1], 10));
  }
  for (const o of options) {
    const n = collectWorkingDays(o.value, orderDate);
    if (n != null) return workingDaysLabel(n);
  }
  return "—";
}

// Colour the collect lead-time by urgency: 7 white, 4 light-purple, 3 orange,
// 2 yellow, next/1-day red.
function workingDaysColor(wd: string): string | undefined {
  if (/next/i.test(wd)) return "#f87171"; // red
  const n = parseInt(wd, 10);
  return { 7: "#ffffff", 4: "#c4b5fd", 3: "#fb923c", 2: "#fbbf24", 1: "#f87171" }[n];
}

/** Display an option value, rewriting a stored "collect <date>" as working days. */
function displayOptionValue(value: string, orderDate: string | null | undefined): string {
  if (/\d+\s*working\s*days?/i.test(value)) return value;
  const m = /^(.*?)collect\s+.+$/i.exec(value);
  if (!m) return value;
  const n = collectWorkingDays(value, orderDate);
  return n != null ? `${m[1]}collect ${n} working days` : value;
}

// Fallback labels + display order for the per-job status summary shown in the
// orders list (active statuses first, then the "needs attention" ones).
const STATUS_LABEL_FALLBACK: Record<string, string> = {
  waiting: "Waiting Order", on_hold: "On Hold", processing: "Processing", production: "In Production",
  ready: "Available for Collection", collection: "Pickup Already", delivery: "Delivery Arranged",
  delivered: "Delivered", completed: "Completed", cancelled: "Cancelled", refunded: "Refunded", failed: "Failed",
};
const DISPLAY_RANK: Record<string, number> = {
  processing: 0, production: 1, ready: 2, delivery: 3, delivered: 4, collection: 5, completed: 6,
  waiting: 7, pending_confirmation: 7, on_hold: 8, cancelled: 9, refunded: 9, failed: 9,
};
/** Distinct job statuses in a sensible order (deduped — repeats show once). */
function distinctStatuses(statuses: string[]): string[] {
  const out: string[] = [];
  for (const s of statuses) if (!out.includes(s)) out.push(s);
  out.sort((a, b) => (DISPLAY_RANK[a] ?? 5) - (DISPLAY_RANK[b] ?? 5));
  return out;
}

function stageClass(stage: string): string {
  return `adm-chip adm-stage-${stage}`;
}

/** Chip colour for a native/reload status value (see .adm-jstat-* in globals.css). */
function jobStatusClass(status: string): string {
  return `adm-chip adm-jstat-${status}`;
}

export default function AdminOrders() {
  const [rows, setRows] = useState<AdminOrderRow[]>([]);
  const [savingReloadId, setSavingReloadId] = useState<number | null>(null);
  const [statuses, setStatuses] = useState<{ value: string; label: string }[]>([]);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Detail drawer (legacy)
  const [detail, setDetail] = useState<OrderDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);

  // Detail drawer (native)
  const [nativeStatuses, setNativeStatuses] = useState<{ value: string; label: string }[]>([]);
  const [nativeDetail, setNativeDetail] = useState<NativeOrderDetail | null>(null);
  const [savingItemId, setSavingItemId] = useState<number | null>(null);

  const load = useCallback(async (p: number, searchTerm: string, statusFilter: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.adminOrders({
        page: p,
        perPage: PER_PAGE,
        search: searchTerm || undefined,
        status: statusFilter || undefined,
      });
      setRows(res.data);
      setLastPage(res.meta.lastPage);
      setTotal(res.meta.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load orders");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    api.adminOrderStatuses().then((r) => setStatuses(r.data)).catch(() => setStatuses([]));
    api.adminNativeStatuses().then((r) => setNativeStatuses(r.data)).catch(() => setNativeStatuses([]));
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      setPage(1);
      void load(1, search, status);
    }, 300);
    return () => clearTimeout(t);
  }, [search, status, load]);

  useEffect(() => {
    void load(page, search, status);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  function closeDrawer() {
    setDetail(null);
    setNativeDetail(null);
  }

  async function openDetail(row: AdminOrderRow) {
    closeDrawer();
    setDetailLoading(true);
    try {
      if (row.source === "native") {
        setNativeDetail(await api.adminNativeOrder(row.id));
      } else {
        setDetail(await api.adminOrder(row.id));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load order");
    } finally {
      setDetailLoading(false);
    }
  }

  /** Legacy status change — WooCommerce order, with a confirmation. */
  async function changeStatus(newStatus: string) {
    if (!detail) return;
    const label = statuses.find((s) => s.value === newStatus)?.label ?? newStatus;
    if (!window.confirm(`Change order #${detail.id} status to "${label}"?`)) return;
    setSavingStatus(true);
    try {
      await api.adminUpdateOrderStatus(detail.id, newStatus);
      setDetail((d) => (d ? { ...d, status: newStatus } : d));
      await load(page, search, status);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update status");
    } finally {
      setSavingStatus(false);
    }
  }

  /** Native status change — confirms, then emails the customer. */
  // Per-item status: cancelling/refunding a single line refunds only that line.
  async function changeNativeItemStatus(itemId: number, newStatus: string, itemName: string) {
    if (!nativeDetail) return;
    const label = nativeStatuses.find((s) => s.value === newStatus)?.label ?? newStatus;
    const refunds = newStatus === "cancelled" || newStatus === "refunded";
    if (
      !window.confirm(
        `Set "${itemName}" to "${label}"?` +
          (refunds ? "\n\nThis refunds ONLY this item's amount to the customer's wallet and emails them." : "\n\nThe customer will be emailed."),
      )
    )
      return;
    setSavingItemId(itemId);
    try {
      await api.adminUpdateNativeItemStatus(nativeDetail.id, itemId, newStatus);
      setNativeDetail(await api.adminNativeOrder(nativeDetail.id));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Could not update item status");
    } finally {
      setSavingItemId(null);
    }
  }

  // Reload rows: toggle Collected (bookkeeping only — the wallet is untouched).
  async function collectReload(o: AdminOrderRow) {
    if (savingReloadId) return;
    setSavingReloadId(o.id);
    try {
      const next = !o.collected;
      await api.adminSetReloadCollected(o.id, next);
      setRows((rs) =>
        rs.map((x) =>
          x.source === "reload" && x.id === o.id
            ? {
                ...x,
                collected: next,
                status: next ? "collection" : "pending_confirmation",
                statusLabel: next ? "Collected" : "Pending Confirmation",
              }
            : x,
        ),
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : "Could not update the reload");
    } finally {
      setSavingReloadId(null);
    }
  }

  return (
    <div className="adm-wrap">
      <div className="adm-toolbar">
        <input
          className="adm-search"
          type="search"
          placeholder="Search order #, name or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="adm-select"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">All statuses</option>
          {statuses.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      <div className="adm-count">
        {loading ? "Loading…" : `${total.toLocaleString()} order${total === 1 ? "" : "s"}`}
      </div>

      {error && <div className="quote-empty">{error}</div>}

      <div className="adm-table-scroll">
        <table className="adm-table">
          <thead>
            <tr>
              <th>Order</th>
              <th>Customer</th>
              <th>Status</th>
              <th className="adm-num">Total (RM)</th>
              <th className="adm-num">Items</th>
              <th>Date</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading && rows.length === 0 && (
              <tr>
                <td colSpan={7} className="adm-empty">
                  Loading orders…
                </td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={7} className="adm-empty">
                  No orders match.
                </td>
              </tr>
            )}
            {rows.map((o) => (
              <tr key={`${o.source ?? "legacy"}-${o.id}`}>
                <td className="adm-mono">
                  {o.source === "reload" ? `RL-${o.id}` : o.source === "native" ? o.ref : `#${o.id}`}
                  {o.source === "native" && <span className="adm-chip adm-stage-completed adm-new-badge">NEW</span>}
                  {o.source === "reload" && <span className="adm-chip adm-chip-member adm-new-badge">RELOAD</span>}
                </td>
                <td>
                  {o.customerId ? (
                    <Link href={`/admin/users/${o.customerId}`} className="adm-edit-link">
                      {o.customer}
                    </Link>
                  ) : (
                    o.customer
                  )}
                </td>
                <td>
                  {o.source === "native" && o.jobStatuses && o.jobStatuses.length > 0 ? (
                    <span className="adm-jstats">
                      {distinctStatuses(o.jobStatuses).map((v) => (
                        <span key={v} className={jobStatusClass(v)}>
                          {nativeStatuses.find((s) => s.value === v)?.label ?? STATUS_LABEL_FALLBACK[v] ?? v}
                        </span>
                      ))}
                    </span>
                  ) : (
                    <span
                      className={
                        o.source === "reload"
                          ? `adm-chip ${o.collected ? "adm-jstat-completed" : "adm-jstat-pending_confirmation"}`
                          : o.source === "native"
                            ? jobStatusClass(o.status)
                            : stageClass(o.stage)
                      }
                    >
                      {o.statusLabel}
                    </span>
                  )}
                </td>
                <td className="adm-num adm-mono">{money(o.total)}</td>
                <td className="adm-num">{o.source === "reload" ? "—" : o.itemCount}</td>
                <td className="adm-date">{formatDate(o.date)}</td>
                <td>
                  {o.source === "reload" ? (
                    <button
                      type="button"
                      className={`adm-filter${o.collected ? "" : " is-active"}`}
                      disabled={savingReloadId === o.id}
                      onClick={() => collectReload(o)}
                    >
                      {savingReloadId === o.id ? "Saving…" : o.collected ? "Undo" : "✓ Collected"}
                    </button>
                  ) : (
                    <button type="button" className="adm-edit-link" onClick={() => openDetail(o)}>
                      View →
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {lastPage > 1 && (
        <div className="adm-pager">
          <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
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

      {/* Native order drawer */}
      {nativeDetail && (
        <div className="adm-modal-overlay" onClick={closeDrawer}>
          <div className="adm-modal adm-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="adm-card-head-row">
              <h2>
                Order {nativeDetail.ref} <span className="adm-chip adm-stage-completed adm-new-badge">NEW</span>
                {nativeDetail.placedByAgent && <span className="adm-chip adm-stage-cancelled adm-new-badge">代理下单{nativeDetail.agentLabel ? ` · ${nativeDetail.agentLabel}` : ""}</span>}
              </h2>
              <button type="button" className="adm-logout" onClick={closeDrawer}>Close</button>
            </div>
            <div className="adm-drawer-meta">
              <div><span className="adm-key-label">Placed</span>{formatDate(nativeDetail.date)}</div>
              {nativeDetail.minAdjustment > 0 && (
                <div><span className="adm-key-label">Min. charge</span>+RM {money(nativeDetail.minAdjustment)} (below RM15)</div>
              )}
              <div><span className="adm-key-label">Total</span>RM {money(nativeDetail.total)}</div>
              <div><span className="adm-key-label">Payment</span>{nativeDetail.paymentMethod}{nativeDetail.paidAt ? " (paid)" : ""}</div>
              <div><span className="adm-key-label">Delivery</span>{nativeDetail.deliveryMethod ?? "—"}</div>
              <div><span className="adm-key-label">Collect</span>
                {nativeDetail.lines.map((l, i) => {
                  const wd = workingDaysOf(l.options, nativeDetail.date);
                  return (
                    <span key={l.id} style={{ display: "block" }}>
                      {nativeDetail.ref}-{i + 1} (
                      <span style={{ color: workingDaysColor(wd), fontWeight: 700 }}>{wd}</span>)
                    </span>
                  );
                })}
              </div>
              {nativeDetail.customerId ? (
                <div><span className="adm-key-label">Customer</span>
                  <Link href={`/admin/users/${nativeDetail.customerId}`} className="adm-edit-link">{nativeDetail.customer ?? "—"}</Link>
                </div>
              ) : null}
            </div>

            {/* Order-level status removed — each line item now carries its own
                status (see "Line items — each can be handled separately"). */}
            <button
              type="button"
              className="adm-edit-link"
              style={{ background: "none", border: "none", cursor: "pointer", padding: 0, marginBottom: 8 }}
              onClick={() => api.openAdminNativeInvoice(nativeDetail.id).catch((e) => alert(e instanceof Error ? e.message : "Could not open invoice"))}
            >
              ↓ Download invoice PDF
            </button>

            {nativeDetail.artworks && nativeDetail.artworks.length > 0 && (
              <>
                <h3 className="adm-drawer-sub">Artwork ({nativeDetail.artworks.length}) — for review</h3>
                <div className="adm-artwork-list">
                  {nativeDetail.artworks.map((a, i) => (
                    <a key={a.url} href={a.url} target="_blank" rel="noreferrer" className="adm-artwork-chip">
                      ↓ {a.name || `File ${i + 1}`}
                    </a>
                  ))}
                </div>
              </>
            )}

            <h3 className="adm-drawer-sub">Line items — each can be handled separately</h3>
            <div className="adm-lineitems">
              <table className="adm-table">
                <thead><tr><th>Item</th><th className="adm-num">Qty</th><th className="adm-num">Total</th><th>Item status</th></tr></thead>
                <tbody>
                  {nativeDetail.lines.map((l, i) => {
                    const done = l.status === "cancelled" || l.status === "refunded";
                    return (
                    <tr key={l.id}>
                      <td>
                        <strong className="adm-job-no">{nativeDetail.ref}-{i + 1}</strong>{" "}
                        {l.name}
                        {l.options.length > 0 && (
                          <div className="adm-line-opts">
                            {l.options.map((o) => <span key={o.label}>{o.label}: {displayOptionValue(o.value, nativeDetail.date)}</span>)}
                          </div>
                        )}
                        {l.artworkUrl && (
                          <div className="adm-line-opts">
                            <a href={l.artworkUrl} target="_blank" rel="noreferrer" className="adm-edit-link">↓ Artwork</a>
                          </div>
                        )}
                        {l.refundedAt && <div className="adm-line-opts"><span style={{ color: "#9fe6c0" }}>Refunded RM {money(l.total)}</span></div>}
                      </td>
                      <td className="adm-num">{l.quantity}</td>
                      <td className={`adm-num adm-mono${done ? " " : ""}`} style={done ? { textDecoration: "line-through", opacity: 0.6 } : undefined}>{money(l.total)}</td>
                      <td>
                        <select
                          className="adm-select"
                          value={l.status}
                          disabled={savingItemId === l.id}
                          onChange={(e) => changeNativeItemStatus(l.id, e.target.value, l.name)}
                        >
                          {nativeStatuses.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                        </select>
                        {savingItemId === l.id && <em className="adm-card-sub"> Saving…</em>}
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {nativeDetail.notes && (
              <>
                <h3 className="adm-drawer-sub">Notes</h3>
                <p className="adm-drawer-addr">{nativeDetail.notes}</p>
              </>
            )}

            <h3 className="adm-drawer-sub">Status history</h3>
            <div className="adm-line-opts" style={{ flexDirection: "column", gap: 4 }}>
              {nativeDetail.history.map((h, i) => (
                <span key={i}>
                  {formatDate(h.date)} — {h.from ? `${h.from} → ` : ""}{h.to}{h.note ? ` · ${h.note}` : ""}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {(detail || detailLoading) && (
        <div className="adm-modal-overlay" onClick={() => setDetail(null)}>
          <div className="adm-modal adm-drawer" onClick={(e) => e.stopPropagation()}>
            {detailLoading || !detail ? (
              <p>Loading order…</p>
            ) : (
              <>
                <div className="adm-card-head-row">
                  <h2>Order #{detail.id}</h2>
                  <button type="button" className="adm-logout" onClick={() => setDetail(null)}>
                    Close
                  </button>
                </div>
                <div className="adm-drawer-meta">
                  <div>
                    <span className="adm-key-label">Placed</span>
                    {formatDate(detail.date)}
                  </div>
                  <div>
                    <span className="adm-key-label">Total</span>
                    RM {money(detail.total)}
                  </div>
                  <div>
                    <span className="adm-key-label">Payment</span>
                    {detail.paymentMethod ?? "—"}
                  </div>
                  {detail.invoiceNumber && (
                    <div>
                      <span className="adm-key-label">Invoice</span>
                      {detail.invoiceNumber}
                    </div>
                  )}
                </div>

                <label className="adm-modal-field">
                  <span>Status</span>
                  <select
                    className="adm-select"
                    value={detail.status}
                    disabled={savingStatus}
                    onChange={(e) => changeStatus(e.target.value)}
                  >
                    {/* Ensure the current value is selectable even if custom. */}
                    {!statuses.some((s) => s.value === detail.status) && (
                      <option value={detail.status}>{detail.statusLabel}</option>
                    )}
                    {statuses.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                  {savingStatus && <em className="adm-card-sub">Saving…</em>}
                </label>

                <h3 className="adm-drawer-sub">Line items</h3>
                <div className="adm-table-scroll">
                  <table className="adm-table">
                    <thead>
                      <tr>
                        <th>Item</th>
                        <th className="adm-num">Qty</th>
                        <th className="adm-num">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.lines.map((l) => (
                        <tr key={l.id}>
                          <td>
                            {l.name}
                            {l.options.length > 0 && (
                              <div className="adm-line-opts">
                                {l.options.map((o) => (
                                  <span key={o.label}>
                                    {o.label}: {o.value}
                                  </span>
                                ))}
                              </div>
                            )}
                          </td>
                          <td className="adm-num">{l.quantity || "—"}</td>
                          <td className="adm-num adm-mono">{money(l.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="adm-drawer-addr">
                  <div>
                    <h3 className="adm-drawer-sub">Billing</h3>
                    <p>
                      {[detail.billing.first_name, detail.billing.last_name]
                        .filter(Boolean)
                        .join(" ") || "—"}
                      <br />
                      {detail.billing.email}
                      <br />
                      {detail.billing.phone}
                      <br />
                      {[detail.billing.address_1, detail.billing.city, detail.billing.postcode]
                        .filter(Boolean)
                        .join(", ")}
                    </p>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
