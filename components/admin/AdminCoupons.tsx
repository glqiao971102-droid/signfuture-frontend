"use client";

import { useEffect, useState } from "react";
import { api, type AdminCouponRow } from "@/lib/api";

const money = (n: number) =>
  n.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function describeType(c: AdminCouponRow): string {
  if (c.type === "percent") return `${c.amount}% off`;
  if (c.type === "fixed_product") return `RM ${money(c.amount)} off product`;
  return `RM ${money(c.amount)} off cart`;
}

export default function AdminCoupons() {
  const [rows, setRows] = useState<AdminCouponRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showInactive, setShowInactive] = useState(true);

  useEffect(() => {
    api
      .adminCoupons()
      .then((r) => setRows(r.data))
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load coupons"))
      .finally(() => setLoading(false));
  }, []);

  const visible = showInactive ? rows : rows.filter((c) => c.active);

  return (
    <div className="adm-wrap">
      <div className="adm-toolbar">
        <div className="adm-filters">
          <button
            type="button"
            className={`adm-filter${showInactive ? " is-active" : ""}`}
            onClick={() => setShowInactive(true)}
          >
            All
          </button>
          <button
            type="button"
            className={`adm-filter${!showInactive ? " is-active" : ""}`}
            onClick={() => setShowInactive(false)}
          >
            Active only
          </button>
        </div>
      </div>

      <div className="adm-count">
        {loading ? "Loading…" : `${visible.length} coupon${visible.length === 1 ? "" : "s"}`}
      </div>

      {error && <div className="quote-empty">{error}</div>}

      <div className="adm-table-scroll">
        <table className="adm-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Discount</th>
              <th className="adm-num">Used</th>
              <th className="adm-num">Limit</th>
              <th className="adm-num">Min spend</th>
              <th>Expires</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={7} className="adm-empty">Loading coupons…</td></tr>}
            {!loading && visible.length === 0 && (
              <tr><td colSpan={7} className="adm-empty">No coupons.</td></tr>
            )}
            {visible.map((c) => (
              <tr key={c.id}>
                <td className="adm-login">
                  {c.code}
                  {c.freeShipping && <span className="adm-chip adm-chip-member"> + free ship</span>}
                </td>
                <td>{describeType(c)}</td>
                <td className="adm-num">{c.used}</td>
                <td className="adm-num">{c.usageLimit ?? "∞"}</td>
                <td className="adm-num">{c.minSpend ? `RM ${money(c.minSpend)}` : "—"}</td>
                <td className="adm-date">{c.expiry ?? "—"}</td>
                <td>
                  <span className={`adm-chip ${c.active ? "adm-stage-completed" : "adm-stage-cancelled"}`}>
                    {c.active ? "Active" : "Inactive"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
