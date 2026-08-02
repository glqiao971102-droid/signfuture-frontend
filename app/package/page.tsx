"use client";

import { useEffect, useState } from "react";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import CustomTopUp from "@/components/CustomTopUp";
import { useAuth } from "@/components/AuthProvider";
import { api } from "@/lib/api";

type Tier = { key: string; threshold: number; discount: number };

const GLYPH: Record<string, string> = { Silver: "◆", Gold: "◆◆", Diamond: "◆◆◆" };
const CLS: Record<string, string> = { Silver: "tier-silver", Gold: "tier-gold", Diamond: "tier-diamond" };
const rm = (n: number) => `RM ${n.toLocaleString("en-MY")}`;

export default function PackagePage() {
  const { user } = useAuth();
  const [tiers, setTiers] = useState<Tier[]>([]);

  useEffect(() => {
    api.membershipConfig().then((r) => setTiers(r.tiers)).catch(() => {});
  }, []);

  // Tiers come high→low from the API; show low→high for the cards.
  const ordered = [...tiers].sort((a, b) => a.threshold - b.threshold);
  const currentTier = user?.tier ?? null;
  const largest = user?.largestTopup ?? 0;

  return (
    <>
      <Nav />
      <main className="home-main">
        <section className="category-header">
          <p className="eyebrow">Sign Future</p>
          <div className="category-title">
            <span className="category-glyph lg">✦</span>
            <div>
              <h1>Membership Top-Up</h1>
              <p>Top up in a single payment to unlock a tier and enjoy member pricing on every product.</p>
            </div>
          </div>
        </section>

        {user && (
          <section className="home-section">
            <div className="tier-status">
              <div>
                <span className="tier-status-label">Your tier</span>
                <strong className={`tier-status-tier ${currentTier ? CLS[currentTier] : ""}`}>
                  {currentTier ?? "Normal"}{user.tierDiscount > 0 ? ` · ${user.tierDiscount}% off` : ""}
                </strong>
              </div>
              <div><span className="tier-status-label">Largest single top-up</span><strong>{rm(largest)}</strong></div>
              <div><span className="tier-status-label">Wallet balance</span><strong>{rm(user.wallet.balance)}</strong></div>
            </div>
            <p className="tier-status-note">
              Your tier needs both: a single top-up ≥ the tier amount, and a wallet balance ≥ the tier amount.
              Spending below a tier’s amount drops you to the next one.
            </p>
          </section>
        )}

        <section className="home-section">
          <div className="tier-grid">
            {ordered.map((t) => {
              const isCurrent = currentTier === t.key;
              const unlocked = largest >= t.threshold;
              return (
                <div key={t.key} className={`tier-card ${CLS[t.key]}${t.key === "Gold" ? " featured" : ""}${isCurrent ? " is-current" : ""}`}>
                  {isCurrent ? <span className="tier-badge">Your tier</span> : t.key === "Gold" && <span className="tier-badge">Most Popular</span>}
                  <span className="tier-glyph">{GLYPH[t.key]}</span>
                  <h2 className="tier-name">{t.key}</h2>
                  <div className="tier-topup">
                    <span>Single top-up</span>
                    <strong>{rm(t.threshold)}</strong>
                  </div>
                  <div className="tier-save">
                    Member price <b>{t.discount}% off</b>
                  </div>
                  <ul className="tier-perks">
                    <li>{t.discount}% off all products</li>
                    <li>Wallet credit for online orders</li>
                    <li>{unlocked ? "✓ Unlocked" : `Top up ${rm(t.threshold)} to unlock`}</li>
                  </ul>
                  <a href={`/package?amount=${t.threshold}#topup`} className="hero-btn primary tier-btn">
                    Top up {rm(t.threshold)}
                  </a>
                </div>
              );
            })}
          </div>

          <div id="topup"><CustomTopUp /></div>

          <div className="tier-note">
            <h3>How it works</h3>
            <p>
              A single top-up unlocks the matching tier (e.g. RM 10,000 in one payment → Diamond). Topping up
              in smaller amounts does not add up to a higher tier. Your tier is kept while your wallet balance
              stays at or above the tier amount; the wallet is non-refundable and for online purchases only.
            </p>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
