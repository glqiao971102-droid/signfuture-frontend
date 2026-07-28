"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import {
  api,
  type AdminProductDetail,
  type ProductConfig,
  type ProductOption,
} from "@/lib/api";

/** Deep clone so edits never mutate the loaded config in place. */
function clone<T>(v: T): T {
  return typeof structuredClone === "function"
    ? structuredClone(v)
    : JSON.parse(JSON.stringify(v));
}

export default function AdminProductEditor() {
  const { slug } = useParams<{ slug: string }>();
  const { user, loading: authLoading } = useAuth();
  const isAdmin = !!user?.roles?.includes("administrator");

  const [detail, setDetail] = useState<AdminProductDetail | null>(null);
  const [name, setName] = useState("");
  const [active, setActive] = useState(true);
  const [config, setConfig] = useState<ProductConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin || !slug) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await api.adminProduct(slug);
        if (cancelled) return;
        setDetail(res);
        setName(res.name);
        setActive(res.active);
        setConfig(clone(res.config));
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load product");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAdmin, slug]);

  const patch = useCallback((fn: (c: ProductConfig) => void) => {
    setConfig((prev) => {
      if (!prev) return prev;
      const next = clone(prev);
      fn(next);
      return next;
    });
    setSaved(null);
  }, []);

  async function save() {
    if (!config || saving) return;
    setSaving(true);
    setError(null);
    setSaved(null);
    try {
      const res = await api.adminUpdateProduct(slug, { name, active, config });
      setSaved(
        res.previewPrice != null
          ? `Saved. Preview price RM ${res.previewPrice.toFixed(2)}.`
          : "Saved."
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (authLoading) return <main className="admin-wrap"><p className="admin-muted">Loading…</p></main>;
  if (!user) return <main className="admin-wrap"><p className="admin-muted">Please sign in with an administrator account.</p></main>;
  if (!isAdmin) return <main className="admin-wrap"><p className="admin-muted">Your account doesn&apos;t have administrator access.</p></main>;
  if (loading) return <main className="admin-wrap"><p className="admin-muted">Loading product…</p></main>;
  if (error && !config) return <main className="admin-wrap"><p className="admin-error">{error}</p></main>;
  if (!config || !detail) return null;

  // Options used as a matrix axis are pure selectors — their per-choice numeric
  // "value" is meaningless, so we hide the value column for them.
  const axisOptionKeys = new Set(
    (config.matrices ?? []).flatMap((m) => [m.rowOption, m.colOption])
  );

  return (
    <main className="admin-wrap admin-editor">
      <div className="admin-crumb">
        <Link href="/admin/products">← All products</Link>
        <span className="admin-muted">{detail.category}</span>
      </div>

      <div className="admin-head">
        <div className="admin-title-edit">
          <input
            className="admin-name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setSaved(null);
            }}
          />
          <label className="admin-active">
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => {
                setActive(e.target.checked);
                setSaved(null);
              }}
            />
            Visible in storefront
          </label>
        </div>
        <div className="admin-save-col">
          <button className="admin-btn primary" onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </button>
          {saved && <span className="admin-ok">{saved}</span>}
          {error && <span className="admin-error">{error}</span>}
        </div>
      </div>

      <div className="admin-editor-cols">
        <div className="admin-editor-main">
          <h2 className="admin-section-title">Options &amp; prices</h2>

          {/* Price grids first — the headline of this editor. */}
          {(config.matrices ?? []).map((m, mi) => (
            <MatrixEditor
              key={m.key}
              config={config}
              matrixIndex={mi}
              onCell={(rowKey, colKey, value) =>
                patch((c) => {
                  const mm = c.matrices![mi];
                  mm.values[rowKey] = mm.values[rowKey] ?? {};
                  mm.values[rowKey][colKey] = value;
                })
              }
            />
          ))}

          {/* Then each option group. */}
          {config.options.map((opt, oi) => (
            <OptionEditor
              key={opt.key}
              option={opt}
              isAxis={axisOptionKeys.has(opt.key)}
              onLabel={(ci, label) =>
                patch((c) => {
                  c.options[oi].choices[ci].label = label;
                })
              }
              onValue={(ci, value) =>
                patch((c) => {
                  c.options[oi].choices[ci].value = value;
                })
              }
            />
          ))}
        </div>

        <PreviewPanel slug={slug} config={config} />
      </div>

      <p className="admin-foot-note">
        Saving updates the live product immediately. To make these the seeded
        defaults, also update <code>database/data/products</code> and re-run the
        products seeder.
      </p>
    </main>
  );
}

/* ---- Material × Printing price grid ------------------------------------- */

function MatrixEditor({
  config,
  matrixIndex,
  onCell,
}: {
  config: ProductConfig;
  matrixIndex: number;
  onCell: (rowKey: string, colKey: string, value: number) => void;
}) {
  const m = config.matrices![matrixIndex];
  const rowOpt = config.options.find((o) => o.key === m.rowOption);
  const colOpt = config.options.find((o) => o.key === m.colOption);
  if (!rowOpt || !colOpt) return null;

  return (
    <div className="admin-block">
      <div className="admin-block-head">
        <h3>{m.label}</h3>
        <span className="admin-muted">
          {rowOpt.label} × {colOpt.label} — each cell is a price.
        </span>
      </div>
      <div className="admin-matrix-scroll">
        <table className="admin-matrix">
          <thead>
            <tr>
              <th className="admin-matrix-corner">{rowOpt.label}</th>
              {colOpt.choices.map((c) => (
                <th key={c.key}>{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rowOpt.choices.map((r) => (
              <tr key={r.key}>
                <th scope="row">{r.label}</th>
                {colOpt.choices.map((c) => {
                  const val = m.values?.[r.key]?.[c.key] ?? 0;
                  return (
                    <td key={c.key}>
                      <div className="admin-cell">
                        <span>RM</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={val}
                          onChange={(e) =>
                            onCell(r.key, c.key, Number(e.target.value) || 0)
                          }
                        />
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---- A plain option group (finishing, collection speed …) --------------- */

function OptionEditor({
  option,
  isAxis,
  onLabel,
  onValue,
}: {
  option: ProductOption;
  isAxis: boolean;
  onLabel: (choiceIndex: number, label: string) => void;
  onValue: (choiceIndex: number, value: number) => void;
}) {
  return (
    <div className="admin-block">
      <div className="admin-block-head">
        <h3>{option.label}</h3>
        {isAxis && <span className="admin-muted">Selector — priced by the grid above.</span>}
      </div>
      <div className="admin-choices">
        {option.choices.map((ch, ci) => (
          <div key={ch.key} className="admin-choice">
            <input
              className="admin-choice-label"
              value={ch.label}
              onChange={(e) => onLabel(ci, e.target.value)}
            />
            {!isAxis && (
              <div className="admin-cell">
                <input
                  type="number"
                  step="0.01"
                  value={ch.value}
                  onChange={(e) => onValue(ci, Number(e.target.value) || 0)}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---- Live price preview -------------------------------------------------- */

function PreviewPanel({ slug, config }: { slug: string; config: ProductConfig }) {
  const [inputs, setInputs] = useState<Record<string, number>>({});
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [price, setPrice] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Seed defaults once (and whenever the set of inputs/options changes).
  const inputKeys = config.inputs.map((i) => i.key).join(",");
  const optionKeys = config.options.map((o) => o.key).join(",");
  useEffect(() => {
    const nextInputs: Record<string, number> = {};
    for (const i of config.inputs) nextInputs[i.key] = i.default;
    const nextSel: Record<string, string> = {};
    for (const o of config.options) nextSel[o.key] = o.choices[0]?.key;
    setInputs(nextInputs);
    setSelections(nextSel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputKeys, optionKeys]);

  // Re-price (debounced) whenever the config or the trial selection changes.
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try {
        const res = await api.adminPreviewProduct(slug, { config, inputs, selections });
        if (res.ok) {
          setPrice(res.price);
          setErr(null);
        } else {
          setErr(res.error);
          setPrice(null);
        }
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Preview failed");
      }
    }, 300);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [slug, config, inputs, selections]);

  const currency = config.currency ?? "RM";

  return (
    <aside className="admin-preview">
      <h3>Live preview</h3>
      <div className="admin-preview-price">
        {price != null ? (
          <>
            <span>{currency}</span>
            <strong>{price.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
          </>
        ) : (
          <span className="admin-error">{err ?? "…"}</span>
        )}
      </div>

      <div className="admin-preview-fields">
        {config.inputs.map((i) => (
          <label key={i.key} className="admin-preview-field">
            {i.label}
            <input
              type="number"
              value={inputs[i.key] ?? i.default}
              onChange={(e) =>
                setInputs((s) => ({ ...s, [i.key]: Number(e.target.value) || 0 }))
              }
            />
            {i.unit && <em>{i.unit}</em>}
          </label>
        ))}
        {config.options.map((o) => (
          <label key={o.key} className="admin-preview-field">
            {o.label}
            <select
              value={selections[o.key] ?? o.choices[0]?.key}
              onChange={(e) =>
                setSelections((s) => ({ ...s, [o.key]: e.target.value }))
              }
            >
              {o.choices.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
    </aside>
  );
}
