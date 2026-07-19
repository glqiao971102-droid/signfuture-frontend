import SitePage from "@/components/SitePage";

const TITLES: Record<string, string> = {
  "terms-conditions": "Term & Condition",
  "privacy-policy": "Privacy Policy",
  "shipping-delivery": "Shipping & Delivery",
  "return-refund-policy": "Return & Refund Policy",
};

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return { title: `${TITLES[slug] ?? "Policy"} — Sign Studio` };
}

export default async function PolicyPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const title = TITLES[slug] ?? "Policy";
  return <SitePage title={title} blurb={`Our ${title} details are coming soon.`} />;
}
