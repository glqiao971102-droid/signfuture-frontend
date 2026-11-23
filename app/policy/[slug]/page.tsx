import Link from "next/link";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import { COMPANY } from "@/lib/company";

type Section = { h: string; p: string[] };
type Policy = { title: string; intro: string; sections: Section[] };

const POLICIES: Record<string, Policy> = {
  "terms-conditions": {
    title: "Terms & Conditions",
    intro: `These terms govern your use of signfuturegroup.com and any order placed with ${COMPANY.name}. By using this website or placing an order, you agree to these terms.`,
    sections: [
      {
        h: "Orders & Pricing",
        p: [
          "All prices are shown in Malaysian Ringgit (MYR) and may change without prior notice.",
          "An order is confirmed only once payment (or wallet credit) has been received.",
        ],
      },
      {
        h: "Payment",
        p: [
          "We accept online banking / e-wallet and card payments through iPay88, as well as manual bank transfer.",
          "Wallet top-ups are stored as credit for your orders and are non-transferable and non-refundable for cash.",
        ],
      },
      {
        h: "Artwork & Content",
        p: [
          "You are responsible for the accuracy of the artwork, text and specifications you submit.",
          "We may decline any order containing unlawful, infringing or offensive content.",
        ],
      },
      {
        h: "Liability",
        p: [
          "Our services are provided on a reasonable-effort basis. To the extent permitted by law, our total liability for any order is limited to the amount paid for that order.",
        ],
      },
      {
        h: "Governing Law",
        p: ["These terms are governed by the laws of Malaysia."],
      },
    ],
  },

  "privacy-policy": {
    title: "Privacy Policy",
    intro: `${COMPANY.name} respects your privacy. This policy explains what information we collect and how we use it.`,
    sections: [
      {
        h: "Information We Collect",
        p: [
          "Your name, contact number, email address, delivery address, and order and payment details.",
        ],
      },
      {
        h: "How We Use It",
        p: [
          "To process and deliver your orders, manage your account, and provide customer support.",
        ],
      },
      {
        h: "Sharing",
        p: [
          "We share information only as needed to fulfil your order — for example with our payment gateway (iPay88) and delivery partners. We do not sell your personal data.",
        ],
      },
      {
        h: "Security & Your Rights",
        p: [
          "We take reasonable measures to protect your information.",
          "You may contact us at any time to access, update or delete your personal data.",
        ],
      },
    ],
  },

  "shipping-delivery": {
    title: "Shipping & Delivery",
    intro: "How and when your order reaches you.",
    sections: [
      {
        h: "Coverage",
        p: ["We deliver within Malaysia. Any delivery charge is shown before you confirm your order."],
      },
      {
        h: "Processing Time",
        p: [
          "Production and delivery times vary by product and quantity. An estimate is provided at the time of order.",
        ],
      },
      {
        h: "Tracking",
        p: ["Order updates are available in your account and via WhatsApp."],
      },
      {
        h: "On Receipt",
        p: [
          "Please check your goods on delivery and report any issue to our Customer Service as soon as possible.",
        ],
      },
    ],
  },

  "return-refund-policy": {
    title: "Return & Refund Policy",
    intro: "Returns and refunds for orders placed with us.",
    sections: [
      {
        h: "Custom-Made Items",
        p: [
          "As most signage is custom-made to your specifications, items are generally non-returnable once production has started.",
        ],
      },
      {
        h: "Defective or Wrong Items",
        p: [
          "If you receive a defective or incorrect item, please contact our Customer Service with photos within 3 days of delivery.",
          "Where a claim is valid, we will repair, replace or refund the affected item.",
        ],
      },
      {
        h: "Refunds",
        p: [
          "Approved refunds are made to your original payment method or as wallet credit, and are processed within a reasonable period.",
        ],
      },
      {
        h: "How to Request",
        p: ["Contact our Customer Service to start a return or refund request."],
      },
    ],
  },
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const policy = POLICIES[slug];
  return { title: `${policy?.title ?? "Policy"} — Sign Future` };
}

export default async function PolicyPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const policy = POLICIES[slug];

  if (!policy) {
    return (
      <>
        <Nav />
        <main className="home-main">
          <section className="home-hero" style={{ display: "block" }}>
            <h1>Policy</h1>
            <p>This page is not available.</p>
            <div style={{ marginTop: 26 }}>
              <Link href="/" className="card-cta">← Back to home</Link>
            </div>
          </section>
        </main>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Nav />
      <main className="home-main">
        <section className="category-header">
          <p className="eyebrow">Sign Studio</p>
          <div className="category-title">
            <span className="category-glyph lg">§</span>
            <div>
              <h1>{policy.title}</h1>
              <p>{policy.intro}</p>
            </div>
          </div>
        </section>

        <section className="home-section">
          <div className="legal-doc">
            {policy.sections.map((s) => (
              <div key={s.h} className="legal-block">
                <h3>{s.h}</h3>
                {s.p.map((para, i) => (
                  <p key={i}>{para}</p>
                ))}
              </div>
            ))}

            <div className="legal-block legal-entity">
              <h3>Company Details</h3>
              <p><strong>{COMPANY.name}</strong></p>
              <p>Company Registration No. (SSM): {COMPANY.ssm}</p>
              <p>{COMPANY.address}</p>
              <p>
                Email: <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>
                {" · "}Tel: {COMPANY.phone}
              </p>
              <p style={{ marginTop: 14 }}>
                <Link href="/contact-us" className="card-cta">Contact Us →</Link>
              </p>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
