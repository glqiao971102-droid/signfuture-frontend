"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PRODUCT_MENU } from "@/lib/products";

type QuoteRow = { label: string; values: string[] };

export type Quote = {
  ref: string;
  date: string;
  /** Top-level product category — must match a PRODUCT_MENU label. */
  category: string;
  product: string;
  status: "Quoted" | "Pending" | "Rejected";
  spec: { label: string; value: string }[];
  quantities: string[];
  rows: QuoteRow[];
};

// Customer Service line — quote questions / re-quote requests.
const WA_PHONE = "601113387198";
const waLink = (text: string) =>
  `https://api.whatsapp.com/send?phone=${WA_PHONE}&text=${encodeURIComponent(text)}`;

// Quotations are valid for 15 days from the quote date.
const VALID_DAYS = 15;
const addDaysISO = (iso: string, days: number) => {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

export default function QuotationBrowser({ quotes }: { quotes: Quote[] }) {
  // Product options follow the storefront category list.
  const categories = useMemo(() => PRODUCT_MENU.map((p) => p.label), []);

  // Resolve "today" only on the client so the static page never hydrates stale.
  const [today, setToday] = useState<string | null>(null);
  useEffect(() => setToday(new Date().toISOString().slice(0, 10)), []);

  const initial = {
    product: "",
    ref: "",
    from: "2026-06-01",
    to: "2026-06-30",
    status: "",
  };
  const [draft, setDraft] = useState(initial);
  const [applied, setApplied] = useState(initial);

  const set = (k: keyof typeof initial, v: string) =>
    setDraft((d) => ({ ...d, [k]: v }));

  const filtered = useMemo(() => {
    return quotes.filter((q) => {
      if (applied.product && q.category !== applied.product) return false;
      if (applied.ref && !q.ref.toLowerCase().includes(applied.ref.toLowerCase()))
        return false;
      if (applied.status && q.status !== applied.status) return false;
      if (applied.from && q.date < applied.from) return false;
      if (applied.to && q.date > applied.to) return false;
      return true;
    });
  }, [quotes, applied]);

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setApplied(draft);
  };

  const onReset = () => {
    setDraft(initial);
    setApplied(initial);
  };

  return (
    <div className="quote-browser">
      <form className="quote-filter" onSubmit={onSearch}>
        <label className="qf-field">
          <span>Product</span>
          <select
            value={draft.product}
            onChange={(e) => set("product", e.target.value)}
          >
            <option value="">-- All --</option>
            {categories.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>

        <label className="qf-field">
          <span>Quote Ref.</span>
          <input
            type="text"
            placeholder="Quote Ref."
            value={draft.ref}
            onChange={(e) => set("ref", e.target.value)}
          />
        </label>

        <div className="qf-field qf-dates">
          <span>Date Quote</span>
          <div className="qf-date-row">
            <input
              type="date"
              value={draft.from}
              onChange={(e) => set("from", e.target.value)}
            />
            <span className="qf-to">TO</span>
            <input
              type="date"
              value={draft.to}
              onChange={(e) => set("to", e.target.value)}
            />
          </div>
        </div>

        <label className="qf-field">
          <span>Status</span>
          <select
            value={draft.status}
            onChange={(e) => set("status", e.target.value)}
          >
            <option value="">-- All --</option>
            <option value="Quoted">Quoted</option>
            <option value="Pending">Pending</option>
            <option value="Rejected">Rejected</option>
          </select>
        </label>

        <div className="qf-actions">
          <button type="submit" className="qf-search">
            SEARCH
          </button>
          <button type="button" className="qf-reset" onClick={onReset}>
            Reset
          </button>
        </div>
      </form>

      <p className="quote-count">
        Showing {filtered.length} of {quotes.length} quotation
        {quotes.length === 1 ? "" : "s"}
      </p>

      {filtered.length === 0 ? (
        <div className="quote-empty">No quotation found!</div>
      ) : (
        <div className="quote-list">
          {filtered.map((q) => {
            const validUntil = addDaysISO(q.date, VALID_DAYS);
            const expired = today !== null && today > validUntil;
            const orderable = q.status === "Quoted" && !expired;
            return (
              <article key={q.ref} className="quote-card">
                <div className="quote-id">
                  <span className="quote-date">{q.date}</span>
                  <strong className="quote-product">{q.product}</strong>
                  <span className="quote-ref">{q.ref}</span>
                  <span className={`quote-status status-${q.status.toLowerCase()}`}>
                    {q.status}
                  </span>
                  <span className="quote-valid">
                    Valid until {validUntil} · {VALID_DAYS} days
                  </span>
                  {expired && <span className="quote-expired-tag">Expired</span>}
                </div>

                <div className="quote-spec">
                  <span className="quote-block-title">Specification</span>
                  <dl>
                    {q.spec.map((s) => (
                      <div key={s.label} className="quote-spec-row">
                        <dt>{s.label}</dt>
                        <dd>{s.value}</dd>
                      </div>
                    ))}
                  </dl>
                </div>

                <div className="quote-price">
                  <span className="quote-block-title">Quoted Price</span>
                  <div className="quote-table-wrap">
                    <table className="quote-table">
                      <thead>
                        <tr>
                          <th>Quantity</th>
                          {q.quantities.map((qty) => (
                            <th key={qty}>{qty}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {q.rows.map((row) => (
                          <tr
                            key={row.label}
                            className={
                              row.label.startsWith("Total") ? "is-total" : undefined
                            }
                          >
                            <td>{row.label}</td>
                            {row.values.map((v, i) => (
                              <td key={i}>{v}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="quote-actions">
                    {orderable ? (
                      <Link
                        href={`/cart?quote=${q.ref}`}
                        className="hero-btn primary quote-order-btn"
                      >
                        Order Now
                      </Link>
                    ) : expired ? (
                      <a
                        href={waLink(
                          `Hi, quotation ${q.ref} (${q.product}) has expired. I'd like to request a new quote.`,
                        )}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hero-btn ghost quote-order-btn quote-requote-btn"
                      >
                        Request New Quote
                      </a>
                    ) : (
                      <button
                        type="button"
                        className="hero-btn ghost quote-order-btn"
                        disabled
                      >
                        {q.status === "Pending" ? "Awaiting Quote" : "Not Available"}
                      </button>
                    )}
                    <a
                      href={waLink(
                        `Hi, I'd like to ask about quotation ${q.ref} (${q.product}).`,
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="quote-ask-link"
                    >
                      Ask a question
                    </a>
                  </div>
                  {expired && (
                    <p className="quote-expired-note">
                      This quotation is over {VALID_DAYS} days old. Please request a
                      new quote to order.
                    </p>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
