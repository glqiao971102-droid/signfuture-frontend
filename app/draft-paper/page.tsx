import DraftPaperProduct from "@/components/DraftPaperProduct";
import { productBySlug } from "@/lib/products";

const product = productBySlug("draft-paper")!;

export const metadata = { title: `${product.name} — Sign Calculators` };

export default function DraftPaperPage() {
  return <DraftPaperProduct />;
}
