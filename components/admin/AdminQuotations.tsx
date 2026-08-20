"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api, type AdminQuotationRow } from "@/lib/api";
import AdminAddQuotation from "@/components/admin/AdminAddQuotation";

const PER_PAGE = 25;

// Month filter options, newest first back to Jan 2024. Value "YYYY-MM".
const MONTH_OPTIONS: { value: string; label: string }[] = (() => {
  const names = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const now = new Date();
  const out: { value: string; label: string }[] = [];
  let y = now.getFullYear();
  let m = now.getMonth();
  while (y > 2024 || (y === 2024 && m >= 0)) {
    out.push({ value: `${y}-${String(m + 1).padStart(2, "0")}`, label: `${names[m]} ${y}` });
    m -= 1;
    if (m < 0) { m = 11; y -= 1; }
  }
  return out;
})();

// Status chips shown with live counts (order = pipeline).
const CHIP_ORDER = ["new", "quoted", "converted", "confirmed", "closed"];

const STATUSES = [
  { value: "", label: "All statuses" },
  { value: "new", label: "New" },
  { value: "quoted", label: "Quoted" },
  { value: "converted", label: "Converted" },
  { value: "closed", label: "Closed" },
];

const STATUS_LABEL: Record<string, string> = {
  new: "New",
  quoted: "Quoted",
  confirmed: "Confirmed",
  converted: "Converted",
  closed: "Closed",
};

// Tier discounts off the Agent price (mirrors the backend).
const TIER_DISCOUNT = { silver: 0.05, gold: 0.06, diamond: 0.08 };
const round2 = (n: number) => Math.round(n * 100) / 100;

type PriceDraft = { agent: string; silver: string; gold: string; diamond: string; workingDays: string };

function fmtDay(v: string | null): string {
  if (!v) return "—";
  const d = new Date(v.includes("T") ? v : v.replace(" ", "T"));
  return Number.isNaN(d.getTime()) ? v : d.toLocaleDateString("en-MY", { day: "2-digit", month: "short", year: "numeric" });
}
function fmtDateTime(v: string | null): string {
  if (!v) return "—";
  const d = new Date(v.includes("T") ? v : v.replace(" ", "T"));
  return Number.isNaN(d.getTime())
    ? v
    : d.toLocaleString("en-MY", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true });
}

// wa.me-friendly Malaysian number.
function waNumber(phone: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("60")) return digits;
  if (digits.startsWith("0")) return `60${digits.slice(1)}`;
  return digits;
}

// Save an uploaded file under its display name (backend honours ?name).
function fileHref(url: string, name: string): string {
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}name=${encodeURIComponent(name || "file")}`;
}

export default function AdminQuotations() {
  const [rows, setRows] = useState<AdminQuotationRow[]>([]);
  const [counts, setCounts] = useState<{ status: string; count: number }[]>([]);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [month, setMonth] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [pricingId, setPricingId] = useState<number | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [drafts, setDrafts] = useState<Record<number, PriceDraft>>({});

  const load = useCallback(async (p: number, statusFilter: string, searchTerm: string, monthFilter: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.adminQuotations({ page: p, perPage: PER_PAGE, status: statusFilter || undefined, search: searchTerm || undefined, month: monthFilter || undefined });
      setRows(res.data);
      setCounts(res.counts ?? []);
      setLastPage(res.meta.lastPage);
      setTotal(res.meta.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load quotations");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => { setPage(1); void load(1, status, search, month); }, 300);
    return () => clearTimeout(t);
  }, [status, search, month, load]);
  useEffect(() => { void load(page, status, search, month); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [page]);

  const reload = () => load(page, status, search, month);
  const countFor = (s: string) => counts.find((c) => c.status === s)?.count ?? 0;
  const totalCount = counts.reduce((a, c) => a + c.count, 0);

  const draftFor = (r: AdminQuotationRow): PriceDraft =>
    drafts[r.id] ?? {
      agent: r.prices?.agent != null ? String(r.prices.agent) : "",
      silver: r.prices?.silver != null ? String(r.prices.silver) : "",
      gold: r.prices?.gold != null ? String(r.prices.gold) : "",
      diamond: r.prices?.diamond != null ? String(r.prices.diamond) : "",
      workingDays: r.workingDays != null ? String(r.workingDays) : "",
    };

  function setAgent(r: AdminQuotationRow, value: string) {
    const base = draftFor(r);
    const n = Number(value);
    const derived =
      value !== "" && !Number.isNaN(n)
        ? {
            silver: String(round2(n * (1 - TIER_DISCOUNT.silver))),
            gold: String(round2(n * (1 - TIER_DISCOUNT.gold))),
            diamond: String(round2(n * (1 - TIER_DISCOUNT.diamond))),
          }
        : { silver: "", gold: "", diamond: "" };
    setDrafts((d) => ({ ...d, [r.id]: { ...base, agent: value, ...derived } }));
  }
  function setField(r: AdminQuotationRow, field: keyof PriceDraft, value: string) {
    const base = draftFor(r);
    setDrafts((d) => ({ ...d, [r.id]: { ...base, [field]: value } }));
  }

  async function sendQuote(r: AdminQuotationRow) {
    const dft = draftFor(r);
    const agent = Number(dft.agent);
    if (!dft.agent || Number.isNaN(agent) || agent <= 0) { alert("Enter the Agent price first."); return; }
    setPricingId(r.id);
    try {
      const res = await api.adminSetQuotationPrices(r.id, {
        agent,
        silver: dft.silver ? Number(dft.silver) : undefined,
        gold: dft.gold ? Number(dft.gold) : undefined,
        diamond: dft.diamond ? Number(dft.diamond) : undefined,
        workingDays: dft.workingDays ? Number(dft.workingDays) : undefined,
      });
      setRows((rs) => rs.map((x) => (x.id === r.id ? { ...x, prices: res.prices, workingDays: res.workingDays, status: res.status } : x)));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Could not save prices");
    } finally {
      setPricingId(null);
    }
  }

  async function changeStatus(id: number, next: string) {
    setSavingId(id);
    try {
      await api.adminUpdateQuotationStatus(id, next);
      setRows((rs) => rs.map((r) => (r.id === id ? { ...r, status: next } : r)));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Could not update status");
    } finally {
      setSavingId(null);
    }
  }

  const selected = selectedId != null ? rows.find((r) => r.id === selectedId) ?? null : null;

  return (
    <div className="adm-wrap">
      <div className="adm-page-head">
        <h1>Quotation Requests</h1>
        <p className="adm-page-sub">Members&apos; RFQs — click View to review the details and files, quote, and convert to an order.</p>
      </div>

      <div className="adm-toolbar">
        <input className="adm-search" type="search" placeholder="Search title, product, customer…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="adm-select" value={month} onChange={(e) => setMonth(e.target.value)} aria-label="Filter by month">
          <option value="">All dates</option>
          {MONTH_OPTIONS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
        <select className="adm-select" value={status} onChange={(e) => setStatus(e.target.value)}>
          {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <button type="button" className="adm-view-btn" onClick={() => setShowAdd(true)}>＋ Add new quotation</button>
      </div>

      {/* Clickable status chips with live counts. */}
      {counts.length > 0 && (
        <div className="adm-status-chips">
          <button type="button" className={`adm-status-chip${status === "" ? " is-active" : ""}`} onClick={() => setStatus("")}>
            All <span className="adm-status-chip-n">{totalCount.toLocaleString()}</span>
          </button>
          {CHIP_ORDER.filter((s) => countFor(s) > 0).map((s) => (
            <button key={s} type="button" className={`adm-status-chip${status === s ? " is-active" : ""}`} onClick={() => setStatus(s)}>
              {STATUS_LABEL[s] ?? s} <span className="adm-status-chip-n">{countFor(s).toLocaleString()}</span>
            </button>
          ))}
        </div>
      )}

      <div className="adm-count">{loading ? "Loading…" : `${total.toLocaleString()} request${total === 1 ? "" : "s"}`}</div>
      {error && <div className="quote-empty">{error}</div>}

      <div className="adm-table-scroll">
        <table className="adm-table">
          <thead>
            <tr>
              <th>Request</th>
              <th>Customer</th>
              <th>Email</th>
              <th>Date</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading && rows.length === 0 && <tr><td colSpan={6} className="adm-empty">Loading…</td></tr>}
            {!loading && rows.length === 0 && <tr><td colSpan={6} className="adm-empty">No quotation requests.</td></tr>}
            {rows.map((q) => (
              <tr key={q.id}>
                <td className="adm-mono">
                  Q-{q.id}
                  {q.orderRef && <span className="adm-chip adm-stage-completed adm-new-badge">{q.orderRef}</span>}
                  <div className="adm-line-opts" style={{ marginTop: 2 }}><span>{q.title}</span></div>
                </td>
                <td>
                  {q.userId ? <Link href={`/admin/users/${q.userId}`} className="adm-edit-link">{q.customer}</Link> : q.customer}
                </td>
                <td className="adm-email">{q.email || "—"}</td>
                <td className="adm-date">{fmtDay(q.createdAt)}</td>
                <td><span className={`adm-chip rfq-status rfq-status-${q.status}`}>{STATUS_LABEL[q.status] ?? q.status}</span></td>
                <td><button type="button" className="adm-view-btn" onClick={() => setSelectedId(q.id)}>View →</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {lastPage > 1 && (
        <div className="adm-pager">
          <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>← Prev</button>
          <span>Page {page} of {lastPage}</span>
          <button type="button" onClick={() => setPage((p) => Math.min(lastPage, p + 1))} disabled={page >= lastPage}>Next →</button>
        </div>
      )}

      {/* Detail drawer */}
      {selected && (() => {
        const q = selected;
        const wa = waNumber(q.phone);
        const size = q.width || q.height ? `${q.width ?? "?"} × ${q.height ?? "?"} ${q.unit ?? ""}` : "—";
        const dft = draftFor(q);
        return (
          <div className="adm-modal-overlay" onClick={() => setSelectedId(null)}>
            <div className="adm-modal adm-drawer" onClick={(e) => e.stopPropagation()}>
              <div className="adm-card-head-row">
                <h2>
                  Q-{q.id} <span className="adm-key-label" style={{ display: "inline" }}>{q.title}</span>{" "}
                  <span className={`adm-chip rfq-status rfq-status-${q.status}`}>{STATUS_LABEL[q.status] ?? q.status}</span>
                  {q.orderRef && <Link href="/admin/orders" className="adm-edit-link" style={{ marginLeft: 10, fontSize: 13 }}>→ Order {q.orderRef}</Link>}
                </h2>
                <button type="button" className="adm-logout" onClick={() => setSelectedId(null)}>Close</button>
              </div>

              <div className="adm-drawer-meta">
                <div><span className="adm-key-label">Placed</span>{fmtDateTime(q.createdAt)}</div>
                <div><span className="adm-key-label">Product</span>{q.category}</div>
                <div><span className="adm-key-label">Quantity</span>{q.quantity}</div>
                <div><span className="adm-key-label">Size</span>{size}</div>
                <div><span className="adm-key-label">Target</span>{q.targetDate ?? "—"}</div>
                <div><span className="adm-key-label">Lead time</span>{q.workingDays != null ? `${q.workingDays} working days` : "—"}</div>
                <div><span className="adm-key-label">Installation</span>{q.installation ? "Yes" : "No"}</div>
                <div><span className="adm-key-label">Customer</span>
                  {q.userId ? <Link href={`/admin/users/${q.userId}`} className="adm-edit-link">{q.customer}</Link> : q.customer}
                </div>
                <div><span className="adm-key-label">Email</span>{q.email ?? "—"}</div>
                <div><span className="adm-key-label">Phone</span>{q.phone ?? "—"}</div>
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
                      <a key={i} href={fileHref(f.url, f.name)} target="_blank" rel="noreferrer" className="adm-artwork-chip">↓ {f.name}</a>
                    ))}
                  </div>
                </>
              )}

              <h3 className="adm-drawer-sub">Pricing</h3>
              <div className="rfq-price-editor" style={{ borderTop: "none", paddingTop: 0, marginTop: 0 }}>
                <span className="adm-key-label">Enter Agent price; Silver −5%, Gold −6%, Diamond −8% auto-fill (editable)</span>
                <div className="rfq-price-grid">
                  <label className="rfq-price-agent">Agent (base)<input type="number" min={0} step="0.01" value={dft.agent} placeholder="0.00" onChange={(e) => setAgent(q, e.target.value)} /></label>
                  <label>Silver<input type="number" min={0} step="0.01" value={dft.silver} placeholder="—" onChange={(e) => setField(q, "silver", e.target.value)} /></label>
                  <label>Gold<input type="number" min={0} step="0.01" value={dft.gold} placeholder="—" onChange={(e) => setField(q, "gold", e.target.value)} /></label>
                  <label>Diamond<input type="number" min={0} step="0.01" value={dft.diamond} placeholder="—" onChange={(e) => setField(q, "diamond", e.target.value)} /></label>
                  <label className="rfq-price-days">Working days<input type="number" min={0} step="1" value={dft.workingDays} placeholder="e.g. 7" onChange={(e) => setField(q, "workingDays", e.target.value)} /></label>
                  <button type="button" className="hero-btn primary rfq-price-send" disabled={pricingId === q.id} onClick={() => sendQuote(q)}>
                    {pricingId === q.id ? "Saving…" : q.prices?.agent != null ? "Update quote" : "Send quote"}
                  </button>
                </div>
                {q.prices?.agent != null && <p className="rfq-price-note">Quoted — the customer sees this table in their account and can confirm the order.</p>}
              </div>

              <h3 className="adm-drawer-sub">Action</h3>
              <div className="rfq-admin-actions" style={{ borderTop: "none", paddingTop: 0, marginTop: 0 }}>
                <label className="rfq-admin-status-pick">
                  <span>Status</span>
                  <select className="adm-select" value={q.status} disabled={savingId === q.id} onChange={(e) => changeStatus(q.id, e.target.value)}>
                    <option value="new">New</option>
                    <option value="quoted">Quoted</option>
                    <option value="converted">Converted to order</option>
                    <option value="closed">Closed</option>
                  </select>
                  {savingId === q.id && <em className="adm-card-sub"> Saving…</em>}
                </label>
                {wa && (
                  <a
                    href={`https://api.whatsapp.com/send?phone=${wa}&text=${encodeURIComponent(`Hi ${q.customer}, regarding your quotation request "${q.title}"`)}`}
                    target="_blank" rel="noreferrer" className="adm-view-btn"
                  >
                    ✆ WhatsApp customer
                  </a>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {showAdd && <AdminAddQuotation onClose={() => setShowAdd(false)} onCreated={reload} />}
    </div>
  );
}
