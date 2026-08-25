import { Suspense } from "react";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import AccountDashboard from "@/components/AccountDashboard";

export const metadata = { title: "My Account — Sign Studio" };

export default function Page() {
  return (
    <>
      <Nav />
      <main className="home-main">
        <section className="category-header">
          <p className="eyebrow">My Account</p>
          <div className="category-title">
            <span className="category-glyph lg">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/mascot-silver.webp" alt="" className="category-glyph-img" />
            </span>
            <div>
              <h1>My Account</h1>
              <p>Your orders, quotations, wallet and membership at a glance.</p>
            </div>
          </div>
        </section>

        <section className="home-section" style={{ marginTop: 18 }}>
          <Suspense fallback={null}>
            <AccountDashboard />
          </Suspense>
        </section>
      </main>
      <Footer />
    </>
  );
}
