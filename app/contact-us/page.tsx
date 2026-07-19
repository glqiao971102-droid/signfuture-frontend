import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import FeedbackForm from "@/components/FeedbackForm";

export const metadata = { title: "Contact Us — Sign Studio" };

const ADDRESS =
  "No 9, Jalan Industri USJ 1/7, Taman Perindustrian USJ 1, 46700 Subang Jaya, Selangor";

const DEPARTMENTS = [
  {
    name: "Customer Service",
    desc: "Website issues, special requests, custom orders, cancellations, file checks.",
    display: "011 1338 7198",
    href: "http://api.whatsapp.com/send?phone=601113387198",
  },
  {
    name: "Sales & Marketing",
    desc: "Inquiries, membership signup, user guidance.",
    display: "011 1289 3520",
    href: "http://api.whatsapp.com/send?phone=601112893520",
  },
  {
    name: "Payment Issues",
    desc: "Offline payments, payment-related problems.",
    display: "011 5889 6458",
    href: "http://api.whatsapp.com/send?phone=601158896458",
  },
];

const WaIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
    <path d="M12 2a10 10 0 0 0-8.6 15l-1.3 4.8 4.9-1.3A10 10 0 1 0 12 2zm0 18.2c-1.5 0-3-.4-4.3-1.2l-.3-.2-2.9.8.8-2.8-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.6-6.1c-.3-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1-.2.3-.6.8-.8 1-.1.1-.3.2-.5 0-.3-.1-1-.4-2-1.2-.7-.6-1.2-1.4-1.4-1.7-.1-.3 0-.4.1-.5l.4-.4.2-.4v-.4c0-.1-.6-1.4-.8-1.9-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.4.1-.6.3-.2.2-.8.8-.8 1.9 0 1.1.8 2.2.9 2.4.1.2 1.6 2.4 3.8 3.3.5.2 1 .4 1.3.5.5.2 1 .1 1.4.1.4-.1 1.3-.5 1.5-1 .2-.5.2-1 .1-1.1l-.4-.2z" />
  </svg>
);

export default function ContactUsPage() {
  const mapSrc = `https://www.google.com/maps?q=${encodeURIComponent(ADDRESS)}&output=embed`;
  return (
    <>
      <Nav />
      <main className="home-main">
        <section className="category-header">
          <p className="eyebrow">Sign Studio</p>
          <div className="category-title">
            <span className="category-glyph lg">✆</span>
            <div>
              <h1>Contact Us</h1>
              <p>SIGN FUTURE INDUSTRY SDN. BHD.</p>
            </div>
          </div>
        </section>

        <section className="home-section">
          <div className="contact-grid">
            <div className="contact-map">
              <iframe
                src={mapSrc}
                title="Sign Future Industry location"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>

            <div className="contact-col">
              <div className="contact-card">
                <span className="contact-ico">⌖</span>
                <div>
                  <h3>Address</h3>
                  <p>{ADDRESS}</p>
                  <div className="contact-links">
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(ADDRESS)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="card-cta"
                    >
                      Google Maps →
                    </a>
                    <a
                      href={`https://waze.com/ul?q=${encodeURIComponent("Sign Future Industry")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="card-cta"
                    >
                      Waze →
                    </a>
                  </div>
                </div>
              </div>

              <div className="contact-card">
                <span className="contact-ico">✉</span>
                <div>
                  <h3>Email</h3>
                  <p>
                    <a href="mailto:info@signfuture.com.my">info@signfuture.com.my</a>
                  </p>
                </div>
              </div>

              <div className="contact-card">
                <span className="contact-ico">◷</span>
                <div>
                  <h3>Business Hours</h3>
                  <ul className="hours-list">
                    <li>
                      <span>Mon – Fri</span>
                      <strong>9:00am – 6:00pm</strong>
                    </li>
                    <li>
                      <span>Lunch Time</span>
                      <strong>1:00pm – 2:00pm</strong>
                    </li>
                    <li>
                      <span>Sat, Sun &amp; Public Holiday</span>
                      <strong className="off">OFF</strong>
                    </li>
                  </ul>
                </div>
              </div>

              <div className="contact-departments">
                {DEPARTMENTS.map((d) => (
                  <a
                    key={d.name}
                    href={d.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="dept-card"
                  >
                    <span className="dept-wa">
                      <WaIcon />
                    </span>
                    <div className="dept-body">
                      <strong>{d.name}</strong>
                      <span className="dept-desc">{d.desc}</span>
                      <span className="dept-num">{d.display}</span>
                    </div>
                  </a>
                ))}
              </div>

              <div className="contact-card contact-social-card">
                <div style={{ flex: 1 }}>
                  <h3>Follow us</h3>
                  <div className="contact-social">
                    <a href="#" className="brand-ico fb" aria-label="Facebook">
                      <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                        <path d="M13.5 21v-7h2.4l.4-2.8h-2.8V9.4c0-.8.2-1.4 1.4-1.4h1.5V5.5c-.3 0-1.2-.1-2.2-.1-2.2 0-3.7 1.3-3.7 3.8v2H8.3V14h2.6v7h2.6z" />
                      </svg>
                    </a>
                    <a href="https://www.instagram.com/signfutureindustry" target="_blank" rel="noopener noreferrer" className="brand-ico ig" aria-label="Instagram">
                      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="3" width="18" height="18" rx="5" />
                        <circle cx="12" cy="12" r="4" />
                        <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
                      </svg>
                    </a>
                    <a href="https://www.tiktok.com/@signfuture_" target="_blank" rel="noopener noreferrer" className="brand-ico tt" aria-label="TikTok">
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                        <path d="M16.5 3c.3 2 1.5 3.4 3.5 3.7v2.5c-1.3 0-2.5-.4-3.5-1v5.6c0 3.2-2.4 5.2-5.2 5.2A5 5 0 1 1 12 13.9v2.7a2.3 2.3 0 1 0 1.7 2.2V3h2.8z" />
                      </svg>
                    </a>
                    <a href="http://api.whatsapp.com/send?phone=601156758370" target="_blank" rel="noopener noreferrer" className="brand-ico wa" aria-label="WhatsApp">
                      <WaIcon />
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="feedback-section">
            <FeedbackForm />
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
