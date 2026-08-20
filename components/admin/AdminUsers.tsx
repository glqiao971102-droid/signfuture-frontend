"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api, type AdminUserRow } from "@/lib/api";

const PER_PAGE = 25;

const ROLE_FILTERS = [
  { value: "", label: "All" },
  { value: "Diamond", label: "Diamond" },
  { value: "Gold", label: "Gold" },
  { value: "Silver", label: "Silver" },
  { value: "customer", label: "No tier" },
  { value: "admin", label: "Admins" },
];

const money = (n: number) =>
  n.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function formatDate(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value.includes("T") ? value : value.replace(" ", "T"));
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-MY", { day: "2-digit", month: "short", year: "numeric" });
}

function tierClass(u: AdminUserRow): string {
  if (u.isAdmin) return "adm-chip adm-chip-admin";
  if (!u.tier) return "adm-chip adm-chip-member";
  return `adm-chip tier-${u.tier.toLowerCase()}`;
}

export default function AdminUsers() {
  const [rows, setRows] = useState<AdminUserRow[]>([]);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (p: number, searchTerm: string, roleFilter: string) => {
      setLoading(true);
      setError(null);
      try {
        const res = await api.adminUsers({
          page: p,
          perPage: PER_PAGE,
          search: searchTerm || undefined,
          role: roleFilter || undefined,
        });
        setRows(res.data);
        setLastPage(res.meta.lastPage);
        setTotal(res.meta.total);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load users");
        setRows([]);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  // Debounce the search box so we don't fire a request on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => {
      setPage(1);
      void load(1, search, role);
    }, 300);
    return () => clearTimeout(t);
  }, [search, role, load]);

  useEffect(() => {
    void load(page, search, role);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  return (
    <div className="adm-wrap">
      <div className="adm-toolbar">
        <input
          className="adm-search"
          type="search"
          placeholder="Search login, email or name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="adm-filters">
          {ROLE_FILTERS.map((f) => (
            <button
              key={f.value || "all"}
              type="button"
              className={`adm-filter${role === f.value ? " is-active" : ""}`}
              onClick={() => setRole(f.value)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="adm-count">
        {loading ? "Loading…" : `${total.toLocaleString()} user${total === 1 ? "" : "s"}`}
      </div>

      {error && <div className="quote-empty">{error}</div>}

      {!error && (
        <div className="adm-table-scroll">
          <table className="adm-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Login</th>
                <th>Email</th>
                <th>Tier</th>
                <th>Consultant</th>
                <th className="adm-num">Wallet (RM)</th>
                <th>Registered</th>
              </tr>
            </thead>
            <tbody>
              {loading && rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="adm-empty">
                    Loading users…
                  </td>
                </tr>
              )}
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="adm-empty">
                    No users match.
                  </td>
                </tr>
              )}
              {rows.map((u) => (
                <tr key={u.id}>
                  <td className="adm-mono">{u.id}</td>
                  <td className="adm-login">
                    <Link href={`/admin/users/${u.id}`} className="adm-edit-link">
                      {u.login}
                    </Link>
                  </td>
                  <td className="adm-email">{u.email}</td>
                  <td>
                    <span className={tierClass(u)}>
                      {u.isAdmin ? "ADMIN" : u.tier ?? "Member"}
                    </span>
                  </td>
                  <td className="adm-email">{u.isAdmin ? "—" : u.consultant || "—"}</td>
                  <td className="adm-num adm-mono">{money(u.walletBalance)}</td>
                  <td className="adm-date">{formatDate(u.registeredAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {lastPage > 1 && (
        <div className="adm-pager">
          <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
            ← Prev
          </button>
          <span>
            Page {page} of {lastPage}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(lastPage, p + 1))}
            disabled={page >= lastPage}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
