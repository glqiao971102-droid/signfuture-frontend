import Link from "next/link";
import AccountSubPage from "@/components/AccountSubPage";

export const metadata = { title: "Pending List — Sign Studio" };

type Pending = {
  ref: string;
  date: string;
  product: string;
  need: string;
  action: { label: string; href: string };
};

const PENDING: Pending[] = [
  {
    ref: "Q65821",
    date: "2026-06-18",
    product: "Loose Sheet 210x297mm · 500 pcs",
    need: "Quotation ready — confirm to place order",
    action: { label: "Review Quote", href: "/my-quotation" },
  },
  {
    ref: "INV-2026-0518",
    date: "2026-05-18",
    product: "PVC Banner 3m x 1.2m · 5 pcs",
    need: "Invoice unpaid — payment required",
    action: { label: "Pay Now", href: "/package" },
  },
  {
    ref: "ART-2026-0610",
    date: "2026-06-10",
    product: "3D LED Box Up — Frontlit",
    need: "Artwork approval needed before printing",
    action: { label: "Review Artwork", href: "/contact-us" },
  },
];

export default function Page() {
  return (
    <AccountSubPage
      title="Pending List"
      blurb="Items waiting for your action."
      glyph="▣"
    >
      <div className="rec-list">
        {PENDING.map((p) => (
          <article key={p.ref} className="rec-card">
            <div className="rec-main">
              <div className="rec-top">
                <strong className="rec-ref">{p.ref}</strong>
                <span className="rec-status rs-pending">Action Needed</span>
              </div>
              <span className="rec-date">{p.date}</span>
              <p className="rec-desc">{p.product}</p>
              <p className="rec-need">{p.need}</p>
            </div>
            <div className="rec-side">
              <Link href={p.action.href} className="hero-btn primary rec-btn">
                {p.action.label}
              </Link>
            </div>
          </article>
        ))}
      </div>
    </AccountSubPage>
  );
}
