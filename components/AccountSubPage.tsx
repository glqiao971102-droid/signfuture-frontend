import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import Link from "next/link";

export default function AccountSubPage({
  title,
  blurb,
  glyph = "☺",
  children,
}: {
  title: string;
  blurb: string;
  glyph?: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <Nav />
      <main className="home-main">
        <section className="category-header">
          <Link href="/account" className="back-link">
            ← Back to My Account
          </Link>
          <div className="category-title">
            <span className="category-glyph lg">{glyph}</span>
            <div>
              <h1>{title}</h1>
              <p>{blurb}</p>
            </div>
          </div>
        </section>

        <section className="home-section" style={{ marginTop: 18 }}>
          {children}
        </section>
      </main>
      <Footer />
    </>
  );
}
