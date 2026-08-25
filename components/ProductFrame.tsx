"use client";

import { useEffect, useRef } from "react";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import { useCart, type BoxupRecord } from "@/components/CartProvider";
import { track } from "@/lib/track";
import { useAuth } from "@/components/AuthProvider";
import { tierIndex } from "@/lib/tier";
import { api } from "@/lib/api";

/** Validate the box-up UV records from the (same-origin) calculator iframe. */
function sanitizeBoxupRecords(raw: unknown): BoxupRecord[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: BoxupRecord[] = [];
  for (const r of raw) {
    const b = (r as { bbox?: Record<string, unknown> })?.bbox;
    if (!b) continue;
    const xIn = Number(b.xIn), yIn = Number(b.yIn), wIn = Number(b.wIn), hIn = Number(b.hIn);
    if (![xIn, yIn, wIn, hIn].every(Number.isFinite) || wIn <= 0 || hIn <= 0) continue;
    const rec = r as { finishing?: unknown; color?: unknown };
    out.push({
      bbox: { xIn, yIn, wIn, hIn },
      finishing: typeof rec.finishing === "string" ? rec.finishing.slice(0, 60) : undefined,
      color: typeof rec.color === "string" ? rec.color.slice(0, 40) : undefined,
    });
  }
  return out.length ? out : undefined;
}

type CardLook = {
  hl: Record<string, string>;
  plain: Record<string, string>;
  hlSpan: string;
  hlStrong: string;
  plSpan: string;
  plStrong: string;
};

export default function ProductFrame({
  src,
  title,
}: {
  src: string;
  title: string;
}) {
  const ref = useRef<HTMLIFrameElement>(null);
  const { add } = useCart();
  const { user, loading, openLogin } = useAuth();
  // Calculators are gated behind login — a visitor must sign in (or register)
  // before they can upload a file / see any pricing.
  const authed = !!user;
  // The member's own tier (Agent 0 … Diamond 3). The Order Summary in every
  // calculator should mark THIS row as the customer's price.
  const memberTier = tierIndex(user?.tier);
  // Pristine highlight/plain look captured once per iframe content, so repeated
  // applies (retries, tier changes) never read our own already-mutated styles.
  const lookRef = useRef<CardLook | null>(null);

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
      // saved in parallel with analysis). The parallel save may still be in
      // flight when the user clicks Add to Cart, so wait briefly for it.
      const readSaved = (): { url: string; name: string } | null => {
        try {
          const w = ref.current?.contentWindow as (Window & { __SF_ARTWORK?: { url: string; name: string } }) | null;
          if (w?.__SF_ARTWORK?.url) return { url: w.__SF_ARTWORK.url, name: w.__SF_ARTWORK.name || "artwork" };
          const raw = w?.sessionStorage?.getItem("__SF_ARTWORK");
          if (raw) {
            const s = JSON.parse(raw) as { url?: string; name?: string };
            if (s?.url) return { url: s.url, name: s.name || "artwork" };
          }
        } catch {
          /* cross-origin / not ready */
        }
        return null;
      };
      // Only wait when this looks like a calculator that uploads (an analysis
      // result is showing) — detected by an artwork form having been present.
      const looksLikeUploadApp = /\/(neon-line|3d-box-up|3d-signboard)\b/.test(item.href as string);
      for (let i = 0; i < (looksLikeUploadApp ? 25 : 1); i++) {
        const saved = readSaved();
        if (saved) return [saved];
        if (i === 0 && !looksLikeUploadApp) break;
        await new Promise((r) => setTimeout(r, 200)); // up to ~5s
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
      // Activity tracking: a file was uploaded to a calculator (to get a price).
      // Record it with the file URL so the admin can download what they uploaded.
      if (data && data.type === "sf-activity" && data.event && typeof data.event.url === "string") {
        track({
          type: "action",
          action: typeof data.event.action === "string" ? data.event.action : "upload",
          label: typeof data.event.label === "string" ? data.event.label : "file",
          meta: {
            url: data.event.url,
            product: typeof data.event.product === "string" ? data.event.product : undefined,
          },
        });
        return;
      }
      if (!data || data.type !== "sign-cart-add" || !data.item) return;
      const item = data.item;
      if (typeof item.label !== "string" || typeof item.href !== "string") return;
      // Activity tracking: capture what the visitor configured + its price + files.
      track({
        type: "action",
        action: "add_to_cart",
        path: typeof item.href === "string" ? item.href : undefined,
        label: item.label,
        meta: {
          price: typeof item.price === "number" ? item.price : undefined,
          spec: typeof item.meta === "string" ? item.meta : undefined,
          files: Array.isArray(item.artworks)
            ? item.artworks
                .filter((a: unknown): a is { url: string; name?: string } => !!a && typeof (a as { url?: unknown }).url === "string")
                .map((a: { url: string; name?: string }) => ({ url: a.url, name: a.name }))
            : undefined,
        },
      });
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
          // Calculators flag express/special requests with a "Pending Confirmation"
          // status — carry it through so the job starts awaiting sales approval.
          requiresConfirmation: item.status === "Pending Confirmation",
          // Box-up UV / Inkjet per-record data (invisible to the buyer).
          boxupRecords: sanitizeBoxupRecords(item.boxupRecords),
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
  }, [src, authed]);

  // Fresh iframe content → forget the previously-captured look.
  useEffect(() => {
    lookRef.current = null;
  }, [src]);

  // Mark the member's OWN tier as the selected price in every calculator's Order
  // Summary — instead of always defaulting to Agent. Three markups are covered:
  //   • Static ".agent-card" apps — Agent is highlighted via CSS :first-child, so
  //     we MOVE that exact look onto the member's tier card (copying the app's own
  //     computed styles, captured once while pristine — no hardcoded colours).
  //   • Neon ".agent-price-row[data-agent]" — the app highlights `.is-current`
  //     from `panel.dataset.currentAgent` (only ever read) and its add-to-cart
  //     price reads the `.is-current` row, so we point both at the member's tier.
  //   • Box Up ".order-total-row" with `.order-price[data-agent-tier]` — the Agent
  //     row has a static `.is-active-agent` (add-to-cart reads it); we move it.
  // Neon/Box Up rebuild via document.write, so a MutationObserver re-applies.
  useEffect(() => {
    const iframe = ref.current;
    if (!iframe) return;
    const TIER_KEYS = ["agent", "silver", "gold", "diamond"];
    const HL = ["backgroundColor", "backgroundImage", "borderColor", "boxShadow"];
    const grab = (cs: CSSStyleDeclaration): Record<string, string> =>
      Object.fromEntries(HL.map((p) => [p, (cs as unknown as Record<string, string>)[p]]));
    const textColor = (el: Element | null): string => (el ? getComputedStyle(el).color : "");
    const idx = Math.min(3, Math.max(0, memberTier));
    const key = TIER_KEYS[idx];

    const apply = () => {
      try {
        const doc = iframe.contentDocument;
        if (!doc) return;

        // (1) Static ".agent-card" apps.
        const cards = Array.from(doc.querySelectorAll<HTMLElement>(".agent-card"));
        if (cards.length >= 4) {
          // Capture the pristine highlight (card 0) + a plain card ONCE, before we
          // mutate anything — otherwise later runs would read our own edits.
          if (!lookRef.current) {
            const plainRef = cards[1];
            lookRef.current = {
              hl: grab(getComputedStyle(cards[0])),
              plain: grab(getComputedStyle(plainRef)),
              hlSpan: textColor(cards[0].querySelector("span")),
              hlStrong: textColor(cards[0].querySelector("strong")),
              plSpan: textColor(plainRef.querySelector("span")),
              plStrong: textColor(plainRef.querySelector("strong")),
            };
          }
          const look = lookRef.current;
          cards.forEach((card, i) => {
            const cur = i === idx;
            const s = cur ? look.hl : look.plain;
            HL.forEach((p) => {
              (card.style as unknown as Record<string, string>)[p] = s[p] ?? "";
            });
            const sp = card.querySelector<HTMLElement>("span");
            const st = card.querySelector<HTMLElement>("strong");
            if (sp) sp.style.color = cur ? look.hlSpan : look.plSpan;
            if (st) st.style.color = cur ? look.hlStrong : look.plStrong;
          });
        }

        // (2) Neon rows.
        const neonRows = doc.querySelectorAll<HTMLElement>(".agent-price-row[data-agent]");
        if (neonRows.length) {
          doc.querySelectorAll<HTMLElement>(".checkout-panel").forEach((p) => {
            p.dataset.currentAgent = key;
          });
          neonRows.forEach((row) => row.classList.toggle("is-current", (row.dataset.agent || "agent") === key));
        }

        // (3) Box Up rows.
        const boxRows = doc.querySelectorAll<HTMLElement>(".order-total-row");
        boxRows.forEach((row) => {
          const price = row.querySelector<HTMLElement>(".order-price[data-agent-tier]");
          if (price) row.classList.toggle("is-active-agent", price.dataset.agentTier === key);
        });
      } catch {
        /* cross-origin / not ready */
      }
    };

    // Re-apply on any structural change (Neon/Box Up swap the page via
    // document.write). We only watch childList/subtree — apply() changes classes,
    // styles and dataset (attributes), which we ignore, so there is no loop.
    let debounce = 0;
    let observer: MutationObserver | null = null;
    const runApply = () => {
      observer?.disconnect();
      apply();
      try {
        const doc = iframe.contentDocument;
        if (doc) observer?.observe(doc, { childList: true, subtree: true });
      } catch {
        /* ignore */
      }
    };
    observer = new MutationObserver(() => {
      if (debounce) return;
      debounce = window.setTimeout(() => {
        debounce = 0;
        runApply();
      }, 150);
    });

    const onLoad = () => runApply();
    iframe.addEventListener("load", onLoad);
    if (iframe.contentDocument?.readyState === "complete") runApply();
    // Content may render after load (analysis result pages, etc.).
    const timers = [300, 1000, 2500].map((ms) => window.setTimeout(runApply, ms));
    return () => {
      iframe.removeEventListener("load", onLoad);
      observer?.disconnect();
      if (debounce) window.clearTimeout(debounce);
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, [src, memberTier, authed]);

  return (
    <>
      <Nav />
      <div className="product-host">
        {loading ? (
          <div className="calc-gate">
            <p className="calc-gate-loading">Loading…</p>
          </div>
        ) : authed ? (
          <iframe ref={ref} src={src} title={title} scrolling="no" />
        ) : (
          <div className="calc-gate">
            <div className="calc-gate-card">
              <div className="calc-gate-icon">🔒</div>
              <h2>Login to see pricing</h2>
              <p>
                Please sign in to your account to upload your file and view the price for{" "}
                <strong>{title}</strong>. Pricing is for registered members only.
              </p>
              <div className="calc-gate-actions">
                <button type="button" className="calc-gate-btn primary" onClick={openLogin}>
                  Login
                </button>
                <button type="button" className="calc-gate-btn" onClick={openLogin}>
                  Register
                </button>
              </div>
              <p className="calc-gate-hint">No account yet? Registration is free.</p>
            </div>
          </div>
        )}
      </div>
      <Footer />
    </>
  );
}
