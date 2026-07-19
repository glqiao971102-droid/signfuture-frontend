"use client";

import { useEffect, useRef } from "react";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import { useCart } from "@/components/CartProvider";

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
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data;
      if (!data || data.type !== "sign-cart-add" || !data.item) return;
      const item = data.item;
      if (typeof item.label !== "string" || typeof item.href !== "string") return;
      add({
        label: item.label,
        href: item.href,
        price: typeof item.price === "number" ? item.price : 0,
        image: typeof item.image === "string" ? item.image : undefined,
        meta: typeof item.meta === "string" ? item.meta : undefined,
      });
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
