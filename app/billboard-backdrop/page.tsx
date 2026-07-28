import BillboardBackdropProduct from "@/components/BillboardBackdropProduct";
import { productBySlug } from "@/lib/products";

const product = productBySlug("billboard-backdrop")!;

export const metadata = { title: `${product.name} — Sign Calculators` };

export default function BillboardBackdropPage() {
  return <BillboardBackdropProduct />;
}
