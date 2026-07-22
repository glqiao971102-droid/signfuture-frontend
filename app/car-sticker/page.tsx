import CarStickerProduct from "@/components/CarStickerProduct";
import { productBySlug } from "@/lib/products";

const product = productBySlug("car-sticker")!;

export const metadata = { title: `${product.name} — Sign Calculators` };

export default function Page() {
  return <CarStickerProduct />;
}