"use client";

import { useCallback, useEffect, useState } from "react";
import { api, type VoucherRow } from "@/lib/api";

const money = (n: number) =>
  n.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function discountLabel(v: VoucherRow) {
  return v.discountType === "percent" ? `${v.discountValue}% off` : `RM ${money(v.discountValue)} off`;
}
function scopeLabel(v: VoucherRow) {
  if (v.scopeType === "all") return "Any product";
  return `${v.scopeType}: ${v.scopeValues.join(", ")}`;
}

export default function AdminVouchers() {
  const [rows, setRows] = useState<VoucherRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Catalogue for the scope picker
  const [categories, setCategories] = useState<string[]>([]);
  const [products, setProducts] = useState<string[]>([]);

  // Create form
  const [code, setCode] = useState("");
  const [title, setTitle] = useState("");
  const [discountType, setDiscountType] = useState<"fixed" | "percent">("fixed");
  const [discountValue, setDiscountValue] = useState("");
  const [scopeType, setScopeType] = useState<"all" | "product" | "category">("all");
  const [scopeValues, setScopeValues] = useState<string[]>([]);
  const [minSpend, setMinSpend] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [creating, setCreating] = useState(false);
  const [formMsg, setFormMsg] = useState<string | null>(null);

  // Grant
  const [grantFor, setGrantFor] = useState<VoucherRow | null>(null);
  const [grantFrom, setGrantFrom] = useState("");
  const [grantTo, setGrantTo] = useState("");
  const [grantUserIds, setGrantUserIds] = useState("");
  const [granting, setGranting] = useState(false);
  const [grantMsg, setGrantMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.adminVouchers();
      setRows(r.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load vouchers");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    api.adminCategories().then((r) => setCategories(r.data.map((c) => c.name))).catch(() => {});
    api.adminProducts().then((r) => setProducts(r.data.map((p) => p.name))).catch(() => {});
  }, [load]);

  function toggleScope(v: string) {
    setScopeValues((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]));
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setFormMsg(null);
    if (!code.trim() || !title.trim() || !(Number(discountValue) > 0)) {
      setFormMsg("Fill in code, title and a discount value.");
      return;
    }
    if (scopeType !== "all" && scopeValues.length === 0) {
      setFormMsg(`Pick at least one ${scopeType}.`);
      return;
    }
    setCreating(true);
    try {
      await api.adminCreateVoucher({
        code: code.trim(),
        title: title.trim(),
        discountType,
        discountValue: Number(discountValue),
        scopeType,
        scopeValues: scopeType === "all" ? [] : scopeValues,
        minSpend: minSpend ? Number(minSpend) : 0,
        expiresAt: expiresAt || undefined,
      });
      setFormMsg("✓ Voucher created.");
      setCode(""); setTitle(""); setDiscountValue(""); setScopeValues([]); setMinSpend(""); setExpiresAt("");
      await load();
    } catch (err) {
      setFormMsg(err instanceof Error ? err.message : "Could not create voucher");
    } finally {
      setCreating(false);
    }
  }

  async function grant() {
    if (!grantFor) return;
    setGranting(true);
    setGrantMsg(null);
    try {
      let target: { userIds?: number[]; registeredFrom?: string; registeredTo?: string };
      if (grantFrom) {
        target = { registeredFrom: grantFrom, registeredTo: grantTo || grantFrom };
      } else {
        const ids = grantUserIds.split(",").map((s) => Number(s.trim())).filter((n) => n > 0);
        if (!ids.length) { setGrantMsg("Enter a date range or user IDs."); setGranting(false); return; }
        target = { userIds: ids };
      }
      const r = await api.adminGrantVoucher(grantFor.id, target);
      setGrantMsg(`✓ Granted ${r.granted}${r.matched !== undefined ? ` of ${r.matched} matched` : ""}, emailed ${r.emailed}${r.skipped ? `, ${r.skipped} already had it` : ""}.`);
      await load();
    } catch (err) {
      setGrantMsg(err instanceof Error ? err.message : "Could not grant voucher");
    } finally {
      setGranting(false);
    }
  }

  const scopeChoices = scopeType === "category" ? categories : scopeType === "product" ? products : [];

  return (
    <div className="adm-wrap">
      {error && <div className="quote-empty">{error}</div>}

      <div className="adm-two-col">
        {/* Create */}
        <div className="adm-card">
          <div className="adm-card-head-row"><h2>Create voucher</h2></div>
          <form onSubmit={create} className="adm-adjust-form">
            <label className="adm-modal-field"><span>Code</span>
              <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="NEON500" />
            </label>
            <label className="adm-modal-field"><span>Title</span>
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Neon RM500 off" />
            </label>
            <div className="adm-modal-field"><span>Discount</span>
              <div className="adm-radio-row">
                <button type="button" className={`adm-filter${discountType === "fixed" ? " is-active" : ""}`} onClick={() => setDiscountType("fixed")}>RM amount</button>
                <button type="button" className={`adm-filter${discountType === "percent" ? " is-active" : ""}`} onClick={() => setDiscountType("percent")}>% percent</button>
                <input className="adm-select" style={{ minWidth: 90 }} type="number" min={0} step="0.01" value={discountValue} onChange={(e) => setDiscountValue(e.target.value)} placeholder={discountType === "percent" ? "20" : "500"} />
              </div>
            </div>
            <div className="adm-modal-field"><span>Applies to</span>
              <div className="adm-radio-row">
                {(["all", "product", "category"] as const).map((s) => (
                  <button key={s} type="button" className={`adm-filter${scopeType === s ? " is-active" : ""}`} onClick={() => { setScopeType(s); setScopeValues([]); }}>{s}</button>
                ))}
              </div>
            </div>
            {scopeType !== "all" && (
              <div className="adm-modal-field"><span>Pick {scopeType}(s)</span>
                <div className="reg-chips">
                  {scopeChoices.map((c) => (
                    <button key={c} type="button" className={`reg-chip${scopeValues.includes(c) ? " is-active" : ""}`} onClick={() => toggleScope(c)}>{c}</button>
                  ))}
                  {scopeChoices.length === 0 && <em className="adm-card-sub">No {scopeType}s found.</em>}
                </div>
              </div>
            )}
            <label className="adm-modal-field"><span>Min spend (optional)</span>
              <input type="number" min={0} step="0.01" value={minSpend} onChange={(e) => setMinSpend(e.target.value)} placeholder="0" />
            </label>
            <label className="adm-modal-field"><span>Expires (optional)</span>
              <input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
            </label>
            {formMsg && <div className={formMsg.startsWith("✓") ? "adm-save-ok" : "adm-save-err"}>{formMsg}</div>}
            <button type="submit" className="hero-btn primary" disabled={creating}>{creating ? "Creating…" : "Create voucher"}</button>
          </form>
        </div>

        {/* Grant */}
        <div className="adm-card">
          <div className="adm-card-head-row"><h2>Send a voucher</h2></div>
          <p className="adm-card-sub">Pick a voucher, then send it to everyone who registered within a date range (leave "To" blank for a single day), or to specific user IDs (from Customers).</p>
          <div className="adm-adjust-form">
            <label className="adm-modal-field"><span>Voucher</span>
              <select className="adm-select" value={grantFor?.id ?? ""} onChange={(e) => setGrantFor(rows.find((r) => r.id === Number(e.target.value)) ?? null)}>
                <option value="">Select…</option>
                {rows.map((v) => <option key={v.id} value={v.id}>{v.code} — {v.title}</option>)}
              </select>
            </label>
            <div className="adm-modal-field"><span>Send to everyone registered between</span>
              <div className="adm-radio-row">
                <input type="date" value={grantFrom} onChange={(e) => { setGrantFrom(e.target.value); if (e.target.value) setGrantUserIds(""); }} />
                <span style={{ alignSelf: "center", color: "var(--muted)" }}>to</span>
                <input type="date" value={grantTo} min={grantFrom || undefined} onChange={(e) => setGrantTo(e.target.value)} />
              </div>
              <em className="adm-card-sub">Leave “to” blank to target just the “from” day.</em>
            </div>
            <label className="adm-modal-field"><span>…or specific user IDs (comma-separated)</span>
              <input value={grantUserIds} onChange={(e) => { setGrantUserIds(e.target.value); if (e.target.value) { setGrantFrom(""); setGrantTo(""); } }} placeholder="12, 407, 410" />
            </label>
            {grantMsg && <div className={grantMsg.startsWith("✓") ? "adm-save-ok" : "adm-save-err"}>{grantMsg}</div>}
            <button type="button" className="hero-btn primary" disabled={granting || !grantFor} onClick={grant}>{granting ? "Sending…" : "Send voucher"}</button>
          </div>
        </div>
      </div>

      {/* List */}
      <div className="adm-card">
        <div className="adm-card-head-row"><h2>All vouchers</h2></div>
        <div className="adm-table-scroll">
          <table className="adm-table">
            <thead>
              <tr><th>Code</th><th>Title</th><th>Discount</th><th>Applies to</th><th className="adm-num">Sent</th><th className="adm-num">Used</th><th>Expires</th></tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={7} className="adm-empty">Loading…</td></tr>}
              {!loading && rows.length === 0 && <tr><td colSpan={7} className="adm-empty">No vouchers yet.</td></tr>}
              {rows.map((v) => (
                <tr key={v.id}>
                  <td className="adm-login">{v.code}</td>
                  <td>{v.title}</td>
                  <td>{discountLabel(v)}</td>
                  <td className="adm-email">{scopeLabel(v)}</td>
                  <td className="adm-num">{v.granted}</td>
                  <td className="adm-num">{v.used}</td>
                  <td className="adm-date">{v.expiresAt ? v.expiresAt.slice(0, 10) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
