// Static right-rail cards shown under the account panel on the home page:
// a "Like & Follow" social card and a "Contact Us" WhatsApp card.

export function LikeFollowCard() {
  return (
    <div className="rail-card social-card">
      <p className="rail-eyebrow">Like &amp; Follow</p>
      <strong className="rail-title">SIGN STUDIO</strong>
      <div className="social-icons">
        <a href="#" aria-label="Facebook" className="brand-ico fb">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
            <path d="M13.5 21v-7h2.4l.4-2.8h-2.8V9.4c0-.8.2-1.4 1.4-1.4h1.5V5.5c-.3 0-1.2-.1-2.2-.1-2.2 0-3.7 1.3-3.7 3.8v2H8.3V14h2.6v7h2.6z" />
          </svg>
        </a>
        <a href="#" aria-label="Instagram" className="brand-ico ig">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="18" height="18" rx="5" />
            <circle cx="12" cy="12" r="4" />
            <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
          </svg>
        </a>
        <a href="#" aria-label="TikTok" className="brand-ico tt">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
            <path d="M16.5 3c.3 2 1.5 3.4 3.5 3.7v2.5c-1.3 0-2.5-.4-3.5-1v5.6c0 3.2-2.4 5.2-5.2 5.2A5 5 0 1 1 12 13.9v2.7a2.3 2.3 0 1 0 1.7 2.2V3h2.8z" />
          </svg>
        </a>
      </div>
    </div>
  );
}

export function ContactCard() {
  return (
    <a href="#" className="rail-card contact-card" aria-label="Contact us on WhatsApp">
      <div className="contact-text">
        <strong className="rail-title">CONTACT US</strong>
        <span className="contact-sub">Chat with us on WhatsApp</span>
      </div>
      <span className="brand-ico wa lg">
        <svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor">
          <path d="M12 2a10 10 0 0 0-8.6 15l-1.3 4.8 4.9-1.3A10 10 0 1 0 12 2zm0 18.2c-1.5 0-3-.4-4.3-1.2l-.3-.2-2.9.8.8-2.8-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.6-6.1c-.3-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1-.2.3-.6.8-.8 1-.1.1-.3.2-.5 0-.3-.1-1-.4-2-1.2-.7-.6-1.2-1.4-1.4-1.7-.1-.3 0-.4.1-.5l.4-.4.2-.4v-.4c0-.1-.6-1.4-.8-1.9-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.4.1-.6.3-.2.2-.8.8-.8 1.9 0 1.1.8 2.2.9 2.4.1.2 1.6 2.4 3.8 3.3.5.2 1 .4 1.3.5.5.2 1 .1 1.4.1.4-.1 1.3-.5 1.5-1 .2-.5.2-1 .1-1.1l-.4-.2z" />
        </svg>
      </span>
    </a>
  );
}
