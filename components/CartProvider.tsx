"use client";

import { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { useAuth } from "@/components/AuthProvider";

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
  /** True for stock items (e.g. Materials) that don't need an artwork upload. */
  noArtwork?: boolean;
  /**
   * True when this line is a special request (e.g. an express collect date) that
   * needs sales approval — it becomes a Pending Confirmation job at checkout.
   */
  requiresConfirmation?: boolean;
  /**
   * Box-up per-letter/logo records for the SF Dropbox UV / Inkjet auto-layout —
   * invisible to the buyer. Carries each piece's bbox + finishing/colour so the
   * backend lays out only the letters marked "UV Printing".
   */
  boxupRecords?: BoxupRecord[];
};

export type BoxupRecord = {
  bbox: { xIn: number; yIn: number; wIn: number; hIn: number };
  finishing?: string;
  color?: string;
};

type AddInput = { label: string; href: string; price?: number; image?: string; meta?: string; deliverable?: boolean; tierPrices?: number[]; spec?: Record<string, unknown>; artworks?: { url: string; name: string }[]; noArtwork?: boolean; requiresConfirmation?: boolean; boxupRecords?: BoxupRecord[] };

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

// The cart is stored per identity so one person's cart never leaks to another
// on a shared browser. Guests use the base key; a signed-in member uses a
// key scoped to their user id.
const GUEST_KEY = "sign-studio-cart";
const keyFor = (uid: number | null) => (uid == null ? GUEST_KEY : `${GUEST_KEY}:u${uid}`);

// A line is identified by its full configuration (product + spec/meta + price),
// so two banners of DIFFERENT sizes are separate lines, while re-adding the exact
// same configuration just bumps the quantity.
const signatureOf = (i: { href: string; meta?: string; price?: number }) =>
  `${i.href}|${i.meta ?? ""}|${i.price ?? 0}`;

// Parse a stored cart payload into well-formed CartItems (tolerant of old data).
function normalizeItems(raw: string | null): CartItem[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as Partial<CartItem>[];
    if (!Array.isArray(parsed)) return [];
    return parsed.map((i) => {
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
        noArtwork: i.noArtwork || undefined,
        requiresConfirmation: i.requiresConfirmation || undefined,
        boxupRecords: Array.isArray(i.boxupRecords) ? i.boxupRecords : undefined,
      };
      return { id: i.id ?? signatureOf(base), ...base };
    });
  } catch {
    return [];
  }
}

// Merge a guest cart into the signed-in member's cart on login (same line → sum
// quantities), so items added before signing in aren't lost.
function mergeCarts(base: CartItem[], extra: CartItem[]): CartItem[] {
  const out = base.map((i) => ({ ...i }));
  for (const it of extra) {
    const existing = out.find((x) => x.id === it.id);
    if (existing) existing.qty += it.qty;
    else out.push({ ...it });
  }
  return out;
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const uid = user?.id ?? null;
  const [items, setItems] = useState<CartItem[]>([]);

  // The identity whose cart is currently loaded. `undefined` until the first
  // load runs. `justLoaded` suppresses the immediate persist that would
  // otherwise write the pre-load (stale) items back under the new identity.
  const identityRef = useRef<number | null | undefined>(undefined);
  const justLoadedRef = useRef(false);

  // Load / switch the cart whenever the signed-in identity changes (initial
  // mount, login, logout, or account switch).
  useEffect(() => {
    if (identityRef.current === uid) return;
    const prev = identityRef.current;
    const curKey = keyFor(uid);

    if (prev !== undefined && prev == null && uid != null) {
      // Guest → signed in: fold the guest cart into this member's own cart,
      // then clear the guest cart so it can't reappear for the next person.
      const merged = mergeCarts(normalizeItems(localStorage.getItem(curKey)), normalizeItems(localStorage.getItem(GUEST_KEY)));
      setItems(merged);
      try {
        localStorage.setItem(curKey, JSON.stringify(merged));
        localStorage.removeItem(GUEST_KEY);
      } catch {
        /* ignore */
      }
    } else {
      // First load, logout, or switching accounts: show that identity's cart.
      setItems(normalizeItems(localStorage.getItem(curKey)));
    }

    identityRef.current = uid;
    justLoadedRef.current = true;
  }, [uid]);

  // Persist the cart under the current identity — but skip the render that just
  // loaded it (items still hold the previous identity's data at that point).
  useEffect(() => {
    if (identityRef.current === undefined) return;
    if (justLoadedRef.current) {
      justLoadedRef.current = false;
      return;
    }
    try {
      localStorage.setItem(keyFor(identityRef.current), JSON.stringify(items));
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
          noArtwork: item.noArtwork || undefined,
          requiresConfirmation: item.requiresConfirmation || undefined,
          boxupRecords: Array.isArray(item.boxupRecords) && item.boxupRecords.length ? item.boxupRecords : undefined,
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
