import Link from "next/link";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import CustomTopUp from "@/components/CustomTopUp";

export const metadata = { title: "Package — Sign Studio" };

const TIERS = [
  {
    name: "Silver",
    glyph: "◆",
    topup: "RM 1,000",
    save: "50%",
    cls: "tier-silver",
    perks: ["Lower unit prices", "Free vouchers", "Wallet credit for online orders"],
  },
  {
    name: "Gold",
    glyph: "◆◆",
    topup: "RM 5,000",
    save: "60%",
    cls: "tier-gold",
    featured: true,
    perks: ["Bigger savings on every order", "Free vouchers", "Priority quotation"],
  },
  {
    name: "Diamond",
    glyph: "◆◆◆",
    topup: "RM 10,000",
    save: "80%",
    cls: "tier-diamond",
    perks: ["Maximum savings", "Free vouchers", "Best value for bulk orders"],
  },
];

export default function PackagePage() {
  return (
    <>
      <Nav />
      <main className="home-main">
        <section className="category-header">
          <p className="eyebrow">Sign Studio</p>
          <div className="category-title">
            <span className="category-glyph lg">✦</span>
            <div>
              <h1>Top Up Promotion</h1>
              <p>Top up now to enjoy a lower price and free vouchers.</p>
            </div>
          </div>
        </section>

        <section className="home-section">
          <div className="tier-grid">
            {TIERS.map((t) => (
              <div key={t.name} className={`tier-card ${t.cls}${t.featured ? " featured" : ""}`}>
                {t.featured && <span className="tier-badge">Most Popular</span>}
                <span className="tier-glyph">{t.glyph}</span>
                <h2 className="tier-name">{t.name}</h2>
                <div className="tier-topup">
                  <span>Top up</span>
                  <strong>{t.topup}</strong>
                </div>
                <div className="tier-save">
                  Save up to <b>{t.save}</b>
                  <span className="plus">++</span>
                </div>
                <ul className="tier-perks">
                  {t.perks.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
                <Link href="/contact-us" className="hero-btn primary tier-btn">
                  Top Up Now
                </Link>
              </div>
            ))}
          </div>

          <CustomTopUp />

          <div className="tier-note">
            <h3>Wallet terms</h3>
            <p>
              In cases of accidental or excess payment, the excess amount will be
              credited to your account wallet on our website. Wallet credit is
              non-refundable and cannot be transferred to other users; it can only
              be used for online purchases.
            </p>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
