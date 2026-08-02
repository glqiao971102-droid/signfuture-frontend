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

function stageClass(stage: string): string {
  return `adm-chip adm-stage-${stage}`;
}

export default function AdminOrders() {
  const [rows, setRows] = useState<AdminOrderRow[]>([]);
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
  async function changeNativeStatus(newStatus: string) {
    if (!nativeDetail) return;
    const label = nativeStatuses.find((s) => s.value === newStatus)?.label ?? newStatus;
    if (!window.confirm(`Change order ${nativeDetail.ref} to "${label}"?\n\nThe customer will be emailed this update.`)) return;
    const note = window.prompt("Optional note to include in the email (leave blank to skip):") ?? undefined;
    setSavingStatus(true);
    try {
      const r = await api.adminUpdateNativeStatus(nativeDetail.id, newStatus, note || undefined);
      setNativeDetail((d) => (d ? { ...d, status: r.status, statusLabel: r.statusLabel } : d));
      await load(page, search, status);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update status");
    } finally {
      setSavingStatus(false);
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
                  {o.source === "native" ? o.ref : `#${o.id}`}
                  {o.source === "native" && <span className="adm-chip adm-stage-completed adm-new-badge">NEW</span>}
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
                  <span className={o.source === "native" ? "adm-chip adm-chip-member" : stageClass(o.stage)}>
                    {o.statusLabel}
                  </span>
                </td>
                <td className="adm-num adm-mono">{money(o.total)}</td>
                <td className="adm-num">{o.itemCount}</td>
                <td className="adm-date">{formatDate(o.date)}</td>
                <td>
                  <button type="button" className="adm-edit-link" onClick={() => openDetail(o)}>
                    View →
                  </button>
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
              <div><span className="adm-key-label">Total</span>RM {money(nativeDetail.total)}</div>
              <div><span className="adm-key-label">Payment</span>{nativeDetail.paymentMethod}{nativeDetail.paidAt ? " (paid)" : ""}</div>
              <div><span className="adm-key-label">Delivery</span>{nativeDetail.deliveryMethod ?? "—"}</div>
              <div><span className="adm-key-label">Collect</span>{nativeDetail.collectDate ?? "—"}</div>
              {nativeDetail.customerId ? (
                <div><span className="adm-key-label">Customer</span>
                  <Link href={`/admin/users/${nativeDetail.customerId}`} className="adm-edit-link">{nativeDetail.customer ?? "—"}</Link>
                </div>
              ) : null}
            </div>

            <label className="adm-modal-field">
              <span>Status (customer is emailed on change)</span>
              <select className="adm-select" value={nativeDetail.status} disabled={savingStatus}
                onChange={(e) => changeNativeStatus(e.target.value)}>
                {nativeStatuses.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
              {savingStatus && <em className="adm-card-sub">Saving…</em>}
            </label>

            <h3 className="adm-drawer-sub">Line items</h3>
            <div className="adm-table-scroll">
              <table className="adm-table">
                <thead><tr><th>Item</th><th className="adm-num">Qty</th><th className="adm-num">Total</th></tr></thead>
                <tbody>
                  {nativeDetail.lines.map((l) => (
                    <tr key={l.id}>
                      <td>
                        {l.name}
                        {l.options.length > 0 && (
                          <div className="adm-line-opts">
                            {l.options.map((o) => <span key={o.label}>{o.label}: {o.value}</span>)}
                          </div>
                        )}
                        {l.artworkUrl && (
                          <div className="adm-line-opts">
                            <a href={l.artworkUrl} target="_blank" rel="noreferrer" className="adm-edit-link">↓ Artwork</a>
                          </div>
                        )}
                      </td>
                      <td className="adm-num">{l.quantity}</td>
                      <td className="adm-num adm-mono">{money(l.total)}</td>
                    </tr>
                  ))}
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
