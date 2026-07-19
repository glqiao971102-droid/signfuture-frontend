"use client";

import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";

export default function AccountPanel() {
  const { user, openLogin, logout } = useAuth();

  return (
    <aside className="account-panel">
      <div className="account-head">
        <span
          className={`account-avatar${user ? ` tier-${(user.tier ?? "member").toLowerCase()}` : ""}`}
        >
          {user ? (
            <>
              <span className="account-avatar-fallback">◆</span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/mascot-silver.webp"
                alt=""
                className="account-avatar-img"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
            </>
          ) : (
            "◇"
          )}
        </span>
        <div>
          <strong>{user ? user.name : "Guest"}</strong>
          <span className="account-balance">
            {user
              ? `Wallet · RM ${user.wallet.balance.toFixed(2)}`
              : "Wallet · RM 0.00"}
          </span>
        </div>
      </div>

      <ul className="account-list">
        {user ? (
          <li>
            <Link href="/account">
              <span className="account-ico">☺</span> My Account
            </Link>
          </li>
        ) : (
          <li>
            <button type="button" onClick={openLogin}>
              <span className="account-ico">→]</span> Login
            </button>
          </li>
        )}
        <li>
          <Link href="/my-quotation">
            <span className="account-ico">❝</span> My Quotation
          </Link>
        </li>
        <li>
          <Link href="/order-status">
            <span className="account-ico">⛟</span> Order Status
          </Link>
        </li>
        <li>
          <Link href="/download-invoice">
            <span className="account-ico">⤓</span> Download Invoice
          </Link>
        </li>
        {user && (
          <li>
            <button type="button" onClick={logout}>
              <span className="account-ico">[→</span> Logout
            </button>
          </li>
        )}
      </ul>

      {user ? (
        <Link href="/package" className="account-cta">
          Top Up Wallet
        </Link>
      ) : (
        <button type="button" className="account-cta" onClick={openLogin}>
          Sign in / Register
        </button>
      )}
    </aside>
  );
}
