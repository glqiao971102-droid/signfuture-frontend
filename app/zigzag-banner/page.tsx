import ZigzagBannerProduct from "@/components/ZigzagBannerProduct";
import { productBySlug } from "@/lib/products";

const product = productBySlug("zigzag-banner")!;

export const metadata = { title: `${product.name} — Sign Calculators` };

export default function ZigzagBannerPage() {
  return <ZigzagBannerProduct />;
}
