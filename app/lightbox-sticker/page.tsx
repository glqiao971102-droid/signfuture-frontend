import LightboxStickerProduct from "@/components/LightboxStickerProduct";
import { productBySlug } from "@/lib/products";

const product = productBySlug("lightbox-sticker")!;

export const metadata = { title: `${product.name} — Sign Calculators` };

export default function Page() {
  return <LightboxStickerProduct />;
}