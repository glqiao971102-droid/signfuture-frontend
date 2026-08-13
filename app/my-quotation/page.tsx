import Nav from "@/components/Nav";
import Footer from "@/components/Footer";

export const metadata = { title: "My Quotation — Sign Studio" };

export default function MyQuotationPage() {
  return (
    <>
      <Nav />
      <main className="home-main">
        <section className="category-header">
          <p className="eyebrow">My Account</p>
          <div className="category-title">
            <span className="category-glyph lg">❝</span>
            <div>
              <h1>My Quotation</h1>
              <p>
                Filter by product, quote ref., date or status. Review the price
                and place your order.
              </p>
            </div>
          </div>
        </section>

        <section className="home-section" style={{ marginTop: 18 }}>
          <p className="quote-empty">
            No quotations yet. Your saved quotes will appear here.
          </p>
        </section>
      </main>
      <Footer />
    </>
  );
}
