"use client";

import { useEffect, useRef } from "react";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import { useCart } from "@/components/CartProvider";
import { api } from "@/lib/api";

export default function ProductFrame({
  src,
  title,
}: {
  src: string;
  title: string;
}) {
  const ref = useRef<HTMLIFrameElement>(null);
  const { add } = useCart();

  // Bridge "add to cart" from the (same-origin) iframe calculators to the
  // storefront cart, so items added inside an embedded app appear in the nav
  // cart and on /cart.
  useEffect(() => {
    // Gather the artwork the customer chose INSIDE the calculator, upload it to
    // the backend, and return the saved file refs. The calculator priced the
    // job from this exact file, so it becomes the order's locked artwork — no
    // re-upload on the cart. The iframe is same-origin, so we can read its file
    // inputs directly. `item.artworks` (already-uploaded refs, e.g. from a
    // calculator that saved server-side) takes precedence.
    async function collectArtworks(item: Record<string, unknown>): Promise<{ url: string; name: string }[]> {
      if (Array.isArray(item.artworks) && item.artworks.length) {
        return (item.artworks as { url: string; name: string }[]).filter((a) => a && a.url);
      }
      // Neon / 3D box-up replace their page with the analysis result and expose
      // the saved artwork here (their file input is gone by add-to-cart) —
      // either on window (large-file path) or in sessionStorage (fast path,
      // saved in parallel with analysis).
      try {
        const w = ref.current?.contentWindow as (Window & { __SF_ARTWORK?: { url: string; name: string } }) | null;
        const a = w?.__SF_ARTWORK;
        if (a && a.url) return [{ url: a.url, name: a.name || "artwork" }];
        const raw = w?.sessionStorage?.getItem("__SF_ARTWORK");
        if (raw) {
          const s = JSON.parse(raw) as { url?: string; name?: string };
          if (s && s.url) return [{ url: s.url, name: s.name || "artwork" }];
        }
      } catch {
        /* cross-origin / not ready */
      }
      const files: File[] = [];
      try {
        const doc = ref.current?.contentDocument;
        doc?.querySelectorAll<HTMLInputElement>('input[type="file"]').forEach((inp) => {
          if (inp.files) for (const f of Array.from(inp.files)) files.push(f);
        });
      } catch {
        /* cross-origin / not ready */
      }
      const out: { url: string; name: string }[] = [];
      for (const f of files) {
        try {
          const res = await api.uploadArtwork(f);
          out.push({ url: res.url, name: f.name });
        } catch {
          /* skip a file that failed to upload rather than blocking the cart */
        }
      }
      return out;
    }

    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data;
      if (!data || data.type !== "sign-cart-add" || !data.item) return;
      const item = data.item;
      if (typeof item.label !== "string" || typeof item.href !== "string") return;
      void (async () => {
        const artworks = await collectArtworks(item);
        add({
          label: item.label,
          href: item.href,
          price: typeof item.price === "number" ? item.price : 0,
          image: typeof item.image === "string" ? item.image : undefined,
          meta: typeof item.meta === "string" ? item.meta : undefined,
          // Member pricing + server-recompute plumbing from iframe calculators.
          tierPrices:
            Array.isArray(item.tierPrices) && item.tierPrices.length === 4
              ? item.tierPrices.map((n: unknown) => (typeof n === "number" ? n : 0))
              : undefined,
          spec: item.spec && typeof item.spec === "object" ? item.spec : undefined,
          artworks: artworks.length ? artworks : undefined,
        });
      })();
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [add]);

  useEffect(() => {
    const iframe = ref.current;
    if (!iframe) return;
    let ro: ResizeObserver | null = null;

    // Size the (same-origin) iframe to its content height so the whole page
    // scrolls — the window scrollbar then sits at the viewport's far right,
    // matching the home page (instead of an inner scrollbar inside the iframe).
    const fit = () => {
      try {
        const doc = iframe.contentDocument;
        if (!doc || !doc.body) return;
        // Avoid the inner `min-height:100vh` inflating the measurement.
        doc.body.style.minHeight = "0px";
        doc.documentElement.style.height = "auto";
        const h = Math.max(
          doc.documentElement.scrollHeight,
          doc.body.scrollHeight
        );
        if (h > 0) iframe.style.height = h + "px";
      } catch {
        /* cross-origin or not ready — ignore */
      }
    };

    const onLoad = () => {
      fit();
      try {
        const doc = iframe.contentDocument;
        if (doc) {
          ro = new ResizeObserver(fit);
          ro.observe(doc.documentElement);
          if (doc.body) ro.observe(doc.body);
        }
      } catch {
        /* ignore */
      }
    };

    iframe.addEventListener("load", onLoad);
    if (iframe.contentDocument?.readyState === "complete") onLoad();
    // Fallback poll for async content (analysis results, 3D model load, etc.).
    const interval = window.setInterval(fit, 700);

    return () => {
      iframe.removeEventListener("load", onLoad);
      ro?.disconnect();
      window.clearInterval(interval);
    };
  }, [src]);

  return (
    <>
      <Nav />
      <div className="product-host">
        <iframe ref={ref} src={src} title={title} scrolling="no" />
      </div>
      <Footer />
    </>
  );
}
