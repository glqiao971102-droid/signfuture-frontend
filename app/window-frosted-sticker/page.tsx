import WindowFrostedStickerProduct from "@/components/WindowFrostedStickerProduct";
import { productBySlug } from "@/lib/products";

const product = productBySlug("window-frosted-sticker")!;

export const metadata = { title: `${product.name} — Sign Calculators` };

export default function Page() {
  return <WindowFrostedStickerProduct />;
}