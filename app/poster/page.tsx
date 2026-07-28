import PosterProduct from "@/components/PosterProduct";
import { productBySlug } from "@/lib/products";

const product = productBySlug("poster")!;

export const metadata = { title: `${product.name} — Sign Calculators` };

export default function PosterPage() {
  return <PosterProduct />;
}
