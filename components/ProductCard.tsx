"use client";

import Link from "next/link";
import { useState } from "react";
import { useCart } from "@/components/CartProvider";
import { isCategory, nodeHref, slugify, type ProductMenuItem } from "@/lib/products";
import { PRODUCT_IMAGES } from "@/lib/productImages";

/** Hero image for a node, keyed by its slug; a category borrows the first
 *  descendant that has one (so grouping cards still get a picture). */
function resolveImage(node: ProductMenuItem): string | undefined {
  const slug = (node.href ?? "").split("/").filter(Boolean).pop() ?? slugify(node.label);
  if (PRODUCT_IMAGES[slug]) return PRODUCT_IMAGES[slug];
  if (PRODUCT_IMAGES[slugify(node.label)]) return PRODUCT_IMAGES[slugify(node.label)];
  if (node.children) {
    for (const child of node.children) {
      const found = resolveImage(child);
      if (found) return found;
    }
  }
  return undefined;
}

export default function ProductCard({ node }: { node: ProductMenuItem }) {
  const { add } = useCart();
  const [added, setAdded] = useState(false);
  const href = nodeHref(node);
  const category = isCategory(node);
  const available = node.available;
  const image = resolveImage(node);

  const onAdd = () => {
    add({ label: node.label, href });
    setAdded(true);
    setTimeout(() => setAdded(false), 1200);
  };

  return (
    <div className={`product-card-tile${category ? " is-category" : ""}`}>
      <Link href={href} className="tile-thumb" aria-label={node.label}>
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="tile-img" src={image} alt={node.label} loading="lazy" />
        ) : (
          <span className="tile-glyph">{category ? "⊞" : available ? "◆" : "▢"}</span>
        )}
        {category && node.children && (
          <span className="tile-count">{node.children.length} items</span>
        )}
        {!category && !available && <span className="tile-soon">Soon</span>}
      </Link>
      <div className="tile-body">
        <Link href={href} className="tile-title">
          {node.label}
        </Link>
        {category ? (
          <Link href={href} className="tile-cta">
            View products →
          </Link>
        ) : available ? (
          <Link href={href} className="tile-cta is-open">
            Open calculator →
          </Link>
        ) : (
          <div className="tile-price-row">
            <span className="tile-price">RM 0.00</span>
            <button type="button" className={`tile-add${added ? " added" : ""}`} onClick={onAdd}>
              {added ? "Added ✓" : "Add to cart"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function productSlugHref(node: ProductMenuItem) {
  return node.children ? `/category/${slugify(node.label)}` : node.href ?? "#";
}
