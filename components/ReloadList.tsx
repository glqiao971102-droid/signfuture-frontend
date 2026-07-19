"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { api, type WalletTransaction } from "@/lib/api";
import {
  buildReloadSlipPdf,
  downloadBlob,
  ringgitInWords,
  type ReloadSlipData,
} from "@/lib/invoicePdf";

const PER_PAGE = 10;

const money = (n: number) =>
  n.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function formatDate(value: string): string {
  const d = new Date(value.includes("T") ? value : value.replace(" ", "T"));
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-MY", { day: "2-digit", month: "short", year: "numeric" });
}

/**
 * The member's real top-up history — the credit side of the WooWallet ledger.
 *
 * The legacy data records no payment method or failed attempts: a credit row
 * only exists once money actually landed, so every entry here is a successful
 * top-up.
 */
export default function ReloadList() {
  const { user } = useAuth();
  const [rows, setRows] = useState<WalletTransaction[]>([]);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (p: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.transactions(p, PER_PAGE, "credit");
      setRows(res.data);
      setLastPage(res.meta.lastPage);
      setTotal(res.meta.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load your top-up history");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(page);
  }, [page, load]);

  function download(tx: WalletTransaction) {
    // "Billing To" now comes from the member's real WooCommerce billing
    // address rather than a locally cached address book.
    const billingTo = [(user?.name ?? "Guest").toUpperCase()];
    const b = user?.billing;
    if (b) {
      if (b.address_1) billingTo.push(b.address_1.toUpperCase());
      if (b.address_2) billingTo.push(b.address_2.toUpperCase());
      const cityLine = [b.postcode, b.city].filter(Boolean).join(" ");
      if (cityLine) billingTo.push(cityLine.toUpperCase());
      if (b.state) billingTo.push(`${b.state} MALAYSIA`.toUpperCase());
    }

    const longDate = new Date(
      tx.date.includes("T") ? tx.date : tx.date.replace(" ", "T"),
    ).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

    const data: ReloadSlipData = {
      transactionDate: longDate,
      transactionNo: String(tx.id),
      agentCode: user?.memberNo ?? "—",
      billingTo,
      rows: [{ method: tx.details || "Wallet top-up", amount: money(tx.amount) }],
      handlingCharge: "0.00",
      totalAmount: money(tx.amount),
      amountInWords: ringgitInWords(tx.amount),
    };
    downloadBlob(buildReloadSlipPdf(data), `Reload-${tx.id}.pdf`);
  }

  return (
    <>
      {error && <div className="quote-empty">{error}</div>}
      {loading && !error && <div className="quote-empty">Loading top-ups…</div>}
      {!loading && !error && rows.length === 0 && (
        <div className="quote-empty">You have no top-ups yet.</div>
      )}

      {!loading && !error && rows.length > 0 && (
        <>
          <div className="wallet-tx-bar">
            <span className="wallet-tx-count">
              {total.toLocaleString()} top-up{total === 1 ? "" : "s"}
            </span>
          </div>

          <div className="rec-list">
            {rows.map((r) => (
              <article key={r.id} className="rec-card">
                <div className="rec-main">
                  <div className="rec-top">
                    <strong className="rec-ref">RL-{r.id}</strong>
                    <span className="rec-status rs-success">Success</span>
                  </div>
                  <span className="rec-date">{formatDate(r.date)}</span>
                  <p className="rec-desc">{r.details || "Wallet top-up"}</p>
                </div>
                <div className="rec-side">
                  <span className="rec-amount">+ RM {money(r.amount)}</span>
                  <button
                    type="button"
                    className="hero-btn primary rec-btn"
                    onClick={() => download(r)}
                  >
                    ⤓ Download PDF
                  </button>
                </div>
              </article>
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
    </>
  );
}
