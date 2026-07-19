"use client";

import Link from "next/link";
import { useState } from "react";
import { useCart } from "@/components/CartProvider";
import { isCategory, nodeHref, slugify, type ProductMenuItem } from "@/lib/products";

export default function ProductCard({ node }: { node: ProductMenuItem }) {
  const { add } = useCart();
  const [added, setAdded] = useState(false);
  const href = nodeHref(node);
  const category = isCategory(node);
  const available = node.available;

  const onAdd = () => {
    add({ label: node.label, href });
    setAdded(true);
    setTimeout(() => setAdded(false), 1200);
  };

  return (
    <div className={`product-card-tile${category ? " is-category" : ""}`}>
      <Link href={href} className="tile-thumb" aria-label={node.label}>
        <span className="tile-glyph">{category ? "⊞" : available ? "◆" : "▢"}</span>
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
