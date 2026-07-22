import LightboxPrintingMaterialProduct from "@/components/LightboxPrintingMaterialProduct";
import { productBySlug } from "@/lib/products";

const product = productBySlug("lightbox-printing-material")!;

export const metadata = { title: `${product.name} — Sign Calculators` };

export default function LightboxPrintingMaterialPage() {
  return <LightboxPrintingMaterialProduct />;
}
