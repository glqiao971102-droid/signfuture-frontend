import Link from "next/link";
import { notFound } from "next/navigation";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import ProductCard from "@/components/ProductCard";
import { findCategoryBySlug, CATEGORY_GLYPH } from "@/lib/products";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const cat = findCategoryBySlug(slug);
  return { title: `${cat?.label ?? "Products"} — Sign Studio` };
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const cat = findCategoryBySlug(slug);
  if (!cat || !cat.children) notFound();

  return (
    <>
      <Nav />
      <main className="home-main">
        <section className="category-header">
          <Link href="/#categories" className="back-link">
            ← All categories
          </Link>
          <div className="category-title">
            <span className="category-glyph lg">{CATEGORY_GLYPH[cat.label] ?? "◆"}</span>
            <div>
              <h1>{cat.label}</h1>
              <p>{cat.children.length} products available</p>
            </div>
          </div>
        </section>

        <section className="home-section">
          <div className="product-tiles">
            {cat.children.map((node) => (
              <ProductCard key={node.label + (node.href ?? "")} node={node} />
            ))}
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
