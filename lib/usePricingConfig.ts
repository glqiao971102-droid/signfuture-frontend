"use client";

import { useEffect, useState } from "react";
import { API_BASE } from "@/lib/api";

/**
 * Reads an admin-editable pricing config for a product from the backend, so a
 * calculator's numbers can be changed in admin without a deploy. Returns the
 * provided `fallback` immediately (and keeps it if the backend is unreachable),
 * so the calculator behaves exactly as its built-in defaults until an override
 * is fetched. The fallback should be byte-identical to the built-in literals.
 */
export function usePricingConfig<T>(key: string, fallback: T): T {
  const [config, setConfig] = useState<T>(fallback);
  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE}/api/v1/pricing/${key}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && d?.config) setConfig(d.config as T);
      })
      .catch(() => {
        /* backend down — keep the built-in fallback */
      });
    return () => {
      cancelled = true;
    };
  }, [key]);
  return config;
}
