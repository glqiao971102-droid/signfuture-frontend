"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { api, type InvoiceRow, type OrderDetail } from "@/lib/api";
import {
  buildInvoicePdf,
  downloadBlob,
  type InvoiceData,
  type EInvoiceItem,
} from "@/lib/invoicePdf";

const PER_PAGE = 10;

const money = (n: number) =>
  `RM ${n.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function formatDate(value: string): string {
  const d = new Date(value.includes("T") ? value : value.replace(" ", "T"));
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-MY", { day: "2-digit", month: "short", year: "numeric" });
}

/**
 * Real invoices, derived from the member's WooCommerce orders — an order
 * carries its invoice number and date in meta, there is no separate invoice
 * record. The PDF is built on demand from the order's line items.
 */
export default function InvoiceList() {
  const { user } = useAuth();
  const [rows, setRows] = useState<InvoiceRow[]>([]);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async (p: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.invoices(p, PER_PAGE);
      setRows(res.data);
      setLastPage(res.meta.lastPage);
      setTotal(res.meta.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load your invoices");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(page);
  }, [page, load]);

  /** Fetches the order behind an invoice and renders it as a PDF. */
  async function download(row: InvoiceRow) {
    if (busyId) return;
    setBusyId(row.orderId);
    try {
      const order = await api.order(row.orderId);
      downloadBlob(
        buildInvoicePdf(toInvoiceData(row, order, user?.name ?? "")),
        `${row.invoiceNumber ?? `Order-${row.orderId}`}.pdf`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not build the invoice PDF");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      {error && <div className="quote-empty">{error}</div>}
      {loading && !error && <div className="quote-empty">Loading invoices…</div>}
      {!loading && !error && rows.length === 0 && (
        <div className="quote-empty">You have no invoices yet.</div>
      )}

      {!loading && !error && rows.length > 0 && (
        <>
          <div className="wallet-tx-bar">
            <span className="wallet-tx-count">
              {total.toLocaleString()} invoice{total === 1 ? "" : "s"}
            </span>
          </div>

          <div className="rec-list">
            {rows.map((inv) => {
              // Every order here was paid from the wallet, so anything not
              // cancelled or failed is settled.
              const paid = !["wc-cancelled", "wc-failed", "wc-refunded"].includes(inv.status);
              return (
                <article key={inv.orderId} className="rec-card">
                  <div className="rec-main">
                    <div className="rec-top">
                      <strong className="rec-ref">{inv.invoiceNumber ?? `#${inv.orderId}`}</strong>
                      <span className={`rec-status ${paid ? "rs-success" : "rs-fail"}`}>
                        {paid ? "Paid" : inv.statusLabel}
                      </span>
                    </div>
                    <span className="rec-date">{formatDate(inv.invoiceDate)}</span>
                    <p className="rec-desc">Order #{inv.orderId}</p>
                  </div>
                  <div className="rec-side">
                    <span className="rec-amount">{money(inv.total)}</span>
                    <button
                      type="button"
                      className="hero-btn primary rec-btn"
                      onClick={() => download(inv)}
                      disabled={busyId === inv.orderId}
                    >
                      {busyId === inv.orderId ? "Preparing…" : "⤓ Download PDF"}
                    </button>
                  </div>
                </article>
              );
            })}
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

/** Maps a real order onto the e-invoice PDF's data shape. */
function toInvoiceData(row: InvoiceRow, order: OrderDetail, fallbackName: string): InvoiceData {
  const rm = (n: number) =>
    `RM${n.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const items: EInvoiceItem[] = order.lines
    .filter((l) => l.type === "line_item")
    .map((l, i) => {
      const qty = l.quantity || 1;
      return {
        itemRef: `#${order.id}-${i + 1}`,
        desc: l.name,
        // The configured options (material, finishing, size) become the spec
        // lines under the product name.
        details: l.options.map((o) => `${o.label}: ${o.value}`),
        qty: String(qty),
        unitPrice: rm(l.total / qty),
        amount: rm(l.total),
        disc: "-",
        // No SST was charged on any order in this dataset — order-level tax is
        // zero throughout — so tax is reported as 0% rather than invented.
        taxRate: "0%",
        taxAmount: rm(0),
        inclTax: rm(l.total),
      };
    });

  const b = order.billing;
  const buyerName =
    [b.first_name, b.last_name].filter(Boolean).join(" ").trim() || fallbackName || "Customer";

  return {
    title: "E-INVOICE",
    status: row.statusLabel,
    invoiceRef: row.invoiceNumber ?? `Order-${order.id}`,
    dateTime: row.invoiceDate,
    currency: order.currency,
    exchangeRate: "1",
    buyer: {
      name: b.company || buyerName,
      address: [b.address_1, b.address_2].filter(Boolean).join(", ") || undefined,
      city: b.city || undefined,
      postal: b.postcode || undefined,
      stateCode: b.state || undefined,
      email: b.email || undefined,
      contact: b.phone || undefined,
    },
    items,
    subtotal: rm(order.total - order.shippingTotal),
    taxAmount: rm(0),
    totalInclTax: rm(order.total),
    totalPayable: rm(order.total),
  };
}
