import Link from "next/link";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import AccountPanel from "@/components/AccountPanel";
import AnnouncementCarousel from "@/components/AnnouncementCarousel";
import { LikeFollowCard, ContactCard } from "@/components/SocialBoxes";
import { PRODUCT_MENU, CATEGORY_GLYPH, nodeHref } from "@/lib/products";

const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

type CatMeta = { desc: string; badge?: string; badgeCls?: string; accent: string };

// Per-category showcase: short product blurb, optional badge, accent tint (RGB).
const CAT_META: Record<string, CatMeta> = {
  "Inkjet Printing": { desc: "Banner, Sticker, Wallpaper, Canvas & more", badge: "BEST SELLER", badgeCls: "badge-bs", accent: "53,216,255" },
  "3D Led Box Up": { desc: "3D Letter, Light Box, Backlit & more", badge: "HOT", badgeCls: "badge-hot", accent: "255,95,143" },
  "Led Sign": { desc: "Neon Sign, Light Box, Modern Wall Sign & more", accent: "139,92,246" },
  "Display System": { desc: "Roll Up Stand, X Banner, Counter & more", badge: "NEW", badgeCls: "badge-new", accent: "37,211,102" },
  "Fabric Display": { desc: "Lightbox, Exhibition, Backdrop & more", badge: "POPULAR", badgeCls: "badge-pop", accent: "176,139,255" },
  Mounting: { desc: "Standoff, Bracket, Double Side Tape & more", accent: "53,216,255" },
  "Acrylic Sheet": { desc: "Clear, Color, Frosted, Mirror & more", accent: "95,200,239" },
  Materials: { desc: "Mounting Board, LED Strip, Neon Rubber & more", accent: "255,200,87" },
};

export default function HomePage() {
  return (
    <>
      <Nav />
      <main className="home-main">
        {/* Row 1: hero box (left) + account/social rail (right) — equal height.
            Row 2: shop-by-category in the left column (same width as hero). */}
        <div className="hero-grid">
          <section className="home-hero">
            <AnnouncementCarousel />
          </section>

          <AccountPanel />

          <section className="home-section flush shop" id="categories">
            <div className="shop-cat-grid">
              {PRODUCT_MENU.map((cat) => {
                const meta = CAT_META[cat.label] ?? {
                  desc: "View our range of products",
                  accent: "53,216,255",
                };
                const glyph = CATEGORY_GLYPH[cat.label] ?? "◆";
                const count = cat.children ? cat.children.length : 1;
                return (
                  <Link
                    key={cat.label}
                    href={nodeHref(cat)}
                    className="shop-cat-card"
                  >
                    <div
                      className="shop-cat-media"
                      style={{
                        backgroundImage: `url(/category/${slugify(cat.label)}.jpg)`,
                      }}
                    />
                    <div className="shop-cat-body">
                      <div className="shop-cat-titlerow">
                        <span className="shop-cat-ico">{glyph}</span>
                        <h3>{cat.label}</h3>
                      </div>
                      <p className="shop-cat-desc">{meta.desc}</p>
                      <div className="shop-cat-foot">
                        <span className="shop-cat-count">{count} Products</span>
                        <span className="shop-cat-arrow">→</span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>

          <div className="rail-bottom">
            <LikeFollowCard />
            <ContactCard />
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
