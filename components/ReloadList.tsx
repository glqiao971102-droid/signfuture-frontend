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
import { DEV_PREVIEW } from "@/lib/preview";

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
/**
 * Banner shown when the member returns from iPay88. The gateway redirects to
 * /reload-status?payment=success|failed|error, and the wallet has already been
 * settled server-side by then.
 */
function PaymentOutcome({ onSettled }: { onSettled: () => void }) {
  const [state, setState] = useState<{ kind: string; ref: string | null } | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const kind = params.get("payment");
    if (!kind) return;

    setState({ kind, ref: params.get("ref") });

    // Refresh the balance/history now that the payment has landed, then drop
    // the query string so a reload doesn't show the banner again.
    if (kind === "success") onSettled();
    window.history.replaceState({}, "", window.location.pathname);
  }, [onSettled]);

  if (!state) return null;

  if (state.kind === "success") {
    return (
      <p className="login-notice" role="status">
        ✓ Top up successful{state.ref ? ` — reference ${state.ref}` : ""}. Your wallet balance
        has been updated.
      </p>
    );
  }

  return (
    <p className="login-error" role="alert">
      {state.kind === "failed"
        ? "Your payment was not completed. No money has been taken."
        : "We could not verify that payment. If you were charged, please contact support."}
    </p>
  );
}

// Sample top-ups shown in the preview (no backend). "Download PDF" builds the
// reload slip straight from these rows.
const SAMPLE_RELOADS: WalletTransaction[] = [
  {
    id: 2440,
    type: "credit",
    amount: 2000,
    balance: 1850.5,
    currency: "MYR",
    details: "Online Banking (FPX)",
    date: "2026-08-06 09:15:00",
  },
  {
    id: 2431,
    type: "credit",
    amount: 500,
    balance: 1350.5,
    currency: "MYR",
    details: "Wallet top-up",
    date: "2026-07-18 16:40:00",
  },
];

export default function ReloadList() {
  const { user, refresh } = useAuth();
  const [rows, setRows] = useState<WalletTransaction[]>([]);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const res = await api.transactions(p, PER_PAGE, "credit");
      setRows(res.data);
      setLastPage(res.meta.lastPage);
      setTotal(res.meta.total);
    } catch {
      // Not signed in to the backend (e.g. preview) — fall back to samples.
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Show the member's real top-ups; only fall back to samples in local dev.
  const shown = rows.length > 0 ? rows : DEV_PREVIEW ? SAMPLE_RELOADS : [];

  useEffect(() => {
    void load(page);
  }, [page, load]);

  async function download(tx: WalletTransaction) {
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
    downloadBlob(await buildReloadSlipPdf(data), `Reload-${tx.id}.pdf`);
  }

  const onSettled = useCallback(() => {
    void refresh();
    void load(1);
    setPage(1);
  }, [refresh, load]);

  return (
    <>
      <PaymentOutcome onSettled={onSettled} />

      {loading && <div className="quote-empty">Loading top-ups…</div>}
      {!loading && shown.length === 0 && (
        <div className="quote-empty">You have no top-ups yet.</div>
      )}

      {!loading && shown.length > 0 && (
        <>
          <div className="wallet-tx-bar">
            <span className="wallet-tx-count">
              {(rows.length > 0 ? total : shown.length).toLocaleString()} top-up{(rows.length > 0 ? total : shown.length) === 1 ? "" : "s"}
            </span>
          </div>

          <div className="rec-list">
            {shown.map((r) => (
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
