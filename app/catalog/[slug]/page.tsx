import Link from "next/link";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import { menuItemBySlug } from "@/lib/products";

export default async function CatalogPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const item = menuItemBySlug(slug);
  const title = item?.label ?? "Product";

  return (
    <>
      <Nav />
      <main className="home-main">
        <section className="home-hero" style={{ display: "block" }}>
          <p className="eyebrow">Sign Studio · Product</p>
          <h1>{title}</h1>
          <p>
            This product is coming soon. We&apos;re putting the finishing touches
            on the {title} estimator. In the meantime, try one of the calculators
            that&apos;s ready to go.
          </p>
          <div style={{ marginTop: 26, display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Link href="/banner" className="card-cta">
              Inkjet Printing →
            </Link>
            <Link href="/3d-box-up" className="card-cta">
              3D Led Box Up →
            </Link>
            <Link href="/neon-line" className="card-cta">
              Led Sign →
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
