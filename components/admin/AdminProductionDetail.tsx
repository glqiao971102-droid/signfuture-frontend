"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api, type ProductionJob, type ProductionHoliday } from "@/lib/api";

/* ------------------------------------------------------------------ *
 * Production Detail — the data view behind the Kanban: performance
 * record (on-time vs late per month, with a chart), current workload
 * by stage, and the public-holiday calendar used by the due-date math.
 * ------------------------------------------------------------------ */

type Monthly = { month: string; completed: number; onTime: number; late: number; noDue: number; onTimeRate: number | null };
type Stats = { monthly: Monthly[]; currentlyOverdue: number };

// The stage (board column) a job currently sits in.
function laneKey(j: ProductionJob): string {
  if (j.status === "waiting" || j.status === "pending_confirmation") return "in_progress";
  if (j.status === "processing") return j.productionStage === "router_3d" ? "router_3d" : j.productionStage === "qc" ? "qc" : "in_progress";
  if (j.status === "ready") return "ready";
  if (j.status === "shipped") return "shipped";
  if (j.status === "collection") return "collection";
  if (j.status === "delivered") return "delivered";
  return "in_progress";
}
const STAGES: { key: string; label: string }[] = [
  { key: "in_progress", label: "Job In Progress" },
  { key: "router_3d", label: "Router & 3D Printer" },
  { key: "qc", label: "QC" },
  { key: "ready", label: "Available for Collection" },
  { key: "shipped", label: "Ready to Ship" },
  { key: "collection", label: "Collected" },
  { key: "delivered", label: "Shipped" },
];
const ACTIVE_STAGES = ["in_progress", "router_3d", "qc", "ready", "shipped"];

function klToday(): string {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kuala_Lumpur", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const g = (t: string) => p.find((x) => x.type === t)?.value ?? "";
  return `${g("year")}-${g("month")}-${g("day")}`;
}
function monthLabelOf(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-MY", { month: "short", year: "numeric" });
}

export default function AdminProductionDetail() {
  const [jobs, setJobs] = useState<ProductionJob[]>([]);
  const [holidays, setHolidays] = useState<ProductionHoliday[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [newDay, setNewDay] = useState("");
  const [newLabel, setNewLabel] = useState("");

  const load = useCallback(async () => {
    try {
      const [board, s] = await Promise.all([api.adminProduction(), api.adminProductionStats(12)]);
      setJobs(board.jobs);
      setHolidays(board.holidays);
      setStats(s);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const today = klToday();

  // Current workload by stage + overview numbers.
  const workload = useMemo(() => {
    const counts: Record<string, number> = {};
    let activeOverdue = 0;
    for (const j of jobs) {
      const k = laneKey(j);
      counts[k] = (counts[k] ?? 0) + 1;
      if (ACTIVE_STAGES.includes(k) && j.dueDate && j.dueDate < today) activeOverdue++;
    }
    const active = ACTIVE_STAGES.reduce((n, k) => n + (counts[k] ?? 0), 0);
    return { counts, active, activeOverdue };
  }, [jobs, today]);

  const totals = useMemo(() => {
    if (!stats) return { onTime: 0, late: 0, rate: null as number | null };
    let onTime = 0;
    let late = 0;
    for (const m of stats.monthly) {
      onTime += m.onTime;
      late += m.late;
    }
    return { onTime, late, rate: onTime + late > 0 ? Math.round((onTime / (onTime + late)) * 100) : null };
  }, [stats]);

  const thisMonth = today.slice(0, 7);
  const thisMonthRow = stats?.monthly.find((m) => m.month === thisMonth);
  const chartMax = Math.max(1, ...(stats?.monthly.map((m) => m.completed) ?? [1]));

  async function addHoliday() {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(newDay)) {
      alert("Pick a date first.");
      return;
    }
    try {
      await api.adminAddHoliday(newDay, newLabel.trim() || undefined);
      setNewDay("");
      setNewLabel("");
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Could not add holiday");
    }
  }
  async function removeHoliday(id: number) {
    try {
      await api.adminDeleteHoliday(id);
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Could not remove holiday");
    }
  }

  const maxStage = Math.max(1, ...STAGES.map((s) => workload.counts[s.key] ?? 0));

  return (
    <div className="prod-wrap">
      <div className="prod-head">
        <div>
          <h1>Production Detail</h1>
          <p className="adm-card-sub">Performance record, current workload, and the holiday calendar.</p>
        </div>
      </div>

      {loading && <div className="quote-empty">Loading…</div>}

      {!loading && (
        <div className="prod-detail">
          {/* Overview tiles */}
          <div className="pd-tiles">
            <div className="pd-tile">
              <span className="pd-tile-num">{workload.active}</span>
              <span className="pd-tile-lbl">Active on the floor</span>
            </div>
            <div className="pd-tile">
              <span className="pd-tile-num" style={{ color: workload.activeOverdue ? "#ff9aab" : undefined }}>{workload.activeOverdue}</span>
              <span className="pd-tile-lbl">Currently overdue</span>
            </div>
            <div className="pd-tile">
              <span className="pd-tile-num">{thisMonthRow?.completed ?? 0}</span>
              <span className="pd-tile-lbl">Completed this month</span>
            </div>
            <div className="pd-tile">
              <span className="pd-tile-num" style={{ color: totals.rate == null ? undefined : totals.rate >= 80 ? "#7ee6b4" : totals.rate >= 50 ? "#ffbe70" : "#ff9aab" }}>
                {totals.rate == null ? "—" : `${totals.rate}%`}
              </span>
              <span className="pd-tile-lbl">On-time rate (12 mo)</span>
            </div>
          </div>

          {/* On-time vs late chart + table */}
          <div className="pd-card">
            <div className="pd-card-head">
              <strong>On-time vs Delayed — by month</strong>
              <span className="adm-card-sub">Jobs finished on/before their working-day due date vs after.</span>
            </div>
            {stats && stats.monthly.length > 0 ? (
              <>
                <div className="pd-chart2">
                  <div className="pd-plot">
                    {[...stats.monthly].reverse().map((m) => {
                      const h = Math.round((m.completed / chartMax) * 150);
                      return (
                        <div key={m.month} className="pd-col" title={`${monthLabelOf(m.month)} — ${m.onTime} on time · ${m.late} late${m.onTimeRate != null ? ` · ${m.onTimeRate}% on-time` : ""}`}>
                          <span className="pd-col-val">{m.completed || ""}</span>
                          <div className="pd-stack" style={{ height: `${Math.max(h, m.completed ? 6 : 0)}px` }}>
                            {m.late > 0 && <div className="pd-seg pd-seg-late" style={{ flexGrow: m.late }} />}
                            {m.onTime > 0 && <div className="pd-seg pd-seg-ontime" style={{ flexGrow: m.onTime }} />}
                            {m.completed > 0 && m.onTime === 0 && m.late === 0 && <div className="pd-seg pd-seg-none" style={{ flexGrow: 1 }} />}
                          </div>
                          <span className="pd-col-x">{monthLabelOf(m.month).split(" ")[0]}</span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="pd-legend">
                    <span className="pd-leg"><i className="pd-dot pd-dot-ontime" /> On time</span>
                    <span className="pd-leg"><i className="pd-dot pd-dot-late" /> Delayed</span>
                  </div>
                </div>
                <div className="prod-stats-tablewrap">
                  <table className="prod-stats-table">
                    <thead>
                      <tr><th>Month</th><th className="adm-num">Completed</th><th className="adm-num">On-time</th><th className="adm-num">Delayed</th><th className="adm-num">On-time %</th></tr>
                    </thead>
                    <tbody>
                      {stats.monthly.map((m) => (
                        <tr key={m.month}>
                          <td>{new Date(m.month + "-01T00:00:00").toLocaleDateString("en-MY", { month: "long", year: "numeric" })}</td>
                          <td className="adm-num">{m.completed}</td>
                          <td className="adm-num" style={{ color: "#7fe3ff" }}>{m.onTime}</td>
                          <td className="adm-num" style={{ color: m.late > 0 ? "#ff9aab" : undefined }}>{m.late}</td>
                          <td className="adm-num">
                            {m.onTimeRate == null ? "—" : (
                              <span style={{ color: m.onTimeRate >= 80 ? "#7ee6b4" : m.onTimeRate >= 50 ? "#ffbe70" : "#ff9aab", fontWeight: 800 }}>{m.onTimeRate}%</span>
                            )}
                            {m.noDue > 0 && <span className="adm-card-sub"> ({m.noDue} no due)</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <div className="adm-card-sub">No completed jobs yet.</div>
            )}
          </div>

          <div className="pd-row2">
          {/* Current workload by stage */}
          <div className="pd-card">
            <div className="pd-card-head">
              <strong>Current workload by stage</strong>
              <span className="adm-card-sub">How many jobs sit in each column right now.</span>
            </div>
            <div className="pd-stagebars">
              {STAGES.map((s) => {
                const n = workload.counts[s.key] ?? 0;
                return (
                  <div key={s.key} className="pd-stagebar-row">
                    <span className="pd-stagebar-lbl">{s.label}</span>
                    <div className="pd-stagebar-track">
                      <div className="pd-stagebar-fill" style={{ width: `${(n / maxStage) * 100}%` }} />
                    </div>
                    <span className="pd-stagebar-n">{n}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Public holidays */}
          <div className="pd-card">
            <div className="pd-card-head">
              <strong>Public Holidays</strong>
              <span className="adm-card-sub">These dates (plus every Sunday) are skipped when computing job due dates.</span>
            </div>
            <div className="prod-holidays-add">
              <input type="date" className="adm-input" value={newDay} onChange={(e) => setNewDay(e.target.value)} />
              <input className="adm-input" placeholder="Label (e.g. Merdeka Day)" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} />
              <button type="button" className="hero-btn primary" onClick={addHoliday}>Add holiday</button>
            </div>
            <div className="prod-holidays-list">
              {holidays.length === 0 && <span className="adm-card-sub">No holidays added yet.</span>}
              {holidays.map((h) => (
                <span key={h.id} className="prod-holiday-chip">
                  {new Date(h.day + "T00:00:00").toLocaleDateString("en-MY", { weekday: "short", day: "2-digit", month: "short", year: "numeric" })}
                  {h.label ? ` · ${h.label}` : ""}
                  <button type="button" onClick={() => removeHoliday(h.id)} aria-label="Remove">×</button>
                </span>
              ))}
            </div>
          </div>
          </div>
        </div>
      )}
    </div>
  );
}
