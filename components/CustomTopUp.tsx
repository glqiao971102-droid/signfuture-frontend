"use client";

import { useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { api, ApiError, submitToGateway, type PaymentProvider } from "@/lib/api";

// Highest qualifying tier first.
const TIERS = [
  { name: "Diamond", min: 10000, save: "80%" },
  { name: "Gold", min: 5000, save: "60%" },
  { name: "Silver", min: 1000, save: "50%" },
];

/** iPay88's own minimum test transaction is MYR 1.00. */
const MIN_TOPUP = 1;

const METHODS: { id: PaymentProvider; label: string; hint: string }[] = [
  { id: "ipay88", label: "Online Banking (FPX)", hint: "Pay from your bank account" },
  { id: "stripe", label: "Credit / Debit Card", hint: "Visa, Mastercard, Amex" },
];

export default function CustomTopUp() {
  const { user, openLogin } = useAuth();
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentProvider>("ipay88");
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
            <strong>RM {num.toLocaleString("en-MY")}</strong> — top up RM 1,000 or more
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
