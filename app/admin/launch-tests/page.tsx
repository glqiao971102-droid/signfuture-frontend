"use client";

import { useEffect, useMemo, useState } from "react";

/**
 * First-launch QA checklist. A pure client-side go/no-go board — no backend.
 * Each step cycles pending → pass → fail and is saved to localStorage so a
 * tester can work through it across sessions on the same browser.
 */

type Step = { id: string; text: string; expect?: string };
type Case = { id: string; no: number; title: string; scope: string; steps: Step[] };

const CASES: Case[] = [
  {
    id: "product",
    no: 1,
    title: "Product Finalize",
    scope: "Admin → Products / storefront",
    steps: [
      { id: "p1", text: "Open Products, edit a product (e.g. Banner), change inputs / options / pricing formula." },
      { id: "p2", text: "Live preview on the right recalculates as you edit.", expect: "Price updates instantly" },
      { id: "p3", text: "Save the product — no error, changes persist after reload." },
      { id: "p4", text: "Upload / replace the product image; it shows on the card." },
      { id: "p5", text: "On the public storefront the product shows the finalized price & options." },
      { id: "p6", text: "Add to cart → price matches the calculator; quantities & options carry through." },
      { id: "p7", text: "Tier pricing (if set): Silver/Gold/Diamond member sees their price, Normal sees standard." },
    ],
  },
  {
    id: "register",
    no: 2,
    title: "Registration with QR",
    scope: "Admin QR → public register",
    steps: [
      { id: "r1", text: "As an admin, open your profile QR code (encodes your referral code)." },
      { id: "r2", text: "Scan the QR on a phone → register page opens with referral code pre-filled." },
      { id: "r3", text: "Fill full name + email, request OTP.", expect: "OTP email arrives" },
      { id: "r4", text: "Enter OTP, set password, pick one or more professions (10 trades)." },
      { id: "r5", text: "Referral code is REQUIRED — submitting without one is blocked." },
      { id: "r6", text: "Submit → account created and auto-logged-in (no separate login needed)." },
      { id: "r7", text: "New user appears under the referring admin's downline.", expect: "Downline shows the new user" },
    ],
  },
  {
    id: "voucher",
    no: 3,
    title: "Voucher System",
    scope: "Admin → Vouchers / checkout",
    steps: [
      { id: "v1", text: "Create a voucher scoped to a product OR category; fixed amount AND percent both selectable." },
      { id: "v2", text: "Grant to specific users → those users receive it (email sent)." },
      { id: "v3", text: "Grant by registration date / date range → all matching users get it (email)." },
      { id: "v4", text: "At checkout the discount applies ONLY to eligible items, not the whole cart.", expect: "Ineligible lines unchanged" },
      { id: "v5", text: "Voucher is one-time per user — after use it can't be applied again." },
      { id: "v6", text: "Ineligible user / expired voucher is rejected at checkout." },
    ],
  },
  {
    id: "rbac",
    no: 4,
    title: "Super Admin & Admin",
    scope: "Admin → Permissions",
    steps: [
      { id: "a1", text: "Super admin sees ALL sidebar sections + the Permissions tab." },
      { id: "a2", text: "In Permissions, restrict a normal admin to a subset (e.g. Orders + Dashboard) and Save." },
      { id: "a3", text: "Log in as that admin → sidebar shows only the granted sections.", expect: "Hidden sections absent" },
      { id: "a4", text: "That admin typing a non-granted URL directly (e.g. /admin/wallet) is blocked (403).", expect: "Backend 403, no data" },
      { id: "a5", text: "Normal admin cannot open Permissions (super-only)." },
      { id: "a6", text: "Super admins always show as full-access and can't be edited in the tab." },
    ],
  },
  {
    id: "topup",
    no: 5,
    title: "Top Up Wallet",
    scope: "Account → Top up (Stripe)",
    steps: [
      { id: "t1", text: "On top-up, only the Stripe gateway is shown (iPay88 hidden)." },
      { id: "t2", text: "Enter an amount → redirects to Stripe live checkout." },
      { id: "t3", text: "Complete payment with a real card (small amount for live test)." },
      { id: "t4", text: "Stripe webhook credits the wallet.", expect: "Balance increases by the amount" },
      { id: "t5", text: "Reload / invoice history shows the top-up record." },
      { id: "t6", text: "Re-triggering the same webhook does NOT double-credit (idempotent)." },
    ],
  },
  {
    id: "agent",
    no: 6,
    title: "Admin 代理下单 (Proxy Order)",
    scope: "Agent login → Admin → Agent Logins",
    steps: [
      { id: "g1", text: "Open agent login, enter a customer's account + the master password." },
      { id: "g2", text: "OTP is sent ONLY to john940827@gmail.com.", expect: "Authorising inbox receives OTP" },
      { id: "g3", text: "Enter OTP → logged in AS the customer (impersonation banner visible)." },
      { id: "g4", text: "Place an order on their behalf → order is flagged 代理下单.", expect: "Order status/label = 代理下单" },
      { id: "g5", text: "Admin → Agent Logins shows who logged into whom, when, and the IP." },
      { id: "g6", text: "Agent login into an ADMIN account is blocked." },
    ],
  },
  {
    id: "tiers",
    no: 7,
    title: "Silver / Gold / Diamond",
    scope: "Membership tiers",
    steps: [
      { id: "m1", text: "Single top-up of RM1,000 → user becomes Silver.", expect: "Tier = Silver" },
      { id: "m2", text: "Single top-up of RM5,000 → Gold.", expect: "Tier = Gold" },
      { id: "m3", text: "Single top-up of RM10,000 → Diamond.", expect: "Tier = Diamond" },
      { id: "m4", text: "Tier is set by LARGEST single top-up (no topping-up-the-difference across small ones)." },
      { id: "m5", text: "Spending down the balance does NOT downgrade the tier (permanent).", expect: "Tier unchanged after spend" },
      { id: "m6", text: "If balance can't cover a tier price and user accepts the normal-price fallback → downgraded to Normal." },
      { id: "m7", text: "Admin can manually tag a user's tier from the customer page." },
    ],
  },
];

type State = Record<string, "pass" | "fail">;
const STORAGE_KEY = "signfuture.launchtests";
const TOTAL = CASES.reduce((n, c) => n + c.steps.length, 0);

export default function LaunchTestsPage() {
  const [state, setState] = useState<State>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setState(JSON.parse(raw));
    } catch {
      /* ignore corrupt storage */
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (loaded) localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state, loaded]);

  function cycle(id: string) {
    setState((s) => {
      const next = { ...s };
      const cur = next[id];
      if (!cur) next[id] = "pass";
      else if (cur === "pass") next[id] = "fail";
      else delete next[id];
      return next;
    });
  }

  const { passed, failed } = useMemo(() => {
    let p = 0;
    let f = 0;
    for (const v of Object.values(state)) {
      if (v === "pass") p++;
      else if (v === "fail") f++;
    }
    return { passed: p, failed: f };
  }, [state]);

  const pct = Math.round((passed / TOTAL) * 100);
  const allGreen = passed === TOTAL && failed === 0;

  return (
    <>
      <div className="adm-page-head">
        <h1>First Launch Tests</h1>
        <p>Go / no-go checklist for launch. Click a row to cycle ⬜ pending → ✅ pass → ❌ fail. Saved in this browser.</p>
      </div>

      <div className="adm-wrap">
        <div className="lt-summary">
          <div className="lt-bar">
            <div
              className="lt-bar-fill"
              style={{ width: `${pct}%`, background: failed ? "#e5484d" : allGreen ? "#30a46c" : "#0b7285" }}
            />
          </div>
          <div className="lt-summary-nums">
            <span className="lt-ok">✅ {passed}</span>
            <span className="lt-bad">❌ {failed}</span>
            <span className="lt-muted">/ {TOTAL} checks</span>
            {allGreen && <span className="lt-golive">🚀 All green — clear to launch</span>}
            <button
              type="button"
              className="lt-reset"
              onClick={() => {
                if (confirm("Reset all launch-test results?")) setState({});
              }}
            >
              Reset
            </button>
          </div>
        </div>

        {CASES.map((c) => {
          const done = c.steps.filter((s) => state[s.id] === "pass").length;
          const anyFail = c.steps.some((s) => state[s.id] === "fail");
          return (
            <div key={c.id} className="adm-card lt-case">
              <div className="lt-case-head">
                <span className="lt-no">{c.no}</span>
                <div>
                  <h2>{c.title}</h2>
                  <span className="adm-card-sub">{c.scope}</span>
                </div>
                <span className={`lt-case-badge${anyFail ? " is-fail" : done === c.steps.length ? " is-pass" : ""}`}>
                  {done}/{c.steps.length}
                </span>
              </div>
              <ul className="lt-steps">
                {c.steps.map((s) => {
                  const v = state[s.id];
                  return (
                    <li
                      key={s.id}
                      className={`lt-step${v ? ` is-${v}` : ""}`}
                      onClick={() => cycle(s.id)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          cycle(s.id);
                        }
                      }}
                    >
                      <span className="lt-box">{v === "pass" ? "✅" : v === "fail" ? "❌" : "⬜"}</span>
                      <span className="lt-text">
                        {s.text}
                        {s.expect && <em className="lt-expect">Expected: {s.expect}</em>}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>

      <style jsx>{`
        .lt-summary {
          position: sticky;
          top: 0;
          z-index: 2;
          background: var(--card, #fff);
          border: 1px solid rgba(0, 0, 0, 0.08);
          border-radius: 12px;
          padding: 14px 16px;
          margin-bottom: 16px;
        }
        .lt-bar {
          height: 8px;
          border-radius: 99px;
          background: rgba(0, 0, 0, 0.08);
          overflow: hidden;
        }
        .lt-bar-fill {
          height: 100%;
          transition: width 0.2s ease;
        }
        .lt-summary-nums {
          display: flex;
          align-items: center;
          gap: 14px;
          margin-top: 10px;
          font-size: 14px;
          font-weight: 600;
        }
        .lt-ok {
          color: #30a46c;
        }
        .lt-bad {
          color: #e5484d;
        }
        .lt-muted {
          color: #888;
          font-weight: 500;
        }
        .lt-golive {
          color: #30a46c;
        }
        .lt-reset {
          margin-left: auto;
          border: 1px solid rgba(0, 0, 0, 0.15);
          background: transparent;
          border-radius: 8px;
          padding: 5px 12px;
          font-size: 13px;
          cursor: pointer;
          color: inherit;
        }
        .lt-case {
          margin-bottom: 14px;
        }
        .lt-case-head {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 10px;
        }
        .lt-case-head h2 {
          margin: 0;
          font-size: 17px;
        }
        .lt-no {
          flex: none;
          width: 30px;
          height: 30px;
          border-radius: 8px;
          background: #0b7285;
          color: #fff;
          display: grid;
          place-items: center;
          font-weight: 700;
        }
        .lt-case-badge {
          margin-left: auto;
          font-size: 13px;
          font-weight: 700;
          padding: 3px 10px;
          border-radius: 99px;
          background: rgba(0, 0, 0, 0.06);
          color: #555;
        }
        .lt-case-badge.is-pass {
          background: rgba(48, 164, 108, 0.15);
          color: #1f7a4d;
        }
        .lt-case-badge.is-fail {
          background: rgba(229, 72, 77, 0.15);
          color: #c0323a;
        }
        .lt-steps {
          list-style: none;
          margin: 0;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .lt-step {
          display: flex;
          gap: 10px;
          align-items: flex-start;
          padding: 9px 10px;
          border-radius: 8px;
          cursor: pointer;
          transition: background 0.12s;
        }
        .lt-step:hover {
          background: rgba(0, 0, 0, 0.035);
        }
        .lt-step.is-pass {
          background: rgba(48, 164, 108, 0.08);
        }
        .lt-step.is-fail {
          background: rgba(229, 72, 77, 0.08);
        }
        .lt-box {
          flex: none;
          font-size: 15px;
          line-height: 1.5;
        }
        .lt-text {
          font-size: 14px;
          line-height: 1.5;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .lt-expect {
          font-style: normal;
          font-size: 12.5px;
          color: #0b7285;
          font-weight: 600;
        }
        @media (prefers-color-scheme: dark) {
          .lt-summary {
            background: rgba(255, 255, 255, 0.04);
            border-color: rgba(255, 255, 255, 0.12);
          }
          .lt-muted {
            color: #aaa;
          }
          .lt-case-badge {
            background: rgba(255, 255, 255, 0.08);
            color: #bbb;
          }
          .lt-step:hover {
            background: rgba(255, 255, 255, 0.05);
          }
        }
      `}</style>
    </>
  );
}
