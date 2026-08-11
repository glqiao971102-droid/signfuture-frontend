"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";

export type CartItem = {
  id: string;
  label: string;
  href: string;
  qty: number;
  price: number;
  image?: string;
  meta?: string;
  /** Whether this product can be delivered. Materials are self-collect only. Defaults to true. */
  deliverable?: boolean;
  /**
   * The line price at each tier [Agent, Silver, Gold, Diamond] for this exact
   * configuration. Present when a calculator supports member pricing; lets the
   * cart charge the customer's own tier and show tier comparisons. `price`
   * stays the fallback for items without it.
   */
  tierPrices?: number[];
  /** Structured pricing spec so the server can recompute (anti-tampering). */
  spec?: Record<string, unknown>;
  /** Artwork files the customer attached to this line (saved on the server). */
  artworks?: { url: string; name: string }[];
};

type AddInput = { label: string; href: string; price?: number; image?: string; meta?: string; deliverable?: boolean; tierPrices?: number[]; spec?: Record<string, unknown>; artworks?: { url: string; name: string }[] };

type CartContextValue = {
  items: CartItem[];
  count: number;
  subtotal: number;
  add: (item: AddInput) => void;
  setQty: (id: string, qty: number) => void;
  setArtworks: (id: string, artworks: { url: string; name: string }[]) => void;
  remove: (id: string) => void;
  clear: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);
const STORAGE_KEY = "sign-studio-cart";

// A line is identified by its full configuration (product + spec/meta + price),
// so two banners of DIFFERENT sizes are separate lines, while re-adding the exact
// same configuration just bumps the quantity.
const signatureOf = (i: { href: string; meta?: string; price?: number }) =>
  `${i.href}|${i.meta ?? ""}|${i.price ?? 0}`;

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<CartItem>[];
        setItems(
          parsed.map((i) => {
            const base = {
              label: i.label ?? "Item",
              href: i.href ?? "#",
              qty: i.qty ?? 1,
              price: typeof i.price === "number" ? i.price : 0,
              image: i.image,
              meta: i.meta,
              deliverable: i.deliverable,
              tierPrices: Array.isArray(i.tierPrices) ? i.tierPrices : undefined,
              spec: i.spec && typeof i.spec === "object" ? i.spec : undefined,
              artworks: Array.isArray(i.artworks) ? i.artworks : undefined,
            };
            return { id: i.id ?? signatureOf(base), ...base };
          })
        );
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      /* ignore */
    }
  }, [items]);

  const add = useCallback((item: AddInput) => {
    const id = signatureOf(item);
    setItems((prev) => {
      const artworks = Array.isArray(item.artworks) && item.artworks.length ? item.artworks : undefined;
      const existing = prev.find((i) => i.id === id);
      if (existing) {
        // Same exact configuration — bump qty; adopt freshly-uploaded artwork.
        return prev.map((i) => (i.id === id ? { ...i, qty: i.qty + 1, artworks: artworks ?? i.artworks } : i));
      }
      return [
        ...prev,
        {
          id,
          label: item.label,
          href: item.href,
          qty: 1,
          price: typeof item.price === "number" ? item.price : 0,
          image: item.image,
          meta: item.meta,
          deliverable: item.deliverable,
          tierPrices: Array.isArray(item.tierPrices) ? item.tierPrices : undefined,
          spec: item.spec && typeof item.spec === "object" ? item.spec : undefined,
          artworks,
        },
      ];
    });
  }, []);

  const setQty = useCallback((id: string, qty: number) => {
    setItems((prev) =>
      prev
        .map((i) => (i.id === id ? { ...i, qty: Math.max(0, Math.round(qty)) } : i))
        .filter((i) => i.qty > 0)
    );
  }, []);

  const setArtworks = useCallback((id: string, artworks: { url: string; name: string }[]) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, artworks } : i)));
  }, []);

  const remove = useCallback((id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const count = items.reduce((n, i) => n + i.qty, 0);
  const subtotal = items.reduce((n, i) => n + (i.price || 0) * i.qty, 0);

  return (
    <CartContext.Provider value={{ items, count, subtotal, add, setQty, setArtworks, remove, clear }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}

export function formatRM(value: number) {
  return "RM " + (value || 0).toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
