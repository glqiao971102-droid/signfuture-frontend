"use client";

import Link from "next/link";
import { useState } from "react";
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

type NavChild = { view: string; label: string };
type NavItem = { href: string; label: string; icon: string; section: string; children?: NavChild[] };

const NAV: NavItem[] = [
  { href: "/admin/dashboard", label: "Dashboard", icon: "◆", section: "dashboard" },
  { href: "/admin/visitors", label: "Visitors", icon: "👣", section: "visitors" },
  { href: "/admin/orders", label: "Orders", icon: "▤", section: "orders" },
  { href: "/admin/quotations", label: "Quotations", icon: "✉", section: "quotations" },
  { href: "/admin/users", label: "Customers", icon: "☺", section: "customers" },
  { href: "/admin/wallet", label: "Wallet", icon: "◈", section: "wallet" },
  { href: "/admin/invoices", label: "Invoices", icon: "▧", section: "invoices" },
  { href: "/admin/coupons", label: "Coupons", icon: "✁", section: "coupons" },
  { href: "/admin/vouchers", label: "Vouchers", icon: "🎟", section: "vouchers" },
  { href: "/admin/tiers", label: "Membership", icon: "★", section: "tiers" },
  { href: "/admin/agent-logins", label: "Agent Logins", icon: "🔐", section: "agent-logins" },
  { href: "/admin/installations", label: "Installations", icon: "⚒", section: "installations" },
  { href: "/admin/products", label: "Products", icon: "▦", section: "products" },
  { href: "/admin/product-pricing", label: "Product Pricing", icon: "＄", section: "products" },
  {
    href: "/admin/sales-listing",
    label: "Sales Listing",
    icon: "₪",
    section: "sales-listing",
    children: [
      { view: "dashboard", label: "Dashboard" },
      { view: "invoices", label: "Invoices" },
      { view: "costs", label: "Costs" },
      { view: "installation", label: "Installation" },
      { view: "scorecard", label: "Sales Scorecard" },
      { view: "mission", label: "Mission" },
      { view: "facebook", label: "Facebook Listing" },
    ],
  },
];

// Which permission section a given admin path belongs to. Returns null for
// pages every admin may open (the /admin root redirect, Launch Tests).
function sectionForPath(path: string): string | null {
  if (path.startsWith("/admin/orders")) return "orders";
  if (path.startsWith("/admin/quotations")) return "quotations";
  if (path.startsWith("/admin/users")) return "customers";
  if (path.startsWith("/admin/wallet")) return "wallet";
  if (path.startsWith("/admin/invoices")) return "invoices";
  if (path.startsWith("/admin/coupons")) return "coupons";
  if (path.startsWith("/admin/vouchers")) return "vouchers";
  if (path.startsWith("/admin/tiers")) return "tiers";
  if (path.startsWith("/admin/agent-logins")) return "agent-logins";
  if (path.startsWith("/admin/installations")) return "installations";
  if (path.startsWith("/admin/products") || path.startsWith("/admin/product-pricing")) return "products";
  if (path.startsWith("/admin/sales-listing")) return "sales-listing";
  if (path.startsWith("/admin/dashboard")) return "dashboard";
  return null;
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, openLogin, logout } = useAuth();
  const pathname = usePathname();
  // Collapsible parent menus (e.g. Sales Listing). Start open if you're already
  // inside that section; toggling is then fully manual.
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>(() => ({
    "/admin/sales-listing": pathname.startsWith("/admin/sales-listing"),
  }));
  const toggleMenu = (href: string) =>
    setOpenMenus((m) => ({ ...m, [href]: !(m[href] ?? false) }));

  // Sidebar reflects the account's permissions. Super admins see everything
  // plus the Permissions tab; other admins only see their granted sections.
  const isSuper = Boolean(user?.isSuperAdmin);
  const perms = user?.adminPermissions ?? [];
  const nav: NavItem[] = NAV.filter((i) => isSuper || perms.includes(i.section));
  // Launch QA checklist — available to every admin.
  nav.push({ href: "/admin/launch-tests", label: "Launch Tests", icon: "🚀", section: "launch-tests" });
  if (isSuper) nav.push({ href: "/admin/permissions", label: "Permissions", icon: "⚙", section: "permissions" });

  // Gate the current page: a non-super admin may only open sections they were
  // granted (Orders + Customers by default). Permissions is super-only.
  const currentSection = sectionForPath(pathname);
  const pageAllowed =
    isSuper ||
    (!pathname.startsWith("/admin/permissions") &&
      (currentSection == null || perms.includes(currentSection)));

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
            <em> · {isSuper ? "Super Admin" : "Admin"}</em>
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
            {nav.map((item) => {
              const active = pathname === item.href || pathname.startsWith(item.href + "/");

              // Parent with children → click toggles the sub-menu open/closed.
              if (item.children) {
                const open = openMenus[item.href] ?? false;
                return (
                  <div key={item.href}>
                    <button
                      type="button"
                      onClick={() => toggleMenu(item.href)}
                      className={`adm-nav-item adm-nav-toggle${active ? " is-active" : ""}`}
                      aria-expanded={open}
                    >
                      <span className="adm-nav-icon" aria-hidden="true">
                        {item.icon}
                      </span>
                      {item.label}
                      <span
                        className={`adm-nav-caret${open ? " is-open" : ""}`}
                        aria-hidden="true"
                      >
                        ▸
                      </span>
                    </button>
                    {open && (
                      <div className="adm-subnav">
                        {item.children.map((c) => (
                          <Link
                            key={c.view}
                            href={`${item.href}?view=${c.view}`}
                            className="adm-subnav-item"
                          >
                            {c.label}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                );
              }

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

        <main
          className={`adm-content${
            pathname.startsWith("/admin/sales-listing") ? " adm-content-full" : ""
          }`}
        >
          {pageAllowed ? (
            children
          ) : (
            <div className="adm-page-head">
              <h1>No access</h1>
              <p className="adm-page-sub">
                Your admin account doesn’t have access to this section. Please
                use Orders or Customers, or ask a Super Admin to grant access.
              </p>
              <Link href="/admin/orders" className="hero-btn primary" style={{ marginTop: 12 }}>
                Go to Orders
              </Link>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
