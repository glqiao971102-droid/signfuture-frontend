"use client";

import { useEffect, useState } from "react";

// Bump this key whenever a NEW notice should re-appear for everyone (the old
// key stays dismissed, the new one shows once per browser session).
const NOTICE_KEY = "sf-notice-iman-20260914";

/**
 * Official customer notice shown once per browser session on the homepage.
 * Dismissable via the × button, the "I understand" button, or clicking the
 * backdrop — the dismissal is remembered in sessionStorage so it won't nag on
 * every navigation, but returns on a fresh session.
 */
export default function NoticePopup() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      if (!sessionStorage.getItem(NOTICE_KEY)) setOpen(true);
    } catch {
      // Private mode / storage blocked — still show it, just won't persist.
      setOpen(true);
    }
  }, []);

  const close = () => {
    setOpen(false);
    try {
      sessionStorage.setItem(NOTICE_KEY, "1");
    } catch {
      /* ignore */
    }
  };

  if (!open) return null;

  return (
    <div
      onClick={close}
      role="dialog"
      aria-modal="true"
      aria-label="Official customer notice"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 2000,
        background: "rgba(8, 12, 24, 0.72)",
        backdropFilter: "blur(2px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "relative",
          width: "100%",
          maxWidth: 620,
          maxHeight: "90vh",
          overflowY: "auto",
          background: "#ffffff",
          color: "#1a1a2e",
          borderRadius: 14,
          boxShadow: "0 24px 60px rgba(0,0,0,0.45)",
          padding: "28px 30px 26px",
        }}
      >
        <button
          type="button"
          onClick={close}
          aria-label="Close"
          style={{
            position: "absolute",
            top: 12,
            right: 14,
            width: 34,
            height: 34,
            borderRadius: 8,
            border: "none",
            background: "#f0f0f5",
            color: "#333",
            fontSize: 22,
            lineHeight: 1,
            cursor: "pointer",
          }}
        >
          ×
        </button>

        {/* Brand */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Sign Future" style={{ height: 40, width: "auto" }} />
        </div>

        <h2 style={{ margin: "0 0 2px", fontSize: 22, fontWeight: 800, letterSpacing: 0.5 }}>
          OFFICIAL CUSTOMER NOTICE
        </h2>
        <div style={{ height: 3, width: 64, background: "#6d28d9", borderRadius: 2, margin: "6px 0 14px" }} />
        <h3 style={{ margin: "0 0 14px", fontSize: 15, fontWeight: 800, textTransform: "uppercase" }}>
          Notice of No Longer Representing the Company
        </h3>

        <div style={{ fontSize: 13.5, lineHeight: 1.6, color: "#2b2b3c" }}>
          <p style={{ margin: "0 0 12px" }}>
            Sign Future Industry Sdn Bhd hereby informs all customers, business partners,
            suppliers, and members of the public that <strong>Mr. Iman Rayson Lim</strong> is no
            longer affiliated with, engaged by, or authorized to represent Sign Future Industry
            Sdn Bhd, effective from <strong>14 September 2026</strong>.
          </p>

          <p style={{ margin: "0 0 8px" }}>From the above date, the said individual:</p>
          <ol style={{ margin: "0 0 12px", paddingLeft: 20, display: "flex", flexDirection: "column", gap: 8 }}>
            <li>
              Is no longer authorized to act on behalf of Sign Future Industry Sdn Bhd in any
              capacity whatsoever.
            </li>
            <li>
              Is no longer authorized to solicit business, negotiate projects, issue quotations,
              enter into agreements, accept instructions, collect payments, receive deposits or
              sign any documents on behalf of the Company.
            </li>
            <li>
              Is no longer authorized to provide consultations, site visits, project coordination,
              installation arrangements, after-sales services, warranty support, maintenance
              services or customer support on behalf of the Company.
            </li>
          </ol>

          <p style={{ margin: "0 0 12px" }}>
            Any statements, commitments, agreements, arrangements or transactions made by{" "}
            <strong>Mr. Iman Rayson Lim</strong> after the effective date shall not be binding upon
            Sign Future Industry Sdn Bhd.
          </p>

          <p style={{ margin: "0 0 14px" }}>
            Customers whose inquiries, quotations, orders, projects, installations, maintenance
            services, warranty claims, or after-sales matters were previously handled by{" "}
            <strong>Mr. Iman Rayson Lim</strong> are kindly requested to contact the Company
            directly through our official channels:
          </p>

          {/* Official channels */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 16,
              padding: "12px 14px",
              background: "#f6f5fb",
              borderRadius: 10,
              margin: "0 0 14px",
            }}
          >
            <div style={{ flex: "1 1 220px" }}>
              <div style={{ fontWeight: 700, marginBottom: 2 }}>📘 Facebook Page Inbox</div>
              <div style={{ color: "#555", fontSize: 12.5 }}>
                Please send us a message via our official Facebook Page.
              </div>
            </div>
            <div style={{ flex: "1 1 200px" }}>
              <div style={{ fontWeight: 700, marginBottom: 2 }}>💬 WhatsApp</div>
              <a
                href="https://wa.me/601156758370"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "#128c3e", fontWeight: 700, fontSize: 16, textDecoration: "none" }}
              >
                +6011 5675 8370
              </a>
            </div>
          </div>

          <p style={{ margin: "0 0 12px" }}>
            Members of the public are advised to exercise caution and verify any communication
            claiming to represent Sign Future Industry Sdn Bhd through our official channels.
          </p>
          <p style={{ margin: "0 0 14px" }}>
            Our team remains fully committed to providing continuous support and assistance to all
            customers. We sincerely appreciate your understanding, trust, and continued support.
          </p>

          <div style={{ borderTop: "1px solid #e6e6ee", paddingTop: 12, fontSize: 12.5, color: "#555" }}>
            By Order of the Company
            <br />
            <strong style={{ color: "#1a1a2e" }}>SIGN FUTURE INDUSTRY SDN BHD</strong>
            <br />
            14 September 2026
          </div>
        </div>

        <button
          type="button"
          onClick={close}
          style={{
            marginTop: 18,
            width: "100%",
            padding: "12px 16px",
            border: "none",
            borderRadius: 10,
            background: "#6d28d9",
            color: "#fff",
            fontWeight: 700,
            fontSize: 15,
            cursor: "pointer",
          }}
        >
          I understand
        </button>
      </div>
    </div>
  );
}
