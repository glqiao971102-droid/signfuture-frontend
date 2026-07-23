"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";

type TierRow = { tier: string; members: number };

const TIER_STYLE: Record<string, string> = {
  Diamond: "tier-diamond",
  Gold: "tier-gold",
  Silver: "tier-silver",
  Customer: "tier-member",
  Admin: "adm-chip-admin",
  Other: "adm-chip-member",
};

const SETTABLE = ["Diamond", "Gold", "Silver", "customer"] as const;

export default function AdminTiers() {
  const [tiers, setTiers] = useState<TierRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Quick change tool
  const [userId, setUserId] = useState("");
  const [tier, setTier] = useState<(typeof SETTABLE)[number]>("Silver");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const stats = await api.adminStatsRanged();
      setTiers(stats.tiers ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load tiers");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const totalMembers = tiers.reduce((s, t) => s + t.members, 0);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setResult(null);
    setFormError(null);
    const uid = Number(userId);
    if (!Number.isInteger(uid) || uid <= 0) return setFormError("Enter a valid user ID.");
    setSubmitting(true);
    try {
      const r = await api.adminUpdateUserTier(uid, tier);
      setResult(`User #${uid} is now ${r.tier ?? "a plain member (no tier)"}.`);
      setUserId("");
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not change tier");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="adm-wrap">
      {error && <div className="quote-empty">{error}</div>}

      <div className="adm-card">
        <div className="adm-card-head-row">
          <h2>Membership distribution</h2>
          <span className="adm-card-sub">{totalMembers.toLocaleString()} accounts</span>
        </div>
        <div className="adm-tier-bars">
          {loading && <p>Loading…</p>}
          {tiers.map((t) => {
            const pct = totalMembers ? (t.members / totalMembers) * 100 : 0;
            return (
              <div key={t.tier} className="adm-tier-bar-row">
                <span className={`adm-chip ${TIER_STYLE[t.tier] ?? "adm-chip-member"}`}>{t.tier}</span>
                <div className="adm-tier-bar-track">
                  <div className="adm-tier-bar-fill" style={{ width: `${Math.max(pct, 2)}%` }} />
                </div>
                <span className="adm-mono adm-tier-bar-count">
                  {t.members} · {pct.toFixed(1)}%
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="adm-two-col">
        <div className="adm-card">
          <div className="adm-card-head-row">
            <h2>Change a member&apos;s tier</h2>
          </div>
          <p className="adm-card-sub">
            Rewrites the member&apos;s WordPress role. Administrator accounts are protected and
            cannot be changed here. To find a user ID, open{" "}
            <Link href="/admin/users" className="adm-edit-link">
              Customers
            </Link>
            .
          </p>
          <form onSubmit={submit} className="adm-adjust-form">
            <label className="adm-modal-field">
              <span>User ID</span>
              <input
                type="number"
                min={1}
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder="e.g. 12"
              />
            </label>
            <label className="adm-modal-field">
              <span>New tier</span>
              <select
                className="adm-select"
                value={tier}
                onChange={(e) => setTier(e.target.value as (typeof SETTABLE)[number])}
              >
                <option value="Diamond">Diamond</option>
                <option value="Gold">Gold</option>
                <option value="Silver">Silver</option>
                <option value="customer">No tier (plain member)</option>
              </select>
            </label>
            {formError && <div className="adm-save-err">{formError}</div>}
            {result && <div className="adm-save-ok">{result}</div>}
            <button type="submit" className="hero-btn primary" disabled={submitting}>
              {submitting ? "Saving…" : "Update tier"}
            </button>
          </form>
        </div>

        <div className="adm-card">
          <div className="adm-card-head-row">
            <h2>Tiers</h2>
          </div>
          <ul className="adm-tier-legend">
            <li><span className="adm-chip tier-diamond">Diamond</span> Highest tier — best pricing.</li>
            <li><span className="adm-chip tier-gold">Gold</span> Mid tier.</li>
            <li><span className="adm-chip tier-silver">Silver</span> Entry membership tier.</li>
            <li><span className="adm-chip adm-chip-member">Customer</span> Registered, no tier.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
