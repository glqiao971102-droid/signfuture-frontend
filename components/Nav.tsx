"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { PRODUCT_MENU, SITE_NAV, flattenMenu, nodeHref, type ProductMenuItem } from "@/lib/products";
import { useCart } from "@/components/CartProvider";
import { useAuth } from "@/components/AuthProvider";

export default function Nav() {
  const pathname = usePathname();
  const { count } = useCart();
  const { user, openLogin, logout } = useAuth();

  // Mobile drawer state.
  const [menuOpen, setMenuOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  // Close the drawer on navigation.
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  // Lock body scroll + allow Escape to close while the drawer is open.
  useEffect(() => {
    if (!menuOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const isActive = (href?: string) =>
    !!href && (pathname === href || pathname.startsWith(href + "/"));

  const nodeActive = (node: ProductMenuItem): boolean =>
    node.children ? node.children.some(nodeActive) : isActive(node.href);

  const productActive = flattenMenu().some((m) => isActive(m.href));

  const renderItems = (items: ProductMenuItem[]) =>
    items.map((node) =>
      node.children ? (
        <div
          key={node.label}
          className={`dropdown-item has-children${nodeActive(node) ? " active" : ""}`}
        >
          <Link href={nodeHref(node)} className="dropdown-item-label">
            {node.label}
          </Link>
          <span className="submenu-caret">›</span>
          <div className="nav-submenu" role="menu">
            {renderItems(node.children)}
          </div>
        </div>
      ) : (
        <Link
          key={node.href ?? node.label}
          href={node.href ?? "#"}
          role="menuitem"
          className={`dropdown-item${isActive(node.href) ? " active" : ""}`}
        >
          <span>{node.label}</span>
          {!node.available && <span className="soon-tag">Soon</span>}
        </Link>
      )
    );

  // Mobile drawer: recursive accordion for the product tree.
  const toggleGroup = (key: string) =>
    setOpenGroups((g) => ({ ...g, [key]: !g[key] }));

  const renderMobileItems = (items: ProductMenuItem[], depth = 0) =>
    items.map((node) => {
      if (node.children) {
        const key = `${depth}-${node.label}`;
        const open = openGroups[key] ?? false;
        return (
          <div key={key} className="m-tree-group">
            <button
              type="button"
              className={`m-tree-toggle${nodeActive(node) ? " active" : ""}`}
              style={{ paddingLeft: 16 + depth * 14 }}
              onClick={() => toggleGroup(key)}
              aria-expanded={open}
            >
              <span>{node.label}</span>
              <span className={`m-tree-caret${open ? " open" : ""}`} aria-hidden="true">▾</span>
            </button>
            {open && <div className="m-tree-children">{renderMobileItems(node.children, depth + 1)}</div>}
          </div>
        );
      }
      return (
        <Link
          key={node.href ?? node.label}
          href={node.href ?? "#"}
          className={`m-tree-link${isActive(node.href) ? " active" : ""}`}
          style={{ paddingLeft: 16 + depth * 14 }}
        >
          <span>{node.label}</span>
          {!node.available && <span className="soon-tag">Soon</span>}
        </Link>
      );
    });

  // Badge counts — show the badge only when there is something (>0).
  const pendingCount = 0;
  const notificationCount = 0;

  return (
    <>
    <nav className="site-nav">
      {/* Top row: logo (left) + action icons (right) */}
      <div className="nav-top">
        <div className="nav-inner">
          <Link href="/" className="brand" aria-label="Sign Studio home">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="Sign Studio" className="brand-logo" />
          </Link>

          <div className="nav-actions">
            <Link href="/pending-list" className="icon-btn nav-icon-extra" aria-label="Pending List" title="Pending List">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="5" y="4" width="14" height="17" rx="2" />
                <path d="M9 4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1H9z" />
                <path d="M8.5 10.5h7M8.5 14h7M8.5 17.5h4" />
              </svg>
              {pendingCount > 0 && <span className="icon-badge">{pendingCount}</span>}
            </Link>
            <Link href="/notifications" className="icon-btn nav-icon-extra" aria-label="Notifications" title="Notifications">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.7 21a2 2 0 0 1-3.4 0" />
              </svg>
              {notificationCount > 0 && <span className="icon-badge">{notificationCount}</span>}
            </Link>
            <Link href="/track-order" className="icon-btn nav-icon-extra" aria-label="Track Order" title="Track Order">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="1.5" y="6" width="12" height="10" rx="1.5" />
                <path d="M13.5 9.5H17l3.5 3.5V16h-7z" />
                <circle cx="6" cy="18.5" r="1.7" />
                <circle cx="17.5" cy="18.5" r="1.7" />
              </svg>
            </Link>
            <Link href="/cart" className="icon-btn" aria-label="Cart" title="Cart">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="9" cy="20" r="1.5" />
                <circle cx="18" cy="20" r="1.5" />
                <path d="M2 3h2.2l2.3 12.1a1 1 0 0 0 1 .8h9.1a1 1 0 0 0 1-.8L20.5 7.5H6" />
              </svg>
              {count > 0 && <span className="icon-badge">{count}</span>}
            </Link>
            {user ? (
              <div className="member-menu">
                <Link
                  href="/account"
                  className={`member-badge tier-${(user.tier ?? "member").toLowerCase()}`}
                  title={`${user.tier ?? "Member"} · ${user.memberNo}`}
                >
                  <span className="member-medal" aria-hidden="true">
                    <span className="member-medal-fallback">◆</span>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="/mascot-silver.webp"
                      alt=""
                      className="member-medal-img"
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                    />
                  </span>
                  <span className="member-meta">
                    <span className="member-tier">
                      {user.tier ? `${user.tier.toUpperCase()} MEMBER` : "MEMBER"}
                    </span>
                    <span className="member-no">{user.memberNo}</span>
                  </span>
                  <span className="member-wallet">
                    {user.wallet.currency === "MYR" ? "RM" : user.wallet.currency}{" "}
                    {user.wallet.balance.toFixed(2)}
                  </span>
                </Link>

                <div className="member-dropdown" role="menu">
                  <Link href="/account" role="menuitem">Account</Link>
                  <Link href="/package" role="menuitem">Top Up</Link>
                  <Link href="/track-order" role="menuitem">Track Order</Link>
                  <Link href="/package" role="menuitem">My Offer</Link>
                  <Link href="/my-quotation" role="menuitem">My Quotation</Link>
                  <button type="button" role="menuitem" className="member-logout" onClick={logout}>
                    Log Out
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" className="login-btn nav-desktop-login" onClick={openLogin}>
                Login
              </button>
            )}

            {/* Mobile hamburger */}
            <button
              type="button"
              className={`nav-hamburger${menuOpen ? " open" : ""}`}
              aria-label="Menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((o) => !o)}
            >
              <span /><span /><span />
            </button>
          </div>
        </div>
      </div>

      {/* Bottom row: primary navigation menu (desktop) */}
      <div className="nav-bottom">
        <div className="nav-links nav-inner">
          <Link href="/" className={`nav-link${pathname === "/" ? " active" : ""}`}>
            Home
          </Link>

          <div className="nav-dropdown">
            <button
              type="button"
              className={`nav-link nav-dropdown-trigger${productActive ? " active" : ""}`}
              aria-haspopup="true"
            >
              Product <span className="caret">▾</span>
            </button>
            <div className="nav-dropdown-menu" role="menu">
              {renderItems(PRODUCT_MENU)}
            </div>
          </div>

          {SITE_NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`nav-link${isActive(item.href) ? " active" : ""}`}
              {...(item.newTab ? { target: "_blank", rel: "noopener noreferrer" } : {})}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </div>
      </nav>

      {/* ---------- Mobile drawer (sibling of <nav>, so it isn't trapped by
          the nav's backdrop-filter containing block) ---------- */}
      <div
        className={`m-drawer-overlay${menuOpen ? " open" : ""}`}
        onClick={() => setMenuOpen(false)}
        aria-hidden={!menuOpen}
      />
      <aside className={`m-drawer${menuOpen ? " open" : ""}`} aria-hidden={!menuOpen}>
        <div className="m-drawer-head">
          <span className="m-drawer-title">Menu</span>
          <button type="button" className="m-drawer-close" aria-label="Close menu" onClick={() => setMenuOpen(false)}>
            ✕
          </button>
        </div>

        {/* Account / login */}
        {user ? (
          <div className="m-account">
            <Link href="/account" className={`m-account-badge tier-${(user.tier ?? "member").toLowerCase()}`}>
              <span className="m-account-tier">{user.tier ? `${user.tier.toUpperCase()} MEMBER` : "MEMBER"}</span>
              <span className="m-account-no">{user.memberNo}</span>
              <span className="m-account-wallet">
                {user.wallet.currency === "MYR" ? "RM" : user.wallet.currency} {user.wallet.balance.toFixed(2)}
              </span>
            </Link>
            <div className="m-account-links">
              <Link href="/account">Account</Link>
              <Link href="/package">Top Up</Link>
              <Link href="/package">My Offer</Link>
              <Link href="/my-quotation">My Quotation</Link>
            </div>
          </div>
        ) : (
          <button type="button" className="m-login-btn" onClick={() => { setMenuOpen(false); openLogin(); }}>
            Login / Register
          </button>
        )}

        {/* Primary nav */}
        <nav className="m-nav">
          <Link href="/" className={`m-tree-link${pathname === "/" ? " active" : ""}`}>Home</Link>

          <div className="m-tree-group">
            <button
              type="button"
              className={`m-tree-toggle${productActive ? " active" : ""}`}
              onClick={() => toggleGroup("__product")}
              aria-expanded={openGroups["__product"] ?? false}
            >
              <span>Product</span>
              <span className={`m-tree-caret${(openGroups["__product"] ?? false) ? " open" : ""}`} aria-hidden="true">▾</span>
            </button>
            {(openGroups["__product"] ?? false) && (
              <div className="m-tree-children">{renderMobileItems(PRODUCT_MENU, 1)}</div>
            )}
          </div>

          {SITE_NAV.map((item) => (
            <Link key={item.href} href={item.href} className={`m-tree-link${isActive(item.href) ? " active" : ""}`}>
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Quick links */}
        <div className="m-quick">
          <Link href="/track-order">Track Order</Link>
          <Link href="/pending-list">Pending List</Link>
          <Link href="/notifications">Notifications</Link>
          <Link href="/cart">Cart{count > 0 ? ` (${count})` : ""}</Link>
        </div>

        {user && (
          <button type="button" className="m-logout" onClick={() => { setMenuOpen(false); logout(); }}>
            Log Out
          </button>
        )}
      </aside>
    </>
  );
}
