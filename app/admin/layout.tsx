"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";

/**
 * CRM shell for the admin area.
 *
 * Access is gated here once for every /admin/* page. This is a UX gate only —
 * the real enforcement is the backend admin middleware, which 403s every
 * /api/v1/admin/* request from a non-admin, so no data leaks even if someone
 * reaches these pages.
 */

const NAV = [
  { href: "/admin/dashboard", label: "Dashboard", icon: "◆" },
  { href: "/admin/orders", label: "Orders", icon: "▤" },
  { href: "/admin/users", label: "Customers", icon: "☺" },
  { href: "/admin/wallet", label: "Wallet", icon: "◈" },
  { href: "/admin/invoices", label: "Invoices", icon: "▧" },
  { href: "/admin/coupons", label: "Coupons", icon: "✁" },
  { href: "/admin/vouchers", label: "Vouchers", icon: "🎟" },
  { href: "/admin/tiers", label: "Membership", icon: "★" },
  { href: "/admin/products", label: "Products", icon: "▦" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, openLogin, logout } = useAuth();
  const pathname = usePathname();

  // Gate states get the full-screen centred treatment, without the sidebar.
  if (loading || !user || !user.isAdmin) {
    return (
      <div className="adm-shell">
        <header className="adm-topbar">
          <div className="adm-brand">
            <span className="adm-badge">ADMIN</span>
            <strong>Sign Future</strong>
          </div>
          <Link href="/" className="adm-link">
            ← Site
          </Link>
        </header>
        <div className="adm-gate">
          {loading ? (
            <p>Checking access…</p>
          ) : !user ? (
            <>
              <h1>Admin sign in required</h1>
              <p>Sign in with an administrator account to continue.</p>
              <button type="button" className="hero-btn primary" onClick={openLogin}>
                Sign in
              </button>
            </>
          ) : (
            <>
              <h1>Access denied</h1>
              <p>
                Your account (<strong>{user.email}</strong>) is not an administrator.
              </p>
              <Link href="/account" className="hero-btn ghost">
                Go to my account
              </Link>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="adm-shell">
      <header className="adm-topbar">
        <div className="adm-brand">
          <span className="adm-badge">ADMIN</span>
          <strong>Sign Future</strong>
        </div>
        <div className="adm-topbar-right">
          <span className="adm-whoami">
            {user.name}
            <em> · administrator</em>
          </span>
          <Link href="/" className="adm-link">
            ← Site
          </Link>
          <button type="button" className="adm-logout" onClick={logout}>
            Log out
          </button>
        </div>
      </header>

      <div className="adm-body">
        <aside className="adm-sidebar">
          <nav>
            {NAV.map((item) => {
              const active = pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`adm-nav-item${active ? " is-active" : ""}`}
                >
                  <span className="adm-nav-icon" aria-hidden="true">
                    {item.icon}
                  </span>
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>

        <main className="adm-content">{children}</main>
      </div>
    </div>
  );
}
