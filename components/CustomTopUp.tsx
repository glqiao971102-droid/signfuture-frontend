"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/components/AuthProvider";
import { api, ApiError, submitToGateway, type PaymentProvider, type MemberTier } from "@/lib/api";
import { tierIndex } from "@/lib/tier";

// Highest qualifying tier first. `min` matches the backend thresholds; a top-up
// below Silver drops the member to Agent (no tier / base price).
const TIERS = [
  { name: "Diamond", min: 10000, save: "80%" },
  { name: "Gold", min: 5000, save: "60%" },
  { name: "Silver", min: 2000, save: "50%" },
];

/** iPay88's own minimum test transaction is MYR 1.00. */
const MIN_TOPUP = 1;

// Only Stripe is offered for now. (iPay88 is temporarily hidden.)
const METHODS: { id: PaymentProvider; label: string; hint: string }[] = [
  { id: "stripe", label: "Credit / Debit Card", hint: "Visa, Mastercard, Amex" },
];

export default function CustomTopUp() {
  const { user, openLogin } = useAuth();
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentProvider>("stripe");

  // Prefill from ?amount= (e.g. a tier card's "Top up RM 10,000" button).
  useEffect(() => {
    const a = new URLSearchParams(window.location.search).get("amount");
    if (a && Number(a) > 0) setAmount(String(Number(a)));
  }, []);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const num = parseFloat(amount) || 0;
  const tier = TIERS.find((t) => num >= t.min) || null;

  async function proceed() {
    if (busy) return;
    setError(null);

    if (!user) {
      openLogin();
      return;
    }
    if (num < MIN_TOPUP) {
      setError(`Please enter at least RM ${MIN_TOPUP.toFixed(2)}.`);
      return;
    }

    // Your tier follows this top-up: warn before a top-up that would LOWER it
    // (e.g. a Diamond topping up below RM10,000). A locked tier is protected,
    // so no warning while a lock is active.
    const newName = (TIERS.find((t) => num >= t.min)?.name ?? null) as MemberTier | null;
    if (!user.tierLock && tierIndex(newName) < tierIndex(user.tier)) {
      const to = newName ?? "Agent (no tier — base price)";
      const ok = window.confirm(
        `Heads up: your membership is currently ${user.tier}.\n\n` +
          `Topping up RM ${num.toLocaleString("en-MY")} will lower it to ${to}, ` +
          `because your tier follows your latest top-up.\n\nContinue with this top-up?`,
      );
      if (!ok) return;
    }

    setBusy(true);
    try {
      // Hands off to the gateway's hosted page; the browser leaves this site here.
      submitToGateway(await api.startTopup(num, method));
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Could not start the payment. Please try again.",
      );
      setBusy(false);
    }
  }

  return (
    <div className="topup-box">
      <div className="topup-head">
        <span className="contact-ico">＋</span>
        <div>
          <h3>Top up a custom amount</h3>
          <p>Don&apos;t want a fixed package? Enter any amount you like.</p>
        </div>
      </div>

      <div className="topup-input-row">
        <span className="topup-currency">RM</span>
        <input
          type="number"
          min={MIN_TOPUP}
          step={50}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="e.g. 1500"
          aria-label="Top-up amount"
        />
      </div>

      <div className={`topup-result${tier ? " has-tier" : ""}`}>
        {num <= 0 ? (
          <>Enter an amount to see the tier you&apos;ll enjoy.</>
        ) : tier ? (
          <>
            With <strong>RM {num.toLocaleString("en-MY")}</strong> you&apos;ll enjoy{" "}
            <strong className={`tier-tag tier-${tier.name.toLowerCase()}-tag`}>{tier.name}</strong>{" "}
            — save up to <strong>{tier.save}++</strong>
          </>
        ) : (
          <>
            <strong>RM {num.toLocaleString("en-MY")}</strong> — top up RM 2,000 or more
            to unlock <strong>Silver</strong> tier benefits.
          </>
        )}
      </div>

      <fieldset className="pay-methods">
        <legend>Payment method</legend>
        {METHODS.map((m) => (
          <label key={m.id} className={`pay-method${method === m.id ? " is-active" : ""}`}>
            <input
              type="radio"
              name="topup-method"
              value={m.id}
              checked={method === m.id}
              onChange={() => setMethod(m.id)}
            />
            <span className="pay-method-body">
              <strong>{m.label}</strong>
              <em>{m.hint}</em>
            </span>
          </label>
        ))}
      </fieldset>

      {error && (
        <p className="login-error" role="alert">
          {error}
        </p>
      )}

      <button
        type="button"
        className="hero-btn primary topup-btn"
        onClick={proceed}
        disabled={busy}
      >
        {busy ? "Redirecting to payment…" : user ? "Proceed to top up" : "Sign in to top up"}
      </button>
    </div>
  );
}
