"use client";

import { useCallback, useEffect, useRef } from "react";
import { api } from "@/lib/api";

async function geocode(address: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const res = await fetch(
      "https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=my&q=" +
        encodeURIComponent(address),
      { headers: { Accept: "application/json" } },
    );
    if (!res.ok) return null;
    const arr = await res.json();
    if (arr?.[0]?.lat && arr[0].lon) return { lat: parseFloat(arr[0].lat), lng: parseFloat(arr[0].lon) };
  } catch {
    /* offline / blocked */
  }
  return null;
}

/**
 * "My Installation" — the exact Sales Ledger installation view (calendar + map +
 * jobs), but its data is the member's OWN database records: we fetch them and
 * feed the iframe, and relay its add / delete / complete actions back to the
 * database. Keeps the identical UI while staying in sync with Admin →
 * Installations.
 */
export default function MyInstallationFrame() {
  const ref = useRef<HTMLIFrameElement>(null);

  const send = useCallback(async () => {
    try {
      const r = await api.myInstallations();
      const installations = r.data.map((d) => ({
        id: d.id,
        manual: true,
        invoiceNo: d.invoiceNo || "",
        installerPhone: d.installerPhone || "",
        customerPhone: d.customerPhone || "",
        address: d.address || "",
        date: d.installDate || "",
        startTime: d.startTime || "",
        endTime: d.endTime || "",
        completed: !!d.completed,
        lat: typeof d.lat === "number" ? d.lat : undefined,
        lng: typeof d.lng === "number" ? d.lng : undefined,
      }));
      ref.current?.contentWindow?.postMessage({ type: "sf-inst-data", installations }, window.location.origin);
    } catch {
      /* not signed in to the backend — leave the view empty */
    }
  }, []);

  useEffect(() => {
    const onMsg = async (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      const d = e.data;
      if (!d || typeof d.type !== "string") return;
      try {
        if (d.type === "sf-inst-ready") {
          await send();
        } else if (d.type === "sf-inst-add") {
          const it = d.item || {};
          let lat: number | undefined;
          let lng: number | undefined;
          if (it.address && String(it.address).trim()) {
            const g = await geocode(String(it.address).trim());
            if (g) {
              lat = g.lat;
              lng = g.lng;
            }
          }
          await api.addMyInstallation({
            installDate: it.date || undefined,
            startTime: it.startTime || undefined,
            endTime: it.endTime || undefined,
            invoiceNo: it.invoiceNo || undefined,
            customerPhone: it.customerPhone || undefined,
            installerPhone: it.installerPhone || undefined,
            address: it.address || undefined,
            lat,
            lng,
          });
          await send();
        } else if (d.type === "sf-inst-delete") {
          await api.deleteMyInstallation(Number(d.id));
          await send();
        } else if (d.type === "sf-inst-complete") {
          await api.completeMyInstallation(Number(d.id), !!d.completed);
          await send();
        }
      } catch {
        /* surface nothing — a failed sync just leaves the list unchanged */
      }
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [send]);

  return (
    <section className="acct-card acct-section-card">
      <div className="acct-card-head">
        <h2>My Installation</h2>
        <span>Your installation calendar, Malaysia map and jobs — synced with our records.</span>
      </div>
      <iframe
        ref={ref}
        src="/sales-listing/index.html?view=installation&customer=1"
        title="My Installation"
        style={{ width: "100%", height: "1900px", border: "0", borderRadius: "12px", background: "#0b1220" }}
      />
    </section>
  );
}
