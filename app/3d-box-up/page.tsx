import ProductFrame from "@/components/ProductFrame";
import { productBySlug } from "@/lib/products";

const product = productBySlug("3d-box-up")!;

export const metadata = { title: `${product.name} — Sign Calculators` };

export default function BoxUpPage() {
  return <ProductFrame src={product.appSrc} title={product.name} />;
}
