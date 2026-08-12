"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { QRCodeCanvas } from "qrcode.react";
import {
  api,
  type MemberProfile,
  type OrderSummary,
  type WalletTransaction,
} from "@/lib/api";

const money = (n: number) =>
  n.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function formatDate(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value.includes("T") ? value : value.replace(" ", "T"));
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-MY", { day: "2-digit", month: "short", year: "numeric" });
}

const SETTABLE = ["Diamond", "Gold", "Silver", "customer"] as const;

export default function AdminCustomerDetail({ id }: { id: number }) {
  const [profile, setProfile] = useState<MemberProfile | null>(null);
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [wallet, setWallet] = useState<WalletTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [savingTier, setSavingTier] = useState(false);
  const [tierMsg, setTierMsg] = useState<string | null>(null);

  // Editable contact details (name / email / phone).
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [savingContact, setSavingContact] = useState(false);
  const [contactMsg, setContactMsg] = useState<string | null>(null);

  function startEdit() {
    if (!profile) return;
    setEditName(profile.name ?? "");
    setEditEmail(profile.email ?? "");
    setEditPhone(profile.phone ?? "");
    setContactMsg(null);
    setEditing(true);
  }
  async function saveContact() {
    setSavingContact(true);
    setContactMsg(null);
    try {
      const r = await api.adminUpdateUserContact(id, {
        name: editName.trim(),
        email: editEmail.trim(),
        phone: editPhone.trim(),
      });
      setProfile(r.profile);
      setEditing(false);
    } catch (err) {
      setContactMsg(err instanceof Error ? err.message : "Could not save changes.");
    } finally {
      setSavingContact(false);
    }
  }

  // Referral / admin
  const [downline, setDownline] = useState<
    { id: number; email: string; name: string; registeredAt: string | null }[]
  >([]);
  const [downlineTotal, setDownlineTotal] = useState(0);
  const [makingAdmin, setMakingAdmin] = useState(false);
  const [adminMsg, setAdminMsg] = useState<string | null>(null);
  const qrRef = useRef<HTMLCanvasElement>(null);

  // Public site base for the referral link encoded in the QR.
  const SITE = "https://www.signfuturegroup.com";
  const referralUrl = profile?.referralCode ? `${SITE}/?ref=${profile.referralCode}` : "";

  function downloadQr() {
    const canvas = qrRef.current;
    if (!canvas) return;
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = `signfuture-referral-${profile?.referralCode ?? "qr"}.png`;
    a.click();
  }

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [p, o, w] = await Promise.all([
        api.adminUser(id),
        api.adminUserOrders(id).catch(() => ({ data: [], meta: null as never })),
        api.adminUserWallet(id).catch(() => ({ data: [], meta: null as never })),
      ]);
      setProfile(p);
      setOrders(o.data);
      setWallet(w.data);
      // Admins have a downline; load it.
      if (p.isAdmin) {
        try {
          const dl = await api.adminDownline(id);
          setDownline(dl.data);
          setDownlineTotal(dl.meta.total);
        } catch {
          setDownline([]);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load customer");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function promoteToAdmin() {
    if (!confirm("Promote this member to administrator? They'll get a referral code and admin access.")) return;
    setMakingAdmin(true);
    setAdminMsg(null);
    try {
      const r = await api.adminMakeAdmin(id);
      setAdminMsg(`Now an admin. Referral code: ${r.referralCode}`);
      await load();
    } catch (err) {
      setAdminMsg(err instanceof Error ? err.message : "Could not promote user");
    } finally {
      setMakingAdmin(false);
    }
  }

  async function changeTier(tier: (typeof SETTABLE)[number]) {
    setSavingTier(true);
    setTierMsg(null);
    try {
      const r = await api.adminUpdateUserTier(id, tier);
      setTierMsg(`Updated to ${r.tier ?? "no tier"}.`);
      await load();
    } catch (err) {
      setTierMsg(err instanceof Error ? err.message : "Could not change tier");
    } finally {
      setSavingTier(false);
    }
  }

  if (loading) return <div className="adm-wrap"><p>Loading customer…</p></div>;
  if (error || !profile)
    return (
      <div className="adm-wrap">
        <div className="quote-empty">{error ?? "Not found."}</div>
        <Link href="/admin/users" className="adm-edit-link">← Back to customers</Link>
      </div>
    );

  return (
    <div className="adm-wrap">
      <Link href="/admin/users" className="adm-edit-link">← Back to customers</Link>

      <div className="adm-card">
        <div className="adm-card-head-row">
          <h2>
            {profile.name || profile.login}{" "}
            {profile.isAdmin && <span className="adm-chip adm-chip-admin">ADMIN</span>}
            {profile.tier && <span className={`adm-chip tier-${profile.tier.toLowerCase()}`} style={{ marginLeft: profile.isAdmin ? 6 : 0 }}>{profile.tier}</span>}
            {!profile.isAdmin && !profile.tier && <span className="adm-chip adm-chip-member">Member</span>}
          </h2>
          <span className="adm-card-sub">Member #{profile.memberNo}</span>
        </div>
        <div className="adm-drawer-meta">
          <div><span className="adm-key-label">Login</span>{profile.login}</div>
          <div><span className="adm-key-label">Email</span>{profile.email}</div>
          <div><span className="adm-key-label">Phone</span>{profile.phone ?? "—"}</div>
          <div><span className="adm-key-label">Joined</span>{formatDate(profile.registeredAt)}</div>
          <div><span className="adm-key-label">Wallet</span>RM {money(profile.wallet.balance)}</div>
          {profile.stats && (
            <>
              <div><span className="adm-key-label">Orders</span>{profile.stats.orderCount}</div>
              <div><span className="adm-key-label">Lifetime spend</span>RM {money(profile.stats.totalSpent)}</div>
            </>
          )}
          {profile.professions && profile.professions.length > 0 && (
            <div style={{ gridColumn: "1 / -1" }}>
              <span className="adm-key-label">Profession</span>
              <div className="adm-prof-tags">
                {profile.professions.map((p) => (
                  <span key={p} className="adm-chip adm-chip-member">{p}</span>
                ))}
              </div>
            </div>
          )}
          <div style={{ gridColumn: "1 / -1" }}>
            <span className="adm-key-label">Upline (referrer)</span>
            {profile.upline ? (
              <>
                <Link href={`/admin/users/${profile.upline.id}`} className="adm-edit-link">
                  {profile.upline.name || `User ${profile.upline.id}`}
                </Link>
                {profile.upline.phone ? ` · ${profile.upline.phone}` : ""}
              </>
            ) : (
              <span>— (registered without a referral code)</span>
            )}
          </div>
        </div>

        {!editing ? (
          <div className="adm-tier-control">
            <button type="button" className="hero-btn ghost" onClick={startEdit}>✎ Edit contact details</button>
            {contactMsg && <em className="adm-card-sub" style={{ color: "#ff8f8f" }}>{contactMsg}</em>}
          </div>
        ) : (
          <div className="adm-tier-control" style={{ display: "grid", gap: 10, maxWidth: 460 }}>
            <span className="adm-key-label">Edit contact details</span>
            <label className="adm-modal-field">
              <span>Name</span>
              <input className="adm-input" type="text" value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Full name" />
            </label>
            <label className="adm-modal-field">
              <span>Email</span>
              <input className="adm-input" type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} placeholder="name@example.com" />
            </label>
            <label className="adm-modal-field">
              <span>Phone</span>
              <input className="adm-input" type="tel" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} placeholder="01x-xxx xxxx" />
            </label>
            {contactMsg && <em className="adm-card-sub" style={{ color: "#ff8f8f" }}>{contactMsg}</em>}
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" className="hero-btn primary" disabled={savingContact} onClick={saveContact}>
                {savingContact ? "Saving…" : "Save"}
              </button>
              <button type="button" className="hero-btn ghost" disabled={savingContact} onClick={() => setEditing(false)}>
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="adm-tier-control">
          <span className="adm-key-label">Change tier{profile.isAdmin ? " (admins can also hold a tier)" : ""}</span>
          <div className="adm-radio-row">
            {SETTABLE.map((t) => (
              <button
                key={t}
                type="button"
                className={`adm-filter${(profile.tier ?? "customer") === t ? " is-active" : ""}`}
                disabled={savingTier}
                onClick={() => changeTier(t)}
              >
                {t === "customer" ? "No tier" : t}
              </button>
            ))}
          </div>
          {tierMsg && <em className="adm-card-sub">{tierMsg}</em>}
        </div>

        {/* Referral / admin */}
        <div className="adm-tier-control">
          {profile.isAdmin ? (
            !profile.referralCode ? (
              <>
                <span className="adm-key-label">Referral code</span>
                <em className="adm-card-sub">This admin has no referral code yet.</em>
                <button
                  type="button"
                  className="hero-btn ghost"
                  disabled={makingAdmin}
                  onClick={promoteToAdmin}
                >
                  {makingAdmin ? "Generating…" : "Generate referral code"}
                </button>
                {adminMsg && <em className="adm-card-sub">{adminMsg}</em>}
              </>
            ) : (
            <>
              <span className="adm-key-label">Referral code</span>
              <code className="adm-referral-code">{profile.referralCode ?? "—"}</code>
              <em className="adm-card-sub">🔒 Permanent — a referral code cannot be changed once generated.</em>
              {profile.referralCode && (
                <div className="adm-qr-block">
                  <div className="adm-qr-frame">
                    <QRCodeCanvas
                      ref={qrRef}
                      value={referralUrl}
                      size={160}
                      level="M"
                      includeMargin
                    />
                  </div>
                  <div className="adm-qr-actions">
                    <em className="adm-card-sub">
                      Scanning this QR opens sign-up with this code pre-filled — the new
                      member joins under this admin.
                    </em>
                    <code className="adm-qr-link">{referralUrl}</code>
                    <div className="adm-radio-row">
                      <button type="button" className="adm-filter" onClick={downloadQr}>
                        ↓ Download QR
                      </button>
                      <button
                        type="button"
                        className="adm-filter"
                        onClick={() => navigator.clipboard?.writeText(referralUrl)}
                      >
                        Copy link
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
            )
          ) : (
            <>
              <span className="adm-key-label">Admin access</span>
              <button
                type="button"
                className="hero-btn ghost"
                disabled={makingAdmin}
                onClick={promoteToAdmin}
              >
                {makingAdmin ? "Promoting…" : "Make admin"}
              </button>
            </>
          )}
          {adminMsg && <em className="adm-card-sub">{adminMsg}</em>}
          {profile.referredBy && (
            <em className="adm-card-sub">
              Referred by admin #{profile.referredBy}
            </em>
          )}
        </div>
      </div>

      {profile.isAdmin && (
        <div className="adm-card">
          <div className="adm-card-head-row">
            <h2>Downline</h2>
            <span className="adm-card-sub">{downlineTotal} member{downlineTotal === 1 ? "" : "s"}</span>
          </div>
          <div className="adm-table-scroll">
            <table className="adm-table">
              <thead>
                <tr><th>Member</th><th>Email</th><th>Joined</th></tr>
              </thead>
              <tbody>
                {downline.length === 0 && (
                  <tr><td colSpan={3} className="adm-empty">No one has registered with this code yet.</td></tr>
                )}
                {downline.map((m) => (
                  <tr key={m.id}>
                    <td>
                      <Link href={`/admin/users/${m.id}`} className="adm-edit-link">
                        {m.name || m.email}
                      </Link>
                    </td>
                    <td className="adm-email">{m.email}</td>
                    <td className="adm-date">{formatDate(m.registeredAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="adm-two-col">
        <div className="adm-card">
          <div className="adm-card-head-row">
            <h2>Recent orders</h2>
          </div>
          <div className="adm-table-scroll">
            <table className="adm-table">
              <thead>
                <tr><th>Order</th><th>Status</th><th className="adm-num">Total</th><th>Date</th></tr>
              </thead>
              <tbody>
                {orders.length === 0 && <tr><td colSpan={4} className="adm-empty">No orders.</td></tr>}
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td className="adm-mono">#{o.id}</td>
                    <td><span className={`adm-chip adm-stage-${o.stage}`}>{o.statusLabel}</span></td>
                    <td className="adm-num adm-mono">{money(o.total)}</td>
                    <td className="adm-date">{formatDate(o.date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="adm-card">
          <div className="adm-card-head-row">
            <h2>Wallet history</h2>
          </div>
          <div className="adm-table-scroll">
            <table className="adm-table">
              <thead>
                <tr><th>Date</th><th>Type</th><th className="adm-num">Amount</th><th>Details</th></tr>
              </thead>
              <tbody>
                {wallet.length === 0 && <tr><td colSpan={4} className="adm-empty">No transactions.</td></tr>}
                {wallet.map((t) => (
                  <tr key={t.id}>
                    <td className="adm-date">{formatDate(t.date)}</td>
                    <td>
                      <span className={`adm-chip ${t.type === "credit" ? "adm-stage-completed" : "adm-stage-cancelled"}`}>
                        {t.type}
                      </span>
                    </td>
                    <td className="adm-num adm-mono">
                      {t.type === "credit" ? "+" : "−"}{money(t.amount)}
                    </td>
                    <td className="adm-email">{t.details ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
