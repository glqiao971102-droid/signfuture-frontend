"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api, type AdminWalletSummary } from "@/lib/api";

const money = (n: number) =>
  n.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function formatDateTime(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value.includes("T") ? value : value.replace(" ", "T"));
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("en-MY", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AdminWallet() {
  const [summary, setSummary] = useState<AdminWalletSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Adjustment form — target the customer by email.
  const [email, setEmail] = useState("");
  const [amount, setAmount] = useState("");
  const [type, setType] = useState<"credit" | "debit">("credit");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setSummary(await api.adminWalletSummary());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load wallet data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function submitAdjust(e: React.FormEvent) {
    e.preventDefault();
    setResult(null);
    setFormError(null);
    const mail = email.trim();
    const amt = Number(amount);
    if (!mail || !mail.includes("@")) return setFormError("Enter a valid customer email.");
    if (!(amt > 0)) return setFormError("Amount must be greater than 0.");
    if (!reason.trim()) return setFormError("A reason is required for the audit trail.");

    setSubmitting(true);
    try {
      const r = await api.adminAdjustWallet({ email: mail, amount: amt, type, reason: reason.trim() });
      setResult(
        `${type === "credit" ? "Credited" : "Debited"} RM ${money(amt)} to ${r.name} (${r.email}). New balance: RM ${money(r.balance)}.`,
      );
      setAmount("");
      setReason("");
      await load();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Adjustment failed";
      setFormError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="adm-wrap">
      {error && <div className="quote-empty">{error}</div>}

      {summary && (
        <div className="adm-kpi-grid">
          <div className="adm-card adm-kpi">
            <span className="adm-kpi-label">Total top-ups</span>
            <strong className="adm-kpi-value">RM {money(summary.totals.topups)}</strong>
          </div>
          <div className="adm-card adm-kpi">
            <span className="adm-kpi-label">Total spent</span>
            <strong className="adm-kpi-value">RM {money(summary.totals.spent)}</strong>
          </div>
          <div className="adm-card adm-kpi">
            <span className="adm-kpi-label">Outstanding liability</span>
            <strong className="adm-kpi-value adm-kpi-warn">RM {money(summary.totals.liability)}</strong>
          </div>
        </div>
      )}

      <div className="adm-two-col">
        <div className="adm-card">
          <div className="adm-card-head-row">
            <h2>Manual adjustment</h2>
          </div>
          <p className="adm-card-sub">
            Credits or debits a member&apos;s wallet and records it in the ledger with your name.
            Debits cannot take a balance below zero.
          </p>
          <form onSubmit={submitAdjust} className="adm-adjust-form">
            <label className="adm-modal-field">
              <span>Customer email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. customer@email.com"
                autoCapitalize="none"
                autoCorrect="off"
              />
            </label>
            <label className="adm-modal-field">
              <span>Amount (RM)</span>
              <input
                type="number"
                min={0.01}
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
              />
            </label>
            <div className="adm-modal-field">
              <span>Type</span>
              <div className="adm-radio-row">
                <button
                  type="button"
                  className={`adm-filter${type === "credit" ? " is-active" : ""}`}
                  onClick={() => setType("credit")}
                >
                  + Credit
                </button>
                <button
                  type="button"
                  className={`adm-filter${type === "debit" ? " is-active" : ""}`}
                  onClick={() => setType("debit")}
                >
                  − Debit
                </button>
              </div>
            </div>
            <label className="adm-modal-field">
              <span>Reason</span>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={200}
                placeholder="e.g. Goodwill refund for order #7920"
              />
            </label>
            {formError && <div className="adm-save-err">{formError}</div>}
            {result && <div className="adm-save-ok">{result}</div>}
            <button type="submit" className="hero-btn primary" disabled={submitting}>
              {submitting ? "Applying…" : "Apply adjustment"}
            </button>
          </form>
        </div>

        <div className="adm-card">
          <div className="adm-card-head-row">
            <h2>Highest balances</h2>
          </div>
          <div className="adm-table-scroll">
            <table className="adm-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th className="adm-num">Balance (RM)</th>
                </tr>
              </thead>
              <tbody>
                {loading && <tr><td colSpan={2} className="adm-empty">Loading…</td></tr>}
                {summary?.topBalances.map((b) => (
                  <tr key={b.userId}>
                    <td>
                      <Link href={`/admin/users/${b.userId}`} className="adm-edit-link">
                        {b.login}
                      </Link>
                      <div className="adm-card-sub">{b.email}</div>
                    </td>
                    <td className="adm-num adm-mono">{money(b.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="adm-card">
        <div className="adm-card-head-row">
          <h2>Recent transactions</h2>
        </div>
        <div className="adm-table-scroll">
          <table className="adm-table">
            <thead>
              <tr>
                <th>When</th>
                <th>User</th>
                <th>Type</th>
                <th className="adm-num">Amount (RM)</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={5} className="adm-empty">Loading…</td></tr>}
              {summary?.recent.map((t) => (
                <tr key={t.id}>
                  <td className="adm-date">{formatDateTime(t.date)}</td>
                  <td>
                    <Link href={`/admin/users/${t.userId}`} className="adm-edit-link">
                      #{t.userId}
                    </Link>
                  </td>
                  <td>
                    <span className={`adm-chip ${t.type === "credit" ? "adm-stage-completed" : "adm-stage-cancelled"}`}>
                      {t.type}
                    </span>
                  </td>
                  <td className="adm-num adm-mono">
                    {t.type === "credit" ? "+" : "−"}
                    {money(t.amount)}
                  </td>
                  <td className="adm-email">{t.details ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
