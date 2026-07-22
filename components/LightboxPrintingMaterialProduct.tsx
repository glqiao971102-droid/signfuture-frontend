import ProductFrame from "@/components/ProductFrame";
import { productBySlug } from "@/lib/products";

const product = productBySlug("lightbox-printing-material")!;

/**
 * Lightbox Printing Material product page body.
 *
 * Started as a copy of the Inkjet Banner calculator, but the two are fully
 * independent: the embedded app lives at
 * `public/apps/lightbox-printing-material/index.html` with its own `assets/`
 * folder, so changing this product's inputs, pricing or images never affects
 * Banner.
 *
 * This component is the seam for anything Lightbox-specific that should live
 * in React rather than in the embedded HTML app.
 */
export default function LightboxPrintingMaterialProduct() {
  return <ProductFrame src={product.appSrc} title={product.name} />;
}
