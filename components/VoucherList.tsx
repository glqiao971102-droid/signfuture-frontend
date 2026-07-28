"use client";

import { useEffect, useState } from "react";
import { api, type Voucher } from "@/lib/api";

/** ISO date "2026-08-31" -> "31 Aug 2026". */
function formatDate(value: string | null): string {
  if (!value) return "No expiry";
  const d = new Date(value.includes("T") ? value : value + "T00:00:00");
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-MY", { day: "2-digit", month: "short", year: "numeric" });
}

const STATUS_LABEL: Record<Voucher["status"], string> = {
  active: "Active",
  upcoming: "Coming soon",
  expired: "Expired",
  inactive: "Inactive",
};

/**
 * The signed-in member's vouchers, from the backend. Shows the discount, what
 * it applies to, the minimum spend, and when it expires.
 */
export default function VoucherList() {
  const [rows, setRows] = useState<Voucher[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await api.vouchers();
        if (!cancelled) setRows(res.data);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load vouchers");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return <p className="voucher-empty">Loading your vouchers…</p>;
  if (error) return <p className="voucher-empty is-error">{error}</p>;
  if (rows.length === 0) {
    return <p className="voucher-empty">You have no vouchers right now. Check back after a top-up or promotion.</p>;
  }

  return (
    <div className="voucher-grid">
      {rows.map((v) => {
        const dead = v.status === "expired" || v.status === "inactive";
        return (
          <article key={v.code} className={`voucher-card${dead ? " is-dead" : ""}`}>
            {/* left stub: the discount */}
            <div className="voucher-amount">
              <strong>{v.discountLabel}</strong>
            </div>

            {/* body */}
            <div className="voucher-body">
              <div className="voucher-top">
                <h3>
                  {v.title}
                  {v.membersOnly && (
                    <span className="voucher-members">{v.requiredTier ?? "Members"}</span>
                  )}
                </h3>
                <span className={`voucher-status status-${v.status}`}>{STATUS_LABEL[v.status]}</span>
              </div>

              {v.description && <p className="voucher-desc">{v.description}</p>}

              <dl className="voucher-meta">
                <div>
                  <dt>Applies to</dt>
                  <dd>{v.appliesTo}</dd>
                </div>
                {v.minSpend != null && (
                  <div>
                    <dt>Min. spend</dt>
                    <dd>RM {v.minSpend.toFixed(2)}</dd>
                  </div>
                )}
                <div>
                  <dt>Expires</dt>
                  <dd>{formatDate(v.expiresAt)}</dd>
                </div>
              </dl>

              <div className="voucher-code">
                <span>Code</span>
                <code>{v.code}</code>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
