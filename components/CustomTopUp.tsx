"use client";

import Link from "next/link";
import { useState } from "react";

// Highest qualifying tier first.
const TIERS = [
  { name: "Diamond", min: 10000, save: "80%" },
  { name: "Gold", min: 5000, save: "60%" },
  { name: "Silver", min: 1000, save: "50%" },
];

export default function CustomTopUp() {
  const [amount, setAmount] = useState("");
  const num = parseFloat(amount) || 0;
  const tier = TIERS.find((t) => num >= t.min) || null;

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
          min={0}
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

      <Link href="/contact-us" className="hero-btn primary topup-btn">
        Proceed to top up
      </Link>
    </div>
  );
}
