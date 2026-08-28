"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api, type ProductionJob } from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";
import { canOperate } from "@/lib/adminPerms";

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
// Each column maps 1:1 to a customer status — moving a card here sets that
// status on the order. The stage sent to the backend equals the column key.
const COLUMNS: Col[] = [
  { key: "in_progress", title: "Job In Progress", stage: "in_progress", hint: "New orders land here" },
  { key: "router_3d", title: "Router & 3D Printer", stage: "router_3d" },
  { key: "qc", title: "QC", stage: "qc" },
  { key: "staged", title: "Ready for AC / RS", stage: "staged", hint: "Finished early — set a release time" },
  { key: "ready", title: "Available for Collection", stage: "ready", hint: "Self-collect — customer notified" },
  { key: "shipped", title: "Ready to Ship", stage: "shipped", hint: "Fill in the driver / courier details" },
  { key: "collection", title: "Collected", stage: "collection" },
  { key: "delivered", title: "Shipped", stage: "delivered" },
];

// The two "finished" columns (grouped by month, no urgency colour).
const DONE_LANES = ["collection", "delivered"];
const isDoneLane = (lane: string) => DONE_LANES.includes(lane);

// The dropdown a card offers to move between stages (values = column keys).
const STAGE_OPTIONS: { value: string; label: string }[] = [
  { value: "in_progress", label: "Job In Progress" },
  { value: "router_3d", label: "Router & 3D Printer" },
  { value: "qc", label: "QC" },
  { value: "staged", label: "Ready for AC / RS" },
  { value: "ready", label: "Available for Collection" },
  { value: "shipped", label: "Ready to Ship" },
  { value: "collection", label: "Collected" },
  { value: "delivered", label: "Shipped" },
];
// Columns that support "select many → advance to the next stage in one go".
const NEXT_STAGE: Record<string, { stage: string; label: string }> = {
  ready: { stage: "collection", label: "Collected" },
  shipped: { stage: "delivered", label: "Shipped" },
};
const hasPhoto = (j: ProductionJob) => Array.isArray(j.handoverPhotos) && j.handoverPhotos.length > 0;
const hasDriver = (j: ProductionJob) => !!(j.deliveryNote && j.deliveryNote.trim());
// A job can advance to the next (hand-over) stage only once its requirements are
// met: a handover photo everywhere, plus driver details for Ready to Ship.
function canAdvance(j: ProductionJob, laneKey: string): boolean {
  if (laneKey === "ready") return hasPhoto(j);
  if (laneKey === "shipped") return hasPhoto(j) && hasDriver(j);
  return true;
}
// Tail stages change the customer status → confirm (and email) before moving.
const CONFIRM_STAGE: Record<string, string> = {
  ready: "Available for Collection",
  shipped: "Ready to Ship",
  collection: "Collected",
  delivered: "Shipped",
};

// Which board column a job falls into, from its status + production stage.
function laneOf(j: ProductionJob): string {
  // New (waiting/pending) jobs land directly in Job In Progress.
  if (j.status === "waiting" || j.status === "pending_confirmation") return "in_progress";
  if (j.status === "processing") {
    if (j.productionStage === "router_3d") return "router_3d";
    if (j.productionStage === "qc") return "qc";
    if (j.productionStage === "staged") return "staged";
    return "in_progress";
  }
  if (j.status === "ready") return "ready";
  if (j.status === "shipped") return "shipped";
  if (j.status === "collection") return "collection";
  if (j.status === "delivered") return "delivered";
  return "in_progress";
}

// The dropdown's current value for a job = its lane (columns are 1:1 with stages).
function stageValueOf(j: ProductionJob): string {
  return laneOf(j);
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

type Urgency = { level: "none" | "ok" | "soon" | "today" | "overdue" | "ontime" | "late"; label: string };
// A job's urgency. In production (Job In Progress / Router / QC) it's a live
// countdown vs the due date. Once finished (Available for Collection / Ready to
// Ship) it becomes a fixed record: on time (cyan) or late (red), no countdown.
// Done columns (Collected / Shipped) show nothing.
function urgencyOf(j: ProductionJob, now: { today: string; hour: number }): Urgency {
  const lane = laneOf(j);
  // Finished jobs (Available for Collection / Ready to Ship, and the done
  // columns Collected / Shipped) show a fixed on-time / late record.
  if (lane === "ready" || lane === "shipped" || isDoneLane(lane)) {
    if (!j.dueDate) return { level: "none", label: "" };
    const ref = j.finishedAt ?? j.completedAt;
    const finishedDay = ref ? klDayOf(ref) : now.today;
    return finishedDay <= j.dueDate
      ? { level: "ontime", label: "On time" }
      : { level: "late", label: "Completed late" };
  }
  if (!j.dueDate) return { level: "none", label: "No due date" };
  const diff = daysBetween(j.dueDate, now.today); // >0 future, 0 today, <0 past
  if (diff > 0) return { level: diff <= 1 ? "soon" : "ok", label: diff === 1 ? "Due tomorrow" : `${diff} days left` };
  if (diff === 0) {
    // Due today counts as "due today" for the WHOLE day (until midnight KL).
    // It only flips to overdue once the calendar rolls to the next day (diff < 0).
    return { level: "today", label: "Due TODAY" };
  }
  const late = -diff;
  return { level: "overdue", label: `Overdue by ${late} day${late === 1 ? "" : "s"}` };
}
// The Malaysia calendar day (YYYY-MM-DD) of an ISO timestamp.
function klDayOf(iso: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kuala_Lumpur", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date(iso));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}
// Malaysia month (YYYY-MM) of a timestamp, and a "September 2026" label for it.
function klMonthOf(iso: string | null): string {
  return iso ? klDayOf(iso).slice(0, 7) : "";
}
function monthLabelOf(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-MY", { month: "long", year: "numeric" });
}
// How long a job has been sitting in its current (Available for Collection /
// Ready to Ship) stage — since it finished production. Escalates the colour so a
// job left too long (e.g. driver info not filled) stands out.
function dwellOf(fromISO: string | null): { text: string; level: "ok" | "warn" | "bad" } | null {
  if (!fromISO) return null;
  const ms = Date.now() - new Date(fromISO).getTime();
  if (ms < 0) return null;
  const totalMin = Math.floor(ms / 60000);
  const d = Math.floor(totalMin / 1440);
  const h = Math.floor((totalMin % 1440) / 60);
  const m = totalMin % 60;
  const text = d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${m}m` : `${m}m`;
  const hours = ms / 3600000;
  const level = hours >= 72 ? "bad" : hours >= 24 ? "warn" : "ok";
  return { text, level };
}

function fmtDue(d: string | null): string {
  if (!d) return "—";
  const dt = new Date(d + "T00:00:00");
  return dt.toLocaleDateString("en-MY", { weekday: "short", day: "2-digit", month: "short", year: "numeric" });
}

export default function AdminProduction() {
  const { user } = useAuth();
  // Read-only when the admin only has 'view' on Production Flow: they can see the
  // board but not move cards or edit anything (the backend also blocks writes).
  const readOnly = !canOperate(user, "production-flow");
  const [jobs, setJobs] = useState<ProductionJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [openJobId, setOpenJobId] = useState<number | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  // Which month each done column (Collected / Shipped) is viewing (YYYY-MM);
  // defaults to the current month.
  const [doneMonth, setDoneMonth] = useState<Record<string, string>>({});
  const [query, setQuery] = useState("");
  // Re-render every minute so the "due today / overdue" colours stay live.
  const [, setTick] = useState(0);

  const load = useCallback(async () => {
    try {
      const r = await api.adminProduction();
      setJobs(r.jobs);
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
    // Order every column tidily by job number (100020-1, 100020-2, 100021-1, …).
    // Done columns first group by completion month (recent first), then number.
    const byNumber = (a: ProductionJob, b: ProductionJob) =>
      a.ref.localeCompare(b.ref, undefined, { numeric: true, sensitivity: "base" }) || a.jobNo - b.jobNo;
    for (const key of Object.keys(map)) {
      if (isDoneLane(key)) {
        map[key].sort((a, b) => {
          const mo = (b.completedAt ?? "").slice(0, 7).localeCompare((a.completedAt ?? "").slice(0, 7));
          return mo !== 0 ? mo : byNumber(a, b);
        });
      } else {
        map[key].sort(byNumber);
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
    if (stage === "delivered" && !hasDriver(j)) {
      alert("Fill in the driver / delivery details first before marking this job as Shipped.");
      return;
    }
    if ((stage === "collection" || stage === "delivered") && !hasPhoto(j)) {
      alert("Upload a handover photo (open the card) before moving this job here.");
      return;
    }
    // Marking an overdue job done requires a reason in the Description.
    if ((stage === "ready" || stage === "shipped") && j.dueDate && daysBetween(j.dueDate, now.today) < 0 && !(j.productionNote && j.productionNote.trim())) {
      alert("This job is overdue — open the card and write (and save) the reason in the Description before moving it here.");
      return;
    }
    if (CONFIRM_STAGE[stage] && !window.confirm(`Mark ${j.jobRef} as "${CONFIRM_STAGE[stage]}"? The customer status changes${stage === "delivered" ? "" : " and they will be emailed"}.`)) return;
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

  function toggleSelect(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleSelectAll(laneKey: string, laneJobs: ProductionJob[]) {
    setSelected((prev) => {
      const next = new Set(prev);
      const allOn = laneJobs.every((j) => next.has(j.id));
      for (const j of laneJobs) allOn ? next.delete(j.id) : next.add(j.id);
      return next;
    });
  }
  // Advance every SELECTED card in a column to that column's next stage in one go.
  async function bulkAdvance(laneKey: string, laneJobs: ProductionJob[]) {
    const info = NEXT_STAGE[laneKey];
    const picked = laneJobs.filter((j) => selected.has(j.id));
    if (!info || picked.length === 0) return;
    if (!window.confirm(`Move ${picked.length} job(s) to "${info.label}"? The customer status changes${info.stage === "delivered" ? "" : " and they will be emailed"}.`)) return;
    setBulkBusy(true);
    try {
      for (const j of picked) {
        await api.adminSetProductionStage(j.orderId, j.id, info.stage);
      }
      setSelected(new Set());
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Could not move the jobs");
      await load();
    } finally {
      setBulkBusy(false);
    }
  }


  return (
    <div className="prod-wrap">
      <div className="prod-head">
        <div>
          <h1>Production</h1>
          <p className="adm-card-sub">
            Every job on the floor, due dates from working days. Orange = due today · Red = overdue (from the next day).
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
        </div>
      </div>

      {readOnly && (
        <div className="prod-readonly-note">👁 View-only access — you can browse the board but can’t move cards or make changes.</div>
      )}
      {loading && <div className="quote-empty">Loading the board…</div>}
      {error && <div className="quote-empty">{error}</div>}

      {!loading && !error && (
        <div className="prod-board">
          {COLUMNS.map((col) => {
            const list = byLane[col.key] ?? [];
            const next = NEXT_STAGE[col.key];
            // Only jobs whose hand-over requirements are met (photo everywhere,
            // + driver for Ready to Ship) can be selected / advanced.
            const selectableList = next ? list.filter((j) => canAdvance(j, col.key)) : [];
            const selCount = selectableList.filter((j) => selected.has(j.id)).length;
            const allSel = selectableList.length > 0 && selectableList.every((j) => selected.has(j.id));
            const doneSel = isDoneLane(col.key) ? (doneMonth[col.key] ?? now.today.slice(0, 7)) : null;
            const headerCount = doneSel ? list.filter((j) => klMonthOf(j.completedAt) === doneSel).length : list.length;
            return (
              <div key={col.key} className="prod-col">
                <div className="prod-col-head">
                  <span className="prod-col-title">{col.title}</span>
                  <span className="prod-col-count">{headerCount}</span>
                </div>
                {col.hint && <div className="prod-col-hint">{col.hint}</div>}
                {next && list.length > 0 && !readOnly && (
                  <div className="prod-bulk">
                    <label className="prod-bulk-all">
                      <input type="checkbox" checked={!!allSel} disabled={selectableList.length === 0} onChange={() => toggleSelectAll(col.key, selectableList)} /> Select all
                    </label>
                    <button
                      type="button"
                      className="hero-btn primary prod-bulk-btn"
                      disabled={selCount === 0 || bulkBusy}
                      onClick={() => bulkAdvance(col.key, selectableList)}
                    >
                      {bulkBusy ? "Moving…" : `→ ${next.label} (${selCount})`}
                    </button>
                  </div>
                )}
                <div className="prod-col-body">
                  {isDoneLane(col.key)
                    ? renderDoneMonth(col.key, list)
                    : list.map((j) => (
                        <ProductionCard
                          key={j.id}
                          job={j}
                          now={now}
                          saving={savingId === j.id}
                          onOpen={(x) => setOpenJobId(x.id)}
                          selectable={!!next && !readOnly}
                          canSelect={canAdvance(j, col.key)}
                          checked={selected.has(j.id)}
                          onToggle={() => toggleSelect(j.id)}
                        />
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
          readOnly={readOnly}
          onClose={() => setOpenJobId(null)}
          onMove={move}
          onSavedNote={load}
        />
      )}
    </div>
  );

  // A done column (Collected / Shipped) shows ONE month at a time — defaulting to
  // the current month — with a picker to look back at earlier months.
  function renderDoneMonth(key: string, list: ProductionJob[]) {
    const curMonth = now.today.slice(0, 7);
    const present = [...new Set(list.map((j) => klMonthOf(j.completedAt)).filter(Boolean))];
    const months = [...new Set([curMonth, ...present])].sort().reverse();
    const sel = doneMonth[key] ?? curMonth;
    const shown = list.filter((j) => klMonthOf(j.completedAt) === sel);
    return (
      <>
        <div className="prod-month-pick">
          <select value={sel} onChange={(e) => setDoneMonth((p) => ({ ...p, [key]: e.target.value }))}>
            {months.map((m) => (
              <option key={m} value={m}>
                {monthLabelOf(m)} ({list.filter((j) => klMonthOf(j.completedAt) === m).length})
              </option>
            ))}
          </select>
        </div>
        {shown.length === 0 && <div className="prod-empty">No jobs in {monthLabelOf(sel)}</div>}
        {shown.map((j) => (
          <ProductionCard key={j.id} job={j} now={now} saving={savingId === j.id} onOpen={(x) => setOpenJobId(x.id)} />
        ))}
      </>
    );
  }
}

// Compact card: just the job number, due date and its urgency badge. Everything
// else lives in the detail modal, opened on click.
function ProductionCard({
  job,
  now,
  saving,
  onOpen,
  selectable = false,
  canSelect = true,
  checked = false,
  onToggle,
}: {
  job: ProductionJob;
  now: { today: string; hour: number };
  saving: boolean;
  onOpen: (j: ProductionJob) => void;
  selectable?: boolean;
  canSelect?: boolean;
  checked?: boolean;
  onToggle?: () => void;
}) {
  const u = urgencyOf(job, now);
  const lane = laneOf(job);
  const done = isDoneLane(lane);
  const hasDelivery = !!(job.deliveryNote && job.deliveryNote.trim());
  // How long it's been sitting in Available for Collection / Ready to Ship.
  const dw = lane === "ready" || lane === "shipped" ? dwellOf(job.finishedAt) : null;
  const missClass = dw?.level === "bad" ? "prod-driver-late" : "prod-driver-missing";
  return (
    <div className={`prod-card-wrap${checked ? " is-selected" : ""}`}>
      {selectable && (
        <input
          type="checkbox"
          className="prod-card-check"
          checked={checked}
          disabled={!canSelect}
          onChange={onToggle}
          onClick={(e) => e.stopPropagation()}
          title={canSelect ? `Select ${job.jobRef}` : "Fill the driver / delivery details first"}
          aria-label={`Select ${job.jobRef}`}
        />
      )}
      <button type="button" className={`prod-card prod-${u.level}${saving ? " is-saving" : ""}${selectable ? " is-selectable" : ""}`} onClick={() => onOpen(job)}>
      <div className="prod-card-top">
        <strong className="prod-card-ref">{job.jobRef}</strong>
        {job.qty > 1 && <span className="prod-card-qty">×{job.qty}</span>}
        {job.productionNote && <span className="prod-card-hasnote" title="Has a description">📝</span>}
      </div>
      {done ? (
        <div className={`prod-due prod-due-${u.level}`}>
          <span className="prod-due-date">✓ {job.completedAt ? fmtStamp(job.completedAt) : "Done"}</span>
          {u.label && <span className="prod-due-badge">{u.label}</span>}
        </div>
      ) : (
        <div className={`prod-due prod-due-${u.level}`}>
          <span className="prod-due-date">{fmtDueShort(job.dueDate)}</span>
          {u.label && <span className="prod-due-badge">{u.label}</span>}
        </div>
      )}
      {lane === "shipped" &&
        (hasDelivery ? (
          <div className="prod-driver prod-driver-ok">✓ Driver arranged</div>
        ) : (
          <div className={`prod-driver ${missClass}`}>⚠ Fill driver info{dw ? ` · pending ${dw.text}` : ""}</div>
        ))}
      {(lane === "ready" || lane === "shipped") &&
        (hasPhoto(job) ? (
          <div className="prod-driver prod-driver-ok">✓ Photo added</div>
        ) : (
          <div className="prod-driver prod-driver-missing">⚠ Add photo</div>
        ))}
      {lane === "ready" && dw && (
        <div className={`prod-dwell prod-dwell-${dw.level}`}>⏱ Awaiting pickup · {dw.text}</div>
      )}
      {lane === "staged" &&
        (job.scheduledReleaseAt && job.scheduledReleaseTo ? (
          <div className="prod-driver prod-sched">
            🕒 → {job.scheduledReleaseTo === "ready" ? "Collection" : "Ready to Ship"}
            <br />
            {fmtStamp(job.scheduledReleaseAt)}
          </div>
        ) : (
          <div className="prod-driver prod-driver-missing">⚠ Set release time</div>
        ))}
      </button>
    </div>
  );
}

function fmtDueShort(d: string | null): string {
  if (!d) return "No due date";
  const dt = new Date(d + "T00:00:00");
  return dt.toLocaleDateString("en-MY", { day: "2-digit", month: "short" });
}
// Full date + time a job reached this (Collected / Shipped) stage.
function fmtStamp(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-MY", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true,
  });
}

// An absolute ISO time → a <input type="datetime-local"> value in Malaysia wall time.
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kuala_Lumpur", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(new Date(iso));
  const g = (t: string) => p.find((x) => x.type === t)?.value ?? "";
  let hh = g("hour");
  if (hh === "24") hh = "00";
  return `${g("year")}-${g("month")}-${g("day")}T${hh}:${g("minute")}`;
}
// A datetime-local value (Malaysia wall time) → an absolute ISO with the +08:00 offset.
function fromLocalInput(v: string): string {
  return v.length === 16 ? `${v}:00+08:00` : `${v}+08:00`;
}

function fmtActivityTime(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString("en-MY", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true,
  });
}

// Driver / courier details for the "Ready to Ship" step (same shape as the
// Orders drawer courier modal: "Courier: X · Tracking No: Y · Contact: Z").
const COURIERS = ["DHL", "Xendnow", "J&T", "Easy Parcel", "Ninja Van", "Other"];
function parseDriver(note: string | null): { courier: string; tracking: string; phone: string } {
  const out = { courier: "", tracking: "", phone: "" };
  if (!note || !note.trim()) return out;
  const parts = note.split(new RegExp("\\s*[\\u00B7\\u2022\\u2219\\u30FB]\\s*|\\n|;")).map((s) => s.trim()).filter(Boolean);
  for (const p of parts) {
    const i = p.indexOf(":");
    if (i < 0) continue;
    const k = p.slice(0, i).trim().toLowerCase();
    const v = p.slice(i + 1).trim();
    if (k.startsWith("courier")) out.courier = v;
    else if (k.startsWith("tracking")) out.tracking = v;
    else if (k.startsWith("contact") || k.startsWith("phone")) out.phone = v;
  }
  return out;
}
function buildDriverNote(courier: string, tracking: string, phone: string): string {
  const parts: string[] = [];
  if (courier.trim()) parts.push("Courier: " + courier.trim());
  if (tracking.trim()) parts.push("Tracking No: " + tracking.trim());
  if (phone.trim()) parts.push("Contact: " + phone.trim());
  // Join with a guaranteed U+00B7 middot (source-file encoding can mangle a typed
  // one) so the member-side parser splits it back into rows.
  return parts.join(" · ");
}

// Card detail modal: full job info, an editable Description, the stage mover, and
// the activity log (who moved it / edited it, and when).
function JobModal({
  job,
  now,
  readOnly = false,
  onClose,
  onMove,
  onSavedNote,
}: {
  job: ProductionJob;
  now: { today: string; hour: number };
  readOnly?: boolean;
  onClose: () => void;
  onMove: (j: ProductionJob, stage: string) => Promise<void>;
  onSavedNote: () => void;
}) {
  const [note, setNote] = useState(job.productionNote ?? "");
  const [activity, setActivity] = useState<{ actor: string; text: string | null; at: string | null }[]>([]);
  const [loadingAct, setLoadingAct] = useState(true);
  const [savingNote, setSavingNote] = useState(false);
  const [moving, setMoving] = useState(false);
  // Driver / courier details (Ready to Ship), prefilled from the saved note.
  const driver0 = parseDriver(job.deliveryNote);
  const [courier, setCourier] = useState(driver0.courier ? (COURIERS.includes(driver0.courier) ? driver0.courier : "Other") : "DHL");
  const [courierOther, setCourierOther] = useState(driver0.courier && !COURIERS.includes(driver0.courier) ? driver0.courier : "");
  const [tracking, setTracking] = useState(driver0.tracking);
  const [phone, setPhone] = useState(driver0.phone);
  const [savingDriver, setSavingDriver] = useState(false);
  // Handover / proof photos (Available for Collection & Ready to Ship).
  const [photos, setPhotos] = useState<{ url: string; name?: string }[]>(job.handoverPhotos ?? []);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  // QC photos (QC stage). Separate set; shown to the customer at Available for Collection.
  const [qcPhotos, setQcPhotos] = useState<{ url: string; name?: string }[]>(job.qcPhotos ?? []);
  const [uploadingQc, setUploadingQc] = useState(false);
  // Scheduled release (Ready for AC / RS staging).
  const [scheduleAt, setScheduleAt] = useState(toLocalInput(job.scheduledReleaseAt));
  const [scheduleTo, setScheduleTo] = useState<"ready" | "shipped">((job.scheduledReleaseTo as "ready" | "shipped") || "ready");
  const [savingSchedule, setSavingSchedule] = useState(false);

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

  async function saveDriver() {
    const finalCourier = courier === "Other" ? courierOther : courier;
    const noteStr = buildDriverNote(finalCourier, tracking, phone);
    if (!noteStr) {
      alert("Enter the courier / driver details first.");
      return;
    }
    setSavingDriver(true);
    try {
      await api.adminUpdateNativeItemDelivery(job.orderId, job.id, noteStr);
      await loadActivity();
      onSavedNote();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Could not save driver details");
    } finally {
      setSavingDriver(false);
    }
  }

  async function addPhotos(files: FileList) {
    setUploadingPhoto(true);
    try {
      const uploaded: { url: string; name?: string }[] = [];
      for (const f of Array.from(files)) {
        const r = await api.adminUploadPhoto(f);
        uploaded.push({ url: r.url, name: f.name });
      }
      const next = [...photos, ...uploaded];
      setPhotos(next);
      await api.adminSaveProductionPhotos(job.orderId, job.id, next);
      onSavedNote();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Could not upload the photo");
    } finally {
      setUploadingPhoto(false);
    }
  }
  async function removePhoto(url: string) {
    const next = photos.filter((p) => p.url !== url);
    setPhotos(next);
    try {
      await api.adminSaveProductionPhotos(job.orderId, job.id, next);
      onSavedNote();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Could not remove the photo");
    }
  }
  async function addQcPhotos(files: FileList) {
    setUploadingQc(true);
    try {
      const uploaded: { url: string; name?: string }[] = [];
      for (const f of Array.from(files)) {
        const r = await api.adminUploadPhoto(f);
        uploaded.push({ url: r.url, name: f.name });
      }
      const next = [...qcPhotos, ...uploaded];
      setQcPhotos(next);
      await api.adminSaveProductionQcPhotos(job.orderId, job.id, next);
      onSavedNote();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Could not upload the QC photo");
    } finally {
      setUploadingQc(false);
    }
  }
  async function removeQcPhoto(url: string) {
    const next = qcPhotos.filter((p) => p.url !== url);
    setQcPhotos(next);
    try {
      await api.adminSaveProductionQcPhotos(job.orderId, job.id, next);
      onSavedNote();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Could not remove the QC photo");
    }
  }

  async function saveSchedule() {
    if (!scheduleAt) {
      alert("Pick the release date & time first.");
      return;
    }
    setSavingSchedule(true);
    try {
      await api.adminScheduleRelease(job.orderId, job.id, fromLocalInput(scheduleAt), scheduleTo);
      await loadActivity();
      onSavedNote();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Could not schedule the release");
    } finally {
      setSavingSchedule(false);
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
            {laneOf(job) === "ready" && job.finishedAt && (() => {
              const dw = dwellOf(job.finishedAt);
              return dw ? <span className={`prod-modal-dwell prod-dwell-${dw.level}`}>⏱ Awaiting pickup · {dw.text}</span> : null;
            })()}
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

        {readOnly && (
          <div className="prod-readonly-note" style={{ margin: "10px 0 0" }}>👁 View-only — you can’t change this job.</div>
        )}

        <label className="prod-modal-label">{readOnly ? "Stage" : "Move to stage"}</label>
        <select
          className="adm-select"
          value={stageValueOf(job)}
          disabled={moving || readOnly}
          onChange={(e) => doMove(e.target.value)}
        >
          {STAGE_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>

        {laneOf(job) === "staged" && (
          <div className="prod-sched-box">
            <div className="prod-modal-label">
              Auto-release schedule{" "}
              {job.scheduledReleaseAt ? (
                <span className="prod-driver-ok">✓ scheduled</span>
              ) : (
                <span className="prod-driver-missing">⚠ not set</span>
              )}
            </div>
            <p className="adm-card-sub" style={{ margin: "0 0 6px" }}>
              Finished early — it stays here until this time, then auto-moves (and notifies the customer).
            </p>
            <div className="prod-sched-form">
              <label className="prod-sched-lbl">Release to</label>
              <select className="adm-select" value={scheduleTo} disabled={savingSchedule || readOnly} onChange={(e) => setScheduleTo(e.target.value as "ready" | "shipped")}>
                <option value="ready">Available for Collection</option>
                <option value="shipped">Ready to Ship</option>
              </select>
              <label className="prod-sched-lbl">Release at (Malaysia time)</label>
              <input type="datetime-local" className="adm-input" value={scheduleAt} disabled={savingSchedule || readOnly} onChange={(e) => setScheduleAt(e.target.value)} />
              {!readOnly && (
                <button type="button" className="hero-btn primary" disabled={savingSchedule} onClick={saveSchedule}>
                  {savingSchedule ? "Saving…" : "Save schedule"}
                </button>
              )}
            </div>
          </div>
        )}

        {laneOf(job) === "shipped" && (
          <div className="prod-driver-box">
            <div className="prod-modal-label">
              Driver / Delivery details{" "}
              {job.deliveryNote && job.deliveryNote.trim() ? (
                <span className="prod-driver-ok">✓ arranged</span>
              ) : (
                <span className="prod-driver-missing">⚠ not arranged — fill below</span>
              )}
            </div>
            <div className="prod-driver-form">
              <select className="adm-select" value={courier} disabled={savingDriver || readOnly} onChange={(e) => setCourier(e.target.value)}>
                {COURIERS.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              {courier === "Other" && (
                <input className="adm-input" placeholder="Courier name" value={courierOther} disabled={savingDriver || readOnly} onChange={(e) => setCourierOther(e.target.value)} />
              )}
              <input className="adm-input" placeholder="Tracking number" value={tracking} disabled={savingDriver || readOnly} onChange={(e) => setTracking(e.target.value)} />
              <input className="adm-input" placeholder="Contact phone" value={phone} disabled={savingDriver || readOnly} onChange={(e) => setPhone(e.target.value)} />
              {!readOnly && (
                <button type="button" className="hero-btn primary" disabled={savingDriver} onClick={saveDriver}>
                  {savingDriver ? "Saving…" : "Save driver details"}
                </button>
              )}
            </div>
          </div>
        )}

        {laneOf(job) === "qc" && (
          <>
            <label className="prod-modal-label">QC photos</label>
            <p className="adm-card-sub" style={{ margin: "0 0 6px" }}>
              QC photos of this job — the customer can view these once it&apos;s Available for Collection. Optional.
            </p>
            <div className="prod-photos">
              {qcPhotos.map((p, i) => (
                <div key={i} className="prod-photo">
                  <a href={p.url} target="_blank" rel="noreferrer">
                    <img src={p.url} alt={p.name || "QC photo"} />
                  </a>
                  {!readOnly && (
                    <button type="button" className="prod-photo-x" onClick={() => removeQcPhoto(p.url)} aria-label="Remove photo">
                      ×
                    </button>
                  )}
                </div>
              ))}
              {readOnly && qcPhotos.length === 0 && <div className="prod-empty">No photos</div>}
              {!readOnly && (
                <label className={`prod-photo-add${uploadingQc ? " is-busy" : ""}`}>
                  {uploadingQc ? "Uploading…" : "＋ Add photo"}
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    hidden
                    disabled={uploadingQc}
                    onChange={(e) => e.target.files && e.target.files.length && addQcPhotos(e.target.files)}
                  />
                </label>
              )}
            </div>
          </>
        )}

        {(laneOf(job) === "ready" || laneOf(job) === "shipped") && (
          <>
            <label className="prod-modal-label">Handover / proof photos</label>
            <p className="adm-card-sub" style={{ margin: "0 0 6px" }}>
              Photo of the goods at collection / ship-out — the customer can view it later.
            </p>
            <div className="prod-photos">
              {photos.map((p, i) => (
                <div key={i} className="prod-photo">
                  <a href={p.url} target="_blank" rel="noreferrer">
                    <img src={p.url} alt={p.name || "Handover photo"} />
                  </a>
                  {!readOnly && (
                    <button type="button" className="prod-photo-x" onClick={() => removePhoto(p.url)} aria-label="Remove photo">
                      ×
                    </button>
                  )}
                </div>
              ))}
              {readOnly && photos.length === 0 && <div className="prod-empty">No photos</div>}
              {!readOnly && (
                <label className={`prod-photo-add${uploadingPhoto ? " is-busy" : ""}`}>
                  {uploadingPhoto ? "Uploading…" : "＋ Add photo"}
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    hidden
                    disabled={uploadingPhoto}
                    onChange={(e) => e.target.files && e.target.files.length && addPhotos(e.target.files)}
                  />
                </label>
              )}
            </div>
          </>
        )}

        <label className="prod-modal-label">Description</label>
        <textarea
          className="adm-input prod-modal-note"
          rows={3}
          placeholder={readOnly ? "" : "Production notes for this job…"}
          value={note}
          readOnly={readOnly}
          onChange={(e) => setNote(e.target.value)}
        />
        {!readOnly && (
          <div className="prod-modal-note-actions">
            <button type="button" className="hero-btn primary" disabled={savingNote || note === (job.productionNote ?? "")} onClick={saveNote}>
              {savingNote ? "Saving…" : "Save description"}
            </button>
          </div>
        )}

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
