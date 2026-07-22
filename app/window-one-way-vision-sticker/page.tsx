import WindowOneWayVisionStickerProduct from "@/components/WindowOneWayVisionStickerProduct";
import { productBySlug } from "@/lib/products";

const product = productBySlug("window-one-way-vision-sticker")!;

export const metadata = { title: `${product.name} — Sign Calculators` };

export default function Page() {
  return <WindowOneWayVisionStickerProduct />;
}