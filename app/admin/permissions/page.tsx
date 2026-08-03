"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";

type AdminRow = { id: number; login: string; email: string; level: "super" | "admin"; permissions: string[] };

const SECTION_LABEL: Record<string, string> = {
  dashboard: "Dashboard",
  orders: "Orders",
  customers: "Customers",
  wallet: "Wallet",
  invoices: "Invoices",
  coupons: "Coupons",
  vouchers: "Vouchers",
  tiers: "Membership",
  "agent-logins": "Agent Logins",
  products: "Products",
  "sales-listing": "Sales Listing",
};

export default function AdminPermissionsPage() {
  const [sections, setSections] = useState<string[]>([]);
  const [rows, setRows] = useState<AdminRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [savedId, setSavedId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, a] = await Promise.all([api.adminAccessSections(), api.adminAccessAdmins()]);
      setSections(s.sections);
      setRows(a.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load. Super admin only.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  function toggle(id: number, section: string) {
    setRows((prev) =>
      prev.map((r) =>
        r.id === id
          ? { ...r, permissions: r.permissions.includes(section) ? r.permissions.filter((p) => p !== section) : [...r.permissions, section] }
          : r,
      ),
    );
  }

  async function save(row: AdminRow) {
    setSavingId(row.id);
    setSavedId(null);
    try {
      await api.adminSetAccess(row.id, row.permissions);
      setSavedId(row.id);
      setTimeout(() => setSavedId(null), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <>
      <div className="adm-page-head">
        <h1>Permissions</h1>
        <p>Super admins have full access. For other admins, choose which sections they can open.</p>
      </div>
      <div className="adm-wrap">
        {error && <div className="quote-empty">{error}</div>}
        {loading && <div className="adm-count">Loading…</div>}

        {rows.map((r) => (
          <div key={r.id} className="adm-card">
            <div className="adm-card-head-row">
              <h2>
                <Link href={`/admin/users/${r.id}`} className="adm-edit-link">{r.email || r.login}</Link>{" "}
                <span className={`adm-chip ${r.level === "super" ? "adm-chip-admin" : "adm-chip-member"}`}>
                  {r.level === "super" ? "SUPER ADMIN" : "ADMIN"}
                </span>
              </h2>
              {r.level === "admin" && (
                <button type="button" className="hero-btn primary" disabled={savingId === r.id} onClick={() => save(r)}>
                  {savingId === r.id ? "Saving…" : savedId === r.id ? "✓ Saved" : "Save"}
                </button>
              )}
            </div>
            {r.level === "super" ? (
              <p className="adm-card-sub">Full access to everything (set via SUPER_ADMIN_EMAILS).</p>
            ) : (
              <div className="reg-chips">
                {sections.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className={`reg-chip${r.permissions.includes(s) ? " is-active" : ""}`}
                    onClick={() => toggle(r.id, s)}
                  >
                    {SECTION_LABEL[s] ?? s}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
