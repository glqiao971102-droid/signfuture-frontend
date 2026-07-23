"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api, ApiError, type AdminProductDetail } from "@/lib/api";
import { priceConfig, type ProductConfig } from "@/lib/formula";

const money = (n: number, currency = "RM") =>
  `${currency} ${n.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function ProductEditor({ slug }: { slug: string }) {
  const [meta, setMeta] = useState<{ name: string; category: string; active: boolean } | null>(
    null,
  );
  const [config, setConfig] = useState<ProductConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Live-preview state: the values a customer would enter.
  const [previewInputs, setPreviewInputs] = useState<Record<string, number>>({});
  const [previewSelections, setPreviewSelections] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const p: AdminProductDetail = await api.adminProduct(slug);
      setMeta({ name: p.name, category: p.category, active: p.active });
      setConfig(p.config);
      // Seed the preview with defaults + first choices.
      const inputs: Record<string, number> = {};
      p.config.inputs.forEach((i) => (inputs[i.key] = i.default));
      const sel: Record<string, string> = {};
      p.config.options.forEach((o) => (sel[o.key] = o.choices[0]?.key));
      setPreviewInputs(inputs);
      setPreviewSelections(sel);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load product");
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    void load();
  }, [load]);

  // Recompute the preview price whenever the config or preview inputs change.
  const preview = useMemo(() => {
    if (!config) return null;
    return priceConfig(config, previewInputs, previewSelections);
  }, [config, previewInputs, previewSelections]);

  // ---- immutable config editing helpers ----
  function patchConfig(fn: (c: ProductConfig) => ProductConfig) {
    setConfig((c) => (c ? fn(structuredClone(c)) : c));
    setSaved(false);
  }

  async function save() {
    if (!config || !meta || saving) return;
    setSaving(true);
    setSaveError(null);
    setSaved(false);
    try {
      await api.adminSaveProduct(slug, { name: meta.name, active: meta.active, config });
      setSaved(true);
    } catch (err) {
      setSaveError(
        err instanceof ApiError ? err.message : "Could not save. Check the formula and try again.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="adm-empty">Loading product…</div>;
  if (error || !config || !meta) return <div className="quote-empty">{error ?? "Not found"}</div>;

  const currency = config.currency ?? "RM";

  return (
    <>
      <div className="adm-editor-head">
        <div>
          <Link href="/admin/products" className="adm-link">
            ← Products
          </Link>
          <input
            className="adm-title-input"
            value={meta.name}
            onChange={(e) => {
              setMeta({ ...meta, name: e.target.value });
              setSaved(false);
            }}
          />
          <span className="adm-editor-cat">{meta.category}</span>
        </div>
        <div className="adm-editor-actions">
          {saveError && <span className="adm-save-err">{saveError}</span>}
          {saved && <span className="adm-save-ok">Saved ✓</span>}
          <button type="button" className="hero-btn primary" onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>

      <div className="adm-editor-grid">
        <div className="adm-editor-main">
          {/* ---- Inputs ---- */}
          <section className="adm-card">
            <h2>Inputs</h2>
            <p className="adm-card-sub">Numbers the customer enters. Keys are used by the formula.</p>
            <div className="adm-rows">
              {config.inputs.map((input, idx) => (
                <div className="adm-input-row" key={input.key}>
                  <code className="adm-key">{input.key}</code>
                  <label>
                    Label
                    <input
                      value={input.label}
                      onChange={(e) =>
                        patchConfig((c) => {
                          c.inputs[idx].label = e.target.value;
                          return c;
                        })
                      }
                    />
                  </label>
                  <label>
                    Default
                    <input
                      type="number"
                      value={input.default}
                      onChange={(e) =>
                        patchConfig((c) => {
                          c.inputs[idx].default = Number(e.target.value);
                          return c;
                        })
                      }
                    />
                  </label>
                  <label>
                    Unit
                    <input
                      value={input.unit ?? ""}
                      onChange={(e) =>
                        patchConfig((c) => {
                          c.inputs[idx].unit = e.target.value || undefined;
                          return c;
                        })
                      }
                    />
                  </label>
                </div>
              ))}
            </div>
          </section>

          {/* ---- Options ---- */}
          <section className="adm-card">
            <h2>Options &amp; prices</h2>
            <p className="adm-card-sub">
              Each option feeds its selected value into the formula (by the option key).
            </p>
            {config.options.map((option, oi) => (
              <div className="adm-option-group" key={option.key}>
                <div className="adm-option-head">
                  <code className="adm-key">{option.key}</code>
                  <input
                    className="adm-option-label"
                    value={option.label}
                    onChange={(e) =>
                      patchConfig((c) => {
                        c.options[oi].label = e.target.value;
                        return c;
                      })
                    }
                  />
                </div>
                <div className="adm-choices">
                  {option.choices.map((choice, ci) => (
                    <div className="adm-choice-row" key={choice.key}>
                      <input
                        className="adm-choice-label"
                        value={choice.label}
                        onChange={(e) =>
                          patchConfig((c) => {
                            c.options[oi].choices[ci].label = e.target.value;
                            return c;
                          })
                        }
                      />
                      <input
                        className="adm-choice-value"
                        type="number"
                        step="0.01"
                        value={choice.value}
                        onChange={(e) =>
                          patchConfig((c) => {
                            c.options[oi].choices[ci].value = Number(e.target.value);
                            return c;
                          })
                        }
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </section>

          {/* ---- Constants ---- */}
          <section className="adm-card">
            <h2>Constants</h2>
            <p className="adm-card-sub">Named numbers the formula can reference.</p>
            <div className="adm-consts">
              {Object.entries(config.constants ?? {}).map(([key, value]) => (
                <div className="adm-const-row" key={key}>
                  <code className="adm-key">{key}</code>
                  <input
                    type="number"
                    step="0.01"
                    value={value}
                    onChange={(e) =>
                      patchConfig((c) => {
                        c.constants[key] = Number(e.target.value);
                        return c;
                      })
                    }
                  />
                </div>
              ))}
            </div>
          </section>

          {/* ---- Variables + Formula ---- */}
          <section className="adm-card">
            <h2>Formula</h2>
            <p className="adm-card-sub">
              Intermediate variables, then the final price. Reference inputs, option keys and
              constants by name. Operators: + − × ÷ % ( ) and min/max/ceil/floor/round.
            </p>
            <div className="adm-vars">
              {config.variables.map((v, vi) => (
                <div className="adm-var-row" key={v.key}>
                  <code className="adm-key">{v.key}</code>
                  <span className="adm-eq">=</span>
                  <input
                    className="adm-expr"
                    value={v.expr}
                    onChange={(e) =>
                      patchConfig((c) => {
                        c.variables[vi].expr = e.target.value;
                        return c;
                      })
                    }
                  />
                </div>
              ))}
            </div>
            <label className="adm-formula-label">
              Price =
              <textarea
                className="adm-formula"
                rows={2}
                value={config.formula}
                onChange={(e) =>
                  patchConfig((c) => {
                    c.formula = e.target.value;
                    return c;
                  })
                }
              />
            </label>
          </section>
        </div>

        {/* ---- Live preview ---- */}
        <aside className="adm-preview">
          <div className="adm-preview-sticky">
            <h2>Live preview</h2>
            <p className="adm-card-sub">Try values — the price recalculates instantly.</p>

            {config.inputs.map((input) => (
              <label className="adm-preview-field" key={input.key}>
                {input.label} {input.unit ? `(${input.unit})` : ""}
                <input
                  type="number"
                  value={previewInputs[input.key] ?? input.default}
                  onChange={(e) =>
                    setPreviewInputs((s) => ({ ...s, [input.key]: Number(e.target.value) }))
                  }
                />
              </label>
            ))}

            {config.options.map((option) => (
              <label className="adm-preview-field" key={option.key}>
                {option.label}
                <select
                  value={previewSelections[option.key] ?? option.choices[0]?.key}
                  onChange={(e) =>
                    setPreviewSelections((s) => ({ ...s, [option.key]: e.target.value }))
                  }
                >
                  {option.choices.map((c) => (
                    <option key={c.key} value={c.key}>
                      {c.label} ({c.value})
                    </option>
                  ))}
                </select>
              </label>
            ))}

            <div className="adm-preview-price">
              {preview && "price" in preview ? (
                <>
                  <span>Price</span>
                  <strong>{money(preview.price, currency)}</strong>
                </>
              ) : (
                <span className="adm-preview-error">
                  {preview && "error" in preview ? preview.error : "—"}
                </span>
              )}
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}
