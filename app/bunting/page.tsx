import BuntingProduct from "@/components/BuntingProduct";
import { productBySlug } from "@/lib/products";

const product = productBySlug("bunting")!;

export const metadata = { title: `${product.name} — Sign Calculators` };

export default function BuntingPage() {
  return <BuntingProduct />;
}
