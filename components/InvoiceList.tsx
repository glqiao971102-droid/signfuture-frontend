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
import { DEV_PREVIEW } from "@/lib/preview";

const PER_PAGE = 10;

const money = (n: number) =>
  `RM ${n.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function formatDate(value: string): string {
  const d = new Date(value.includes("T") ? value : value.replace(" ", "T"));
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-MY", { day: "2-digit", month: "short", year: "numeric" });
}

// Sample invoices shown in the preview (no backend). Each carries its own PDF
// data so "Download PDF" works without fetching a real order.
const SAMPLE_INVOICES: { row: InvoiceRow; data: InvoiceData }[] = [
  {
    row: {
      orderId: -1001,
      invoiceNumber: "INV-2026-0001",
      invoiceDate: "2026-08-05 14:32:00",
      total: 1272,
      currency: "MYR",
      status: "wc-completed",
      statusLabel: "Completed",
    },
    data: {
      title: "E-INVOICE",
      status: "Valid",
      invoiceRef: "INV-2026-0001",
      dateTime: "2026-08-05 14:32:00",
      currency: "MYR",
      exchangeRate: "1",
      buyer: {
        name: "Acme Signs Sdn Bhd",
        tin: "C1234567890",
        regNo: "202301099888",
        address: "12 Jalan PJU 5/1, Kota Damansara",
        city: "Petaling Jaya",
        postal: "47810",
        stateCode: "Selangor",
        email: "orders@acme.my",
        contact: "012-345 6789",
      },
      items: [
        {
          itemRef: "#1001-1",
          desc: "3D LED Box Up (Stainless Frontlit)",
          details: ["Letter height: 30cm", "Depth: 8cm", "LED: White"],
          qty: "1",
          unitPrice: "RM980.00",
          amount: "RM980.00",
          disc: "-",
          taxRate: "0%",
          taxAmount: "RM0.00",
          inclTax: "RM980.00",
        },
        {
          itemRef: "#1001-2",
          desc: "Neon Sign (Custom Wording)",
          details: ["Colour: Ice Blue", "Size: 60cm"],
          qty: "1",
          unitPrice: "RM292.00",
          amount: "RM292.00",
          disc: "-",
          taxRate: "0%",
          taxAmount: "RM0.00",
          inclTax: "RM292.00",
        },
      ],
      subtotal: "RM1,272.00",
      taxAmount: "RM0.00",
      totalInclTax: "RM1,272.00",
      totalPayable: "RM1,272.00",
    },
  },
  {
    row: {
      orderId: -1002,
      invoiceNumber: "INV-2026-0002",
      invoiceDate: "2026-07-22 10:05:00",
      total: 4500,
      currency: "MYR",
      status: "wc-completed",
      statusLabel: "Completed",
    },
    data: {
      title: "E-INVOICE",
      status: "Valid",
      invoiceRef: "INV-2026-0002",
      dateTime: "2026-07-22 10:05:00",
      currency: "MYR",
      exchangeRate: "1",
      buyer: {
        name: "Sunrise Cafe Enterprise",
        tin: "N/A",
        regNo: "JR0056789-A",
        address: "88 Jalan Bukit Bintang",
        city: "Kuala Lumpur",
        postal: "55100",
        stateCode: "Kuala Lumpur",
        email: "hello@sunrisecafe.my",
        contact: "011-2233 4455",
      },
      items: [
        {
          itemRef: "#1002-1",
          desc: "3D Printer Box Up (Backlit with 10mm Clear Acrylic)",
          details: ["Letter height: 45cm", "Board: 3mm ACP"],
          qty: "1",
          unitPrice: "RM4,500.00",
          amount: "RM4,500.00",
          disc: "-",
          taxRate: "0%",
          taxAmount: "RM0.00",
          inclTax: "RM4,500.00",
        },
      ],
      subtotal: "RM4,500.00",
      taxAmount: "RM0.00",
      totalInclTax: "RM4,500.00",
      totalPayable: "RM4,500.00",
    },
  },
];
const SAMPLE_INVOICE_DATA = new Map(SAMPLE_INVOICES.map((s) => [s.row.orderId, s.data]));

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
    } catch {
      // Not signed in to the backend (e.g. preview) — fall back to samples.
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
      const sample = SAMPLE_INVOICE_DATA.get(row.orderId);
      const data = sample ?? toInvoiceData(row, await api.order(row.orderId), user?.name ?? "");
      const blob = await buildInvoicePdf(data);
      downloadBlob(blob, `${row.invoiceNumber ?? `Order-${row.orderId}`}.pdf`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not build the invoice PDF");
    } finally {
      setBusyId(null);
    }
  }

  // Show the member's real invoices; only fall back to samples in local dev.
  const shown = rows.length > 0 ? rows : DEV_PREVIEW ? SAMPLE_INVOICES.map((s) => s.row) : [];

  return (
    <>
      {error && <div className="quote-empty">{error}</div>}
      {loading && <div className="quote-empty">Loading invoices…</div>}
      {!loading && shown.length === 0 && (
        <div className="quote-empty">You have no invoices yet.</div>
      )}

      {!loading && shown.length > 0 && (
        <>
          <div className="wallet-tx-bar">
            <span className="wallet-tx-count">
              {(rows.length > 0 ? total : shown.length).toLocaleString()} invoice{(rows.length > 0 ? total : shown.length) === 1 ? "" : "s"}
            </span>
          </div>

          <div className="rec-list">
            {shown.map((inv) => {
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
