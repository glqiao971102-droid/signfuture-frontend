"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api, type ProductionJob, type ProductionHoliday } from "@/lib/api";

/* ------------------------------------------------------------------ *
 * Production Kanban — one card per job (order item, e.g. 100049-1),
 * grouped into production-stage columns. Each card shows a due date
 * computed from the job's "N working days" (Mon–Sat, skipping Sundays
 * and admin-set public holidays); cards turn orange when due today and
 * red when overdue. All time logic runs in Malaysia time.
 * ------------------------------------------------------------------ */

// Board columns (display order). `stage` is the value sent to the backend when
// a card is moved here via the dropdown; some columns share a stage but are
// split for display by delivery method / month.
type Col = { key: string; title: string; stage: string; hint?: string };
const COLUMNS: Col[] = [
  { key: "in_progress", title: "Job In Progress", stage: "in_progress", hint: "New orders land here" },
  { key: "router_3d", title: "Router & 3D Printer", stage: "router_3d" },
  { key: "qc", title: "QC", stage: "qc" },
  { key: "ready_collection", title: "Available for Collection", stage: "ready", hint: "Self-collect — customer notified" },
  { key: "delivery", title: "Ready for Delivery", stage: "ready", hint: "To be delivered" },
  { key: "collection", title: "Collected", stage: "done" },
  { key: "delivered", title: "Shipped", stage: "done" },
];

// The two "finished" columns (grouped by month, no urgency colour).
const DONE_LANES = ["collection", "delivered"];
const isDoneLane = (lane: string) => DONE_LANES.includes(lane);

// The dropdown a card offers to move between stages.
const STAGE_OPTIONS: { value: string; label: string }[] = [
  { value: "in_progress", label: "Job In Progress" },
  { value: "router_3d", label: "Router & 3D Printer" },
  { value: "qc", label: "QC" },
  { value: "ready", label: "Ready (Collection / Delivery)" },
  { value: "done", label: "Done (Collected / Shipped)" },
];

// Which board column a job falls into, from its status + production stage.
function laneOf(j: ProductionJob): string {
  // New (waiting/pending) jobs land directly in Job In Progress — no separate
  // intake column.
  if (j.status === "waiting" || j.status === "pending_confirmation") return "in_progress";
  if (j.status === "processing") {
    if (j.productionStage === "router_3d") return "router_3d";
    if (j.productionStage === "qc") return "qc";
    return "in_progress";
  }
  if (j.status === "ready") return j.selfCollect ? "ready_collection" : "delivery";
  if (j.status === "shipped") return "delivery";
  if (j.status === "collection") return "collection";
  if (j.status === "delivered") return "delivered";
  return "in_progress";
}

// The dropdown's current value for a job (maps a lane back to a stage).
function stageValueOf(j: ProductionJob): string {
  const lane = laneOf(j);
  if (lane === "ready_collection" || lane === "delivery") return "ready";
  if (isDoneLane(lane)) return "done";
  return lane;
}

// Malaysia "now": today's date (YYYY-MM-DD) and the current hour (0–23),
// independent of the admin's own browser timezone.
function klNow(): { today: string; hour: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kuala_Lumpur",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  let hour = Number.parseInt(get("hour") || "0", 10);
  if (hour === 24) hour = 0;
  return { today: `${get("year")}-${get("month")}-${get("day")}`, hour };
}

const DAY_MS = 86400000;
function daysBetween(a: string, b: string): number {
  // a, b = YYYY-MM-DD. Positive when a is after b.
  return Math.round((Date.parse(a + "T00:00:00Z") - Date.parse(b + "T00:00:00Z")) / DAY_MS);
}

type Urgency = { level: "none" | "ok" | "soon" | "today" | "overdue"; label: string };
// A job's urgency from its due date vs Malaysia "now". The 6pm cutoff only bites
// on the due day itself. Finished jobs never show urgency.
function urgencyOf(j: ProductionJob, now: { today: string; hour: number }): Urgency {
  if (isDoneLane(laneOf(j))) return { level: "none", label: "" };
  if (!j.dueDate) return { level: "none", label: "No due date" };
  const diff = daysBetween(j.dueDate, now.today); // >0 future, 0 today, <0 past
  if (diff > 0) return { level: diff <= 1 ? "soon" : "ok", label: diff === 1 ? "Due tomorrow" : `${diff} days left` };
  if (diff === 0) {
    return now.hour < 18
      ? { level: "today", label: "Due TODAY — before 6pm" }
      : { level: "overdue", label: "Overdue — past 6pm today" };
  }
  const late = -diff;
  return { level: "overdue", label: `Overdue by ${late} day${late === 1 ? "" : "s"}` };
}

function fmtDue(d: string | null): string {
  if (!d) return "—";
  const dt = new Date(d + "T00:00:00");
  return dt.toLocaleDateString("en-MY", { weekday: "short", day: "2-digit", month: "short", year: "numeric" });
}
function monthKey(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en-MY", { month: "long", year: "numeric" });
}

export default function AdminProduction() {
  const [jobs, setJobs] = useState<ProductionJob[]>([]);
  const [holidays, setHolidays] = useState<ProductionHoliday[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [openJobId, setOpenJobId] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [showHolidays, setShowHolidays] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [stats, setStats] = useState<{
    monthly: { month: string; completed: number; onTime: number; late: number; noDue: number; onTimeRate: number | null }[];
    currentlyOverdue: number;
  } | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [newHolidayDay, setNewHolidayDay] = useState("");
  const [newHolidayLabel, setNewHolidayLabel] = useState("");
  // Re-render every minute so the "due today / overdue" colours stay live.
  const [, setTick] = useState(0);

  const load = useCallback(async () => {
    try {
      const r = await api.adminProduction();
      setJobs(r.jobs);
      setHolidays(r.holidays);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load the production board");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 60000);
    return () => clearInterval(t);
  }, []);

  const now = klNow();
  const openJob = openJobId != null ? jobs.find((j) => j.id === openJobId) ?? null : null;

  const visibleJobs = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return jobs;
    return jobs.filter(
      (j) =>
        j.jobRef.toLowerCase().includes(q) ||
        (j.customerName ?? "").toLowerCase().includes(q) ||
        j.productName.toLowerCase().includes(q),
    );
  }, [jobs, query]);

  const byLane = useMemo(() => {
    const map: Record<string, ProductionJob[]> = {};
    for (const c of COLUMNS) map[c.key] = [];
    for (const j of visibleJobs) (map[laneOf(j)] ??= []).push(j);
    // Sort active columns by urgency (most urgent first); done by completion desc.
    for (const key of Object.keys(map)) {
      if (isDoneLane(key)) {
        map[key].sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""));
      } else {
        map[key].sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"));
      }
    }
    return map;
  }, [visibleJobs]);

  // Top-line counts across all ACTIVE (not done) jobs.
  const summary = useMemo(() => {
    let dueToday = 0;
    let overdue = 0;
    let active = 0;
    for (const j of jobs) {
      if (isDoneLane(laneOf(j))) continue;
      active++;
      const u = urgencyOf(j, now);
      if (u.level === "today") dueToday++;
      else if (u.level === "overdue") overdue++;
    }
    return { active, dueToday, overdue };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobs, now.today, now.hour]);

  async function move(j: ProductionJob, stage: string) {
    if (stage === stageValueOf(j)) return;
    if (stage === "ready" && !window.confirm(`Mark ${j.jobRef} as ready? The customer will be emailed.`)) return;
    if (stage === "done" && !window.confirm(`Mark ${j.jobRef} as ${j.selfCollect ? "Collected" : "Shipped"}?`)) return;
    setSavingId(j.id);
    try {
      await api.adminSetProductionStage(j.orderId, j.id, stage);
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Could not move the job");
    } finally {
      setSavingId(null);
    }
  }

  async function addHoliday() {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(newHolidayDay)) {
      alert("Pick a date first.");
      return;
    }
    try {
      await api.adminAddHoliday(newHolidayDay, newHolidayLabel.trim() || undefined);
      setNewHolidayDay("");
      setNewHolidayLabel("");
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

  async function openStats() {
    const next = !showStats;
    setShowStats(next);
    if (next) {
      setStatsLoading(true);
      try {
        setStats(await api.adminProductionStats(12));
      } catch {
        /* ignore */
      } finally {
        setStatsLoading(false);
      }
    }
  }

  return (
    <div className="prod-wrap">
      <div className="prod-head">
        <div>
          <h1>Production</h1>
          <p className="adm-card-sub">
            Every job on the floor, due dates from working days. Orange = due today (before 6pm) · Red = overdue.
          </p>
        </div>
        <div className="prod-head-right">
          <span className="prod-stat">{summary.active} active</span>
          <span className="prod-stat prod-stat-today">{summary.dueToday} due today</span>
          <span className="prod-stat prod-stat-over">{summary.overdue} overdue</span>
          <input
            className="adm-input prod-search"
            placeholder="Search job / customer / product"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button type="button" className="hero-btn ghost" onClick={() => load()}>
            ↻ Refresh
          </button>
          <button type="button" className="hero-btn ghost" onClick={openStats}>
            📊 Stats
          </button>
          <button type="button" className="hero-btn ghost" onClick={() => setShowHolidays((v) => !v)}>
            📅 Holidays ({holidays.length})
          </button>
        </div>
      </div>

      {showStats && (
        <div className="prod-holidays">
          <div className="prod-holidays-head">
            <strong>Production Record — On-time vs Delayed</strong>
            <span className="adm-card-sub">
              Per completion month: jobs finished on or before their working-day due date (on-time) vs after (delayed).
              {stats && <> · <b style={{ color: "#ff9aab" }}>{stats.currentlyOverdue}</b> job(s) currently overdue on the floor.</>}
            </span>
          </div>
          {statsLoading && <div className="adm-card-sub">Loading…</div>}
          {!statsLoading && stats && (
            <div className="prod-stats-tablewrap">
              <table className="prod-stats-table">
                <thead>
                  <tr>
                    <th>Month</th>
                    <th className="adm-num">Completed</th>
                    <th className="adm-num">On-time</th>
                    <th className="adm-num">Delayed</th>
                    <th className="adm-num">On-time %</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.monthly.length === 0 && (
                    <tr>
                      <td colSpan={5} className="adm-card-sub">No completed jobs yet.</td>
                    </tr>
                  )}
                  {stats.monthly.map((m) => (
                    <tr key={m.month}>
                      <td>{new Date(m.month + "-01T00:00:00").toLocaleDateString("en-MY", { month: "long", year: "numeric" })}</td>
                      <td className="adm-num">{m.completed}</td>
                      <td className="adm-num" style={{ color: "#7ee6b4" }}>{m.onTime}</td>
                      <td className="adm-num" style={{ color: m.late > 0 ? "#ff9aab" : undefined }}>{m.late}</td>
                      <td className="adm-num">
                        {m.onTimeRate == null ? "—" : (
                          <span style={{ color: m.onTimeRate >= 80 ? "#7ee6b4" : m.onTimeRate >= 50 ? "#ffbe70" : "#ff9aab", fontWeight: 800 }}>
                            {m.onTimeRate}%
                          </span>
                        )}
                        {m.noDue > 0 && <span className="adm-card-sub"> ({m.noDue} no due)</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {showHolidays && (
        <div className="prod-holidays">
          <div className="prod-holidays-head">
            <strong>Public Holidays</strong>
            <span className="adm-card-sub">These dates (plus every Sunday) are skipped when computing due dates.</span>
          </div>
          <div className="prod-holidays-add">
            <input type="date" className="adm-input" value={newHolidayDay} onChange={(e) => setNewHolidayDay(e.target.value)} />
            <input
              className="adm-input"
              placeholder="Label (e.g. Merdeka Day)"
              value={newHolidayLabel}
              onChange={(e) => setNewHolidayLabel(e.target.value)}
            />
            <button type="button" className="hero-btn primary" onClick={addHoliday}>
              Add
            </button>
          </div>
          <div className="prod-holidays-list">
            {holidays.length === 0 && <span className="adm-card-sub">No holidays yet.</span>}
            {holidays.map((h) => (
              <span key={h.id} className="prod-holiday-chip">
                {h.day}
                {h.label ? ` · ${h.label}` : ""}
                <button type="button" onClick={() => removeHoliday(h.id)} aria-label="Remove">
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {loading && <div className="quote-empty">Loading the board…</div>}
      {error && <div className="quote-empty">{error}</div>}

      {!loading && !error && (
        <div className="prod-board">
          {COLUMNS.map((col) => {
            const list = byLane[col.key] ?? [];
            return (
              <div key={col.key} className="prod-col">
                <div className="prod-col-head">
                  <span className="prod-col-title">{col.title}</span>
                  <span className="prod-col-count">{list.length}</span>
                </div>
                {col.hint && <div className="prod-col-hint">{col.hint}</div>}
                <div className="prod-col-body">
                  {isDoneLane(col.key)
                    ? renderDoneGrouped(list)
                    : list.map((j) => (
                        <ProductionCard key={j.id} job={j} now={now} saving={savingId === j.id} onOpen={(x) => setOpenJobId(x.id)} />
                      ))}
                  {list.length === 0 && <div className="prod-empty">—</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {openJob && (
        <JobModal
          job={openJob}
          now={now}
          onClose={() => setOpenJobId(null)}
          onMove={move}
          onSavedNote={load}
        />
      )}
    </div>
  );

  function renderDoneGrouped(list: ProductionJob[]) {
    const groups: { month: string; jobs: ProductionJob[] }[] = [];
    for (const j of list) {
      const m = monthKey(j.completedAt);
      const g = groups.find((x) => x.month === m);
      if (g) g.jobs.push(j);
      else groups.push({ month: m, jobs: [j] });
    }
    return groups.map((g) => (
      <div key={g.month} className="prod-done-group">
        <div className="prod-done-month">
          {g.month} <span className="prod-col-count">{g.jobs.length}</span>
        </div>
        {g.jobs.map((j) => (
          <ProductionCard key={j.id} job={j} now={now} saving={savingId === j.id} onOpen={(x) => setOpenJobId(x.id)} />
        ))}
      </div>
    ));
  }
}

// Compact card: just the job number, due date and its urgency badge. Everything
// else lives in the detail modal, opened on click.
function ProductionCard({
  job,
  now,
  saving,
  onOpen,
}: {
  job: ProductionJob;
  now: { today: string; hour: number };
  saving: boolean;
  onOpen: (j: ProductionJob) => void;
}) {
  const u = urgencyOf(job, now);
  const done = isDoneLane(laneOf(job));
  return (
    <button type="button" className={`prod-card prod-${u.level}${saving ? " is-saving" : ""}`} onClick={() => onOpen(job)}>
      <div className="prod-card-top">
        <strong className="prod-card-ref">{job.jobRef}</strong>
        {job.qty > 1 && <span className="prod-card-qty">×{job.qty}</span>}
        {job.productionNote && <span className="prod-card-hasnote" title="Has a description">📝</span>}
      </div>
      {done ? (
        <div className="prod-due prod-due-done">
          ✓ {job.completedAt ? new Date(job.completedAt).toLocaleDateString("en-MY", { day: "2-digit", month: "short" }) : "Done"}
        </div>
      ) : (
        <div className={`prod-due prod-due-${u.level}`}>
          <span className="prod-due-date">{fmtDueShort(job.dueDate)}</span>
          {u.label && <span className="prod-due-badge">{u.label}</span>}
        </div>
      )}
    </button>
  );
}

function fmtDueShort(d: string | null): string {
  if (!d) return "No due date";
  const dt = new Date(d + "T00:00:00");
  return dt.toLocaleDateString("en-MY", { day: "2-digit", month: "short" });
}

function fmtActivityTime(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString("en-MY", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true,
  });
}

// Card detail modal: full job info, an editable Description, the stage mover, and
// the activity log (who moved it / edited it, and when).
function JobModal({
  job,
  now,
  onClose,
  onMove,
  onSavedNote,
}: {
  job: ProductionJob;
  now: { today: string; hour: number };
  onClose: () => void;
  onMove: (j: ProductionJob, stage: string) => Promise<void>;
  onSavedNote: () => void;
}) {
  const [note, setNote] = useState(job.productionNote ?? "");
  const [activity, setActivity] = useState<{ actor: string; text: string | null; at: string | null }[]>([]);
  const [loadingAct, setLoadingAct] = useState(true);
  const [savingNote, setSavingNote] = useState(false);
  const [moving, setMoving] = useState(false);

  const loadActivity = useCallback(async () => {
    setLoadingAct(true);
    try {
      const r = await api.adminProductionJob(job.orderId, job.id);
      setActivity(r.activity);
      setNote((prev) => (prev === (job.productionNote ?? "") ? r.productionNote ?? "" : prev));
    } catch {
      /* ignore */
    } finally {
      setLoadingAct(false);
    }
  }, [job.orderId, job.id, job.productionNote]);

  useEffect(() => {
    loadActivity();
  }, [loadActivity]);

  const u = urgencyOf(job, now);
  const done = isDoneLane(laneOf(job));
  const arts = job.artworks && job.artworks.length ? job.artworks : job.artworkUrl ? [{ url: job.artworkUrl, name: "Artwork" }] : [];
  const specOptions = (job.options || []).filter((o) => o.label !== "LED Length" && o.label !== "3D Outline");

  async function saveNote() {
    setSavingNote(true);
    try {
      await api.adminSaveProductionNote(job.orderId, job.id, note);
      await loadActivity();
      onSavedNote();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Could not save the description");
    } finally {
      setSavingNote(false);
    }
  }

  async function doMove(stage: string) {
    setMoving(true);
    try {
      await onMove(job, stage);
      await loadActivity();
    } finally {
      setMoving(false);
    }
  }

  return (
    <div className="prod-modal-backdrop" onClick={onClose}>
      <div className="prod-modal" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="prod-modal-x" onClick={onClose} aria-label="Close">
          ×
        </button>
        <div className="prod-modal-head">
          <strong className="prod-card-ref">{job.jobRef}</strong>
          <span className="prod-modal-product">{job.productName}</span>
          {job.qty > 1 && <span className="prod-card-qty">×{job.qty}</span>}
        </div>

        {!done ? (
          <div className={`prod-modal-due prod-due-${u.level}`}>
            📅 Due {fmtDue(job.dueDate)}
            {u.label && <span className="prod-due-badge">{u.label}</span>}
            {job.workingDays != null && <span className="prod-modal-wd">{job.workingDays} working days</span>}
          </div>
        ) : (
          <div className="prod-modal-due prod-due-done">
            ✓ {job.status === "collection" ? "Collected" : "Shipped"}{" "}
            {job.completedAt ? fmtActivityTime(job.completedAt) : ""}
          </div>
        )}

        <div className="prod-modal-grid">
          {job.customerName && <div><span>Customer</span>{job.customerName}</div>}
          {job.collect && <div><span>Collect</span>{job.collect}</div>}
          {job.deliveryMethod && <div><span>Delivery</span>{job.deliveryMethod}</div>}
          {job.orderDate && <div><span>Ordered</span>{new Date(job.orderDate).toLocaleDateString("en-MY", { day: "2-digit", month: "short", year: "numeric" })}</div>}
        </div>

        {specOptions.length > 0 && (
          <div className="prod-modal-opts">
            {specOptions.map((o) => (
              <span key={o.label}>
                <b>{o.label}:</b> {o.value}
              </span>
            ))}
          </div>
        )}

        {arts.length > 0 && (
          <div className="prod-modal-arts">
            {arts.map((a, i) => (
              <a key={i} href={a.url} target="_blank" rel="noreferrer" className="adm-edit-link">
                ↓ {a.name || "Artwork"}
              </a>
            ))}
          </div>
        )}

        <label className="prod-modal-label">Move to stage</label>
        <select
          className="adm-select"
          value={stageValueOf(job)}
          disabled={moving}
          onChange={(e) => doMove(e.target.value)}
        >
          {STAGE_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>

        <label className="prod-modal-label">Description</label>
        <textarea
          className="adm-input prod-modal-note"
          rows={3}
          placeholder="Production notes for this job…"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <div className="prod-modal-note-actions">
          <button type="button" className="hero-btn primary" disabled={savingNote || note === (job.productionNote ?? "")} onClick={saveNote}>
            {savingNote ? "Saving…" : "Save description"}
          </button>
        </div>

        <div className="prod-modal-label">Activity</div>
        <div className="prod-activity">
          {loadingAct && <div className="adm-card-sub">Loading…</div>}
          {!loadingAct && activity.length === 0 && <div className="adm-card-sub">No activity yet.</div>}
          {activity.map((a, i) => (
            <div key={i} className="prod-activity-row">
              <div className="prod-activity-text">
                <strong>{a.actor}</strong> {a.text}
              </div>
              <div className="prod-activity-time">{fmtActivityTime(a.at)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
