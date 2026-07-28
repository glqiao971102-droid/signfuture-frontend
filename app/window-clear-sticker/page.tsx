import WindowClearStickerProduct from "@/components/WindowClearStickerProduct";
import { productBySlug } from "@/lib/products";

const product = productBySlug("window-clear-sticker")!;

export const metadata = { title: `${product.name} — Sign Calculators` };

export default function Page() {
  return <WindowClearStickerProduct />;
}