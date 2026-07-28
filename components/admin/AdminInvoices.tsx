"use client";

import { useCallback, useEffect, useState } from "react";
import { api, type AdminInvoiceRow } from "@/lib/api";

const PER_PAGE = 25;

const money = (n: number) =>
  n.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function formatDate(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value.includes("T") ? value : value.replace(" ", "T"));
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-MY", { day: "2-digit", month: "short", year: "numeric" });
}

export default function AdminInvoices() {
  const [rows, setRows] = useState<AdminInvoiceRow[]>([]);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (p: number, searchTerm: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.adminInvoices({ page: p, perPage: PER_PAGE, search: searchTerm || undefined });
      setRows(res.data);
      setLastPage(res.meta.lastPage);
      setTotal(res.meta.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load invoices");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      setPage(1);
      void load(1, search);
    }, 300);
    return () => clearTimeout(t);
  }, [search, load]);

  useEffect(() => {
    void load(page, search);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  return (
    <div className="adm-wrap">
      <div className="adm-toolbar">
        <input
          className="adm-search"
          type="search"
          placeholder="Search invoice #, order # or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button
          type="button"
          className="adm-filter"
          onClick={() => api.adminDownloadReport("orders").catch(() => {})}
        >
          ↓ Export orders CSV
        </button>
      </div>

      <div className="adm-count">
        {loading ? "Loading…" : `${total.toLocaleString()} invoice${total === 1 ? "" : "s"}`}
      </div>

      {error && <div className="quote-empty">{error}</div>}

      <div className="adm-table-scroll">
        <table className="adm-table">
          <thead>
            <tr>
              <th>Invoice</th>
              <th>Order</th>
              <th>Date</th>
              <th>Email</th>
              <th className="adm-num">Total (RM)</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {loading && rows.length === 0 && (
              <tr><td colSpan={6} className="adm-empty">Loading invoices…</td></tr>
            )}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={6} className="adm-empty">No invoices match.</td></tr>
            )}
            {rows.map((r) => (
              <tr key={r.orderId}>
                <td className="adm-mono">{r.invoiceNumber ?? "—"}</td>
                <td className="adm-mono">#{r.orderId}</td>
                <td className="adm-date">{formatDate(r.invoiceDate)}</td>
                <td className="adm-email">{r.email ?? "—"}</td>
                <td className="adm-num adm-mono">{money(r.total)}</td>
                <td>
                  <span className={`adm-chip ${r.paid ? "adm-stage-completed" : "adm-stage-cancelled"}`}>
                    {r.paid ? "Paid" : "Unpaid"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {lastPage > 1 && (
        <div className="adm-pager">
          <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
            ← Prev
          </button>
          <span>Page {page} of {lastPage}</span>
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
