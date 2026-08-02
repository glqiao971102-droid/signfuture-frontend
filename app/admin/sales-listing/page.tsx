"use client";

import { Suspense, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";

const VALID_VIEWS = new Set([
  "dashboard",
  "invoices",
  "costs",
  "installation",
  "scorecard",
  "mission",
  "facebook",
]);

/**
 * Sales Listing — the live Sales Performance Ledger app (served on :3200),
 * embedded straight into the admin. Pointing the iframe at the running :3200
 * origin means it reads that app's own localStorage, so all your real data
 * (invoices, costs, installation, scorecard, mission, Facebook) shows exactly
 * as it does on the original page.
 *
 * The sidebar sub-items pass ?view=<tab>; we relay that to the iframe via
 * postMessage so switching tabs never reloads (and never loses in-app state).
 */
/** Origin of the standalone ledger app. Override with NEXT_PUBLIC_SALES_APP_URL. */
const SALES_APP_ORIGIN =
  process.env.NEXT_PUBLIC_SALES_APP_URL?.replace(/\/$/, "") ?? "http://localhost:3200";
function SalesListingEmbed() {
  const params = useSearchParams();
  const view = params.get("view") || "dashboard";
  const initialView = useRef(VALID_VIEWS.has(view) ? view : "dashboard");
  const frameRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (!VALID_VIEWS.has(view)) return;
    const win = frameRef.current?.contentWindow;
    // The bridge script in the embedded page listens for this.
    win?.postMessage({ type: "sf-sales-view", view }, "*");
  }, [view]);

  return (
    <div className="sales-embed">
      <iframe
        ref={frameRef}
        src={`${SALES_APP_ORIGIN}/?view=${initialView.current}`}
        title="Sales Listing"
        className="sales-embed-frame"
      />
    </div>
  );
}

export default function SalesListingPage() {
  return (
    <Suspense fallback={<div className="sales-embed" />}>
      <SalesListingEmbed />
    </Suspense>
  );
}
