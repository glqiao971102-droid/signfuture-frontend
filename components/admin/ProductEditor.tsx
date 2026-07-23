"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api, ApiError, resolveImageUrl, type AdminProductDetail } from "@/lib/api";
import { priceConfig, type ProductConfig } from "@/lib/formula";

const money = (n: number, currency = "RM") =>
  `${currency} ${n.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Makes a key that isn't already used in `taken`. */
function freshKey(base: string, taken: string[]): string {
  let n = 1;
  let k = `${base}${n}`;
  while (taken.includes(k)) k = `${base}${++n}`;
  return k;
}

export default function ProductEditor({ slug }: { slug: string }) {
  const router = useRouter();
  const [meta, setMeta] = useState<{ name: string; category: string; active: boolean } | null>(
    null,
  );
  const [config, setConfig] = useState<ProductConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);

  const [previewInputs, setPreviewInputs] = useState<Record<string, number>>({});
  const [previewSelections, setPreviewSelections] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const p: AdminProductDetail = await api.adminProduct(slug);
      setMeta({ name: p.name, category: p.category, active: p.active });
      setConfig(p.config);
      setImageUrl(p.imageUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load product");
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    void load();
  }, [load]);

  // Preview scope: seed from current config defaults, letting stale keys fall
  // through to their defaults so editing keys doesn't crash the preview.
  const preview = useMemo(() => {
    if (!config) return null;
    const inputs: Record<string, number> = {};
    config.inputs.forEach((i) => (inputs[i.key] = previewInputs[i.key] ?? i.default));
    const sel: Record<string, string> = {};
    config.options.forEach((o) => (sel[o.key] = previewSelections[o.key] ?? o.choices[0]?.key));
    return priceConfig(config, inputs, sel);
  }, [config, previewInputs, previewSelections]);

  function patchConfig(fn: (c: ProductConfig) => void) {
    setConfig((c) => {
      if (!c) return c;
      const next = structuredClone(c);
      fn(next);
      return next;
    });
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

  async function deleteProduct() {
    if (!confirm("Delete this product? This cannot be undone.")) return;
    try {
      await api.adminDeleteProduct(slug);
      router.push("/admin/products");
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : "Could not delete");
    }
  }

  async function onPickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    setImageError(null);
    try {
      const res = await api.adminUploadProductImage(slug, file);
      setImageUrl(res.imageUrl);
    } catch (err) {
      setImageError(err instanceof ApiError ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function removeImage() {
    setUploading(true);
    setImageError(null);
    try {
      await api.adminRemoveProductImage(slug);
      setImageUrl(null);
    } catch (err) {
      setImageError(err instanceof ApiError ? err.message : "Could not remove");
    } finally {
      setUploading(false);
    }
  }

  if (loading) return <div className="adm-empty">Loading product…</div>;
  if (error || !config || !meta) return <div className="quote-empty">{error ?? "Not found"}</div>;

  const currency = config.currency ?? "RM";
  const allKeys = [
    ...config.inputs.map((i) => i.key),
    ...config.options.map((o) => o.key),
    ...Object.keys(config.constants ?? {}),
    ...config.variables.map((v) => v.key),
  ];

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
          <button type="button" className="adm-image-remove" onClick={deleteProduct}>
            Delete
          </button>
          <button type="button" className="hero-btn primary" onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>

      <div className="adm-editor-grid">
        <div className="adm-editor-main">
          {/* ---- Image ---- */}
          <section className="adm-card">
            <h2>Product image</h2>
            <p className="adm-card-sub">Shown on the storefront. JPG, PNG, WEBP, GIF or SVG, up to 8MB.</p>
            <div className="adm-image-row">
              <div className="adm-image-preview">
                {imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={resolveImageUrl(imageUrl) ?? ""} alt={meta.name} />
                ) : (
                  <span className="adm-image-placeholder">No image</span>
                )}
              </div>
              <div className="adm-image-actions">
                <label className="hero-btn primary adm-upload-btn">
                  {uploading ? "Uploading…" : imageUrl ? "Replace image" : "Upload image"}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
                    onChange={onPickImage}
                    disabled={uploading}
                    hidden
                  />
                </label>
                {imageUrl && (
                  <button type="button" className="adm-image-remove" onClick={removeImage} disabled={uploading}>
                    Remove
                  </button>
                )}
                {imageError && <span className="adm-save-err">{imageError}</span>}
              </div>
            </div>
          </section>

          {/* ---- Inputs ---- */}
          <section className="adm-card">
            <div className="adm-card-head-row">
              <h2>Inputs</h2>
              <button
                type="button"
                className="adm-add-btn"
                onClick={() =>
                  patchConfig((c) =>
                    c.inputs.push({
                      key: freshKey("input", allKeys),
                      label: "New input",
                      type: "number",
                      default: 1,
                    }),
                  )
                }
              >
                + Add input
              </button>
            </div>
            <p className="adm-card-sub">Numbers the customer enters. The key is used by the formula.</p>
            <div className="adm-rows">
              {config.inputs.map((input, idx) => (
                <div className="adm-input-row adm-editable-row" key={idx}>
                  <label>
                    Key
                    <input
                      className="adm-key-input"
                      value={input.key}
                      onChange={(e) => patchConfig((c) => (c.inputs[idx].key = e.target.value))}
                    />
                  </label>
                  <label>
                    Label
                    <input value={input.label} onChange={(e) => patchConfig((c) => (c.inputs[idx].label = e.target.value))} />
                  </label>
                  <label>
                    Default
                    <input type="number" value={input.default} onChange={(e) => patchConfig((c) => (c.inputs[idx].default = Number(e.target.value)))} />
                  </label>
                  <label>
                    Unit
                    <input value={input.unit ?? ""} onChange={(e) => patchConfig((c) => (c.inputs[idx].unit = e.target.value || undefined))} />
                  </label>
                  <button type="button" className="adm-del-btn" onClick={() => patchConfig((c) => c.inputs.splice(idx, 1))} aria-label="Remove input">
                    ×
                  </button>
                </div>
              ))}
            </div>
          </section>

          {/* ---- Options ---- */}
          <section className="adm-card">
            <div className="adm-card-head-row">
              <h2>Options &amp; prices</h2>
              <button
                type="button"
                className="adm-add-btn"
                onClick={() =>
                  patchConfig((c) =>
                    c.options.push({
                      key: freshKey("option", allKeys),
                      label: "New option",
                      choices: [{ key: "standard", label: "Standard", value: 1 }],
                    }),
                  )
                }
              >
                + Add option
              </button>
            </div>
            <p className="adm-card-sub">Each option feeds its selected value into the formula (by the option key).</p>
            {config.options.map((option, oi) => (
              <div className="adm-option-group" key={oi}>
                <div className="adm-option-head">
                  <label className="adm-key-label">
                    Key
                    <input className="adm-key-input" value={option.key} onChange={(e) => patchConfig((c) => (c.options[oi].key = e.target.value))} />
                  </label>
                  <input className="adm-option-label" value={option.label} onChange={(e) => patchConfig((c) => (c.options[oi].label = e.target.value))} />
                  <button type="button" className="adm-del-btn" onClick={() => patchConfig((c) => c.options.splice(oi, 1))} aria-label="Remove option">
                    ×
                  </button>
                </div>
                <div className="adm-choices">
                  {option.choices.map((choice, ci) => (
                    <div className="adm-choice-row adm-choice-editable" key={ci}>
                      <input className="adm-choice-label" value={choice.label} onChange={(e) => patchConfig((c) => (c.options[oi].choices[ci].label = e.target.value))} />
                      <input className="adm-choice-value" type="number" step="0.01" value={choice.value} onChange={(e) => patchConfig((c) => (c.options[oi].choices[ci].value = Number(e.target.value)))} />
                      <button type="button" className="adm-del-btn" onClick={() => patchConfig((c) => c.options[oi].choices.splice(ci, 1))} aria-label="Remove choice">
                        ×
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    className="adm-add-btn adm-add-choice"
                    onClick={() =>
                      patchConfig((c) =>
                        c.options[oi].choices.push({
                          key: freshKey("choice", option.choices.map((x) => x.key)),
                          label: "New choice",
                          value: 0,
                        }),
                      )
                    }
                  >
                    + Add choice
                  </button>
                </div>
              </div>
            ))}
          </section>

          {/* ---- Constants ---- */}
          <section className="adm-card">
            <div className="adm-card-head-row">
              <h2>Constants</h2>
              <button
                type="button"
                className="adm-add-btn"
                onClick={() => patchConfig((c) => (c.constants[freshKey("const", allKeys)] = 0))}
              >
                + Add constant
              </button>
            </div>
            <p className="adm-card-sub">Named numbers the formula can reference.</p>
            <div className="adm-consts">
              {Object.entries(config.constants ?? {}).map(([key, value]) => (
                <div className="adm-const-row adm-editable-row" key={key}>
                  <input
                    className="adm-key-input"
                    value={key}
                    onChange={(e) =>
                      patchConfig((c) => {
                        const nk = e.target.value;
                        const val = c.constants[key];
                        delete c.constants[key];
                        c.constants[nk] = val;
                      })
                    }
                  />
                  <input type="number" step="0.01" value={value} onChange={(e) => patchConfig((c) => (c.constants[key] = Number(e.target.value)))} />
                  <button type="button" className="adm-del-btn" onClick={() => patchConfig((c) => delete c.constants[key])} aria-label="Remove constant">
                    ×
                  </button>
                </div>
              ))}
            </div>
          </section>

          {/* ---- Variables + Formula ---- */}
          <section className="adm-card">
            <div className="adm-card-head-row">
              <h2>Formula</h2>
              <button
                type="button"
                className="adm-add-btn"
                onClick={() => patchConfig((c) => c.variables.push({ key: freshKey("var", allKeys), expr: "0" }))}
              >
                + Add variable
              </button>
            </div>
            <p className="adm-card-sub">
              Intermediate variables (evaluated top-down), then the final price. Reference inputs,
              option keys and constants by name. Operators: + − × ÷ % ( ) and min/max/ceil/floor/round.
            </p>
            <div className="adm-vars">
              {config.variables.map((v, vi) => (
                <div className="adm-var-row adm-editable-row" key={vi}>
                  <input className="adm-key-input" value={v.key} onChange={(e) => patchConfig((c) => (c.variables[vi].key = e.target.value))} />
                  <span className="adm-eq">=</span>
                  <input className="adm-expr" value={v.expr} onChange={(e) => patchConfig((c) => (c.variables[vi].expr = e.target.value))} />
                  <button type="button" className="adm-del-btn" onClick={() => patchConfig((c) => c.variables.splice(vi, 1))} aria-label="Remove variable">
                    ×
                  </button>
                </div>
              ))}
            </div>
            <label className="adm-formula-label">
              Price =
              <textarea className="adm-formula" rows={2} value={config.formula} onChange={(e) => patchConfig((c) => (c.formula = e.target.value))} />
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
                  onChange={(e) => setPreviewInputs((s) => ({ ...s, [input.key]: Number(e.target.value) }))}
                />
              </label>
            ))}

            {config.options.map((option) => (
              <label className="adm-preview-field" key={option.key}>
                {option.label}
                <select
                  value={previewSelections[option.key] ?? option.choices[0]?.key}
                  onChange={(e) => setPreviewSelections((s) => ({ ...s, [option.key]: e.target.value }))}
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
