"use client";

import { useEffect, useRef, useState } from "react";
import { api, type AdminUserRow, type QuotationFile } from "@/lib/api";

const CATEGORIES = [
  "3D LED Box Up",
  "Signboard / Lightbox",
  "Neon Sign",
  "Inkjet Printing",
  "Acrylic",
  "Display System / Banner Stand",
  "Fabric Display / Flag",
  "Materials",
  "Other",
];
const UNITS = ["ft", "in", "cm", "mm", "m"] as const;
const TIER_DISCOUNT = { silver: 0.05, gold: 0.06, diamond: 0.08 };
const round2 = (n: number) => Math.round(n * 100) / 100;

export default function AdminAddQuotation({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  // Customer picker
  const [cust, setCust] = useState<AdminUserRow | null>(null);
  const [custSearch, setCustSearch] = useState("");
  const [results, setResults] = useState<AdminUserRow[]>([]);
  const [searching, setSearching] = useState(false);

  const [category, setCategory] = useState("");
  const [title, setTitle] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [width, setWidth] = useState("");
  const [height, setHeight] = useState("");
  const [unit, setUnit] = useState<(typeof UNITS)[number]>("ft");
  const [targetDate, setTargetDate] = useState("");
  const [installation, setInstallation] = useState(false);
  const [workingDays, setWorkingDays] = useState("");
  const [remark, setRemark] = useState("");
  const [files, setFiles] = useState<QuotationFile[]>([]);
  const [agent, setAgent] = useState("");

  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (cust || custSearch.trim().length < 2) { setResults([]); return; }
    const t = setTimeout(() => {
      setSearching(true);
      api.adminUsers({ search: custSearch.trim(), perPage: 8 })
        .then((r) => setResults(r.data))
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(t);
  }, [custSearch, cust]);

  const agentN = Number(agent);
  const derived = agent && !Number.isNaN(agentN)
    ? { silver: round2(agentN * (1 - TIER_DISCOUNT.silver)), gold: round2(agentN * (1 - TIER_DISCOUNT.gold)), diamond: round2(agentN * (1 - TIER_DISCOUNT.diamond)) }
    : null;

  async function onPickFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);
    if (fileRef.current) fileRef.current.value = "";
    if (!picked.length) return;
    setUploading(true);
    try {
      const up: QuotationFile[] = [];
      for (const f of picked) { const { url } = await api.uploadFile(f); up.push({ url, name: f.name }); }
      setFiles((p) => [...p, ...up]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!cust) { setError("Please choose a customer."); return; }
    if (!category) { setError("Please choose a product / service."); return; }
    if (!title.trim()) { setError("Please enter a project title."); return; }
    setSaving(true);
    setError(null);
    try {
      await api.adminCreateQuotation({
        userId: cust.id,
        category,
        title: title.trim(),
        quantity: Math.max(1, Math.round(Number(quantity) || 1)),
        width: width ? Number(width) : undefined,
        height: height ? Number(height) : undefined,
        unit: width || height ? unit : undefined,
        targetDate: targetDate || undefined,
        installation,
        remark: remark.trim() || undefined,
        files,
        agent: agent ? Number(agent) : undefined,
        workingDays: workingDays ? Number(workingDays) : undefined,
      });
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the quotation.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="adm-modal-overlay" onClick={onClose}>
      <form className="adm-modal adm-drawer" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <div className="adm-card-head-row">
          <h2>New quotation for a customer</h2>
          <button type="button" className="adm-logout" onClick={onClose}>Close</button>
        </div>

        {/* Customer */}
        <h3 className="adm-drawer-sub">Customer</h3>
        {cust ? (
          <div className="rfq-cust-picked">
            <span><strong>{cust.login}</strong> · {cust.email}{cust.tier ? ` · ${cust.tier}` : ""}</span>
            <button type="button" className="rfq-file-remove" onClick={() => { setCust(null); setCustSearch(""); }}>change</button>
          </div>
        ) : (
          <div className="rfq-cust-search">
            <input className="adm-search" type="search" placeholder="Search customer by name or email…" value={custSearch} onChange={(e) => setCustSearch(e.target.value)} />
            {searching && <p className="adm-card-sub">Searching…</p>}
            {results.length > 0 && (
              <div className="rfq-cust-results">
                {results.map((u) => (
                  <button type="button" key={u.id} className="rfq-cust-result" onClick={() => { setCust(u); setResults([]); }}>
                    <strong>{u.login}</strong> · {u.email}{u.tier ? ` · ${u.tier}` : ""}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Job details */}
        <h3 className="adm-drawer-sub">Job details</h3>
        <div className="edit-detail-grid">
          <label>
            Product / service
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">Select…</option>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <label>Quantity<input type="number" min={1} value={quantity} onChange={(e) => setQuantity(e.target.value)} /></label>
          <label className="span-2">Project title<input value={title} placeholder="e.g. Shopfront signboard" onChange={(e) => setTitle(e.target.value)} /></label>
          <label>Width<input type="number" min={0} value={width} placeholder="optional" onChange={(e) => setWidth(e.target.value)} /></label>
          <label>
            Height
            <div className="rfq-size-row">
              <input type="number" min={0} value={height} placeholder="optional" onChange={(e) => setHeight(e.target.value)} />
              <select value={unit} onChange={(e) => setUnit(e.target.value as (typeof UNITS)[number])}>{UNITS.map((u) => <option key={u} value={u}>{u}</option>)}</select>
            </div>
          </label>
          <label>Target date<input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} /></label>
          <label className="rfq-check-label"><input type="checkbox" checked={installation} onChange={(e) => setInstallation(e.target.checked)} /><span>Installation needed</span></label>
          <label className="span-2">Process notes<textarea className="rfq-textarea" rows={3} value={remark} placeholder="Material, finishing, colours…" onChange={(e) => setRemark(e.target.value)} /></label>
        </div>

        {/* Files */}
        <div className="rfq-files">
          <span className="edit-detail-professions-label">Reference files</span>
          <div className="rfq-file-picker">
            <button type="button" className="hero-btn ghost rfq-file-btn" disabled={uploading} onClick={() => fileRef.current?.click()}>{uploading ? "Uploading…" : "＋ Add files"}</button>
            <input ref={fileRef} type="file" multiple accept="image/*,application/pdf,.ai,.eps,.psd,.cdr" hidden onChange={onPickFiles} />
          </div>
          {files.length > 0 && (
            <ul className="rfq-file-list">
              {files.map((f) => (
                <li key={f.url}><span className="rfq-file-name">📎 {f.name}</span><button type="button" className="rfq-file-remove" onClick={() => setFiles((p) => p.filter((x) => x.url !== f.url))}>✕</button></li>
              ))}
            </ul>
          )}
        </div>

        {/* Pricing (optional — set to quote immediately) */}
        <h3 className="adm-drawer-sub">Pricing (optional)</h3>
        <div className="rfq-price-editor" style={{ borderTop: "none", paddingTop: 0, marginTop: 0 }}>
          <span className="adm-key-label">Leave blank to send as “New”. Enter an Agent price to quote it now — the customer can then confirm.</span>
          <div className="rfq-price-grid">
            <label className="rfq-price-agent">Agent (base)<input type="number" min={0} step="0.01" value={agent} placeholder="0.00" onChange={(e) => setAgent(e.target.value)} /></label>
            <label>Silver<input type="number" value={derived ? derived.silver : ""} placeholder="—" readOnly /></label>
            <label>Gold<input type="number" value={derived ? derived.gold : ""} placeholder="—" readOnly /></label>
            <label>Diamond<input type="number" value={derived ? derived.diamond : ""} placeholder="—" readOnly /></label>
            <label className="rfq-price-days">Working days<input type="number" min={0} value={workingDays} placeholder="e.g. 7" onChange={(e) => setWorkingDays(e.target.value)} /></label>
          </div>
        </div>

        {error && <p className="edit-detail-msg" style={{ color: "#f87171" }}>{error}</p>}
        <div className="edit-detail-actions">
          <button type="submit" className="hero-btn primary" disabled={saving || uploading}>
            {saving ? "Creating…" : agent ? "Create & send quote" : "Create quotation"}
          </button>
        </div>
      </form>
    </div>
  );
}
