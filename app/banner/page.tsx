import ProductFrame from "@/components/ProductFrame";
import { productBySlug } from "@/lib/products";

const product = productBySlug("banner")!;

export const metadata = { title: `${product.name} — Sign Calculators` };

export default function BannerPage() {
  return <ProductFrame src={product.appSrc} title={product.name} />;
}
