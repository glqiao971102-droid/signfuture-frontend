"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { track, flush } from "@/lib/track";

/**
 * Mounted once in the root layout. Sends a page view on every route change
 * (admin pages excluded — those are internal), a "login" action when a visitor
 * signs in, and flushes the queue when the tab is hidden/closed.
 */
export default function Tracker() {
  const pathname = usePathname();
  const { user } = useAuth();
  const lastUserId = useRef<number | null | undefined>(undefined);

  // Page views — one per page entered. The admin derives dwell from the gap to
  // the visitor's next event, so no client-side timing is needed.
  useEffect(() => {
    if (!pathname || pathname.startsWith("/admin")) return;
    track({ type: "pageview", path: pathname });
  }, [pathname]);

  // Login — fire once when the visitor transitions signed-out → signed-in, so
  // the admin can link the earlier guest activity to the account.
  useEffect(() => {
    const id = user ? (user as { id?: number }).id ?? null : null;
    if (lastUserId.current === undefined) {
      lastUserId.current = id;
      return;
    }
    if (!lastUserId.current && id) {
      track({ type: "action", action: "login", label: user?.name || "" });
      flush();
    }
    lastUserId.current = id;
  }, [user]);

  // Make sure the last batch is sent when the tab goes away.
  useEffect(() => {
    const onHidden = () => {
      if (document.visibilityState === "hidden") flush(true);
    };
    const onPageHide = () => flush(true);
    document.addEventListener("visibilitychange", onHidden);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      document.removeEventListener("visibilitychange", onHidden);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, []);

  return null;
}
