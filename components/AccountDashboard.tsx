"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, ApiError, type NativeOrderRow } from "@/lib/api";
import { useAuth, type MemberTier } from "@/components/AuthProvider";
import OrderStatusList from "@/components/OrderStatusList";
import InvoiceList from "@/components/InvoiceList";
import ReloadList from "@/components/ReloadList";
import WalletTransactions from "@/components/WalletTransactions";
import EditDetail from "@/components/EditDetail";
import RequestQuotation from "@/components/RequestQuotation";
import MyQuotations from "@/components/MyQuotations";
import VoucherCards from "@/components/VoucherCards";
import MyInstallationFrame from "@/components/MyInstallationFrame";
import LineLengthTool from "@/components/LineLengthTool";

type SectionKey =
  | "consultant"
  | "requestQuote"
  | "quotation"
  | "voucher"
  | "wallet"
  | "orders"
  | "invoice"
  | "reload"
  | "pending"
  | "installation"
  | "lineLength"
  | "installer"
  | "account"
  | "materialStore"
  | "editDetail";

// Left sidebar menu (Feedback Message removed). Each item swaps the right panel.
// `soon` items are disabled and show a small "soon" badge (coming later).
const SIDE: { key: SectionKey; label: string; glyph: string; soon?: boolean }[] = [
  { key: "consultant", label: "My Consultant", glyph: "☎" },
  { key: "requestQuote", label: "Request Quotation", glyph: "✉" },
  { key: "quotation", label: "My Quotation", glyph: "❝" },
  { key: "voucher", label: "My Voucher", glyph: "▧" },
  { key: "wallet", label: "My Wallet", glyph: "◈" },
  { key: "orders", label: "Order Status", glyph: "⛟" },
  { key: "invoice", label: "Download Invoice", glyph: "⤓" },
  { key: "reload", label: "Reload Status", glyph: "↻" },
  { key: "pending", label: "Pending List", glyph: "▣" },
  { key: "installation", label: "My Installation", glyph: "⚒" },
  { key: "lineLength", label: "Line Length", glyph: "📏" },
  { key: "installer", label: "Installer", glyph: "⚑", soon: true },
  { key: "account", label: "Account", glyph: "⚙", soon: true },
  { key: "materialStore", label: "Material Store", glyph: "▦", soon: true },
  { key: "editDetail", label: "Edit Detail", glyph: "✎" },
];

// Customer-facing installation view: the Sales Ledger app's Installation tab
// (Calendar / Map / Jobs only), served from this storefront's own
// public/sales-listing copy via ?customer=1 — which hides the admin
// sidebar/upload/tabs. Self-hosted so it stays up on live independent of any
// local dev server.

// Malaysian states for the Installer directory's state filter.
const MY_STATES = [
  "Johor", "Kedah", "Kelantan", "Kuala Lumpur", "Labuan", "Melaka",
  "Negeri Sembilan", "Pahang", "Penang", "Perak", "Perlis", "Putrajaya",
  "Sabah", "Sarawak", "Selangor", "Terengganu",
];

// Installer directory. PLACEHOLDER sample data — replaced by real installers
// once registration adds a "categories" step (users who pick "Installation").
type Installer = { name: string; state: string; phone: string; areas: string };
const INSTALLERS: Installer[] = [
  { name: "Selangor Sign Install", state: "Selangor", phone: "012-345 6789", areas: "Shah Alam, Klang, Subang Jaya" },
  { name: "Klang Valley Fitters", state: "Selangor", phone: "017-880 2211", areas: "Petaling Jaya, Puchong, Kajang" },
  { name: "KL Central Installers", state: "Kuala Lumpur", phone: "013-221 4455", areas: "Bukit Bintang, Cheras, Setapak" },
  { name: "Johor Bahru Signage Team", state: "Johor", phone: "019-770 3388", areas: "JB, Skudai, Kulai" },
  { name: "Penang Island Mounting", state: "Penang", phone: "016-455 9090", areas: "Georgetown, Bayan Lepas, Butterworth" },
  { name: "Ipoh Sign Crew", state: "Perak", phone: "011-2233 4455", areas: "Ipoh, Taiping" },
];

// The member's assigned consultant.
// Default consultant, used when the member has no referrer on file / isn't
// signed in to the backend. Real members show their own referrer (the admin
// whose QR they scanned) — see api.myConsultant().
const CONSULTANT = {
  name: "Joe Lem",
  role: "Your Dedicated Sales Consultant",
  initials: "JL",
  // Temporary placeholder until the real salesperson photo is uploaded.
  photo: "/mascot-silver.webp",
  wa: "60179907559",
};

// Turn a local/intl phone into a wa.me-friendly number (Malaysia default).
function waNumber(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("60")) return digits;
  if (digits.startsWith("0")) return `60${digits.slice(1)}`;
  return digits;
}
function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "★";
}


const TIER_RATE: Record<MemberTier, number> = {
  Silver: 0.05,
  Gold: 0.12,
  Diamond: 0.2,
};
const TIER_ORDER: MemberTier[] = ["Silver", "Gold", "Diamond"];

const rm = (n: number) =>
  n.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function AccountDashboard() {
  const { user } = useAuth();
  const [active, setActive] = useState<SectionKey>("consultant");
  const [installerState, setInstallerState] = useState("Selangor");
  // The member's consultant = the admin whose referral QR/code they registered
  // under. Falls back to the default contact when there's no referrer / not
  // signed in to the backend (e.g. preview session).
  const [consultant, setConsultant] = useState<{ name: string; phone: string | null } | null>(null);
  useEffect(() => {
    api
      .myConsultant()
      .then((r) => setConsultant(r.consultant))
      .catch(() => {});
  }, []);

  // Real orders — used to build "This Month" + "Sales Performance" from actual
  // spend (no hardcoded numbers). null = still loading, [] = loaded but empty.
  const [nativeOrders, setNativeOrders] = useState<NativeOrderRow[] | null>(null);
  useEffect(() => {
    api
      .myNativeOrders()
      .then((r) => setNativeOrders(r.data ?? []))
      .catch(() => setNativeOrders([]));
  }, []);

  // Member without a consultant can enter an agent's referral code to join.
  const [joinCode, setJoinCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [joinErr, setJoinErr] = useState<string | null>(null);
  async function joinConsultant() {
    const code = joinCode.trim();
    if (!code || joining) return;
    setJoining(true);
    setJoinErr(null);
    try {
      const r = await api.joinConsultant(code);
      setConsultant(r.consultant);
      setJoinCode("");
    } catch (e) {
      setJoinErr(
        e instanceof ApiError ? e.message : "Couldn't join with that code. Please try again.",
      );
    } finally {
      setJoining(false);
    }
  }

  if (!user) {
    return (
      <div className="quote-empty">
        Please sign in to view your account dashboard.
      </div>
    );
  }

  // A plain WordPress `customer` carries no membership role, so there is no
  // tier and no member discount — they pay list price until they top up.
  const currentRate = user.tier ? TIER_RATE[user.tier] : 0;

  // ---- Real spend, aggregated from the member's own orders ----
  // Build the last 6 calendar months (oldest → newest) and drop each order's
  // total into its month. Cancelled/refunded orders don't count as spend.
  const ordersLoading = nativeOrders === null;
  const now = new Date();
  const monthly = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    return {
      key: `${d.getFullYear()}-${d.getMonth()}`,
      m: d.toLocaleString("en-US", { month: "short" }),
      v: 0,
    };
  });
  const monthIndex = new Map(monthly.map((mm, i) => [mm.key, i]));
  const thisKey = `${now.getFullYear()}-${now.getMonth()}`;
  let thisMonthSpent = 0;
  for (const o of nativeOrders ?? []) {
    if (!o.date || /cancel|refund/i.test(o.status)) continue;
    const d = new Date(o.date);
    if (Number.isNaN(d.getTime())) continue;
    const k = `${d.getFullYear()}-${d.getMonth()}`;
    const amt = o.total || 0;
    const idx = monthIndex.get(k);
    if (idx != null) monthly[idx].v += amt;
    if (k === thisKey) thisMonthSpent += amt;
  }
  const max = Math.max(1, ...monthly.map((d) => d.v));
  const hasMonthlyData = monthly.some((d) => d.v > 0);

  // What the member actually paid this month (net, at their current tier), and
  // the implied list price so the tier-upsell rows can compare.
  const currentPrice = thisMonthSpent;
  const thisMonthGross = currentRate < 1 ? thisMonthSpent / (1 - currentRate) : thisMonthSpent;

  // ---- Order pipeline counts (top status cards), from real orders ----
  const statusCount = { new: 0, pending: 0, print: 0, delivery: 0 };
  for (const o of nativeOrders ?? []) {
    const s = o.status;
    if (s === "waiting") statusCount.new += 1;
    else if (s === "pending_confirmation" || s === "on_hold") statusCount.pending += 1;
    else if (s === "processing") statusCount.print += 1;
    else if (s === "ready" || s === "shipped") statusCount.delivery += 1;
  }
  const statusCards = [
    { label: "New Orders", value: statusCount.new, glyph: "▤", cls: "st-blue" },
    { label: "Pending", value: statusCount.pending, glyph: "⧗", cls: "st-amber" },
    { label: "Print", value: statusCount.print, glyph: "⎙", cls: "st-purple" },
    { label: "Delivery", value: statusCount.delivery, glyph: "⛟", cls: "st-green" },
  ];

  // ---- Pending List: real orders that need the member's action ----
  // pending_confirmation → confirm to proceed; ready → collect.
  const pendingItems = (nativeOrders ?? [])
    .filter((o) => o.status === "pending_confirmation" || o.status === "ready")
    .map((o) => ({
      ref: o.ref,
      date: o.date ? o.date.slice(0, 10) : "",
      product:
        o.items.length > 1
          ? `${o.items[0]?.name ?? "Order"} +${o.items.length - 1} more`
          : o.items[0]?.name ?? "Order",
      need:
        o.status === "pending_confirmation"
          ? "Awaiting your confirmation to proceed."
          : "Ready — available for collection.",
    }));
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

      {ordersLoading ? (
        <p className="acct-card-sub" style={{ padding: "8px 0" }}>Loading…</p>
      ) : thisMonthSpent <= 0 ? (
        <p className="acct-card-sub" style={{ padding: "8px 0" }}>
          No orders this month yet.
        </p>
      ) : (
        <>
          <div className="acct-month-total">
            <span>You ordered</span>
            <strong>RM {rm(currentPrice)}</strong>
            <span className="acct-month-sub">
              {user.tier
                ? `List RM ${rm(thisMonthGross)} · ${user.tier} saves ${Math.round(currentRate * 100)}%`
                : `List RM ${rm(thisMonthGross)} · top up to unlock member savings`}
            </span>
          </div>

          <p className="acct-upsell-label">If you were a higher tier:</p>
          <div className="acct-tier-rows">
            {TIER_ORDER.map((tier) => {
              const price = thisMonthGross * (1 - TIER_RATE[tier]);
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
        </>
      )}

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
      {ordersLoading ? (
        <p className="acct-card-sub" style={{ padding: "24px 0", textAlign: "center" }}>
          Loading…
        </p>
      ) : !hasMonthlyData ? (
        <p className="acct-card-sub" style={{ padding: "24px 0", textAlign: "center" }}>
          No data yet — your monthly spend will appear here once you place an order.
        </p>
      ) : (
      <div className="acct-chart">
        {monthly.map((d) => (
          <div key={d.key} className="acct-chart-col">
            <span className="acct-chart-val">{rm(d.v)}</span>
            <div className="acct-chart-bar" style={{ height: `${(d.v / max) * 100}%` }} />
            <span className="acct-chart-month">{d.m}</span>
          </div>
        ))}
      </div>
      )}
    </section>
  );

  // ---- right-panel content per selected section ----
  const renderSection = () => {
    switch (active) {
      case "consultant": {
        // The consultant is the agent the member registered under (their
        // referral code). No hardcoded fallback — if there's no referrer, we
        // show an empty state instead of a fake consultant.
        const cName = consultant?.name || null;
        const cWa = waNumber(consultant?.phone);
        const cInitials = cName ? initialsOf(cName) : "★";
        return (
          <>
          <div className="acct-grid">
          <section className="acct-card acct-consultant" id="my-consultant">
            <div className="acct-card-head">
              <h2>My Consultant</h2>
              <span>Your dedicated contact for quotes &amp; orders</span>
            </div>
            {cName ? (
              <>
                <div className="acct-consultant-body">
                  <span className="acct-consultant-avatar">
                    <span className="acct-consultant-fallback">{cInitials}</span>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={CONSULTANT.photo}
                      alt={cName}
                      className="acct-consultant-img"
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                    />
                  </span>
                  <div className="acct-consultant-info">
                    <strong>{cName}</strong>
                    <span>{CONSULTANT.role}</span>
                  </div>
                </div>
                {cWa ? (
                  <div className="acct-consultant-actions">
                    <a
                      href={`https://api.whatsapp.com/send?phone=${cWa}&text=${encodeURIComponent(
                        `Hi ${cName}, I'm ${user.name}.`,
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="acct-contact wa"
                    >
                      <span>✆</span> WhatsApp {cName.split(" ")[0]}
                    </a>
                  </div>
                ) : (
                  <p className="acct-card-sub" style={{ marginTop: 8 }}>
                    No WhatsApp number on file for your consultant yet.
                  </p>
                )}
              </>
            ) : (
              <div style={{ padding: "8px 0" }}>
                <p className="acct-card-sub" style={{ marginBottom: 12 }}>
                  You don’t have an assigned consultant yet. Enter a Sign Future
                  agent’s referral code below to join under them.
                </p>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    joinConsultant();
                  }}
                  style={{ display: "flex", gap: 8, flexWrap: "wrap" }}
                >
                  <input
                    type="text"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value)}
                    placeholder="Referral code"
                    disabled={joining}
                    className="acct-input"
                    style={{
                      flex: "1 1 160px",
                      minWidth: 0,
                      padding: "10px 12px",
                      border: "1px solid #d1d5db",
                      borderRadius: 8,
                      fontSize: 14,
                    }}
                    autoCapitalize="characters"
                  />
                  <button
                    type="submit"
                    className="acct-contact wa"
                    disabled={joining || !joinCode.trim()}
                    style={{
                      whiteSpace: "nowrap",
                      opacity: joining || !joinCode.trim() ? 0.6 : 1,
                    }}
                  >
                    {joining ? "Joining…" : "Join"}
                  </button>
                </form>
                {joinErr && (
                  <p
                    className="acct-card-sub"
                    style={{ marginTop: 8, color: "#dc2626" }}
                  >
                    {joinErr}
                  </p>
                )}
              </div>
            )}
          </section>
          {thisMonthCard}
          </div>
          {salesChart}
          </>
        );
      }

      case "requestQuote":
        return <RequestQuotation />;

      case "quotation":
        return <MyQuotations />;

      case "voucher":
        return (
          <section className="acct-card acct-section-card">
            <div className="acct-card-head">
              <h2>My Voucher</h2>
              <span>Your vouchers ready to use</span>
            </div>
            <VoucherCards />
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
            {ordersLoading ? (
              <p className="acct-card-sub" style={{ padding: "8px 0" }}>Loading…</p>
            ) : pendingItems.length === 0 ? (
              <p className="acct-card-sub" style={{ padding: "8px 0" }}>
                Nothing needs your action right now.
              </p>
            ) : (
              <div className="rec-list">
                {pendingItems.map((p) => (
                  <article key={p.ref} className="rec-card">
                    <div className="rec-main">
                      <div className="rec-top">
                        <strong className="rec-ref">{p.ref}</strong>
                        <span className="rec-status rs-pending">Action Needed</span>
                      </div>
                      {p.date && <span className="rec-date">{p.date}</span>}
                      <p className="rec-desc">{p.product}</p>
                      <p className="rec-need">{p.need}</p>
                    </div>
                    <div className="rec-side">
                      <button
                        type="button"
                        className="hero-btn primary rec-btn"
                        onClick={() => setActive("orders")}
                      >
                        View Order
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        );

      case "installation":
        // The member's own installation records, synced with our database (the
        // same rows admins manage under Admin → Installations).
        return <MyInstallationFrame />;

      case "lineLength":
        // Artwork line-length calculator: upload a black & white artwork, get the
        // size + total metres of the black lines (like the neon calculator).
        return <LineLengthTool />;

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

      case "editDetail":
        return <EditDetail />;

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
            className={`acct-side-item${active === s.key ? " is-active" : ""}${s.soon ? " is-soon" : ""}`}
            onClick={() => {
              if (!s.soon) setActive(s.key);
            }}
            disabled={s.soon}
            aria-current={active === s.key ? "page" : undefined}
          >
            <span className="acct-side-ico">{s.glyph}</span>
            <span>{s.label}</span>
            {s.soon && <span className="acct-side-soon">soon</span>}
          </button>
        ))}
      </aside>

      {/* ---------- right main ---------- */}
      <div className="acct-main">
        {/* Member summary card + order status cards are shown ONLY on the My
            Consultant section. Every other section (My Quotation, My Wallet, …)
            goes straight to its own panel without this header. */}
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

            <div className="acct-status">
              {statusCards.map((s) => (
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
