"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  api,
  type DropboxSettings,
  type DropboxFolderRow,
  type DropboxFileRow,
  type DropboxFolderMeta,
} from "@/lib/api";

/**
 * SF Dropbox — our own internal file library (NOT external dropbox.com).
 *
 * Used like Dropbox: click a folder to go INTO it, and keep drilling down through
 * any sub-folders (job folders, and the auto-generated "Cnc router file" folder);
 * a back arrow / breadcrumb at the top takes you up again.
 */

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtSize(bytes: number): string {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function AdminDropbox() {
  const [settings, setSettings] = useState<DropboxSettings | null>(null);
  const [folders, setFolders] = useState<DropboxFolderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"active" | "done">("active");

  // Navigation: root (order list) → inside an order, drill through `path` segments.
  const [curOrder, setCurOrder] = useState<{ orderId: number; label: string } | null>(null);
  const [path, setPath] = useState<string[]>([]);
  const [orderMeta, setOrderMeta] = useState<DropboxFolderMeta | null>(null);
  const [orderFiles, setOrderFiles] = useState<DropboxFileRow[]>([]);
  const [openLoading, setOpenLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [zipping, setZipping] = useState<number | null>(null);

  // Config
  const [rootPath, setRootPath] = useState("");
  const [donePath, setDonePath] = useState("");
  const [autoPush, setAutoPush] = useState(true);
  const [savingCfg, setSavingCfg] = useState(false);
  const [cfgMsg, setCfgMsg] = useState<string | null>(null);
  const [showCfg, setShowCfg] = useState(false);

  const applySettings = useCallback((s: DropboxSettings) => {
    setSettings(s);
    setRootPath(s.rootPath ?? "");
    setDonePath(s.donePath ?? "");
    setAutoPush(s.autoPush);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await api.adminDropboxStatus();
      applySettings(r.settings);
      setFolders(r.folders ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load SF Dropbox");
    } finally {
      setLoading(false);
    }
  }, [applySettings]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadOrder = useCallback(async (orderId: number) => {
    setOpenLoading(true);
    setOrderMeta(null);
    setOrderFiles([]);
    try {
      const r = await api.adminDropboxFolder(orderId);
      setOrderMeta(r.order);
      setOrderFiles(r.files ?? []);
    } catch {
      setOrderFiles([]);
    } finally {
      setOpenLoading(false);
    }
  }, []);

  function openOrder(f: DropboxFolderRow) {
    setCurOrder({ orderId: f.orderId, label: f.folderLabel ?? `Order ${f.orderRef ?? f.orderId}` });
    setPath([]);
    void loadOrder(f.orderId);
  }

  function goRoot() {
    setCurOrder(null);
    setPath([]);
    setOrderFiles([]);
    setOrderMeta(null);
  }

  function back() {
    if (path.length > 0) setPath(path.slice(0, -1));
    else goRoot();
  }

  async function saveConfig(e: React.FormEvent) {
    e.preventDefault();
    setSavingCfg(true);
    setCfgMsg(null);
    try {
      const r = await api.adminDropboxSaveConfig({ rootPath: rootPath.trim(), donePath: donePath.trim(), autoPush });
      applySettings(r.settings);
      setCfgMsg("Saved.");
    } catch (err) {
      setCfgMsg(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setSavingCfg(false);
    }
  }

  async function resync() {
    if (!curOrder) return;
    setBusy(true);
    try {
      const r = await api.adminDropboxPush(curOrder.orderId);
      if (!r.success) alert(r.error || "Re-sync failed.");
      await load();
      await loadOrder(curOrder.orderId);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Could not re-sync.");
    } finally {
      setBusy(false);
    }
  }

  async function removeFolder() {
    if (!curOrder) return;
    if (!window.confirm("Remove this order's folder from SF Dropbox? The files here will be deleted (the original order is untouched).")) return;
    setBusy(true);
    try {
      await api.adminDropboxRemove(curOrder.orderId);
      goRoot();
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Could not remove.");
    } finally {
      setBusy(false);
    }
  }

  function download(f: DropboxFileRow) {
    api.adminDropboxDownload(f.id, f.name).catch((err) =>
      alert(err instanceof Error ? err.message : "Could not download the file."),
    );
  }

  async function downloadZip(orderId: number, label: string) {
    setZipping(orderId);
    try {
      await api.adminDropboxDownloadZip(orderId, label);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Could not download the folder.");
    } finally {
      setZipping(null);
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return folders
      .filter((f) => (tab === "done" ? f.done : !f.done))
      .filter((f) => !q || (f.folderLabel ?? "").toLowerCase().includes(q) || (f.orderRef ?? "").toLowerCase().includes(q));
  }, [folders, search, tab]);

  const activeCount = folders.filter((f) => !f.done).length;
  const doneCount = folders.filter((f) => f.done).length;

  // Files/sub-folders at the current path inside the open order.
  const curPathStr = path.join("/");
  const { subDirs, filesHere } = useMemo(() => {
    const dirs = new Map<string, number>();
    const here: DropboxFileRow[] = [];
    for (const f of orderFiles) {
      const segs = f.subFolder ? f.subFolder.split("/") : [];
      if (segs.slice(0, path.length).join("/") !== curPathStr) continue;
      if (segs.length === path.length) {
        here.push(f);
      } else {
        const seg = segs[path.length];
        dirs.set(seg, (dirs.get(seg) ?? 0) + 1);
      }
    }
    here.sort((a, b) => a.name.localeCompare(b.name));
    const dirList = [...dirs.entries()].sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }));
    return { subDirs: dirList, filesHere: here };
  }, [orderFiles, curPathStr, path.length]);

  return (
    <div className="adm-wrap">
      {error && <div className="quote-empty">{error}</div>}

      {/* Breadcrumb / back bar */}
      <div className="dbx-nav">
        {curOrder && (
          <button type="button" className="dbx-back" onClick={back} title="Back" aria-label="Back">
            ←
          </button>
        )}
        <nav className="dbx-crumbs">
          <button type="button" className="dbx-crumb" onClick={goRoot}>
            🗂 SF Dropbox
          </button>
          {curOrder && (
            <>
              <span className="dbx-crumb-sep">/</span>
              <button
                type="button"
                className={path.length === 0 ? "dbx-crumb is-current" : "dbx-crumb"}
                onClick={() => setPath([])}
              >
                {curOrder.label}
              </button>
              {path.map((seg, i) => (
                <span key={i} style={{ display: "contents" }}>
                  <span className="dbx-crumb-sep">/</span>
                  <button
                    type="button"
                    className={i === path.length - 1 ? "dbx-crumb is-current" : "dbx-crumb"}
                    onClick={() => setPath(path.slice(0, i + 1))}
                  >
                    {seg}
                  </button>
                </span>
              ))}
            </>
          )}
        </nav>
        {curOrder && (
          <div className="dbx-order-tools">
            {orderMeta?.done && <span className="adm-chip dbx-done">In Done</span>}
            {orderFiles.length > 0 && (
              <button
                type="button"
                className="dbx-zip-btn"
                onClick={() => downloadZip(curOrder.orderId, curOrder.label)}
                disabled={zipping === curOrder.orderId}
                title="Download all files as a ZIP"
              >
                {zipping === curOrder.orderId ? "Zipping…" : "⬇ Download all (ZIP)"}
              </button>
            )}
            <button type="button" className="adm-edit-link" onClick={resync} disabled={busy}>
              {busy ? "…" : "Re-sync"}
            </button>
            <button type="button" className="adm-edit-link dbx-danger-link" onClick={removeFolder} disabled={busy}>
              Remove
            </button>
          </div>
        )}
      </div>

      {/* ROOT: order folders */}
      {!curOrder && (
        <>
          <div className="dbx-bar">
            <div className="dbx-tabs">
              <button
                type="button"
                className={`adm-status-chip${tab === "active" ? " is-active" : ""}`}
                onClick={() => setTab("active")}
              >
                Active <span className="adm-status-chip-n">{activeCount}</span>
              </button>
              <button
                type="button"
                className={`adm-status-chip${tab === "done" ? " is-active" : ""}`}
                onClick={() => setTab("done")}
              >
                Done <span className="adm-status-chip-n">{doneCount}</span>
              </button>
            </div>
            <input
              className="adm-input dbx-search"
              placeholder="Search order # or customer…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button type="button" className="adm-edit-link" onClick={() => setShowCfg((v) => !v)}>
              {showCfg ? "Hide settings" : "Settings"}
            </button>
          </div>

          {showCfg && (
            <form className="adm-card" onSubmit={saveConfig}>
              <div className="dbx-form">
                <label className="dbx-field">
                  <span>Root folder name</span>
                  <input value={rootPath} onChange={(e) => setRootPath(e.target.value)} placeholder="Production (Sign Future)" />
                </label>
                <label className="dbx-field">
                  <span>Done folder name</span>
                  <input value={donePath} onChange={(e) => setDonePath(e.target.value)} placeholder="Done" />
                </label>
              </div>
              <label className="dbx-toggle">
                <input type="checkbox" checked={autoPush} onChange={(e) => setAutoPush(e.target.checked)} />
                <span>
                  Automatically copy a job's files into SF Dropbox when its order is set to <strong>Processing</strong>
                </span>
              </label>
              <div className="dbx-actions">
                <button type="submit" className="hero-btn primary" disabled={savingCfg}>
                  {savingCfg ? "Saving…" : "Save settings"}
                </button>
                {cfgMsg && <span className="adm-save-ok">{cfgMsg}</span>}
              </div>
            </form>
          )}

          <div className="adm-card dbx-pane">
            {loading ? (
              <p>Loading…</p>
            ) : filtered.length === 0 ? (
              <p className="adm-card-sub">
                {tab === "done" ? "No completed folders yet." : "No folders yet. Set an order to Processing to add its files here."}
              </p>
            ) : (
              <div className="dbx-grid">
                {filtered.map((f) => {
                  const label = f.folderLabel ?? `Order ${f.orderRef ?? f.orderId}`;
                  return (
                    <div key={f.orderId} className="dbx-tile dbx-tile-row">
                      <button type="button" className="dbx-tile-open" onClick={() => openOrder(f)}>
                        <span className="dbx-tile-icon" aria-hidden="true">📁</span>
                        <span className="dbx-tile-body">
                          <span className="dbx-tile-name">{label}</span>
                          <span className="dbx-tile-meta">
                            {f.status === "failed" ? (
                              <span className="dbx-off-text">Failed — {f.error || "see order"}</span>
                            ) : (
                              <>
                                {f.filesCount} file{f.filesCount === 1 ? "" : "s"}
                                {f.sizeBytes ? ` · ${fmtSize(f.sizeBytes)}` : ""} · {fmtDate(f.lastPushedAt)}
                              </>
                            )}
                          </span>
                        </span>
                      </button>
                      {f.status !== "failed" && f.filesCount > 0 && (
                        <button
                          type="button"
                          className="dbx-zip-btn"
                          title="Download all files as a ZIP"
                          disabled={zipping === f.orderId}
                          onClick={(e) => {
                            e.stopPropagation();
                            void downloadZip(f.orderId, label);
                          }}
                        >
                          {zipping === f.orderId ? "…" : "⬇ ZIP"}
                        </button>
                      )}
                      <span className="dbx-tile-chev" aria-hidden="true">›</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {/* INSIDE AN ORDER: sub-folders + files at the current path */}
      {curOrder && (
        <div className="adm-card dbx-pane">
          {openLoading ? (
            <p>Loading…</p>
          ) : subDirs.length === 0 && filesHere.length === 0 ? (
            <p className="adm-card-sub">This folder is empty. Try Re-sync, or check the order has artwork.</p>
          ) : (
            <div className="dbx-grid">
              {subDirs.map(([seg, count]) => (
                <button key={seg} type="button" className="dbx-tile" onClick={() => setPath([...path, seg])}>
                  <span className="dbx-tile-icon" aria-hidden="true">{seg === "Cnc router file" ? "🛠" : "📁"}</span>
                  <span className="dbx-tile-body">
                    <span className="dbx-tile-name">{seg}</span>
                    <span className="dbx-tile-meta">
                      {count} file{count === 1 ? "" : "s"}
                    </span>
                  </span>
                  <span className="dbx-tile-chev" aria-hidden="true">›</span>
                </button>
              ))}
              {filesHere.map((f) => (
                <FileTile key={f.id} file={f} onDownload={download} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function FileTile({ file, onDownload }: { file: DropboxFileRow; onDownload: (f: DropboxFileRow) => void }) {
  const icon = file.kind === "job_order" ? "📄" : file.kind === "cnc" ? "🛠" : "🎨";
  return (
    <button type="button" className="dbx-tile dbx-tile-file" onClick={() => onDownload(file)} title="Download">
      <span className="dbx-tile-icon" aria-hidden="true">{icon}</span>
      <span className="dbx-tile-body">
        <span className="dbx-tile-name">{file.name}</span>
        <span className="dbx-tile-meta">{file.sizeBytes ? fmtSize(file.sizeBytes) : ""}</span>
      </span>
      <span className="dbx-tile-dl" aria-hidden="true">↓</span>
    </button>
  );
}
