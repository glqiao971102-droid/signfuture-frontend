"use client";

import { useCallback, useEffect, useState } from "react";
import { api, type AdminActivity, type ActivityVisitor, type AdminActivityMonthly } from "@/lib/api";

function todayISO(): string {
  return new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD, local
}
function thisMonthISO(): string {
  return new Date().toLocaleDateString("en-CA").slice(0, 7); // YYYY-MM, local
}
function dateOf(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleDateString("en-MY", { day: "2-digit", month: "short", timeZone: "Asia/Kuala_Lumpur" });
}
function timeOf(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleTimeString("en-MY", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
        timeZone: "Asia/Kuala_Lumpur",
      });
}

type ActionMeta = {
  price?: number;
  product?: string;
  url?: string;
  files?: { url: string; name?: string }[];
};

function actionLabel(a: ActivityVisitor["actions"][number]): string {
  const meta = (a.meta ?? {}) as ActionMeta;
  if (a.action === "add_to_cart") {
    const price = typeof meta.price === "number" ? ` — RM ${meta.price.toFixed(2)}` : "";
    return `🛒 Configured “${a.label}”${price}`;
  }
  if (a.action === "login") return "🔑 Logged in";
  if (a.action === "upload") {
    const p = meta.product ? ` (${meta.product})` : "";
    return `📎 Uploaded “${a.label}”${p}`;
  }
  return `${a.action}${a.label ? ` · ${a.label}` : ""}`;
}

/** Files attached to an action (the uploaded artwork), for a download link. */
function actionFiles(a: ActivityVisitor["actions"][number]): { url: string; name: string }[] {
  const meta = (a.meta ?? {}) as ActionMeta;
  const out: { url: string; name: string }[] = [];
  if (typeof meta.url === "string") out.push({ url: meta.url, name: a.label || "file" });
  if (Array.isArray(meta.files)) for (const f of meta.files) if (f?.url) out.push({ url: f.url, name: f.name || "file" });
  return out;
}

/** Download URL that carries the original filename (backend sets it via ?name). */
function fileHref(f: { url: string; name: string }): string {
  const sep = f.url.includes("?") ? "&" : "?";
  return `${f.url}${sep}name=${encodeURIComponent(f.name)}`;
}

function VisitorCard({
  v,
  open,
  onToggle,
}: {
  v: ActivityVisitor;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div className={`vis-card${v.isMember ? " is-member" : ""}`}>
      <button type="button" className="vis-head" onClick={onToggle}>
        <span className="vis-id">
          <span className={`vis-badge ${v.isMember ? "is-member" : "is-guest"}`}>
            {v.isMember ? "MEMBER" : "NEW"}
          </span>
          <strong>{v.name}</strong>
          {v.email && <span className="vis-email">{v.email}</span>}
        </span>
        <span className="vis-metrics">
          <span title="Time on site">⏱ {v.durationLabel}</span>
          <span title="Page views">👁 {v.pageviews}</span>
          <span title="Actions">⚡ {v.actions.length}</span>
          <span className="vis-time">
            {timeOf(v.firstSeen)} – {timeOf(v.lastSeen)}
          </span>
          <span className="vis-caret">{open ? "▲" : "▼"}</span>
        </span>
      </button>
      {open && (
        <div className="vis-body">
          <div className="vis-col">
            <h4>Pages viewed</h4>
            {v.pages.length === 0 ? (
              <p className="vis-none">—</p>
            ) : (
              <ul className="vis-pages">
                {v.pages.map((p, i) => (
                  <li key={i}>
                    <span className="vis-path">{p.path}</span>
                    <span className="vis-dwell">
                      {p.dwellLabel}
                      {p.visits > 1 ? ` · ${p.visits}×` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="vis-col">
            <h4>Actions</h4>
            {v.actions.length === 0 ? (
              <p className="vis-none">—</p>
            ) : (
              <ul className="vis-actions">
                {v.actions.map((a, i) => {
                  const files = actionFiles(a);
                  return (
                    <li key={i}>
                      <span className="vis-action-main">
                        {actionLabel(a)}
                        {files.map((f, k) => (
                          <a key={k} className="vis-file" href={fileHref(f)} target="_blank" rel="noreferrer" title={`Download ${f.name}`}>
                            ⤓ {f.name}
                          </a>
                        ))}
                      </span>
                      <span className="vis-at">{timeOf(a.at)}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminVisitors() {
  const [mode, setMode] = useState<"daily" | "monthly">("daily");
  const [date, setDate] = useState(todayISO());
  const [month, setMonth] = useState(thisMonthISO());
  const [data, setData] = useState<AdminActivity | null>(null);
  const [monthData, setMonthData] = useState<AdminActivityMonthly | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  // Uploaded-artwork storage (backup): list months + download a month as a zip.
  const [artworkMonths, setArtworkMonths] = useState<
    { month: string; files: number; sizeMB: number }[] | null
  >(null);
  const [artworkTotalMB, setArtworkTotalMB] = useState<number | null>(null);
  const [downloadingMonth, setDownloadingMonth] = useState<string | null>(null);
  const [artworkMsg, setArtworkMsg] = useState<string | null>(null);

  useEffect(() => {
    api
      .adminArtworkMonths()
      .then((r) => {
        setArtworkMonths(r.months);
        setArtworkTotalMB(r.totalMB);
      })
      .catch(() => setArtworkMonths([]));
  }, []);

  async function downloadMonth(month: string) {
    setDownloadingMonth(month);
    setArtworkMsg(null);
    try {
      const res = await api.adminArtworkArchive(month);
      if (!res.ok) {
        setArtworkMsg(`Download failed (${res.status}).`);
        return;
      }
      const filename = `artwork-${month}.zip`;
      // Stream straight to a file when the browser supports it (avoids buffering
      // a large — up to ~1GB — zip in memory); otherwise fall back to a blob.
      type Picker = (opts: {
        suggestedName?: string;
      }) => Promise<{ createWritable: () => Promise<WritableStream<Uint8Array>> }>;
      const picker = (window as unknown as { showSaveFilePicker?: Picker }).showSaveFilePicker;
      if (picker && res.body) {
        let handle: { createWritable: () => Promise<WritableStream<Uint8Array>> } | null = null;
        try {
          handle = await picker({ suggestedName: filename });
        } catch (e) {
          if ((e as { name?: string }).name === "AbortError") return; // user cancelled
        }
        if (handle) {
          const writable = await handle.createWritable();
          await res.body.pipeTo(writable);
          return;
        }
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (e) {
      setArtworkMsg(e instanceof Error ? e.message : "Download failed.");
    } finally {
      setDownloadingMonth(null);
    }
  }

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (mode === "monthly") setMonthData(await api.adminActivityMonthly(month));
      else setData(await api.adminActivity(date));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load activity.");
    } finally {
      setLoading(false);
    }
  }, [mode, date, month]);
  useEffect(() => {
    void load();
  }, [load]);

  const s = data?.summary;
  const ms = monthData?.summary;

  return (
    <div>
      <div className="adm-page-head">
        <h1>Visitors</h1>
        <p>Who came to the site each day, what they viewed, and how long they stayed.</p>
      </div>

      {/* Uploaded-artwork storage: back a month up as a .zip before clearing space. */}
      <div className="adm-card" style={{ marginBottom: 16 }}>
        <div className="adm-card-head-row">
          <h2>Uploaded artwork — backup</h2>
          {artworkTotalMB != null && (
            <span className="adm-card-sub">{artworkTotalMB} MB on server</span>
          )}
        </div>
        <p className="adm-card-sub" style={{ margin: "0 0 10px" }}>
          Customer-uploaded artwork files, grouped by upload month. Download a month as a
          .zip to keep a backup. (Confirmed orders keep their own copy in SF Dropbox.)
        </p>
        {artworkMonths === null ? (
          <div className="adm-card-sub">Loading…</div>
        ) : artworkMonths.length === 0 ? (
          <div className="adm-card-sub">No uploaded artwork on the server.</div>
        ) : (
          <div className="adm-table-scroll">
            <table className="adm-table">
              <thead>
                <tr>
                  <th>Month</th>
                  <th>Files</th>
                  <th>Size</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {artworkMonths.map((m) => (
                  <tr key={m.month}>
                    <td>{m.month}</td>
                    <td>{m.files}</td>
                    <td>{m.sizeMB} MB</td>
                    <td>
                      <button
                        type="button"
                        className="adm-filter"
                        disabled={downloadingMonth === m.month}
                        onClick={() => downloadMonth(m.month)}
                      >
                        {downloadingMonth === m.month ? "Preparing…" : "↓ Download ZIP"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {artworkMsg && <p className="adm-card-sub">{artworkMsg}</p>}
      </div>

      <div className="vis-toolbar">
        <div className="vis-mode">
          <button type="button" className={`vis-mode-btn${mode === "daily" ? " is-on" : ""}`} onClick={() => setMode("daily")}>
            Daily visitors
          </button>
          <button type="button" className={`vis-mode-btn${mode === "monthly" ? " is-on" : ""}`} onClick={() => setMode("monthly")}>
            Active members (month)
          </button>
        </div>
        {mode === "daily" ? (
          <>
            <label className="vis-datefield">
              <span>Date</span>
              <input type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} />
            </label>
            <button type="button" className="adm-filter" onClick={() => setDate(todayISO())}>
              Today
            </button>
          </>
        ) : (
          <>
            <label className="vis-datefield">
              <span>Month</span>
              <input type="month" value={month} max={thisMonthISO()} onChange={(e) => setMonth(e.target.value)} />
            </label>
            <button type="button" className="adm-filter" onClick={() => setMonth(thisMonthISO())}>
              This month
            </button>
          </>
        )}
      </div>

      {mode === "daily" ? (
        <div className="dash-kpis">
          <div className="dash-kpi is-accent">
            <span className="dash-kpi-label">Visitors</span>
            <strong className="dash-kpi-value">{s?.visitors ?? 0}</strong>
          </div>
          <div className="dash-kpi">
            <span className="dash-kpi-label">Members</span>
            <strong className="dash-kpi-value">{s?.members ?? 0}</strong>
          </div>
          <div className="dash-kpi">
            <span className="dash-kpi-label">New people (guests)</span>
            <strong className="dash-kpi-value">{s?.guests ?? 0}</strong>
          </div>
          <div className="dash-kpi">
            <span className="dash-kpi-label">Page views</span>
            <strong className="dash-kpi-value">{s?.pageviews ?? 0}</strong>
          </div>
          <div className="dash-kpi">
            <span className="dash-kpi-label">Actions</span>
            <strong className="dash-kpi-value">{s?.actions ?? 0}</strong>
          </div>
        </div>
      ) : (
        <div className="dash-kpis">
          <div className="dash-kpi is-accent">
            <span className="dash-kpi-label">Active members</span>
            <strong className="dash-kpi-value">{ms?.activeMembers ?? 0}</strong>
          </div>
          <div className="dash-kpi">
            <span className="dash-kpi-label">Page views</span>
            <strong className="dash-kpi-value">{ms?.pageviews ?? 0}</strong>
          </div>
          <div className="dash-kpi">
            <span className="dash-kpi-label">Actions</span>
            <strong className="dash-kpi-value">{ms?.actions ?? 0}</strong>
          </div>
        </div>
      )}

      {loading && <div className="adm-empty">Loading…</div>}
      {!loading && error && <div className="adm-empty">{error}</div>}

      {/* Daily */}
      {mode === "daily" && !loading && !error && data && data.visitors.length === 0 && (
        <div className="adm-empty">No visitors recorded on this day yet.</div>
      )}
      {mode === "daily" && !loading && !error && data && data.visitors.length > 0 && (
        <div className="vis-list">
          {data.visitors.map((v) => (
            <VisitorCard
              key={v.visitorId}
              v={v}
              open={open === v.visitorId}
              onToggle={() => setOpen(open === v.visitorId ? null : v.visitorId)}
            />
          ))}
        </div>
      )}

      {/* Monthly active members */}
      {mode === "monthly" && !loading && !error && monthData && monthData.members.length === 0 && (
        <div className="adm-empty">No members were active in this month yet.</div>
      )}
      {mode === "monthly" && !loading && !error && monthData && monthData.members.length > 0 && (
        <div className="vis-list">
          {monthData.members.map((m, i) => (
            <div key={m.userId} className="vis-card is-member vis-member-row">
              <span className="vis-rank">{i + 1}</span>
              <span className="vis-id">
                <span className="vis-badge is-member">MEMBER</span>
                <strong>{m.name}</strong>
                {m.email && <span className="vis-email">{m.email}</span>}
              </span>
              <span className="vis-metrics">
                <span title="Active days this month">📅 {m.days} day{m.days === 1 ? "" : "s"}</span>
                <span title="Page views">👁 {m.pageviews}</span>
                <span title="Actions">⚡ {m.actions}</span>
                {m.uploads > 0 && <span title="Uploads / configured items">📎 {m.uploads}</span>}
                <span className="vis-time" title="Last active">last: {dateOf(m.lastSeen)}</span>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
