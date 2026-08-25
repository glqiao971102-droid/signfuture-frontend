"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";

type Level = "view" | "edit";
type Perms = Record<string, Level>;
type AdminRow = { id: number; login: string; email: string; level: "super" | "admin"; permissions: Perms };
type Section = { key: string; editable: boolean };

// Display names + optional group heading, in the order sections should appear.
const LABEL: Record<string, string> = {
  dashboard: "Dashboard",
  orders: "Orders",
  quotations: "Quotations",
  customers: "Customers",
  wallet: "Wallet",
  invoices: "Invoices",
  coupons: "Coupons",
  vouchers: "Vouchers",
  tiers: "Membership",
  "agent-logins": "Agent Logins",
  products: "Products",
  "sales-listing": "Sales Listing",
  installations: "Installations",
  visitors: "Visitors",
  "production-flow": "Production Flow (Kanban)",
  "production-detail": "Production Detail (stats & holidays)",
  "production-nesting": "3D Printer Nesting",
  dropbox: "SF Dropbox",
};
// Sub-features that render under a shared group heading.
const GROUP: Record<string, string> = {
  "production-flow": "Production",
  "production-detail": "Production",
  "production-nesting": "Production",
};

export default function AdminPermissionsPage() {
  const [sections, setSections] = useState<Section[]>([]);
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

  // Set a section to No access (null), View, or Operate for one admin.
  function setLevel(id: number, key: string, level: Level | null) {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        const next: Perms = { ...r.permissions };
        if (level == null) delete next[key];
        else next[key] = level;
        return { ...r, permissions: next };
      }),
    );
  }

  async function save(row: AdminRow) {
    setSavingId(row.id);
    setSavedId(null);
    setError(null);
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
        <p>
          Super admins have full access. For other admins, set each feature to{" "}
          <strong>No access</strong>, <strong>View only</strong> (can open &amp; read, cannot change),
          or <strong>Operate</strong> (can also create / edit / delete).
        </p>
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
              <div className="perm-grid">
                {sections.map((s, i) => {
                  const cur = r.permissions[s.key] ?? null;
                  const group = GROUP[s.key];
                  const showHead = group && GROUP[sections[i - 1]?.key] !== group;
                  return (
                    <div key={s.key} style={{ display: "contents" }}>
                      {showHead && <div className="perm-group">{group}</div>}
                      <div className="perm-row">
                        <span className="perm-label">{LABEL[s.key] ?? s.key}</span>
                        <div className="perm-seg" role="group" aria-label={LABEL[s.key] ?? s.key}>
                          <button
                            type="button"
                            className={`perm-seg-btn${cur == null ? " is-none" : ""}`}
                            onClick={() => setLevel(r.id, s.key, null)}
                          >
                            No access
                          </button>
                          <button
                            type="button"
                            className={`perm-seg-btn${cur === "view" ? " is-view" : ""}`}
                            onClick={() => setLevel(r.id, s.key, "view")}
                          >
                            View
                          </button>
                          {s.editable && (
                            <button
                              type="button"
                              className={`perm-seg-btn${cur === "edit" ? " is-edit" : ""}`}
                              onClick={() => setLevel(r.id, s.key, "edit")}
                            >
                              Operate
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
