import ProductFrame from "@/components/ProductFrame";
import { productBySlug } from "@/lib/products";

const product = productBySlug("bunting")!;

/**
 * Bunting product page body.
 *
 * Bunting started as a copy of the Inkjet Banner calculator, but the two are
 * fully independent: the embedded app lives at `public/apps/bunting/index.html`
 * with its own `assets/` folder, so changing Bunting's inputs, pricing or
 * images never affects Banner.
 *
 * This component is the seam for anything Bunting-specific that should live in
 * React rather than in the embedded HTML app (extra sections, promos, related
 * products). Add it around the <ProductFrame /> below.
 */
export default function BuntingProduct() {
  return <ProductFrame src={product.appSrc} title={product.name} />;
}
