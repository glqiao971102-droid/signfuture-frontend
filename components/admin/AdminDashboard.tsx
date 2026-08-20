"use client";

import { useEffect, useState } from "react";
import { api, type AdminStats } from "@/lib/api";

const rm = (n: number) =>
  `RM ${n.toLocaleString("en-MY", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
const rm2 = (n: number) =>
  `RM ${n.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function monthLabel(ym: string) {
  const [y, m] = ym.split("-");
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("en-MY", { month: "short" });
}

function formatDate(value: string) {
  const d = new Date(value.includes("T") ? value : value.replace(" ", "T"));
  return Number.isNaN(d.getTime())
    ? value
    : d.toLocaleDateString("en-MY", { day: "2-digit", month: "short", year: "numeric" });
}

/** Human label for a raw WooCommerce status. */
function statusLabel(s: string) {
  return s
    .replace(/^wc-(custom-)?/, "")
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Quick-pick presets for the date range, computed against today. */
function presetRange(days: number): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - days);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { from: iso(from), to: iso(to) };
}

const isoDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** The current calendar month: 1st → today (local date, no UTC shift). */
function thisMonthRange(): { from: string; to: string } {
  const now = new Date();
  return { from: isoDate(new Date(now.getFullYear(), now.getMonth(), 1)), to: isoDate(now) };
}

/** The current calendar year: Jan 1 → today (local date, no UTC shift). */
function thisYearRange(): { from: string; to: string } {
  const now = new Date();
  return { from: isoDate(new Date(now.getFullYear(), 0, 1)), to: isoDate(now) };
}

type RangeMode = "month" | "year" | "custom";

export default function AdminDashboard() {
  const [data, setData] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Default every visit to the CURRENT MONTH's report; "This year" switches to
  // the year-to-date view, and editing the dates is a custom range.
  const [mode, setMode] = useState<RangeMode>("month");
  const [from, setFrom] = useState<string>(() => thisMonthRange().from);
  const [to, setTo] = useState<string>(() => thisMonthRange().to);
  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const d = await api.adminStatsRanged({
          from: from || undefined,
          to: to || undefined,
        });
        if (!cancelled) setData(d);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load stats");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [from, to]);

  async function download(kind: "orders" | "sales" | "products") {
    setDownloading(kind);
    try {
      await api.adminDownloadReport(kind);
    } catch {
      /* ignore — the button just won't produce a file */
    } finally {
      setDownloading(null);
    }
  }

  const rangeLabel =
    mode === "month" ? "this month" : mode === "year" ? "this year" : `${from || "start"} → ${to || "today"}`;

  const toolbar = (
    <div className="dash-toolbar">
      <div className="dash-range">
        <label>
          From
          <input type="date" value={from} max={to || undefined} onChange={(e) => { setMode("custom"); setFrom(e.target.value); }} />
        </label>
        <label>
          To
          <input type="date" value={to} min={from || undefined} onChange={(e) => { setMode("custom"); setTo(e.target.value); }} />
        </label>
        <button type="button" className={`adm-filter${mode === "month" ? " is-active" : ""}`} onClick={() => { const r = thisMonthRange(); setMode("month"); setFrom(r.from); setTo(r.to); }}>
          This month
        </button>
        <button type="button" className={`adm-filter${mode === "year" ? " is-active" : ""}`} onClick={() => { const r = thisYearRange(); setMode("year"); setFrom(r.from); setTo(r.to); }}>
          This year
        </button>
        <button type="button" className="adm-filter" onClick={() => { setMode("custom"); const r = presetRange(30); setFrom(r.from); setTo(r.to); }}>
          30d
        </button>
        <button type="button" className="adm-filter" onClick={() => { setMode("custom"); const r = presetRange(90); setFrom(r.from); setTo(r.to); }}>
          90d
        </button>
      </div>
      <div className="dash-exports">
        <button type="button" className="adm-filter" disabled={downloading !== null} onClick={() => download("orders")}>
          ↓ Orders CSV
        </button>
        <button type="button" className="adm-filter" disabled={downloading !== null} onClick={() => download("sales")}>
          ↓ Monthly sales CSV
        </button>
        <button type="button" className="adm-filter" disabled={downloading !== null} onClick={() => download("products")}>
          ↓ Products CSV
        </button>
      </div>
    </div>
  );

  if (loading && !data)
    return (
      <>
        <div className="adm-page-head">
          <h1>Sales performance</h1>
        </div>
        {toolbar}
        <div className="adm-empty">Loading dashboard…</div>
      </>
    );
  if (error || !data) return <div className="quote-empty">{error ?? "No data"}</div>;

  const k = data.kpis;
  const momPct =
    k.lastMonthRevenue > 0
      ? ((k.thisMonthRevenue - k.lastMonthRevenue) / k.lastMonthRevenue) * 100
      : null;

  const maxRev = Math.max(1, ...data.revenueByMonth.map((m) => m.revenue));
  const maxProdRev = Math.max(1, ...data.topProducts.map((p) => p.revenue));

  return (
    <>
      <div className="adm-page-head">
        <h1>Sales performance</h1>
        <p>Showing {rangeLabel} — revenue, products and customers.</p>
      </div>

      {toolbar}

      {/* ---- KPI cards ---- */}
      <div className="dash-kpis">
        <Kpi label="Total revenue" value={rm(k.revenue)} accent />
        <Kpi label="Orders" value={k.orders.toLocaleString()} />
        <Kpi label="Items sold" value={k.itemsSold.toLocaleString()} />
        <Kpi label="Customers" value={k.customers.toLocaleString()} />
        <Kpi
          label="Users reloaded"
          value={(data.reloads?.users ?? 0).toLocaleString()}
          hint={`${rm(data.reloads?.amount ?? 0)} topped up · ${(data.reloads?.count ?? 0).toLocaleString()} reload${(data.reloads?.count ?? 0) === 1 ? "" : "s"}`}
        />
        <Kpi
          label="Reloads (top-ups)"
          value={rm(data.reloads?.amount ?? 0)}
          hint={`${(data.reloads?.users ?? 0).toLocaleString()} members · ${(data.reloads?.count ?? 0).toLocaleString()} reload${(data.reloads?.count ?? 0) === 1 ? "" : "s"} in this range`}
        />
      </div>

      <div className="dash-grid">
        {/* ---- Revenue trend ---- */}
        <section className="adm-card dash-chart-card">
          <div className="adm-card-head-row">
            <h2>{mode === "month" ? "Revenue — this month" : mode === "year" ? "Revenue — this year" : "Revenue — selected range"}</h2>
            <span className="dash-mom">
              This month {rm2(k.thisMonthRevenue)}
              {momPct !== null && (
                <em className={momPct >= 0 ? "up" : "down"}>
                  {momPct >= 0 ? "▲" : "▼"} {Math.abs(momPct).toFixed(0)}%
                </em>
              )}
            </span>
          </div>
          <div className="dash-chart">
            {data.revenueByMonth.map((m) => (
              <div className="dash-bar-col" key={m.month} title={`${m.month}: ${rm2(m.revenue)} · ${m.orders} orders`}>
                <span className="dash-bar-val">{Math.round(m.revenue / 1000)}k</span>
                <div className="dash-bar" style={{ height: `${(m.revenue / maxRev) * 100}%` }} />
                <span className="dash-bar-month">{monthLabel(m.month)}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ---- Order status ---- */}
        <section className="adm-card">
          <h2>Orders by status</h2>
          <div className="dash-status-list">
            {data.statusBreakdown.slice(0, 8).map((s) => (
              <div className="dash-status-row" key={s.status}>
                <span className="dash-status-name">{statusLabel(s.status)}</span>
                <span className="dash-status-count">{s.orders}</span>
                <span className="dash-status-rev">{rm(s.revenue)}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ---- Top products ---- */}
        <section className="adm-card">
          <h2>Top products</h2>
          <div className="dash-rank">
            {data.topProducts.map((p, i) => (
              <div className="dash-rank-row" key={i}>
                <div className="dash-rank-main">
                  <span className="dash-rank-name">{p.name}</span>
                  <span className="dash-rank-sub">
                    {p.qty.toLocaleString()} sold · {p.orders} orders
                  </span>
                  <div className="dash-rank-bar">
                    <div style={{ width: `${(p.revenue / maxProdRev) * 100}%` }} />
                  </div>
                </div>
                <span className="dash-rank-value">{rm(p.revenue)}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ---- Top customers ---- */}
        <section className="adm-card">
          <h2>Top customers</h2>
          <div className="dash-rank">
            {data.topCustomers.map((c, i) => (
              <div className="dash-rank-row" key={i}>
                <div className="dash-rank-main">
                  <span className="dash-rank-name">{c.name}</span>
                  <span className="dash-rank-sub">{c.orders} orders</span>
                </div>
                <span className="dash-rank-value">{rm(c.spend)}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ---- Membership tiers ---- */}
        {data.tiers && data.tiers.length > 0 && (
          <section className="adm-card">
            <h2>Membership</h2>
            <div className="dash-status-list">
              {data.tiers.map((t) => (
                <div className="dash-status-row" key={t.tier}>
                  <span className="dash-status-name">{t.tier}</span>
                  <span className="dash-status-count">{t.members}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ---- Reloads (wallet top-ups) ---- */}
        <section className="adm-card">
          <h2>Reloads (top-ups)</h2>
          <div className="dash-status-list">
            <div className="dash-status-row">
              <span className="dash-status-name">Users reloaded</span>
              <span className="dash-status-count">{(data.reloads?.users ?? 0).toLocaleString()}</span>
            </div>
            <div className="dash-status-row">
              <span className="dash-status-name">Reloads</span>
              <span className="dash-status-count">{(data.reloads?.count ?? 0).toLocaleString()}</span>
            </div>
            <div className="dash-status-row">
              <span className="dash-status-name">Total reloaded</span>
              <span className="dash-status-rev">{rm(data.reloads?.amount ?? 0)}</span>
            </div>
          </div>
          {data.reloads?.top?.length ? (
            <div className="dash-rank" style={{ marginTop: 12 }}>
              {data.reloads.top.map((c, i) => (
                <div className="dash-rank-row" key={i}>
                  <div className="dash-rank-main">
                    <span className="dash-rank-name">{c.name}</span>
                    <span className="dash-rank-sub">
                      {c.reloads.toLocaleString()} reload{c.reloads === 1 ? "" : "s"}
                    </span>
                  </div>
                  <span className="dash-rank-value">{rm(c.amount)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="adm-card-sub" style={{ marginTop: 8 }}>No reloads in this range.</p>
          )}
        </section>

        {/* ---- Recent orders ---- */}
        <section className="adm-card dash-recent">
          <h2>Recent orders</h2>
          <div className="adm-table-scroll">
            <table className="adm-table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Customer</th>
                  <th>Status</th>
                  <th className="adm-num">Items</th>
                  <th className="adm-num">Total</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {data.recentOrders.map((o) => (
                  <tr key={o.id}>
                    <td className="adm-mono">#{o.id}</td>
                    <td className="adm-login">{o.customer}</td>
                    <td>
                      <span className="adm-chip adm-chip-member">{statusLabel(o.status)}</span>
                    </td>
                    <td className="adm-num adm-mono">{o.items}</td>
                    <td className="adm-num adm-mono">{rm2(o.total)}</td>
                    <td className="adm-date">{formatDate(o.date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </>
  );
}

function Kpi({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <div className={`dash-kpi${accent ? " is-accent" : ""}`}>
      <span className="dash-kpi-label">{label}</span>
      <strong className="dash-kpi-value">{value}</strong>
      {hint && <span className="dash-kpi-hint">{hint}</span>}
    </div>
  );
}
