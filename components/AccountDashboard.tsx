"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth, type MemberTier } from "@/components/AuthProvider";
import QuotationBrowser from "@/components/QuotationBrowser";
import OrderStatusList from "@/components/OrderStatusList";
import InvoiceList from "@/components/InvoiceList";
import ReloadList from "@/components/ReloadList";
import CustomTopUp from "@/components/CustomTopUp";
import WalletTransactions from "@/components/WalletTransactions";
import VoucherList from "@/components/VoucherList";
import { api, type PointsInfo } from "@/lib/api";
import { SAMPLE_QUOTES } from "@/lib/sampleQuotes";

type SectionKey =
  | "consultant"
  | "quotation"
  | "vouchers"
  | "wallet"
  | "orders"
  | "invoice"
  | "reload"
  | "pending"
  | "installation"
  | "installer";

// Left sidebar menu (Feedback Message removed). Each item swaps the right panel.
const SIDE: { key: SectionKey; label: string; glyph: string }[] = [
  { key: "consultant", label: "My Consultant", glyph: "☎" },
  { key: "quotation", label: "My Quotation", glyph: "❝" },
  { key: "vouchers", label: "My Vouchers", glyph: "▧" },
  { key: "wallet", label: "My Wallet", glyph: "◈" },
  { key: "orders", label: "Order Status", glyph: "⛟" },
  { key: "invoice", label: "Download Invoice", glyph: "⤓" },
  { key: "reload", label: "Reload Status", glyph: "↻" },
  { key: "pending", label: "Pending List", glyph: "▣" },
  { key: "installation", label: "My Installation", glyph: "⚒" },
  { key: "installer", label: "Installer", glyph: "⚑" },
];

// Customer-facing installation view: the Sales Ledger app's Installation tab
// (Calendar / Map / Jobs only) embedded via ?customer=1, which hides its admin
// sidebar/upload/tabs. Same :3200 origin the admin embed uses.
const SALES_APP_ORIGIN =
  process.env.NEXT_PUBLIC_SALES_APP_URL?.replace(/\/$/, "") ?? "http://localhost:3200";

// Malaysian states for the Installer directory's state filter.
const MY_STATES = [
  "Johor", "Kedah", "Kelantan", "Kuala Lumpur", "Labuan", "Melaka",
  "Negeri Sembilan", "Pahang", "Penang", "Perak", "Perlis", "Putrajaya",
  "Sabah", "Sarawak", "Selangor", "Terengganu",
];

// Installer directory. PLACEHOLDER sample data — these will be replaced by real
// installers once registration adds a "categories" step: users who register and
// pick the "Installation" category get listed here (matched to a region/state).
type Installer = { name: string; state: string; phone: string; areas: string };
const INSTALLERS: Installer[] = [
  { name: "Selangor Sign Install", state: "Selangor", phone: "012-345 6789", areas: "Shah Alam, Klang, Subang Jaya" },
  { name: "Klang Valley Fitters", state: "Selangor", phone: "017-880 2211", areas: "Petaling Jaya, Puchong, Kajang" },
  { name: "KL Central Installers", state: "Kuala Lumpur", phone: "013-221 4455", areas: "Bukit Bintang, Cheras, Setapak" },
  { name: "Johor Bahru Signage Team", state: "Johor", phone: "019-770 3388", areas: "JB, Skudai, Kulai" },
  { name: "Penang Island Mounting", state: "Penang", phone: "016-455 9090", areas: "Georgetown, Bayan Lepas, Butterworth" },
  { name: "Ipoh Sign Crew", state: "Perak", phone: "011-2233 4455", areas: "Ipoh, Taiping" },
];

// Order pipeline counts (top status cards).
const STATUS = [
  { label: "New Orders", value: 0, glyph: "▤", cls: "st-blue" },
  { label: "Pending", value: 0, glyph: "⧗", cls: "st-amber" },
  { label: "Print", value: 0, glyph: "⎙", cls: "st-purple" },
  { label: "Delivery", value: 2, glyph: "⛟", cls: "st-green" },
];

// The member's assigned consultant.
const CONSULTANT = {
  name: "Jacky Lim",
  role: "Your Dedicated Sales Consultant",
  initials: "JL",
  photo: "/consultant.jpg",
  wa: "601113387198",
};

// Customer service line for change-of-consultant requests.
const SERVICE_WA = "601113387198";

// Net amount paid per month at the member's current tier (RM).
const MONTHLY = [
  { m: "Jan", v: 620 },
  { m: "Feb", v: 410 },
  { m: "Mar", v: 980 },
  { m: "Apr", v: 750 },
  { m: "May", v: 1130 },
  { m: "Jun", v: 1187.5 },
];

// Items waiting for the member's action (Pending List tab).
const PENDING = [
  {
    ref: "Q65821",
    date: "2026-06-18",
    product: "Loose Sheet 210x297mm · 500 pcs",
    need: "Quotation ready — confirm to place order",
    action: { label: "Review Quote", key: "quotation" as SectionKey },
  },
  {
    ref: "INV-2026-0518",
    date: "2026-05-18",
    product: "PVC Banner 3m x 1.2m · 5 pcs",
    need: "Invoice unpaid — payment required",
    action: { label: "Pay Now", key: "wallet" as SectionKey },
  },
  {
    ref: "ART-2026-0610",
    date: "2026-06-10",
    product: "3D LED Box Up — Frontlit",
    need: "Artwork approval needed before printing",
    action: { label: "Review Artwork", key: "orders" as SectionKey },
  },
];

// Top-up packages (mirrors the /package promo) — shown in the My Wallet tab.
const TOPUP_TIERS = [
  { name: "Silver", glyph: "◆", topup: "RM 2,000", save: "50%", cls: "tier-silver", featured: false, perks: ["RM 20 voucher (1% of top-up)", "Earn 1 point per RM 1 spent", "Lower unit prices", "Wallet credit for online orders"] },
  { name: "Gold", glyph: "◆◆", topup: "RM 5,000", save: "60%", cls: "tier-gold", featured: true, perks: ["RM 50 voucher (1% of top-up)", "Earn 1 point per RM 1 spent", "Bigger savings on every order", "Priority quotation"] },
  { name: "Diamond", glyph: "◆◆◆", topup: "RM 10,000", save: "80%", cls: "tier-diamond", featured: false, perks: ["RM 100 voucher (1% of top-up)", "Earn 1 point per RM 1 spent", "Maximum savings", "Best value for bulk orders"] },
];

const TIER_RATE: Record<MemberTier, number> = {
  Silver: 0.05,
  Gold: 0.12,
  Diamond: 0.2,
};
const TIER_ORDER: MemberTier[] = ["Silver", "Gold", "Diamond"];
const THIS_MONTH_GROSS = 1250;

const rm = (n: number) =>
  n.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function AccountDashboard() {
  const { user } = useAuth();
  const [active, setActive] = useState<SectionKey>("consultant");
  const [points, setPoints] = useState<PointsInfo | null>(null);
  const [installerState, setInstallerState] = useState("Selangor");

  // Point balance for the member summary. Members earn 1 point per RM 1;
  // plain customers stay at 0.
  useEffect(() => {
    let cancelled = false;
    api
      .points()
      .then((res) => {
        if (!cancelled) setPoints(res);
      })
      .catch(() => {
        /* leave points null — the summary just omits the badge */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!user) {
    return (
      <div className="quote-empty">
        Please sign in to view your account dashboard.
      </div>
    );
  }

  const max = Math.max(...MONTHLY.map((d) => d.v));
  // A plain WordPress `customer` carries no membership role, so there is no
  // tier and no member discount — they pay list price until they top up.
  const currentRate = user.tier ? TIER_RATE[user.tier] : 0;
  const currentPrice = THIS_MONTH_GROSS * (1 - currentRate);
  const activeLabel = SIDE.find((s) => s.key === active)?.label ?? "";
  const tierClass = (user.tier ?? "member").toLowerCase();
  const tierLabel = user.tier ? `${user.tier.toUpperCase()} MEMBER` : "MEMBER";
  const walletBalance = user.wallet.balance;
  const walletCurrency = user.wallet.currency === "MYR" ? "RM" : user.wallet.currency;

  // ---- This Month + Sales chart (shown in the Wallet tab) ----
  const thisMonthCard = (
    <section className="acct-card acct-tier-card">
      <div className="acct-card-head">
        <h2>This Month</h2>
        <span>{user.tier ? `${user.tier} member rate applied` : "List price — no member rate"}</span>
      </div>
      <div className="acct-month-total">
        <span>You ordered</span>
        <strong>RM {rm(currentPrice)}</strong>
        <span className="acct-month-sub">
          {user.tier
            ? `List RM ${rm(THIS_MONTH_GROSS)} · ${user.tier} saves ${Math.round(currentRate * 100)}%`
            : `List RM ${rm(THIS_MONTH_GROSS)} · top up to unlock member savings`}
        </span>
      </div>

      <p className="acct-upsell-label">If you were a higher tier:</p>
      <div className="acct-tier-rows">
        {TIER_ORDER.map((tier) => {
          const price = THIS_MONTH_GROSS * (1 - TIER_RATE[tier]);
          const save = currentPrice - price;
          const isCurrent = tier === user.tier;
          return (
            <div
              key={tier}
              className={`acct-tier-row tier-${tier.toLowerCase()}${
                isCurrent ? " is-current" : ""
              }`}
            >
              <span className="acct-tier-name">
                <span className="acct-tier-dot" />
                {tier}
                {isCurrent && <em> · your tier</em>}
              </span>
              <span className="acct-tier-price">RM {rm(price)}</span>
              <span className="acct-tier-save">
                {isCurrent
                  ? "—"
                  : save > 0
                    ? `save RM ${rm(save)}`
                    : `+RM ${rm(-save)}`}
              </span>
            </div>
          );
        })}
      </div>

      {user.tier !== "Diamond" && (
        <Link href="/package" className="hero-btn primary acct-upgrade-btn">
          Upgrade &amp; Save More
        </Link>
      )}
    </section>
  );

  const salesChart = (
    <section className="acct-card">
      <div className="acct-card-head">
        <h2>Sales Performance</h2>
        <span>Amount spent per month (RM)</span>
      </div>
      <div className="acct-chart">
        {MONTHLY.map((d) => (
          <div key={d.m} className="acct-chart-col">
            <span className="acct-chart-val">{rm(d.v)}</span>
            <div className="acct-chart-bar" style={{ height: `${(d.v / max) * 100}%` }} />
            <span className="acct-chart-month">{d.m}</span>
          </div>
        ))}
      </div>
    </section>
  );

  // ---- right-panel content per selected section ----
  const renderSection = () => {
    switch (active) {
      case "consultant":
        return (
          <>
          {(user.stats || user.billing.address_1 || user.phone) && (
            <section className="acct-card">
              <div className="acct-card-head">
                <h2>My Details</h2>
                <span>From your Sign Future account</span>
              </div>
              <div className="profile-grid">
                {user.stats && (
                  <>
                    <div className="profile-stat">
                      <span>Total Orders</span>
                      <strong>{user.stats.orderCount.toLocaleString()}</strong>
                    </div>
                    <div className="profile-stat">
                      <span>Lifetime Spend</span>
                      <strong>RM {rm(user.stats.totalSpent)}</strong>
                    </div>
                  </>
                )}
                {user.phone && (
                  <div className="profile-field">
                    <span>Phone</span>
                    <strong>{user.phone}</strong>
                  </div>
                )}
                <div className="profile-field">
                  <span>Email</span>
                  <strong>{user.email}</strong>
                </div>
                {user.billing.company && (
                  <div className="profile-field">
                    <span>Company</span>
                    <strong>{user.billing.company}</strong>
                  </div>
                )}
                {user.billing.address_1 && (
                  <div className="profile-field is-wide">
                    <span>Billing Address</span>
                    <strong>
                      {[
                        user.billing.address_1,
                        user.billing.address_2,
                        user.billing.postcode,
                        user.billing.city,
                        user.billing.state,
                      ]
                        .filter(Boolean)
                        .join(", ")}
                    </strong>
                  </div>
                )}
                {user.shipping.address_1 && (
                  <div className="profile-field is-wide">
                    <span>Shipping Address</span>
                    <strong>
                      {[
                        user.shipping.address_1,
                        user.shipping.address_2,
                        user.shipping.postcode,
                        user.shipping.city,
                        user.shipping.state,
                      ]
                        .filter(Boolean)
                        .join(", ")}
                    </strong>
                  </div>
                )}
              </div>
            </section>
          )}
          <div className="acct-grid">
          <section className="acct-card acct-consultant" id="my-consultant">
            <div className="acct-card-head">
              <h2>My Consultant</h2>
              <span>Your dedicated contact for quotes &amp; orders</span>
            </div>
            <div className="acct-consultant-body">
              <span className="acct-consultant-avatar">
                <span className="acct-consultant-fallback">{CONSULTANT.initials}</span>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={CONSULTANT.photo}
                  alt={CONSULTANT.name}
                  className="acct-consultant-img"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
              </span>
              <div className="acct-consultant-info">
                <strong>{CONSULTANT.name}</strong>
                <span>{CONSULTANT.role}</span>
              </div>
            </div>
            <div className="acct-consultant-actions">
              <a
                href={`https://api.whatsapp.com/send?phone=${CONSULTANT.wa}&text=${encodeURIComponent(
                  `Hi ${CONSULTANT.name}, I'm member ${user.memberNo}.`,
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="acct-contact wa"
              >
                <span>✆</span> WhatsApp {CONSULTANT.name.split(" ")[0]}
              </a>
              <a
                href={`https://api.whatsapp.com/send?phone=${SERVICE_WA}&text=${encodeURIComponent(
                  `Hi, I'm member ${user.memberNo}. I'd like to request a change of consultant.`,
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="acct-contact change"
              >
                <span>⇄</span> Request to Change Consultant
              </a>
            </div>
          </section>
          {thisMonthCard}
          </div>
          {salesChart}
          </>
        );

      case "quotation":
        return (
          <section className="acct-card acct-section-card">
            <div className="acct-card-head">
              <h2>My Quotation</h2>
              <span>Filter by product, ref., date or status — then place your order.</span>
            </div>
            <QuotationBrowser quotes={SAMPLE_QUOTES} />
          </section>
        );

      case "vouchers":
        return (
          <section className="acct-card acct-section-card">
            <div className="acct-card-head">
              <h2>My Vouchers</h2>
              <span>Your discounts — what they apply to, the amount off, and when they expire.</span>
            </div>
            <VoucherList />
          </section>
        );

      case "wallet":
        return (
          <>
            <section className="acct-card acct-section-card">
              <div className="acct-card-head">
                <h2>My Wallet</h2>
                <span>
                  Balance {walletCurrency} {rm(walletBalance)} · your full transaction history.
                </span>
              </div>
              <WalletTransactions />
            </section>

            <section className="acct-card acct-section-card">
              <div className="acct-card-head">
                <h2>Top Up Packages</h2>
                <span>Top up now to enjoy a lower price and free vouchers.</span>
              </div>
              <div className="tier-grid">
                {TOPUP_TIERS.map((t) => (
                  <div key={t.name} className={`tier-card ${t.cls}${t.featured ? " featured" : ""}`}>
                    {t.featured && <span className="tier-badge">Most Popular</span>}
                    <span className="tier-glyph">{t.glyph}</span>
                    <h2 className="tier-name">{t.name}</h2>
                    <div className="tier-topup">
                      <span>Top up</span>
                      <strong>{t.topup}</strong>
                    </div>
                    <div className="tier-save">
                      Save up to <b>{t.save}</b>
                      <span className="plus">++</span>
                    </div>
                    <ul className="tier-perks">
                      {t.perks.map((p) => (
                        <li key={p}>{p}</li>
                      ))}
                    </ul>
                    <Link href="/package" className="hero-btn primary tier-btn">
                      Top Up Now
                    </Link>
                  </div>
                ))}
              </div>
            </section>

            <CustomTopUp />
          </>
        );

      case "orders":
        return (
          <section className="acct-card acct-section-card">
            <div className="acct-card-head">
              <h2>Order Status</h2>
              <span>Track every confirmed order from print to collection or delivery.</span>
            </div>
            <OrderStatusList />
          </section>
        );

      case "invoice":
        return (
          <section className="acct-card acct-section-card">
            <div className="acct-card-head">
              <h2>Download Invoice</h2>
              <span>Download a PDF invoice for any of your orders.</span>
            </div>
            <InvoiceList />
          </section>
        );

      case "reload":
        return (
          <section className="acct-card acct-section-card">
            <div className="acct-card-head">
              <h2>Reload Status</h2>
              <span>Your wallet top-up history and payment status.</span>
            </div>
            <ReloadList />
          </section>
        );

      case "pending":
        return (
          <section className="acct-card acct-section-card">
            <div className="acct-card-head">
              <h2>Pending List</h2>
              <span>Items waiting for your action.</span>
            </div>
            <div className="rec-list">
              {PENDING.map((p) => (
                <article key={p.ref} className="rec-card">
                  <div className="rec-main">
                    <div className="rec-top">
                      <strong className="rec-ref">{p.ref}</strong>
                      <span className="rec-status rs-pending">Action Needed</span>
                    </div>
                    <span className="rec-date">{p.date}</span>
                    <p className="rec-desc">{p.product}</p>
                    <p className="rec-need">{p.need}</p>
                  </div>
                  <div className="rec-side">
                    <button
                      type="button"
                      className="hero-btn primary rec-btn"
                      onClick={() => setActive(p.action.key)}
                    >
                      {p.action.label}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        );

      case "installation":
        return (
          <section className="acct-card acct-section-card">
            <div className="acct-card-head">
              <h2>My Installation</h2>
              <span>Your installation calendar, Malaysia map and jobs.</span>
            </div>
            <iframe
              src={`${SALES_APP_ORIGIN}/?view=installation&customer=1`}
              title="My Installation"
              style={{
                width: "100%",
                height: "1400px",
                border: "0",
                borderRadius: "12px",
                background: "#0b1220",
              }}
            />
          </section>
        );

      case "installer": {
        const list = INSTALLERS.filter((i) => i.state === installerState);
        return (
          <section className="acct-card acct-section-card">
            <div className="acct-card-head">
              <h2>Installer</h2>
              <span>Pick a state to see the installers covering that area.</span>
            </div>
            <label
              className="installer-state-filter"
              style={{ display: "flex", alignItems: "center", gap: "10px", margin: "6px 0 4px", fontWeight: 700, color: "#b9c9dd" }}
            >
              <span>State</span>
              <select
                value={installerState}
                onChange={(e) => setInstallerState(e.target.value)}
                style={{
                  padding: "8px 12px", borderRadius: "8px", minWidth: "220px",
                  border: "1px solid rgba(120,150,190,0.4)", background: "rgba(3,15,31,0.6)",
                  color: "#eaf2ff", fontWeight: 700,
                }}
              >
                {MY_STATES.map((s) => (
                  <option key={s} value={s} style={{ color: "#0b1220" }}>{s}</option>
                ))}
              </select>
            </label>
            <p className="installer-count" style={{ color: "#9fb4d0", margin: "8px 0 12px", fontSize: "13px" }}>
              {list.length} installer{list.length === 1 ? "" : "s"} in {installerState}
            </p>
            <div className="rec-list">
              {list.map((i) => (
                <article key={i.name + i.phone} className="rec-card">
                  <div className="rec-main">
                    <div className="rec-top">
                      <strong className="rec-ref">{i.name}</strong>
                      <span className="rec-status rs-pending">{i.state}</span>
                    </div>
                    <p className="rec-desc">Covers: {i.areas}</p>
                    <p className="rec-need">📞 {i.phone}</p>
                  </div>
                </article>
              ))}
              {list.length === 0 && (
                <div className="quote-empty">No installers in {installerState} yet.</div>
              )}
            </div>
          </section>
        );
      }

      default:
        return null;
    }
  };

  return (
    <div className="acct-layout">
      {/* ---------- left sidebar (stays fixed; highlights the active section) ---------- */}
      <aside className="acct-side">
        <p className="acct-side-title">My Account</p>
        {SIDE.map((s) => (
          <button
            key={s.key}
            type="button"
            className={`acct-side-item${active === s.key ? " is-active" : ""}`}
            onClick={() => setActive(s.key)}
            aria-current={active === s.key ? "page" : undefined}
          >
            <span className="acct-side-ico">{s.glyph}</span>
            <span>{s.label}</span>
          </button>
        ))}
      </aside>

      {/* ---------- right main ---------- */}
      <div className="acct-main">
        {/* member card + status cards — only shown on the My Consultant section */}
        {active === "consultant" && (
          <>
        <div className="acct-summary">
          <span className={`acct-avatar tier-${tierClass}`}>
            <span className="acct-avatar-fallback">◆</span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/mascot-silver.webp"
              alt=""
              className="acct-avatar-img"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          </span>
          <div className="acct-summary-meta">
            <span className={`acct-tier-chip tier-${tierClass}`}>{tierLabel}</span>
            <strong>{user.name}</strong>
            <span className="acct-no">Member No. {user.memberNo}</span>
          </div>
          <div className="acct-summary-points">
            <span>My Points</span>
            <strong>{(points?.balance ?? 0).toLocaleString("en-MY")}</strong>
            <span className="acct-points-hint">
              {points && !points.earning
                ? "Top up to earn 1 pt / RM 1"
                : "Earning 1 pt / RM 1"}
            </span>
          </div>
          <div className="acct-summary-wallet">
            <span>Wallet Balance</span>
            <strong>
              {walletCurrency} {rm(walletBalance)}
            </strong>
            <Link href="/package" className="hero-btn primary acct-topup">
              Top Up
            </Link>
          </div>
        </div>

        {/* status cards — always visible */}
        <div className="acct-status">
          {STATUS.map((s) => (
            <div key={s.label} className={`acct-status-card ${s.cls}`}>
              <div>
                <span className="acct-status-label">{s.label}</span>
                <strong className="acct-status-value">{s.value}</strong>
              </div>
              <span className="acct-status-ico">{s.glyph}</span>
            </div>
          ))}
        </div>
          </>
        )}

        {/* swappable section panel */}
        <div className="acct-section" aria-label={activeLabel}>
          {renderSection()}
        </div>
      </div>
    </div>
  );
}
