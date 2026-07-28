import DiecutStickerProduct from "@/components/DiecutStickerProduct";
import { productBySlug } from "@/lib/products";

const product = productBySlug("diecut-sticker")!;

export const metadata = { title: `${product.name} — Sign Calculators` };

export default function Page() {
  return <DiecutStickerProduct />;
}