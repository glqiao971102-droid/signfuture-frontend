"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { PRICING_SCHEMAS, getPath, setPath, type PricingSchema } from "@/lib/pricingSchemas";

/**
 * Admin editor for data-driven calculator prices. Products with a table schema
 * (banner, stands) get a friendly grid; box-up (irregular nested tables) uses a
 * validated JSON editor. Saving goes live immediately — no deploy.
 */

const PRODUCTS: { key: string; label: string }[] = [
  { key: "banner", label: "Banner (Inkjet)" },
  { key: "x-stand", label: "X Stand" },
  { key: "roll-up-76x200-economy", label: "Roll Up 76×200 (Economy)" },
  { key: "roll-up-85x200-economy", label: "Roll Up 85×200 (Economy)" },
  { key: "roll-up-85x200-luxury", label: "Roll Up 85×200 (Luxury)" },
  { key: "roll-up-85x200-luxury-2side", label: "Roll Up 85×200 (Luxury 2-Side)" },
  { key: "roll-up-120x200-luxury", label: "Roll Up 120×200 (Luxury)" },
  { key: "door-bunting-stand", label: "Door Bunting Stand" },
  { key: "boxup", label: "3D Box Up" },
];

export default function ProductPricingPage() {
  const [key, setKey] = useState("banner");
  const schema: PricingSchema | undefined = PRICING_SCHEMAS[key];

  const [config, setConfig] = useState<any>(null);
  const [text, setText] = useState(""); // JSON editor (box-up)
  const [isOverride, setIsOverride] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [advanced, setAdvanced] = useState(false); // JSON escape hatch

  const load = useCallback(async () => {
    setLoading(true); setErr(null); setMsg(null);
    try {
      const r = await api.adminGetPricing(key);
      setConfig(r.config);
      setText(JSON.stringify(r.config, null, 2));
      setIsOverride(r.isOverride);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not load pricing.");
    } finally {
      setLoading(false);
    }
  }, [key]);

  useEffect(() => { void load(); }, [load]);

  function setTier(path: (string | number)[], idx: number, raw: string) {
    const num = raw === "" ? 0 : Number(raw);
    if (Number.isNaN(num)) return;
    const arr = (getPath(config, path) as number[]) ?? [0, 0, 0, 0];
    const next = arr.slice();
    next[idx] = num;
    setConfig(setPath(config, path, next));
  }

  function setBracket(path: (string | number)[], bi: number, field: "max" | number, raw: string) {
    const num = raw === "" ? 0 : Number(raw);
    if (Number.isNaN(num)) return;
    const arr = (getPath(config, path) as any[]) ?? [];
    const next = arr.map((b) => [b[0], Array.isArray(b[1]) ? [...b[1]] : [0, 0, 0, 0]]);
    if (!next[bi]) return;
    if (field === "max") next[bi][0] = num;
    else (next[bi][1] as number[])[field] = num;
    setConfig(setPath(config, path, next));
  }

  async function save() {
    setErr(null); setMsg(null);
    let payload = config;
    if (!schema || advanced) {
      try { payload = JSON.parse(text); }
      catch (e) { setErr("Invalid JSON: " + (e instanceof Error ? e.message : "")); return; }
    }
    setSaving(true);
    try {
      const r = await api.adminSavePricing(key, payload);
      setConfig(r.config);
      setText(JSON.stringify(r.config, null, 2));
      setIsOverride(true);
      setMsg("✓ Saved. New prices are live immediately.");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed.");
    } finally { setSaving(false); }
  }

  async function revert() {
    if (!confirm("Remove your saved override and revert to the built-in default prices?")) return;
    setSaving(true); setErr(null); setMsg(null);
    try {
      const r = await api.adminResetPricing(key);
      setConfig(r.config);
      setText(JSON.stringify(r.config, null, 2));
      setIsOverride(false);
      setMsg("✓ Reverted to built-in defaults.");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Revert failed.");
    } finally { setSaving(false); }
  }

  return (
    <>
      <div className="adm-page-head">
        <h1>Product Pricing</h1>
        <p>Edit calculator prices. Changes go live immediately — no deploy. Falls back to built-in defaults if no override is saved.</p>
      </div>

      <div className="adm-wrap">
        <div className="adm-card">
          <div className="adm-card-head-row">
            <h2>
              Product{" "}
              <span className={`adm-chip ${isOverride ? "adm-chip-admin" : "adm-chip-member"}`}>
                {isOverride ? "CUSTOM PRICES" : "USING DEFAULTS"}
              </span>
            </h2>
            <select className="adm-select" value={key} onChange={(e) => setKey(e.target.value)}>
              {PRODUCTS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
            </select>
          </div>

          {loading ? (
            <p className="adm-card-sub">Loading…</p>
          ) : !advanced && schema && config ? (
            <>
              <p className="adm-card-sub">Columns are <strong>[{schema.tierLabels.join(", ")}]</strong> in RM. Changes go live on Save.</p>
              {schema.sections.map((sec) => (
                <div key={sec.title} className="pp-section">
                  <h3 className="pp-section-title">{sec.title}</h3>
                  {sec.note && <p className="adm-card-sub">{sec.note}</p>}
                  <div className="pp-table-scroll">
                    <table className="adm-table pp-table">
                      <thead>
                        <tr>
                          <th className="pp-first-col">{sec.rows.some((r) => r.kind === "brackets") ? "Up to (cm)" : ""}</th>
                          {schema.tierLabels.map((t) => <th key={t} className="adm-num">{t}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {sec.rows.map((row) => {
                          if (row.kind === "brackets") {
                            const brackets = (getPath(config, row.path) as any[]) ?? [];
                            return brackets.map((b, bi) => (
                              <tr key={`${row.label}-${bi}`}>
                                <td className="pp-row-label">
                                  ≤{" "}
                                  <input
                                    className="pp-num pp-num-cm"
                                    type="number"
                                    step="1"
                                    value={b[0] ?? 0}
                                    onChange={(e) => setBracket(row.path, bi, "max", e.target.value)}
                                  />{" "}
                                  cm
                                </td>
                                {schema.tierLabels.map((_, i) => (
                                  <td key={i} className="adm-num">
                                    <input
                                      className="pp-num"
                                      type="number"
                                      step="0.01"
                                      value={(b[1]?.[i]) ?? 0}
                                      onChange={(e) => setBracket(row.path, bi, i, e.target.value)}
                                    />
                                  </td>
                                ))}
                              </tr>
                            ));
                          }
                          const val = getPath(config, row.path);
                          if (val == null) {
                            return (
                              <tr key={row.label}>
                                <td className="pp-row-label">{row.label}</td>
                                <td className="adm-num" colSpan={schema.tierLabels.length}>
                                  <em className="adm-card-sub">Quote only (no fixed price)</em>
                                </td>
                              </tr>
                            );
                          }
                          const arr = val as number[];
                          return (
                            <tr key={row.label}>
                              <td className="pp-row-label">{row.label}</td>
                              {schema.tierLabels.map((_, i) => (
                                <td key={i} className="adm-num">
                                  <input
                                    className="pp-num"
                                    type="number"
                                    step="0.01"
                                    value={arr[i] ?? 0}
                                    onChange={(e) => setTier(row.path, i, e.target.value)}
                                  />
                                </td>
                              ))}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </>
          ) : (
            <>
              <p className="adm-card-sub">Advanced JSON editor. Per-tier arrays are <code>[Agent, Silver, Gold, Diamond]</code>. Keep the structure; only change numbers.</p>
              <textarea className="pp-editor" spellCheck={false} value={text} onChange={(e) => setText(e.target.value)} />
            </>
          )}

          {err && <div className="adm-save-err">{err}</div>}
          {msg && <div className="adm-save-ok">{msg}</div>}
          <div className="adm-radio-row" style={{ marginTop: 12, gap: 10, flexWrap: "wrap" }}>
            <button type="button" className="hero-btn primary" disabled={saving || loading} onClick={save}>
              {saving ? "Saving…" : "Save (go live)"}
            </button>
            <button type="button" className="adm-filter" disabled={saving || !isOverride} onClick={revert}>
              Revert to defaults
            </button>
            <button type="button" className="adm-filter" disabled={saving} onClick={load}>Reload</button>
            {schema && (
              <button
                type="button"
                className="adm-filter"
                disabled={saving}
                onClick={() => {
                  setErr(null);
                  if (!advanced) {
                    setText(JSON.stringify(config, null, 2));
                    setAdvanced(true);
                  } else {
                    try {
                      setConfig(JSON.parse(text));
                      setAdvanced(false);
                    } catch (e) {
                      setErr("Invalid JSON: " + (e instanceof Error ? e.message : ""));
                    }
                  }
                }}
              >
                {advanced ? "◀ Back to table" : "Advanced (JSON)"}
              </button>
            )}
          </div>
        </div>
      </div>

      <style jsx>{`
        .pp-section { margin-top: 18px; }
        .pp-section-title { margin: 0 0 6px; font-size: 15px; }
        .pp-table-scroll { overflow-x: auto; }
        .pp-table { width: 100%; }
        .pp-row-label { font-size: 13px; font-weight: 600; white-space: nowrap; }
        .pp-num {
          width: 84px; padding: 6px 8px; text-align: right;
          border: 1px solid rgba(0,0,0,0.18); border-radius: 8px;
          background: rgba(3,10,22,0.85); color: #d6e3f3; font-size: 13px;
        }
        .pp-num:focus { outline: none; border-color: var(--cyan); }
        .pp-num-cm { width: 60px; text-align: center; }
        .pp-first-col { text-align: left; font-size: 12px; color: var(--muted); }
        .pp-editor {
          width: 100%; min-height: 460px;
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          font-size: 12.5px; line-height: 1.5; padding: 14px; border-radius: 10px;
          border: 1px solid rgba(0,0,0,0.15); background: rgba(3,10,22,0.9);
          color: #d6e3f3; white-space: pre; overflow: auto; resize: vertical;
        }
      `}</style>
    </>
  );
}
