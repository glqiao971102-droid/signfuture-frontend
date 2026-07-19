import ProductFrame from "@/components/ProductFrame";
import { productBySlug } from "@/lib/products";

const product = productBySlug("neon-line")!;

export const metadata = { title: `${product.name} — Sign Calculators` };

export default function NeonLinePage() {
  return <ProductFrame src={product.appSrc} title={product.name} />;
}
