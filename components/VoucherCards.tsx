"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { api, type MemberVoucher } from "@/lib/api";
import { PRODUCTS } from "@/lib/products";
import { DEV_PREVIEW } from "@/lib/preview";

/**
 * The member's vouchers, stacked one per row. Shared by the /vouchers page and
 * the My Account → My Voucher section, so both stay in sync.
 *
 * When the account has no real vouchers (e.g. the preview session), two sample
 * vouchers are shown so the layout is always visible.
 */

const SAMPLE_VOUCHERS: MemberVoucher[] = [
  {
    code: "WELCOME100",
    title: "Welcome Reward",
    description: "RM100 off your next order — thanks for joining Sign Future.",
    discountType: "fixed",
    discountValue: 100,
    scopeType: "all",
    scopeValues: [],
    minSpend: 500,
    expiresAt: "2026-12-31",
  },
  {
    code: "NEON15",
    title: "Neon Sign Special",
    description: "15% off any Neon Sign order.",
    discountType: "percent",
    discountValue: 15,
    scopeType: "all",
    scopeValues: [],
    minSpend: 0,
    expiresAt: "2026-09-30",
  },
];

// Where clicking a voucher should take the member. Product-scoped vouchers jump
// straight to that product's calculator; everything else lands on the product
// grid so they can pick an eligible item.
function targetHref(v: MemberVoucher): string {
  if (v.scopeType === "product" && v.scopeValues.length) {
    const hit = PRODUCTS.find((p) => v.scopeValues.includes(p.slug));
    if (hit?.href) return hit.href;
  }
  return "/#categories";
}

function scopeLabel(v: MemberVoucher): string {
  if (v.scopeType === "all") return "Any product";
  const names = v.scopeValues
    .map((s) => PRODUCTS.find((p) => p.slug === s)?.name ?? s)
    .join(", ");
  return names || (v.scopeType === "category" ? "Selected categories" : "Selected products");
}

function discountLabel(v: MemberVoucher): string {
  return v.discountType === "percent" ? `${v.discountValue}%` : `RM${v.discountValue}`;
}

function fmtDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export default function VoucherCards() {
  const { user } = useAuth();
  const [vouchers, setVouchers] = useState<MemberVoucher[] | null>(null);

  useEffect(() => {
    if (!user) {
      setVouchers([]);
      return;
    }
    let alive = true;
    api
      .myVouchers()
      .then((r) => alive && setVouchers(r.data))
      .catch(() => alive && setVouchers([]));
    return () => {
      alive = false;
    };
  }, [user]);

  // Show the member's real vouchers; only fall back to the samples in local dev
  // (never on the production build).
  const real = vouchers ?? [];
  const shown = real.length > 0 ? real : DEV_PREVIEW ? SAMPLE_VOUCHERS : [];

  return (
    <>
      <p className="vpage-sub">
        {shown.length === 0
          ? "You don't have any vouchers yet."
          : `You have ${shown.length} voucher${shown.length === 1 ? "" : "s"} ready to use. Tap one to shop the eligible product.`}
      </p>

      <ul className="vpage-grid">
        {shown.map((v) => {
          const expires = fmtDate(v.expiresAt);
          return (
            <li key={v.code}>
              <Link href={targetHref(v)} className="vcard" title="Shop the eligible product">
                <div className="vcard-left">
                  <span className="vcard-off">{discountLabel(v)}</span>
                  <span className="vcard-off-label">OFF</span>
                </div>
                <div className="vcard-body">
                  <span className="vcard-title">{v.title || v.code}</span>
                  {v.description && <span className="vcard-desc">{v.description}</span>}
                  <span className="vcard-meta">Use on: {scopeLabel(v)}</span>
                  <div className="vcard-tags">
                    <span className="vcard-code">{v.code}</span>
                    {v.minSpend > 0 && <span className="vcard-tag">Min spend RM{v.minSpend}</span>}
                    {expires && <span className="vcard-tag">Valid till {expires}</span>}
                  </div>
                </div>
                <span className="vcard-go" aria-hidden="true">Shop →</span>
              </Link>
            </li>
          );
        })}
      </ul>

      <style>{`
        .vpage-sub { color: #9fb3c8; margin: 0 0 16px; }
        /* One voucher per row (stacked), never side-by-side. */
        .vpage-grid { list-style: none; margin: 0; padding: 0; display: grid; gap: 14px; grid-template-columns: 1fr; }
        .vcard {
          display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 16px;
          padding: 16px 18px; border-radius: 14px; text-decoration: none;
          border: 1px solid rgba(57,151,255,.35); background: linear-gradient(135deg, #0b1730, #04101f);
          transition: border-color .15s, transform .15s, box-shadow .15s;
        }
        .vcard:hover { border-color: rgba(53,216,255,.8); transform: translateY(-2px); box-shadow: 0 12px 30px rgba(0,0,0,.35); }
        .vcard-left { display: flex; flex-direction: column; align-items: center; justify-content: center; min-width: 76px; padding-right: 14px; border-right: 1px dashed rgba(120,160,210,.4); }
        .vcard-off { font-size: 26px; font-weight: 800; color: #35d8ff; line-height: 1; }
        .vcard-off-label { font-size: 11px; letter-spacing: .18em; color: #7fa2c4; margin-top: 4px; }
        .vcard-body { display: flex; flex-direction: column; gap: 5px; min-width: 0; }
        .vcard-title { font-weight: 700; color: #e6eefc; }
        .vcard-desc { font-size: 13px; color: #9fb3c8; }
        .vcard-meta { font-size: 12.5px; color: #b9c9dd; }
        .vcard-tags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 4px; }
        .vcard-code { font-family: ui-monospace, monospace; font-size: 12px; font-weight: 700; color: #04101f; background: #35d8ff; padding: 2px 8px; border-radius: 6px; }
        .vcard-tag { font-size: 11.5px; color: #9fb3c8; border: 1px solid rgba(120,160,210,.35); padding: 2px 8px; border-radius: 6px; }
        .vcard-go { color: #35d8ff; font-weight: 700; white-space: nowrap; }
        @media (max-width: 560px) {
          .vcard { grid-template-columns: auto 1fr; }
          .vcard-go { grid-column: 1 / -1; text-align: right; }
        }
      `}</style>
    </>
  );
}
