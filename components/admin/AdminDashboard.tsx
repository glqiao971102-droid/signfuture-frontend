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

/** Premium revenue trend — gradient area under a smooth glowing line. */
function RevenueTrend({ months }: { months: { month: string; revenue: number; orders: number }[] }) {
  const W = 1000, H = 260, padL = 54, padR = 22, padT = 30, padB = 34;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const n = months.length;
  const max = Math.max(1, ...months.map((m) => m.revenue));
  const xf = (i: number) => padL + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const yf = (v: number) => padT + plotH - (v / max) * plotH;
  const pts = months.map((m, i) => [xf(i), yf(m.revenue)] as [number, number]);
  // Catmull-Rom → cubic bézier for a smooth curve.
  const smooth = (p: [number, number][]): string => {
    if (p.length < 2) return p.length ? `M${p[0][0]},${p[0][1]}` : "";
    let d = `M${p[0][0].toFixed(1)},${p[0][1].toFixed(1)}`;
    for (let i = 0; i < p.length - 1; i++) {
      const p0 = p[i - 1] || p[i], p1 = p[i], p2 = p[i + 1], p3 = p[i + 2] || p2;
      const c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = p1[1] + (p2[1] - p0[1]) / 6;
      const c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = p2[1] - (p3[1] - p1[1]) / 6;
      d += ` C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
    }
    return d;
  };
  const line = smooth(pts);
  const area = n ? `${line} L${xf(n - 1).toFixed(1)},${(padT + plotH).toFixed(1)} L${xf(0).toFixed(1)},${(padT + plotH).toFixed(1)} Z` : "";
  const grid = [0, 0.25, 0.5, 0.75, 1];
  const kfmt = (v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : `${Math.round(v)}`);
  return (
    <svg className="dash-rev-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Revenue trend">
      <defs>
        <linearGradient id="revArea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--cyan)" stopOpacity="0.36" />
          <stop offset="55%" stopColor="var(--blue)" stopOpacity="0.12" />
          <stop offset="100%" stopColor="var(--blue)" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="revLine" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="var(--blue)" />
          <stop offset="100%" stopColor="var(--cyan)" />
        </linearGradient>
        <filter id="revGlow" x="-10%" y="-40%" width="120%" height="180%">
          <feGaussianBlur stdDeviation="4" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      {grid.map((g, i) => {
        const yy = padT + plotH - g * plotH;
        return (
          <g key={i}>
            <line x1={padL} y1={yy} x2={W - padR} y2={yy} className="dash-rev-grid" />
            <text x={padL - 10} y={yy + 4} className="dash-rev-ylabel" textAnchor="end">{kfmt(g * max)}</text>
          </g>
        );
      })}
      {area && <path d={area} fill="url(#revArea)" />}
      {line && <path d={line} fill="none" stroke="url(#revLine)" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" filter="url(#revGlow)" />}
      {pts.map((p, i) => {
        const last = i === pts.length - 1;
        return (
          <g key={i}>
            <line x1={p[0]} y1={p[1]} x2={p[0]} y2={padT + plotH} className="dash-rev-vline" />
            <circle cx={p[0]} cy={p[1]} r={last ? 5.5 : 3.5} className={last ? "dash-rev-dot is-last" : "dash-rev-dot"} />
            <text x={p[0]} y={p[1] - 12} className={`dash-rev-val${last ? " is-last" : ""}`} textAnchor="middle">{kfmt(months[i].revenue)}</text>
            <text x={p[0]} y={H - 10} className="dash-rev-xlabel" textAnchor="middle">{monthLabel(months[i].month)}</text>
          </g>
        );
      })}
    </svg>
  );
}

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
  // Which category rows are expanded to show their products.
  const [openCats, setOpenCats] = useState<Record<string, boolean>>({});
  // The revenue trend chart always shows the full YEAR (Jan → now) so it stays
  // a meaningful trend even while the KPIs default to just this month.
  const [yearMonths, setYearMonths] = useState<AdminStats["revenueByMonth"] | null>(null);

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

  // Fetch the full-year monthly revenue once for the trend chart (independent
  // of the range selector above).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const y = await api.adminStatsRanged(thisYearRange());
        if (!cancelled) setYearMonths(y.revenueByMonth);
      } catch {
        /* the chart falls back to the ranged data */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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

  // Revenue chart always shows the full year; fall back to the ranged data
  // until the year fetch resolves.
  const chartMonths = yearMonths ?? data.revenueByMonth;
  const cats = data.categoryBreakdown ?? [];
  const maxCatRev = Math.max(1, ...cats.map((c) => c.revenue));

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
        <Kpi
          label="Reloads (top-ups)"
          value={rm(data.reloads?.amount ?? 0)}
          hint={`${(data.reloads?.users ?? 0).toLocaleString()} members · ${(data.reloads?.count ?? 0).toLocaleString()} reload${(data.reloads?.count ?? 0) === 1 ? "" : "s"} in this range`}
        />
        <Kpi label="Orders" value={k.orders.toLocaleString()} />
        <Kpi label="Items sold" value={k.itemsSold.toLocaleString()} />
        <Kpi label="Customers" value={k.customers.toLocaleString()} />
        <Kpi
          label="Users reloaded"
          value={(data.reloads?.users ?? 0).toLocaleString()}
          hint={`${rm(data.reloads?.amount ?? 0)} topped up · ${(data.reloads?.count ?? 0).toLocaleString()} reload${(data.reloads?.count ?? 0) === 1 ? "" : "s"}`}
        />
      </div>

      <div className="dash-grid">
        {/* ---- Revenue trend ---- */}
        <section className="adm-card dash-chart-card">
          <div className="adm-card-head-row">
            <h2>Revenue — this year</h2>
            <span className="dash-mom">
              This month {rm2(k.thisMonthRevenue)}
              {momPct !== null && (
                <em className={momPct >= 0 ? "up" : "down"}>
                  {momPct >= 0 ? "▲" : "▼"} {Math.abs(momPct).toFixed(0)}%
                </em>
              )}
            </span>
          </div>
          <RevenueTrend months={chartMonths} />
        </section>

        {/* ---- Order status ---- */}
        <section className="adm-card">
          <h2>Orders by status</h2>
          <div className="dash-status-list">
            {data.statusBreakdown.slice(0, 8).map((s) => (
              <div className="dash-status-row" key={s.status}>
                <span className="dash-status-name">{s.status}</span>
                <span className="dash-status-count">{s.orders}</span>
                <span className="dash-status-rev">{rm(s.revenue)}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ---- Revenue by category (click a category to see its products) ---- */}
        <section className="adm-card">
          <div className="adm-card-head-row">
            <h2>Revenue by category</h2>
            <span className="dash-mom">{rangeLabel}</span>
          </div>
          {cats.length === 0 ? (
            <p className="adm-card-sub">No sales in this range.</p>
          ) : (
            <div className="dash-rank">
              {cats.map((c) => {
                const open = !!openCats[c.category];
                return (
                  <div key={c.category}>
                    <button
                      type="button"
                      className={`dash-cat-row${open ? " is-open" : ""}`}
                      onClick={() => setOpenCats((s) => ({ ...s, [c.category]: !s[c.category] }))}
                    >
                      <div className="dash-rank-main">
                        <span className="dash-rank-name">
                          <span className="dash-cat-caret">{open ? "▾" : "▸"}</span> {c.category}
                        </span>
                        <span className="dash-rank-sub">
                          {c.products.length} product{c.products.length === 1 ? "" : "s"} · {c.qty.toLocaleString()} sold
                        </span>
                        <div className="dash-rank-bar">
                          <div style={{ width: `${(c.revenue / maxCatRev) * 100}%` }} />
                        </div>
                      </div>
                      <span className="dash-rank-value">{rm(c.revenue)}</span>
                    </button>
                    {open && (
                      <div className="dash-cat-products">
                        {c.products.map((p, i) => (
                          <div className="dash-cat-product" key={i}>
                            <span className="dash-cat-product-name">{p.name}</span>
                            <span className="dash-cat-product-sub">{p.qty.toLocaleString()} sold</span>
                            <span className="dash-cat-product-val">{rm2(p.revenue)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* ---- Production volume (area products in sq ft, others in pcs) ---- */}
        <section className="adm-card">
          <div className="adm-card-head-row">
            <h2>Production volume</h2>
            <span className="dash-mom">{rangeLabel}</span>
          </div>
          {(() => {
            const pv = data.productionVolume ?? [];
            const areaItems = pv.filter((p) => p.area);
            const pcsItems = pv.filter((p) => !p.area);
            if (pv.length === 0) return <p className="adm-card-sub">No production in this range.</p>;
            const maxSqft = Math.max(1, ...areaItems.map((p) => p.sqft));
            const maxPcs = Math.max(1, ...pcsItems.map((p) => p.pcs));
            return (
              <>
                {areaItems.length > 0 && (
                  <>
                    <p className="dash-vol-group">By area (sq ft)</p>
                    <div className="dash-rank">
                      {areaItems.map((p, i) => (
                        <div className="dash-rank-row" key={`a${i}`}>
                          <div className="dash-rank-main">
                            <span className="dash-rank-name">{p.name}</span>
                            <span className="dash-rank-sub">{p.count} order{p.count === 1 ? "" : "s"}</span>
                            <div className="dash-rank-bar"><div style={{ width: `${(p.sqft / maxSqft) * 100}%` }} /></div>
                          </div>
                          <span className="dash-rank-value">{p.sqft.toLocaleString("en-MY", { maximumFractionDigits: 1 })} ft²</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
                {pcsItems.length > 0 && (
                  <>
                    <p className="dash-vol-group">By quantity (pcs)</p>
                    <div className="dash-rank">
                      {pcsItems.map((p, i) => (
                        <div className="dash-rank-row" key={`p${i}`}>
                          <div className="dash-rank-main">
                            <span className="dash-rank-name">{p.name}</span>
                            <span className="dash-rank-sub">{p.count} order{p.count === 1 ? "" : "s"}</span>
                            <div className="dash-rank-bar"><div style={{ width: `${(p.pcs / maxPcs) * 100}%` }} /></div>
                          </div>
                          <span className="dash-rank-value">{p.pcs.toLocaleString()} pcs</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </>
            );
          })()}
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
                  <tr key={`${o.ref ?? o.id}`}>
                    <td className="adm-mono">{o.ref ?? `#${o.id}`}</td>
                    <td className="adm-login">{o.customer}</td>
                    <td>
                      <span className="adm-chip adm-chip-member">{o.statusLabel ?? statusLabel(o.status)}</span>
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
