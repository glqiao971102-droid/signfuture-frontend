"use client";

import { useCallback, useEffect, useState } from "react";
import { api, type VoucherRow, type AdminUserRow } from "@/lib/api";

const money = (n: number) =>
  n.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function discountLabel(v: VoucherRow) {
  return v.discountType === "percent" ? `${v.discountValue}% off` : `RM ${money(v.discountValue)} off`;
}
function scopeLabel(v: VoucherRow) {
  if (v.scopeType === "all") return "Any product";
  return `${v.scopeType}: ${v.scopeValues.join(", ")}`;
}

type GrantRow = { userId: number; login: string; email: string; status: string; usedAt: string | null };

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

  // Send / grant
  const [grantFor, setGrantFor] = useState<VoucherRow | null>(null);
  const [grantFrom, setGrantFrom] = useState("");
  const [grantTo, setGrantTo] = useState("");
  const [granting, setGranting] = useState(false);
  const [grantMsg, setGrantMsg] = useState<string | null>(null);

  // Recipient picker
  const [custSearch, setCustSearch] = useState("");
  const [custResults, setCustResults] = useState<AdminUserRow[]>([]);
  const [custLoading, setCustLoading] = useState(false);
  const [picked, setPicked] = useState<AdminUserRow[]>([]);

  // Re-send modal (per voucher "Sent" list)
  const [grantsFor, setGrantsFor] = useState<VoucherRow | null>(null);
  const [grantRows, setGrantRows] = useState<GrantRow[]>([]);
  const [grantsLoading, setGrantsLoading] = useState(false);
  const [reSelected, setReSelected] = useState<Set<number>>(new Set());
  const [resending, setResending] = useState(false);
  const [resendMsg, setResendMsg] = useState<string | null>(null);

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

  // Debounced customer search for the recipient picker.
  useEffect(() => {
    const term = custSearch.trim();
    if (term.length < 2) { setCustResults([]); return; }
    let cancelled = false;
    setCustLoading(true);
    const t = setTimeout(() => {
      api.adminUsers({ search: term, perPage: 15 })
        .then((r) => { if (!cancelled) setCustResults(r.data); })
        .catch(() => { if (!cancelled) setCustResults([]); })
        .finally(() => { if (!cancelled) setCustLoading(false); });
    }, 300);
    return () => { cancelled = true; clearTimeout(t); };
  }, [custSearch]);

  function togglePick(u: AdminUserRow) {
    setPicked((prev) => (prev.some((p) => p.id === u.id) ? prev.filter((p) => p.id !== u.id) : [...prev, u]));
  }

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
      } else if (picked.length) {
        target = { userIds: picked.map((p) => p.id) };
      } else {
        setGrantMsg("Pick recipients, or set a registration date range.");
        setGranting(false);
        return;
      }
      const r = await api.adminGrantVoucher(grantFor.id, target);
      setGrantMsg(`✓ Granted ${r.granted}${r.matched !== undefined ? ` of ${r.matched} matched` : ""}, emailed ${r.emailed}${r.skipped ? `, ${r.skipped} already had it` : ""}.`);
      setPicked([]); setCustSearch(""); setCustResults([]);
      await load();
    } catch (err) {
      setGrantMsg(err instanceof Error ? err.message : "Could not grant voucher");
    } finally {
      setGranting(false);
    }
  }

  async function openGrants(v: VoucherRow) {
    setGrantsFor(v);
    setGrantRows([]);
    setReSelected(new Set());
    setResendMsg(null);
    setGrantsLoading(true);
    try {
      const r = await api.adminVoucherGrants(v.id);
      setGrantRows(r.data);
    } catch {
      setResendMsg("Could not load recipients.");
    } finally {
      setGrantsLoading(false);
    }
  }

  function toggleRe(userId: number) {
    setReSelected((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId); else next.add(userId);
      return next;
    });
  }
  function toggleReAll() {
    setReSelected((prev) => (prev.size === grantRows.length ? new Set() : new Set(grantRows.map((g) => g.userId))));
  }

  async function resend() {
    if (!grantsFor || reSelected.size === 0) return;
    setResending(true);
    setResendMsg(null);
    try {
      const r = await api.adminResendVoucher(grantsFor.id, [...reSelected]);
      setResendMsg(`✓ Re-sent to ${r.emailed} of ${r.requested} selected.`);
      await load();
    } catch (err) {
      setResendMsg(err instanceof Error ? err.message : "Could not re-send.");
    } finally {
      setResending(false);
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

        {/* Send */}
        <div className="adm-card">
          <div className="adm-card-head-row"><h2>Send a voucher</h2></div>
          <p className="adm-card-sub">Pick a voucher, then choose recipients — search &amp; select customers, or send to everyone who registered within a date range. Each recipient gets an email with the code &amp; discount.</p>
          <div className="adm-adjust-form">
            <label className="adm-modal-field"><span>Voucher</span>
              <select className="adm-select" value={grantFor?.id ?? ""} onChange={(e) => setGrantFor(rows.find((r) => r.id === Number(e.target.value)) ?? null)}>
                <option value="">Select…</option>
                {rows.map((v) => <option key={v.id} value={v.id}>{v.code} — {v.title} ({discountLabel(v)})</option>)}
              </select>
            </label>

            {/* Recipient picker */}
            <div className="adm-modal-field"><span>Recipients — search customers</span>
              <input
                value={custSearch}
                onChange={(e) => { setCustSearch(e.target.value); if (e.target.value) { setGrantFrom(""); setGrantTo(""); } }}
                placeholder="Type a name or email…"
                disabled={!!grantFrom}
              />
              {picked.length > 0 && (
                <div className="reg-chips" style={{ marginTop: 6 }}>
                  {picked.map((p) => (
                    <button key={p.id} type="button" className="reg-chip is-active" onClick={() => togglePick(p)} title="Remove">
                      {p.email || p.login} ✕
                    </button>
                  ))}
                </div>
              )}
              {custLoading && <em className="adm-card-sub">Searching…</em>}
              {!custLoading && custSearch.trim().length >= 2 && (
                <div className="adm-picker-results">
                  {custResults.length === 0 && <em className="adm-card-sub">No customers match.</em>}
                  {custResults.map((u) => {
                    const on = picked.some((p) => p.id === u.id);
                    return (
                      <button key={u.id} type="button" className={`adm-picker-row${on ? " is-on" : ""}`} onClick={() => togglePick(u)}>
                        <span>{on ? "☑" : "☐"}</span>
                        <span className="adm-picker-name">{u.email || u.login}</span>
                        <span className="adm-picker-sub">#{u.id}{u.isAdmin ? " · admin" : u.tier ? ` · ${u.tier}` : ""}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="adm-modal-field"><span>…or send to everyone registered between</span>
              <div className="adm-radio-row">
                <input type="date" value={grantFrom} onChange={(e) => { setGrantFrom(e.target.value); if (e.target.value) { setPicked([]); setCustSearch(""); } }} />
                <span style={{ alignSelf: "center", color: "var(--muted)" }}>to</span>
                <input type="date" value={grantTo} min={grantFrom || undefined} onChange={(e) => setGrantTo(e.target.value)} />
              </div>
              <em className="adm-card-sub">Leave “to” blank to target just the “from” day.</em>
            </div>

            {grantMsg && <div className={grantMsg.startsWith("✓") ? "adm-save-ok" : "adm-save-err"}>{grantMsg}</div>}
            <button type="button" className="hero-btn primary" disabled={granting || !grantFor} onClick={grant}>
              {granting ? "Sending…" : grantFrom ? "Send to date range" : `Send to ${picked.length || 0} selected`}
            </button>
          </div>
        </div>
      </div>

      {/* List */}
      <div className="adm-card">
        <div className="adm-card-head-row"><h2>All vouchers</h2></div>
        <div className="adm-table-scroll">
          <table className="adm-table">
            <thead>
              <tr><th>Code</th><th>Title</th><th>Discount</th><th>Applies to</th><th className="adm-num">Sent</th><th className="adm-num">Used</th><th>Expires</th><th></th></tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={8} className="adm-empty">Loading…</td></tr>}
              {!loading && rows.length === 0 && <tr><td colSpan={8} className="adm-empty">No vouchers yet.</td></tr>}
              {rows.map((v) => (
                <tr key={v.id}>
                  <td className="adm-login">{v.code}</td>
                  <td>{v.title}</td>
                  <td>{discountLabel(v)}</td>
                  <td className="adm-email">{scopeLabel(v)}</td>
                  <td className="adm-num">{v.granted}</td>
                  <td className="adm-num">{v.used}</td>
                  <td className="adm-date">{v.expiresAt ? v.expiresAt.slice(0, 10) : "—"}</td>
                  <td>
                    <button type="button" className="adm-filter" disabled={v.granted === 0} onClick={() => openGrants(v)}>
                      Recipients ▸
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recipients / re-send modal */}
      {grantsFor && (
        <div className="adm-modal-overlay" onClick={() => setGrantsFor(null)}>
          <div className="adm-modal" style={{ maxWidth: 640, width: "100%" }} onClick={(e) => e.stopPropagation()}>
            <div className="adm-card-head-row">
              <h2>{grantsFor.code} — recipients</h2>
              <button type="button" className="adm-filter" onClick={() => setGrantsFor(null)}>✕</button>
            </div>
            <p className="adm-card-sub">Everyone this voucher was sent to. Tick people and re-send the email (e.g. a reminder to those who haven’t used it).</p>
            {grantsLoading ? (
              <p className="adm-card-sub">Loading…</p>
            ) : grantRows.length === 0 ? (
              <p className="adm-empty">No recipients yet.</p>
            ) : (
              <>
                <div className="adm-table-scroll" style={{ maxHeight: 360, overflowY: "auto" }}>
                  <table className="adm-table">
                    <thead>
                      <tr>
                        <th><input type="checkbox" checked={reSelected.size === grantRows.length && grantRows.length > 0} onChange={toggleReAll} /></th>
                        <th>Customer</th><th>Status</th><th>Used</th>
                      </tr>
                    </thead>
                    <tbody>
                      {grantRows.map((g) => (
                        <tr key={g.userId} onClick={() => toggleRe(g.userId)} style={{ cursor: "pointer" }}>
                          <td><input type="checkbox" checked={reSelected.has(g.userId)} onChange={() => toggleRe(g.userId)} onClick={(e) => e.stopPropagation()} /></td>
                          <td className="adm-email">{g.email || g.login}</td>
                          <td><span className={`adm-chip ${g.status === "used" ? "adm-chip-admin" : "adm-chip-member"}`}>{g.status}</span></td>
                          <td className="adm-date">{g.usedAt ? g.usedAt.slice(0, 10) : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {resendMsg && <div className={resendMsg.startsWith("✓") ? "adm-save-ok" : "adm-save-err"}>{resendMsg}</div>}
                <div className="adm-modal-actions">
                  <button type="button" className="hero-btn ghost" onClick={() => setGrantsFor(null)}>Close</button>
                  <button type="button" className="hero-btn primary" disabled={resending || reSelected.size === 0} onClick={resend}>
                    {resending ? "Re-sending…" : `Re-send email to ${reSelected.size} selected`}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
