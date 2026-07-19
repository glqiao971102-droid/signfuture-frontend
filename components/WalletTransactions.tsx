"use client";

import { useCallback, useEffect, useState } from "react";
import { api, type WalletTransaction } from "@/lib/api";

const PER_PAGE = 20;

type Filter = "all" | "credit" | "debit";

const money = (n: number) =>
  n.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** "2026-07-08 13:32:26" / ISO -> "08 Jul 2026, 13:32" */
function formatDate(value: string): string {
  const d = new Date(value.includes("T") ? value : value.replace(" ", "T"));
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("en-MY", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/**
 * The signed-in member's wallet history, straight from the legacy
 * WooWallet transaction table.
 */
export default function WalletTransactions() {
  const [rows, setRows] = useState<WalletTransaction[]>([]);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [filter, setFilter] = useState<Filter>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (p: number, f: Filter) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.transactions(p, PER_PAGE, f === "all" ? undefined : f);
      setRows(res.data);
      setLastPage(res.meta.lastPage);
      setTotal(res.meta.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load transactions");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(page, filter);
  }, [page, filter, load]);

  function changeFilter(f: Filter) {
    setFilter(f);
    setPage(1); // a filtered list has different pages; never keep the old index
  }

  return (
    <div className="wallet-tx">
      <div className="wallet-tx-bar">
        <div className="wallet-tx-filters">
          {(["all", "credit", "debit"] as Filter[]).map((f) => (
            <button
              key={f}
              type="button"
              className={`wallet-tx-filter${filter === f ? " is-active" : ""}`}
              onClick={() => changeFilter(f)}
            >
              {f === "all" ? "All" : f === "credit" ? "Top Up" : "Spent"}
            </button>
          ))}
        </div>
        {!loading && !error && (
          <span className="wallet-tx-count">
            {total.toLocaleString()} transaction{total === 1 ? "" : "s"}
          </span>
        )}
      </div>

      {error && <div className="quote-empty">{error}</div>}
      {loading && <div className="quote-empty">Loading transactions…</div>}
      {!loading && !error && rows.length === 0 && (
        <div className="quote-empty">No transactions yet.</div>
      )}

      {!loading && !error && rows.length > 0 && (
        <>
          <div className="wallet-tx-table" role="table">
            <div className="wallet-tx-head" role="row">
              <span role="columnheader">Date</span>
              <span role="columnheader">Details</span>
              <span role="columnheader">Amount</span>
              <span role="columnheader">Balance</span>
            </div>
            {rows.map((t) => (
              <div key={t.id} className="wallet-tx-row" role="row">
                <span className="wallet-tx-date">{formatDate(t.date)}</span>
                <span className="wallet-tx-details">{t.details || "—"}</span>
                <span className={`wallet-tx-amount is-${t.type}`}>
                  {t.type === "credit" ? "+" : "−"} RM {money(t.amount)}
                </span>
                <span className="wallet-tx-balance">RM {money(t.balance)}</span>
              </div>
            ))}
          </div>

          {lastPage > 1 && (
            <div className="wallet-tx-pager">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
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
        </>
      )}
    </div>
  );
}
