import ProductFrame from "@/components/ProductFrame";
import { productBySlug } from "@/lib/products";

const product = productBySlug("window-clear-sticker")!;

/**
 * Window Clear Sticker product page body.
 *
 * Started as a copy of the Inkjet Banner calculator, but the two are fully
 * independent: the embedded app lives at
 * `public/apps/window-clear-sticker/index.html` with its own `assets/` folder, so
 * changing this product's inputs, pricing or images never affects Banner.
 *
 * This component is the seam for anything Window Clear Sticker-specific that should
 * live in React rather than in the embedded HTML app.
 */
export default function WindowClearStickerProduct() {
  return <ProductFrame src={product.appSrc} title={product.name} />;
}