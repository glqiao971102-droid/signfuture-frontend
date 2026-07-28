import StickerProduct from "@/components/StickerProduct";
import { productBySlug } from "@/lib/products";

const product = productBySlug("sticker")!;

export const metadata = { title: `${product.name} — Sign Calculators` };

export default function Page() {
  return <StickerProduct />;
}