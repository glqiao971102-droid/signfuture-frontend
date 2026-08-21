"use client";

import { useCallback, useEffect, useState } from "react";
import { api, type AdminActivity, type ActivityVisitor } from "@/lib/api";

function todayISO(): string {
  return new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD, local
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
  const [date, setDate] = useState(todayISO());
  const [data, setData] = useState<AdminActivity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await api.adminActivity(date));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load activity.");
    } finally {
      setLoading(false);
    }
  }, [date]);
  useEffect(() => {
    void load();
  }, [load]);

  const s = data?.summary;

  return (
    <div>
      <div className="adm-page-head">
        <h1>Visitors</h1>
        <p>Who came to the site each day, what they viewed, and how long they stayed.</p>
      </div>

      <div className="vis-toolbar">
        <label className="vis-datefield">
          <span>Date</span>
          <input type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} />
        </label>
        <button type="button" className="adm-filter" onClick={() => setDate(todayISO())}>
          Today
        </button>
      </div>

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

      {loading && <div className="adm-empty">Loading…</div>}
      {!loading && error && <div className="adm-empty">{error}</div>}
      {!loading && !error && data && data.visitors.length === 0 && (
        <div className="adm-empty">No visitors recorded on this day yet.</div>
      )}

      {!loading && !error && data && data.visitors.length > 0 && (
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
    </div>
  );
}
