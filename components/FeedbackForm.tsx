"use client";

import { useState } from "react";

export default function FeedbackForm() {
  const [sent, setSent] = useState(false);

  if (sent) {
    return (
      <div className="feedback-card feedback-done">
        <span className="feedback-check">✓</span>
        <div>
          <h3>Thank you for your feedback!</h3>
          <p>We&apos;ve received your message and will get back to you if needed.</p>
        </div>
      </div>
    );
  }

  return (
    <form
      className="feedback-card"
      onSubmit={(e) => {
        e.preventDefault();
        setSent(true);
      }}
    >
      <div className="feedback-head">
        <span className="feedback-ico">✎</span>
        <div>
          <h3>Feedback &amp; Suggestions</h3>
          <p>Have a question, idea, or comment? Drop us a message.</p>
        </div>
      </div>

      <div className="feedback-grid">
        <label>
          Name
          <input type="text" name="name" placeholder="Your name" required />
        </label>
        <label>
          Email
          <input type="email" name="email" placeholder="you@example.com" required />
        </label>
        <label>
          Phone <span className="optional">(optional)</span>
          <input type="tel" name="phone" placeholder="011 0000 0000" />
        </label>
        <label>
          Subject
          <input type="text" name="subject" placeholder="What is it about?" />
        </label>
      </div>

      <label className="feedback-message">
        Message
        <textarea name="message" rows={5} placeholder="Write your feedback here..." required />
      </label>

      <button type="submit" className="hero-btn primary feedback-submit">
        Send feedback
      </button>
    </form>
  );
}
