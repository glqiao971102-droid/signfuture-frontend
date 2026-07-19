import Link from "next/link";
import { PRODUCT_MENU, nodeHref } from "@/lib/products";

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <div className="footer-brand">
          <Link href="/" className="footer-logo-link" aria-label="Sign Future home">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="Sign Future" className="footer-logo" />
          </Link>
          <p>
            Signage &amp; printing made simple — measure, configure, and price
            banners, neon line, and 3D LED box-up letters in one place.
          </p>
          <p className="footer-note">Free delivery within Peninsular Malaysia.</p>
        </div>

        <div className="footer-col">
          <h4>Products</h4>
          <ul>
            {PRODUCT_MENU.slice(0, 6).map((p) => (
              <li key={p.label}>
                <Link href={nodeHref(p)}>{p.label}</Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="footer-col">
          <h4>Company</h4>
          <ul>
            <li><Link href="/user-guide">User Guide</Link></li>
            <li><Link href="/faq">FAQ</Link></li>
            <li><Link href="/contact-us">Contact Us</Link></li>
            <li><Link href="/company-profile">Company Profile</Link></li>
          </ul>
        </div>

        <div className="footer-col">
          <h4>Policies</h4>
          <ul>
            <li><Link href="/policy/terms-conditions">Term &amp; Condition</Link></li>
            <li><Link href="/policy/privacy-policy">Privacy Policy</Link></li>
            <li><Link href="/policy/shipping-delivery">Shipping &amp; Delivery</Link></li>
            <li><Link href="/policy/return-refund-policy">Return &amp; Refund Policy</Link></li>
          </ul>
        </div>
      </div>

      <div className="footer-bottom">
        <span>© {new Date().getFullYear()} Sign Future. All rights reserved.</span>
        <div className="footer-social">
          <a href="#" aria-label="Facebook">f</a>
          <a href="#" aria-label="Instagram">◎</a>
          <a href="#" aria-label="TikTok">♪</a>
          <a href="#" aria-label="WhatsApp">✆</a>
        </div>
      </div>
    </footer>
  );
}
