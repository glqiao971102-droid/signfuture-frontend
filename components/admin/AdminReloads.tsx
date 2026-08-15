"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api, type AdminReloadRow } from "@/lib/api";

const PER_PAGE = 25;

const money = (n: number) =>
  n.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function formatDate(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value.includes("T") ? value : value.replace(" ", "T"));
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-MY", { day: "2-digit", month: "short", year: "numeric" });
}

/**
 * Reload (top-up) reconciliation. Every settled top-up shows here as a slip:
 * "Pending Confirmation" until the admin has checked the bank account and marks
 * it "Collected". The wallet was already credited when the top-up settled — this
 * is a bookkeeping view, so marking Collected changes nothing about balances.
 */
export default function AdminReloads() {
  const [rows, setRows] = useState<AdminReloadRow[]>([]);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"" | "pending" | "collected">("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<number | null>(null);

  const load = useCallback(
    async (p: number, s: string, term: string) => {
      setLoading(true);
      setError(null);
      try {
        const res = await api.adminReloads({
          page: p,
          perPage: PER_PAGE,
          status: (s || undefined) as "pending" | "collected" | undefined,
          search: term || undefined,
        });
        setRows(res.data);
        setLastPage(res.meta.lastPage);
        setTotal(res.meta.total);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load reloads");
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  // Debounce search; reset to page 1 on any filter change.
  useEffect(() => {
    const t = setTimeout(() => {
      setPage(1);
      void load(1, status, search);
    }, 250);
    return () => clearTimeout(t);
  }, [search, status, load]);

  useEffect(() => {
    void load(page, status, search);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  async function toggle(r: AdminReloadRow) {
    if (savingId) return;
    setSavingId(r.id);
    try {
      await api.adminSetReloadCollected(r.id, !r.collected);
      setRows((rs) =>
        rs
          .map((x) =>
            x.id === r.id
              ? { ...x, collected: !r.collected, status: !r.collected ? "collection" : "pending_confirmation", statusLabel: !r.collected ? "Collected" : "Pending Confirmation" }
              : x,
          )
          // If filtering to one status, drop the row that no longer matches.
          .filter((x) => (status === "collected" ? x.collected : status === "pending" ? !x.collected : true)),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update the reload");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="adm-wrap">
      <div className="adm-toolbar">
        <input
          className="adm-search"
          type="search"
          placeholder="Search reference, name or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="adm-select"
          value={status}
          onChange={(e) => setStatus(e.target.value as "" | "pending" | "collected")}
        >
          <option value="">All reloads</option>
          <option value="pending">Pending Confirmation</option>
          <option value="collected">Collected</option>
        </select>
      </div>

      <div className="adm-count">
        {loading ? "Loading…" : `${total.toLocaleString()} reload${total === 1 ? "" : "s"}`}
      </div>

      {error && <div className="quote-empty">{error}</div>}

      <div className="adm-table-scroll">
        <table className="adm-table">
          <thead>
            <tr>
              <th>Reload</th>
              <th>Customer</th>
              <th>Status</th>
              <th className="adm-num">Amount (RM)</th>
              <th>Date</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading && rows.length === 0 && (
              <tr>
                <td colSpan={6} className="adm-empty">Loading reloads…</td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={6} className="adm-empty">No reloads match.</td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="adm-mono">
                  RL-{r.id}
                  <span className="adm-chip adm-chip-member" style={{ marginLeft: 6 }}>
                    {r.provider === "stripe" ? "Card" : r.provider === "ipay88" ? "iPay88" : "Top-up"}
                  </span>
                </td>
                <td>
                  {r.userId ? (
                    <Link href={`/admin/users/${r.userId}`} className="adm-edit-link">
                      {r.customer}
                    </Link>
                  ) : (
                    r.customer
                  )}
                </td>
                <td>
                  <span
                    className={`adm-chip ${r.collected ? "adm-stage-completed" : "adm-chip-member"}`}
                  >
                    {r.statusLabel}
                  </span>
                </td>
                <td className="adm-num adm-mono">{money(r.amount)}</td>
                <td className="adm-date">{formatDate(r.date)}</td>
                <td className="adm-num">
                  <button
                    type="button"
                    className={`adm-filter${r.collected ? "" : " is-active"}`}
                    disabled={savingId === r.id}
                    onClick={() => toggle(r)}
                  >
                    {savingId === r.id
                      ? "Saving…"
                      : r.collected
                        ? "Undo"
                        : "✓ Mark Collected"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {lastPage > 1 && (
        <div className="wallet-tx-pager">
          <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
            ← Prev
          </button>
          <span>Page {page} of {lastPage}</span>
          <button type="button" onClick={() => setPage((p) => Math.min(lastPage, p + 1))} disabled={page >= lastPage}>
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
