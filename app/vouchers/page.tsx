"use client";

import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import VoucherCards from "@/components/VoucherCards";

export default function VouchersPage() {
  return (
    <>
      <Nav />
      <main className="vpage-main">
        <header className="vpage-head">
          <p className="eyebrow">Sign Future</p>
          <h1>My Vouchers</h1>
        </header>

        <VoucherCards />
      </main>
      <Footer />

      <style>{`
        .vpage-main { max-width: 1000px; margin: 0 auto; padding: 32px 20px 72px; }
        .vpage-head { margin-bottom: 22px; }
        .vpage-head h1 { margin: 4px 0 8px; }
      `}</style>
    </>
  );
}
