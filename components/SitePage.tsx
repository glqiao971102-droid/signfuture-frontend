import Link from "next/link";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";

export default function SitePage({
  title,
  blurb,
}: {
  title: string;
  blurb?: string;
}) {
  return (
    <>
      <Nav />
      <main className="home-main">
        <section className="home-hero" style={{ display: "block" }}>
          <p className="eyebrow">Sign Studio</p>
          <h1>{title}</h1>
          <p>{blurb ?? `The ${title} page is coming soon.`}</p>
          <div style={{ marginTop: 26 }}>
            <Link href="/" className="card-cta">
              ← Back to home
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
