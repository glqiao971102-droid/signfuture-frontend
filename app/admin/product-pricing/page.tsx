"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";

/**
 * Admin editor for the data-driven calculator price tables. Pilot: Box-up.
 * The calculators read these numbers live (falling back to built-in defaults
 * if a key has no override), so saving here re-prices immediately — no deploy.
 */

const PRODUCTS = [
  { key: "boxup", label: "3D Box Up (Frontlit / Backlit / Stainless / EG / Aluminium)" },
];

export default function ProductPricingPage() {
  const [key] = useState("boxup");
  const [text, setText] = useState("");
  const [defaults, setDefaults] = useState<Record<string, unknown> | null>(null);
  const [isOverride, setIsOverride] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    setMsg(null);
    try {
      const r = await api.adminGetPricing(key);
      setText(JSON.stringify(r.config, null, 2));
      setDefaults(r.defaults);
      setIsOverride(r.isOverride);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not load pricing.");
    } finally {
      setLoading(false);
    }
  }, [key]);

  useEffect(() => { void load(); }, [load]);

  function validate(): Record<string, unknown> | null {
    try {
      const parsed = JSON.parse(text);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        setErr("Top level must be an object.");
        return null;
      }
      return parsed;
    } catch (e) {
      setErr("Invalid JSON: " + (e instanceof Error ? e.message : "parse error"));
      return null;
    }
  }

  async function save() {
    setErr(null);
    setMsg(null);
    const parsed = validate();
    if (!parsed) return;
    setSaving(true);
    try {
      const r = await api.adminSavePricing(key, parsed);
      setText(JSON.stringify(r.config, null, 2));
      setIsOverride(true);
      setMsg("✓ Saved. New prices are live immediately.");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  function loadDefaultsIntoEditor() {
    if (defaults) setText(JSON.stringify(defaults, null, 2));
    setMsg("Loaded built-in defaults into the editor — click Save to apply them.");
  }

  async function revertToDefaults() {
    if (!confirm("Remove your saved override and revert Box-up to the built-in default prices?")) return;
    setSaving(true);
    setErr(null);
    setMsg(null);
    try {
      const r = await api.adminResetPricing(key);
      setText(JSON.stringify(r.config, null, 2));
      setIsOverride(false);
      setMsg("✓ Reverted to built-in defaults.");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Revert failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="adm-page-head">
        <h1>Product Pricing</h1>
        <p>Edit the calculator price tables. Changes go live immediately — no deploy. The calculator falls back to built-in defaults if no override is saved.</p>
      </div>

      <div className="adm-wrap">
        <div className="adm-card">
          <div className="adm-card-head-row">
            <h2>
              {PRODUCTS[0].label}{" "}
              <span className={`adm-chip ${isOverride ? "adm-chip-admin" : "adm-chip-member"}`}>
                {isOverride ? "CUSTOM PRICES" : "USING DEFAULTS"}
              </span>
            </h2>
          </div>

          <div className="pp-legend">
            <p><strong>Per-tier arrays are <code>[Agent, Silver, Gold, Diamond]</code></strong> (RM).</p>
            <ul>
              <li><code>cm</code>: size brackets — <code>[maxCm, ratesPerTier]</code>, RM per cm of the letter&apos;s longest side.</li>
              <li><code>m2</code>: rate per m² for letters over 100 cm (<code>null</code> = quote only).</li>
              <li><code>addon.LED / UV / Spray</code>, <code>ledWhite</code>, <code>uv</code>, <code>acrylicM2</code>, <code>finish</code>: add-on rates.</li>
            </ul>
            <p className="pp-warn">⚠ Keep the same structure (same keys, arrays of 4 numbers). A malformed save is rejected. Only change the numbers unless you know the shape.</p>
          </div>

          {loading ? (
            <p className="adm-card-sub">Loading…</p>
          ) : (
            <>
              <textarea
                className="pp-editor"
                spellCheck={false}
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
              {err && <div className="adm-save-err">{err}</div>}
              {msg && <div className="adm-save-ok">{msg}</div>}
              <div className="adm-radio-row" style={{ marginTop: 12, flexWrap: "wrap", gap: 10 }}>
                <button type="button" className="hero-btn primary" disabled={saving} onClick={save}>
                  {saving ? "Saving…" : "Save (go live)"}
                </button>
                <button type="button" className="adm-filter" disabled={saving} onClick={loadDefaultsIntoEditor}>
                  Load defaults into editor
                </button>
                <button type="button" className="adm-filter" disabled={saving || !isOverride} onClick={revertToDefaults}>
                  Revert to defaults
                </button>
                <button type="button" className="adm-filter" disabled={saving} onClick={load}>
                  Reload
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <style jsx>{`
        .pp-legend {
          font-size: 13px;
          line-height: 1.6;
          background: rgba(0, 0, 0, 0.03);
          border: 1px solid rgba(0, 0, 0, 0.08);
          border-radius: 10px;
          padding: 12px 14px;
          margin-bottom: 12px;
        }
        .pp-legend ul { margin: 6px 0; padding-left: 18px; }
        .pp-legend code { background: rgba(0,0,0,0.06); padding: 1px 5px; border-radius: 5px; }
        .pp-warn { color: #c0323a; margin-top: 6px; }
        .pp-editor {
          width: 100%;
          min-height: 460px;
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          font-size: 12.5px;
          line-height: 1.5;
          padding: 14px;
          border-radius: 10px;
          border: 1px solid rgba(0, 0, 0, 0.15);
          background: rgba(3, 10, 22, 0.9);
          color: #d6e3f3;
          white-space: pre;
          overflow: auto;
          resize: vertical;
        }
        @media (prefers-color-scheme: dark) {
          .pp-legend { background: rgba(255,255,255,0.04); border-color: rgba(255,255,255,0.12); }
          .pp-legend code { background: rgba(255,255,255,0.1); }
        }
      `}</style>
    </>
  );
}
