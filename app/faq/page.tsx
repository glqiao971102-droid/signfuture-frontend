import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import { FAQS } from "@/lib/faq";

export const metadata = { title: "FAQ — Sign Studio" };

export default function FaqPage() {
  return (
    <>
      <Nav />
      <main className="home-main">
        <section className="category-header">
          <p className="eyebrow">Sign Studio</p>
          <div className="category-title">
            <span className="category-glyph lg">?</span>
            <div>
              <h1>Frequently Asked Questions</h1>
              <p>Everything you need to know about ordering, payment, artwork and delivery.</p>
            </div>
          </div>
        </section>

        <section className="home-section">
          <div className="faq-card">
            {FAQS.map((item, i) => (
              <div key={i} className="faq-row">
                <div className="faq-q-line">
                  <span className="faq-num">{String(i + 1).padStart(2, "0")}</span>
                  <h3 className="faq-q-text">{item.q}</h3>
                </div>
                <p className="faq-a">{item.a}</p>
              </div>
            ))}
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
