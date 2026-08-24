"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api, type AdminOrderRow, type OrderDetail, type NativeOrderDetail } from "@/lib/api";

const PER_PAGE = 25;

// Status chips the operator doesn't want in the quick-filter row (still counted
// in "All" and still available via the dropdown).
const HIDDEN_STATUS_CHIPS = new Set([
  "Completed — Ready for Pickup",
  "Failed",
  "Refunded",
  "In Production",
]);

// Month filter options, newest first: from the current month back to Jan 2024
// (the store's data start). Value is "YYYY-MM"; label is e.g. "August 2026".
const MONTH_OPTIONS: { value: string; label: string }[] = (() => {
  const names = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  const now = new Date();
  const out: { value: string; label: string }[] = [];
  let y = now.getFullYear();
  let m = now.getMonth(); // 0-based
  while (y > 2024 || (y === 2024 && m >= 0)) {
    out.push({ value: `${y}-${String(m + 1).padStart(2, "0")}`, label: `${names[m]} ${y}` });
    m -= 1;
    if (m < 0) { m = 11; y -= 1; }
  }
  return out;
})();

const money = (n: number) =>
  n.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function formatDate(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value.includes("T") ? value : value.replace(" ", "T"));
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-MY", { day: "2-digit", month: "short", year: "numeric" });
}
// YYYY-MM-DD, for download filenames (e.g. "2026-08-20").
function fileDate(value: string | null): string {
  if (!value) return "";
  const d = new Date(value.includes("T") ? value : value.replace(" ", "T"));
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-CA", { year: "numeric", month: "2-digit", day: "2-digit" });
}

// Artwork download URL that carries the display name, so the file saves under
// its human name (e.g. "3D Wording - 30x102 cm.ai") instead of the stored UUID.
// The `download` attribute is ignored cross-origin, so the backend reads ?name
// and sets Content-Disposition.
function downloadHref(a: { url: string; name?: string }): string {
  const name = (a.name || "artwork").trim();
  const sep = a.url.includes("?") ? "&" : "?";
  return `${a.url}${sep}name=${encodeURIComponent(name)}`;
}

// Date + time of day, for the order detail "Placed" line (e.g. "19 Aug 2026,
// 03:45 PM"). Shown in the viewer's local timezone.
function formatDateTime(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value.includes("T") ? value : value.replace(" ", "T"));
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("en-MY", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

// Valid collect lead-times (working days). Older orders sometimes stored the
// resolved collect DATE ("collect Wed, 19 Aug 2026") instead of "N working
// days" — we derive the number from the order date → collect date, and snap it
// to one of these so the admin always shows working days.
const COLLECT_DAYS = [1, 2, 3, 4, 7];
function snapWorkingDays(n: number): number {
  return COLLECT_DAYS.reduce((best, v) => (Math.abs(v - n) < Math.abs(best - n) ? v : best), COLLECT_DAYS[0]);
}
// Working days (Mon–Sat; Sundays excluded) strictly after `from`, up to `to`.
function businessDaysBetween(from: Date, to: Date): number {
  const a = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const b = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  let count = 0;
  const d = new Date(a);
  while (d < b) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 0) count += 1;
  }
  return count;
}
/** Working days derived from a "collect <date>" in a value, or null. */
function collectWorkingDays(value: string, orderDate: string | null | undefined): number | null {
  const m = /collect\s+(.+)$/i.exec(value.trim());
  if (!m) return null;
  const od = orderDate ? new Date(orderDate) : null;
  if (!od || Number.isNaN(od.getTime())) return null;
  const cd = new Date(m[1].replace(/^[A-Za-z]{3,},\s*/, "").trim()); // drop leading "Wed, "
  if (Number.isNaN(cd.getTime())) return null;
  return snapWorkingDays(businessDaysBetween(od, cd));
}

// The ONLY valid collect lead-times. Any day-count is normalised to one of
// these, so the admin always shows exactly: 7 / 4 / 3 / 2 / next working days.
function workingDaysLabel(n: number): string {
  if (n <= 1) return "next working days";
  const snapped = [2, 3, 4, 7].reduce((best, v) => (Math.abs(v - n) < Math.abs(best - n) ? v : best), 2);
  return `${snapped} working days`;
}

/** Pulls the collect lead-time out of a line item's spec/options. An explicit
 *  "N working days" (e.g. a custom quotation lead time) is shown EXACTLY; only a
 *  value derived from a "collect <date>" is snapped to the standard lead-times. */
function workingDaysOf(options: { label: string; value: string }[], orderDate?: string | null): string {
  for (const o of options) {
    const text = `${o.value} ${o.label}`;
    if (/next\s*working\s*days?/i.test(text)) return "next working days";
    const m = /(\d+)\s*working\s*days?/i.exec(text);
    if (m) {
      const n = parseInt(m[1], 10);
      return n <= 1 ? "next working days" : `${n} working days`;
    }
  }
  for (const o of options) {
    const n = collectWorkingDays(o.value, orderDate);
    if (n != null) return workingDaysLabel(n);
  }
  return "—";
}

// Colour the collect lead-time by urgency: 7 white, 4 light-purple, 3 orange,
// 2 yellow, next/1-day red.
function workingDaysColor(wd: string): string | undefined {
  if (/next/i.test(wd)) return "#f87171"; // red
  const n = parseInt(wd, 10);
  return { 7: "#ffffff", 4: "#c4b5fd", 3: "#fb923c", 2: "#fbbf24", 1: "#f87171" }[n];
}

/** Display an option value, rewriting a stored "collect <date>" as working days. */
function displayOptionValue(value: string, orderDate: string | null | undefined): string {
  if (/\d+\s*working\s*days?/i.test(value)) return value;
  const m = /^(.*?)collect\s+.+$/i.exec(value);
  if (!m) return value;
  const n = collectWorkingDays(value, orderDate);
  return n != null ? `${m[1]}collect ${n} working days` : value;
}

// Fallback labels + display order for the per-job status summary shown in the
// orders list (active statuses first, then the "needs attention" ones).
const STATUS_LABEL_FALLBACK: Record<string, string> = {
  waiting: "Waiting Order", on_hold: "On Hold", processing: "Processing", production: "In Production",
  ready: "Available for Collection", collection: "Pickup Already", delivery: "Delivery Arranged",
  shipped: "Ready to Ship", delivered: "Shipped", completed: "Completed", cancelled: "Cancelled", refunded: "Refunded", failed: "Failed",
};
// The status dropdowns are split into tiers with a divider line between each,
// so the pipeline (received → in production → ready → completed) reads at a glance.
const STATUS_TIERS: { label: string; values: string[] }[] = [
  { label: "① Order received", values: ["pending_confirmation", "waiting"] },
  { label: "② In production", values: ["on_hold", "processing"] },
  { label: "③ Ready", values: ["ready", "shipped"] },
  { label: "④ Completed", values: ["delivered", "collection"] },
  { label: "Cancelled", values: ["cancelled"] },
];
/** Groups the flat status list into the tiers above, keeping any unlisted ones. */
function statusTiers(statuses: { value: string; label: string }[]) {
  const byVal = new Map(statuses.map((s) => [s.value, s.label]));
  const used = new Set<string>();
  const groups = STATUS_TIERS.map((t) => ({
    label: t.label,
    items: t.values.filter((v) => byVal.has(v)).map((v) => { used.add(v); return { value: v, label: byVal.get(v)! }; }),
  })).filter((g) => g.items.length > 0);
  const rest = statuses.filter((s) => !used.has(s.value));
  if (rest.length) groups.push({ label: "Other", items: rest });
  return groups;
}

const DISPLAY_RANK: Record<string, number> = {
  processing: 0, production: 1, ready: 2, delivery: 3, delivered: 4, collection: 5, completed: 6,
  waiting: 7, pending_confirmation: 7, on_hold: 8, cancelled: 9, refunded: 9, failed: 9,
};
/** Distinct job statuses in a sensible order (deduped — repeats show once). */
function distinctStatuses(statuses: string[]): string[] {
  const out: string[] = [];
  for (const s of statuses) if (!out.includes(s)) out.push(s);
  out.sort((a, b) => (DISPLAY_RANK[a] ?? 5) - (DISPLAY_RANK[b] ?? 5));
  return out;
}

function stageClass(stage: string): string {
  return `adm-chip adm-stage-${stage}`;
}

/** Chip colour for a native/reload status value (see .adm-jstat-* in globals.css). */
function jobStatusClass(status: string): string {
  return `adm-chip adm-jstat-${status}`;
}

// ---- Box-up cost estimate ----
// A box-up order line carries "LED Length: X m" and "3D Outline: Y m" (metres),
// captured from the analyzer at checkout. 3D-print material length ≈ outline ×
// (depth ÷ 0.3mm layer): 3cm → ×100, 5cm → ×166.67.
// Internal cost inputs — surfaced in the Cost estimate, hidden from the plain
// line-item option list.
const COST_OPTION_LABELS = new Set(["LED Length", "3D Outline"]);
// Options an admin may swap mid-order WITHOUT changing the price — a like-for-like
// change (e.g. filament colour White → Red at the customer's request). Only values
// that do NOT affect the box-up price are listed; price-changing choices (UV
// Printing, 2K Spray, LED, Power Supply, …) are intentionally absent so they can't
// be picked here. The backend re-validates against the same whitelist.
const SWAPPABLE_OPTIONS: Record<string, string[]> = {
  "3D Filament Color": [
    "White",
    "Translucent White",
    "Translucent Red",
    "Translucent Yellow",
    "Translucent Green",
    "Translucent Blue",
    "Translucent Orange",
    "Translucent Cyclamen",
  ],
  Surface: ["3mm White Acrylic", "3mm Black Acrylic"],
  "Side Finishing": ["Option 1", "Option 2", "Option 3"],
  "Base Finishing": ["10mm PVC Foam Board", "3mm ACP Board"],
  // LED: only the WHITE colour temperatures — they share the same per-cm add-on,
  // so swapping between them is free. "None" (no LED) and "RGB" (quote-on-request)
  // change the price, so they are absent AND the pencil only shows when the item's
  // current LED is already one of these (see the same-price guard on the pencil).
  LED: ["3000K", "4000K", "10000K"],
  // Neon Color (Neon Sign): the 12 solid colours all cost the same per metre.
  // "RGB" doubles the line rate, so it is excluded and the pencil hides on an
  // RGB neon sign. Up to 4 colours are stored, joined by " / ".
  "Neon Color": [
    "White",
    "3K Warm",
    "4.5K Warm",
    "Red",
    "Lemon Yellow",
    "Yellow",
    "Orange",
    "Ice Blue",
    "Blue",
    "Green",
    "Pink",
    "Purple",
  ],
};
// How many 3D Filament Color slots an item has — Side Finishing Option 2/3 use two
// side extrusions (two colours, joined by " / "); Option 1 is a single colour. The
// colour list is deduped, so "White / White" collapses to "White".
function filamentSlots(options: { label: string; value: string }[]): number {
  const side = options.find((o) => o.label === "Side Finishing")?.value;
  return side === "Option 2" || side === "Option 3" ? 2 : 1;
}
function optValue(options: { label: string; value: string }[], label: string): string | null {
  const o = options.find((x) => x.label.toLowerCase() === label.toLowerCase());
  return o ? o.value : null;
}
function metresOf(v: string | null): number | null {
  if (!v) return null;
  const m = /([\d.]+)/.exec(v);
  return m ? Number(m[1]) : null;
}
function boxupDepthCm(options: { label: string; value: string }[]): number | null {
  const m = /(\d+)\s*cm/i.exec(optValue(options, "Size") || "");
  return m ? Number(m[1]) : null;
}
type CostLine = { name: string; led: number | null; outline: number | null; depth: number | null };
function costLinesOf(lines: { name: string; options: { label: string; value: string }[] }[]): CostLine[] {
  return lines
    .map((l) => {
      const led = metresOf(optValue(l.options, "LED Length"));
      const outline = metresOf(optValue(l.options, "3D Outline"));
      if (led == null && outline == null) return null;
      return { name: l.name, led, outline, depth: boxupDepthCm(l.options) };
    })
    .filter((c): c is CostLine => c !== null);
}

export default function AdminOrders() {
  const [rows, setRows] = useState<AdminOrderRow[]>([]);
  const [savingReloadId, setSavingReloadId] = useState<number | null>(null);
  // Reload detail drawer — keyed by row id so it always reflects the latest
  // row state (collected/rejected) after an action, without a refetch.
  const [reloadDetailId, setReloadDetailId] = useState<number | null>(null);
  const [statuses, setStatuses] = useState<{ value: string; label: string }[]>([]);
  const [statusCounts, setStatusCounts] = useState<{ value: string; label: string; count: number }[]>([]);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [month, setMonth] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Detail drawer (legacy)
  const [detail, setDetail] = useState<OrderDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);

  // Detail drawer (native)
  const [nativeStatuses, setNativeStatuses] = useState<{ value: string; label: string }[]>([]);
  const [nativeDetail, setNativeDetail] = useState<NativeOrderDetail | null>(null);
  const [savingItemId, setSavingItemId] = useState<number | null>(null);
  const [dbxPushing, setDbxPushing] = useState(false);
  // Inline "swap a same-price option" editor: which item+label is open, its draft value.
  const [editOpt, setEditOpt] = useState<{ itemId: number; label: string } | null>(null);
  const [editOptValue, setEditOptValue] = useState("");
  const [savingOpt, setSavingOpt] = useState(false);
  // "Out for Delivery" collects courier + tracking + phone, emailed to the customer.
  // `all` marks the bulk "set every item" flow.
  const [deliveryModal, setDeliveryModal] = useState<{ itemId?: number; itemName?: string; all?: boolean; edit?: boolean } | null>(null);
  const [dlvCourier, setDlvCourier] = useState("DHL");
  const [dlvCourierOther, setDlvCourierOther] = useState("");
  const [dlvTracking, setDlvTracking] = useState("");
  const [dlvPhone, setDlvPhone] = useState("");
  const [bulkStatus, setBulkStatus] = useState("");
  const [savingAll, setSavingAll] = useState(false);

  const load = useCallback(async (p: number, searchTerm: string, statusFilter: string, monthFilter: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.adminOrders({
        page: p,
        perPage: PER_PAGE,
        search: searchTerm || undefined,
        status: statusFilter || undefined,
        month: monthFilter || undefined,
      });
      setRows(res.data);
      setLastPage(res.meta.lastPage);
      setTotal(res.meta.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load orders");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    api.adminOrderStatuses().then((r) => setStatuses(r.data)).catch(() => setStatuses([]));
    api.adminNativeStatuses().then((r) => setNativeStatuses(r.data)).catch(() => setNativeStatuses([]));
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      setPage(1);
      void load(1, search, status, month);
    }, 300);
    return () => clearTimeout(t);
  }, [search, status, month, load]);

  useEffect(() => {
    void load(page, search, status, month);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  // Per-status counts for the clickable chips — depend on search + month only
  // (they always show every status, regardless of which one is selected).
  useEffect(() => {
    const t = setTimeout(() => {
      api
        .adminOrderStatusCounts({ search: search || undefined, month: month || undefined })
        .then((r) => setStatusCounts(r.data))
        .catch(() => setStatusCounts([]));
    }, 300);
    return () => clearTimeout(t);
  }, [search, month]);

  function closeDrawer() {
    setDetail(null);
    setNativeDetail(null);
    setReloadDetailId(null);
  }

  async function openDetail(row: AdminOrderRow) {
    closeDrawer();
    setDetailLoading(true);
    try {
      if (row.source === "native") {
        setNativeDetail(await api.adminNativeOrder(row.id));
      } else {
        setDetail(await api.adminOrder(row.id));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load order");
    } finally {
      setDetailLoading(false);
    }
  }

  /** Legacy status change — WooCommerce order, with a confirmation. */
  async function changeStatus(newStatus: string) {
    if (!detail) return;
    const label = statuses.find((s) => s.value === newStatus)?.label ?? newStatus;
    if (!window.confirm(`Change order #${detail.id} status to "${label}"?`)) return;
    setSavingStatus(true);
    try {
      await api.adminUpdateOrderStatus(detail.id, newStatus);
      setDetail((d) => (d ? { ...d, status: newStatus } : d));
      await load(page, search, status, month);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update status");
    } finally {
      setSavingStatus(false);
    }
  }

  /** Native status change — confirms, then emails the customer. */
  // Per-item status: cancelling/refunding a single line refunds only that line.
  async function changeNativeItemStatus(itemId: number, newStatus: string, itemName: string) {
    if (!nativeDetail) return;
    // "Out for Delivery" (shipped) → collect courier / tracking / phone first;
    // the actual status change happens when that modal is submitted.
    if (newStatus === "shipped") {
      setDlvCourier("DHL");
      setDlvCourierOther("");
      setDlvTracking("");
      setDlvPhone("");
      setDeliveryModal({ itemId, itemName });
      return;
    }
    const label = nativeStatuses.find((s) => s.value === newStatus)?.label ?? newStatus;
    const refunds = newStatus === "cancelled" || newStatus === "refunded";
    if (
      !window.confirm(
        `Set "${itemName}" to "${label}"?` +
          (refunds ? "\n\nThis refunds ONLY this item's amount to the customer's wallet and emails them." : "\n\nThe customer will be emailed."),
      )
    )
      return;
    setSavingItemId(itemId);
    try {
      await api.adminUpdateNativeItemStatus(nativeDetail.id, itemId, newStatus);
      setNativeDetail(await api.adminNativeOrder(nativeDetail.id));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Could not update item status");
    } finally {
      setSavingItemId(null);
    }
  }

  // Manually push (or re-push) this order's files to SF Dropbox now.
  async function pushDropbox() {
    if (!nativeDetail) return;
    setDbxPushing(true);
    try {
      const r = await api.adminDropboxPush(nativeDetail.id);
      if (!r.success) alert(r.error || "Dropbox push failed. Check SF Dropbox settings.");
      setNativeDetail(await api.adminNativeOrder(nativeDetail.id));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Could not push to Dropbox");
    } finally {
      setDbxPushing(false);
    }
  }

  // Swap a same-price option (e.g. filament colour) on one item. Price is
  // unchanged; the change is logged to the order history (no customer email).
  async function saveItemOption() {
    if (!nativeDetail || !editOpt) return;
    setSavingOpt(true);
    try {
      await api.adminUpdateNativeItemOption(nativeDetail.id, editOpt.itemId, editOpt.label, editOptValue);
      setNativeDetail(await api.adminNativeOrder(nativeDetail.id));
      setEditOpt(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Could not update option");
    } finally {
      setSavingOpt(false);
    }
  }

  // Set EVERY item to one status in one action → one combined customer email.
  async function applyAllItemsStatus(newStatus: string) {
    if (!nativeDetail || !newStatus) return;
    if (newStatus === "shipped") {
      setDlvCourier("DHL");
      setDlvCourierOther("");
      setDlvTracking("");
      setDlvPhone("");
      setDeliveryModal({ all: true });
      return;
    }
    const label = nativeStatuses.find((s) => s.value === newStatus)?.label ?? newStatus;
    const refunds = newStatus === "cancelled" || newStatus === "refunded";
    if (
      !window.confirm(
        `Set ALL ${nativeDetail.lines.length} items to "${label}"?` +
          (refunds ? "\n\nThis refunds EVERY item's amount to the customer's wallet." : "") +
          "\n\nThe customer gets ONE email covering all items.",
      )
    )
      return;
    setSavingAll(true);
    try {
      await api.adminUpdateAllNativeItemsStatus(nativeDetail.id, newStatus);
      setNativeDetail(await api.adminNativeOrder(nativeDetail.id));
      setBulkStatus("");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Could not update items");
    } finally {
      setSavingAll(false);
    }
  }

  // Open the delivery modal pre-filled to EDIT an already-shipped item's details.
  function openEditDelivery(itemId: number, itemName: string, note: string) {
    const map: Record<string, string> = {};
    note.split(new RegExp("\\s*[\\u00B7\\u2022\\u2219\\u30FB]\\s*|\\n|;")).forEach((p) => {
      const i = p.indexOf(":");
      if (i !== -1) map[p.slice(0, i).trim().toLowerCase()] = p.slice(i + 1).trim();
    });
    const courier = map["courier"] || "";
    const known = ["DHL", "Xendnow", "J&T", "Easy Parcel", "Ninja Van"];
    if (courier && known.includes(courier)) {
      setDlvCourier(courier);
      setDlvCourierOther("");
    } else {
      setDlvCourier("Other");
      setDlvCourierOther(courier);
    }
    setDlvTracking(map["tracking no"] || map["tracking"] || "");
    setDlvPhone(map["contact"] || map["phone"] || "");
    setDeliveryModal({ itemId, itemName, edit: true });
  }

  // Confirm "Out for Delivery" with the courier details; sent as the status
  // note, so it lands in the status history AND the customer's email. Handles
  // a single item, the bulk "all items" flow, and editing an existing shipment.
  async function submitDeliveryStatus() {
    if (!nativeDetail || !deliveryModal) return;
    const courier = dlvCourier === "Other" ? dlvCourierOther.trim() || "Other" : dlvCourier;
    if (!dlvTracking.trim() && !dlvPhone.trim()) {
      alert("Please enter a tracking number or a contact phone.");
      return;
    }
    const parts = [`Courier: ${courier}`];
    if (dlvTracking.trim()) parts.push(`Tracking No: ${dlvTracking.trim()}`);
    if (dlvPhone.trim()) parts.push(`Contact: ${dlvPhone.trim()}`);
    const note = parts.join(" · ");
    const bulk = !!deliveryModal.all;
    const edit = !!deliveryModal.edit;
    const itemId = deliveryModal.itemId;
    setDeliveryModal(null);
    if (edit && itemId != null) {
      setSavingItemId(itemId);
      try {
        await api.adminUpdateNativeItemDelivery(nativeDetail.id, itemId, note);
        setNativeDetail(await api.adminNativeOrder(nativeDetail.id));
      } catch (err) {
        alert(err instanceof Error ? err.message : "Could not update delivery details");
      } finally {
        setSavingItemId(null);
      }
      return;
    }
    if (bulk) {
      setSavingAll(true);
      try {
        await api.adminUpdateAllNativeItemsStatus(nativeDetail.id, "shipped", note);
        setNativeDetail(await api.adminNativeOrder(nativeDetail.id));
        setBulkStatus("");
      } catch (err) {
        alert(err instanceof Error ? err.message : "Could not update items");
      } finally {
        setSavingAll(false);
      }
      return;
    }
    if (itemId == null) return;
    setSavingItemId(itemId);
    try {
      await api.adminUpdateNativeItemStatus(nativeDetail.id, itemId, "shipped", note);
      setNativeDetail(await api.adminNativeOrder(nativeDetail.id));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Could not update item status");
    } finally {
      setSavingItemId(null);
    }
  }

  // Reload rows: Collected credits a manual top-up's wallet (gateway ones are
  // already credited — then it's a bookkeeping flag). Undo reverses the flag.
  async function collectReload(o: AdminOrderRow) {
    if (savingReloadId) return;
    const next = !o.collected;
    if (next && o.manual && !window.confirm(
      `Confirm you have verified the RM ${money(o.total)} bank-transfer receipt from ${o.customer}?\n\nThis credits their wallet immediately.`,
    )) return;
    setSavingReloadId(o.id);
    try {
      await api.adminSetReloadCollected(o.id, next);
      setRows((rs) =>
        rs.map((x) =>
          x.source === "reload" && x.id === o.id
            ? {
                ...x,
                collected: next,
                rejected: false,
                status: next ? "collection" : "pending_confirmation",
                statusLabel: next ? "Collected" : "Pending Confirmation",
              }
            : x,
        ),
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : "Could not update the reload");
    } finally {
      setSavingReloadId(null);
    }
  }

  // Reject a manual bank-transfer top-up (fake/unmatched receipt) — never
  // credits the wallet. Toggles back to Pending Confirmation on undo.
  async function rejectReload(o: AdminOrderRow) {
    if (savingReloadId) return;
    const next = !o.rejected;
    if (next && !window.confirm(
      `Reject the RM ${money(o.total)} bank transfer from ${o.customer}?\n\nThe wallet will NOT be credited.`,
    )) return;
    setSavingReloadId(o.id);
    try {
      await api.adminSetReloadRejected(o.id, next);
      setRows((rs) =>
        rs.map((x) =>
          x.source === "reload" && x.id === o.id
            ? {
                ...x,
                rejected: next,
                status: next ? "failed" : "pending_confirmation",
                statusLabel: next ? "Rejected" : "Pending Confirmation",
              }
            : x,
        ),
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : "Could not reject the reload");
    } finally {
      setSavingReloadId(null);
    }
  }

  const reloadDetail =
    reloadDetailId != null
      ? rows.find((r) => r.source === "reload" && r.id === reloadDetailId) ?? null
      : null;

  return (
    <div className="adm-wrap">
      <div className="adm-toolbar">
        <input
          className="adm-search"
          type="search"
          placeholder="Search order #, name or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="adm-select"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          aria-label="Filter by month"
        >
          <option value="">All dates</option>
          {MONTH_OPTIONS.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
        <select
          className="adm-select"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">All statuses</option>
          {statuses.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      {statusCounts.length > 0 && (
        <div className="adm-status-chips">
          <button
            type="button"
            className={`adm-status-chip${status === "" ? " is-active" : ""}`}
            onClick={() => setStatus("")}
          >
            All <span className="adm-status-chip-n">{statusCounts.reduce((a, s) => a + s.count, 0).toLocaleString()}</span>
          </button>
          {statusCounts
            .filter((s) => !HIDDEN_STATUS_CHIPS.has(s.label))
            .map((s) => (
              <button
                key={s.value}
                type="button"
                className={`adm-status-chip${status === s.value ? " is-active" : ""}`}
                onClick={() => setStatus(s.value)}
              >
                {s.label} <span className="adm-status-chip-n">{s.count.toLocaleString()}</span>
              </button>
            ))}
        </div>
      )}

      <div className="adm-count">
        {loading ? "Loading…" : `${total.toLocaleString()} order${total === 1 ? "" : "s"}`}
      </div>

      {error && <div className="quote-empty">{error}</div>}

      <div className="adm-table-scroll">
        <table className="adm-table">
          <thead>
            <tr>
              <th>Order</th>
              <th>Customer</th>
              <th>Email</th>
              <th>Date</th>
              <th>Status</th>
              <th className="adm-docs-col">Docs</th>
              <th className="adm-num">Total (RM)</th>
              <th className="adm-num">Items</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading && rows.length === 0 && (
              <tr>
                <td colSpan={9} className="adm-empty">
                  Loading orders…
                </td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={9} className="adm-empty">
                  No orders match.
                </td>
              </tr>
            )}
            {rows.map((o) => (
              <tr key={`${o.source ?? "legacy"}-${o.id}`} className={o.source === "reload" ? "adm-reload-row" : undefined}>
                <td className="adm-mono">
                  {o.source === "reload" ? `RL-${o.id}` : o.source === "native" ? o.ref : `#${o.id}`}
                  {o.source === "native" && <span className="adm-chip adm-stage-completed adm-new-badge">NEW</span>}
                  {o.source === "reload" && <span className="adm-chip adm-reload-badge adm-new-badge">RELOAD</span>}
                </td>
                <td>
                  {o.customerId ? (
                    <Link href={`/admin/users/${o.customerId}`} className="adm-edit-link">
                      {o.customer}
                    </Link>
                  ) : (
                    o.customer
                  )}
                </td>
                <td className="adm-email">{o.email || "—"}</td>
                <td className="adm-date">{formatDate(o.date)}</td>
                <td>
                  {o.source === "native" && o.jobStatuses && o.jobStatuses.length > 0 ? (
                    <span className="adm-jstats">
                      {distinctStatuses(o.jobStatuses).map((v) => (
                        <span key={v} className={jobStatusClass(v)}>
                          {nativeStatuses.find((s) => s.value === v)?.label ?? STATUS_LABEL_FALLBACK[v] ?? v}
                        </span>
                      ))}
                    </span>
                  ) : (
                    <span
                      className={
                        o.source === "reload"
                          ? `adm-chip ${o.collected ? "adm-jstat-completed" : o.rejected ? "adm-jstat-cancelled" : "adm-jstat-pending_confirmation"}`
                          : o.source === "native"
                            ? jobStatusClass(o.status)
                            : stageClass(o.stage)
                      }
                    >
                      {o.statusLabel}
                    </span>
                  )}
                </td>
                <td className="adm-docs-col">
                  {o.source === "native" ? (
                    <span className="adm-doc-actions">
                      <button
                        type="button"
                        className="adm-doc-btn"
                        title="Download invoice PDF"
                        aria-label="Download invoice PDF"
                        onClick={() =>
                          api
                            .downloadAdminNativeInvoice(o.id, `Sign Future INV-${o.ref}`)
                            .catch((e) => alert(e instanceof Error ? e.message : "Could not download invoice"))
                        }
                      >
                        🧾
                      </button>
                      <button
                        type="button"
                        className="adm-doc-btn"
                        title="Download Job Order (production)"
                        aria-label="Download Job Order (production)"
                        onClick={() =>
                          api
                            .downloadAdminNativeJobOrder(o.id, `${fileDate(o.date)} Job-${o.ref}`)
                            .catch((e) => alert(e instanceof Error ? e.message : "Could not download job order"))
                        }
                      >
                        🛠
                      </button>
                    </span>
                  ) : null}
                </td>
                <td className="adm-num adm-mono">{money(o.total)}</td>
                <td className="adm-num">{o.source === "reload" ? "—" : o.itemCount}</td>
                <td>
                  {o.source === "reload" ? (
                    <button type="button" className="adm-view-btn adm-view-gold" onClick={() => setReloadDetailId(o.id)}>
                      View →
                    </button>
                  ) : (
                    <button type="button" className="adm-view-btn" onClick={() => openDetail(o)}>
                      View →
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {lastPage > 1 && (
        <div className="adm-pager">
          <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
            ← Prev
          </button>
          <span>
            Page {page} of {lastPage}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(lastPage, p + 1))}
            disabled={page >= lastPage}
          >
            Next →
          </button>
        </div>
      )}

      {/* Reload (top-up) drawer — verify the receipt, then Collect or Fail. */}
      {reloadDetail && (
        <div className="adm-modal-overlay" onClick={closeDrawer}>
          <div className="adm-modal adm-drawer adm-reload-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="adm-card-head-row">
              <h2>
                Reload RL-{reloadDetail.id}{" "}
                <span className="adm-chip adm-chip-member adm-new-badge">RELOAD</span>
                <span
                  className={`adm-chip adm-new-badge ${
                    reloadDetail.collected
                      ? "adm-jstat-completed"
                      : reloadDetail.rejected
                        ? "adm-jstat-cancelled"
                        : "adm-jstat-pending_confirmation"
                  }`}
                >
                  {reloadDetail.statusLabel}
                </span>
              </h2>
              <button type="button" className="adm-logout" onClick={closeDrawer}>
                Close
              </button>
            </div>
            <div className="adm-drawer-meta">
              <div>
                <span className="adm-key-label">Placed</span>
                {formatDateTime(reloadDetail.date)}
              </div>
              <div>
                <span className="adm-key-label">Amount</span>
                RM {money(reloadDetail.total)}
              </div>
              <div>
                <span className="adm-key-label">Method</span>
                {reloadDetail.manual ? "Bank transfer (manual)" : "Online payment"}
              </div>
              <div>
                <span className="adm-key-label">Customer</span>
                {reloadDetail.customerId ? (
                  <Link href={`/admin/users/${reloadDetail.customerId}`} className="adm-edit-link">
                    {reloadDetail.customer}
                  </Link>
                ) : (
                  reloadDetail.customer
                )}
              </div>
              {reloadDetail.email && (
                <div>
                  <span className="adm-key-label">Email</span>
                  {reloadDetail.email}
                </div>
              )}
            </div>

            {reloadDetail.manual && (
              <>
                <h3 className="adm-drawer-sub">Transfer receipt</h3>
                {reloadDetail.receiptUrl ? (
                  <a
                    href={downloadHref({ url: reloadDetail.receiptUrl, name: "transfer receipt" })}
                    target="_blank"
                    rel="noreferrer"
                    className="adm-artwork-chip"
                  >
                    ↓ Download the member's uploaded receipt
                  </a>
                ) : (
                  <p className="adm-card-sub">No receipt uploaded.</p>
                )}
              </>
            )}

            <h3 className="adm-drawer-sub">Action</h3>
            <p className="adm-card-sub" style={{ marginTop: -4 }}>
              {reloadDetail.manual
                ? "Verify the receipt against your bank before collecting. Collecting credits the member's wallet immediately; Fail credits nothing."
                : "Online payment — the wallet was already credited. Collected is a bookkeeping flag."}
            </p>
            <div className="adm-reload-drawer-actions">
              {reloadDetail.rejected ? (
                <button
                  type="button"
                  className="adm-filter"
                  disabled={savingReloadId === reloadDetail.id}
                  onClick={() => rejectReload(reloadDetail)}
                >
                  {savingReloadId === reloadDetail.id ? "Saving…" : "↩ Undo reject"}
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    className={`adm-filter${reloadDetail.collected ? "" : " is-active"}`}
                    disabled={savingReloadId === reloadDetail.id}
                    onClick={() => collectReload(reloadDetail)}
                  >
                    {savingReloadId === reloadDetail.id
                      ? "Saving…"
                      : reloadDetail.collected
                        ? "↩ Undo collected"
                        : "✓ Collected"}
                  </button>
                  {reloadDetail.manual && !reloadDetail.collected && (
                    <button
                      type="button"
                      className="adm-filter adm-filter-danger"
                      disabled={savingReloadId === reloadDetail.id}
                      onClick={() => rejectReload(reloadDetail)}
                    >
                      ✗ Fail
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Native order drawer */}
      {nativeDetail && (
        <div className="adm-modal-overlay" onClick={closeDrawer}>
          <div className="adm-modal adm-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="adm-card-head-row">
              <h2>
                Order {nativeDetail.ref} <span className="adm-chip adm-stage-completed adm-new-badge">NEW</span>
                {nativeDetail.placedByAgent && <span className="adm-chip adm-stage-cancelled adm-new-badge">代理下单{nativeDetail.agentLabel ? ` · ${nativeDetail.agentLabel}` : ""}</span>}
              </h2>
              <button type="button" className="adm-logout" onClick={closeDrawer}>Close</button>
            </div>
            <div className="adm-drawer-meta">
              <div><span className="adm-key-label">Placed</span>{formatDateTime(nativeDetail.date)}</div>
              {nativeDetail.minAdjustment > 0 && (
                <div><span className="adm-key-label">Min. charge</span>+RM {money(nativeDetail.minAdjustment)} (below RM15)</div>
              )}
              <div><span className="adm-key-label">Total</span>RM {money(nativeDetail.total)}</div>
              <div><span className="adm-key-label">Payment</span>{nativeDetail.paymentMethod}{nativeDetail.paidAt ? " (paid)" : ""}</div>
              <div><span className="adm-key-label">Delivery</span>{nativeDetail.deliveryMethod ?? "—"}</div>
              <div><span className="adm-key-label">Collect</span>
                {nativeDetail.lines.map((l, i) => {
                  const wd = workingDaysOf(l.options, nativeDetail.date);
                  return (
                    <span key={l.id} style={{ display: "block" }}>
                      {nativeDetail.ref}-{i + 1} (
                      <span style={{ color: workingDaysColor(wd), fontWeight: 700 }}>{wd}</span>)
                    </span>
                  );
                })}
              </div>
              {nativeDetail.customerId ? (
                <div><span className="adm-key-label">Customer</span>
                  <Link href={`/admin/users/${nativeDetail.customerId}`} className="adm-edit-link">{nativeDetail.customer ?? "—"}</Link>
                </div>
              ) : null}
            </div>

            {/* Order-level status removed — each line item now carries its own
                status (see "Line items — each can be handled separately"). */}
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 8 }}>
              <button
                type="button"
                className="adm-edit-link"
                style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}
                onClick={() =>
                  api
                    .downloadAdminNativeInvoice(nativeDetail.id, `Sign Future INV-${nativeDetail.ref}`)
                    .catch((e) => alert(e instanceof Error ? e.message : "Could not open invoice"))
                }
              >
                ↓ Download invoice PDF
              </button>
              <button
                type="button"
                className="adm-edit-link"
                style={{ background: "none", border: "none", cursor: "pointer", padding: 0, fontWeight: 700 }}
                onClick={() =>
                  api
                    .downloadAdminNativeJobOrder(nativeDetail.id, `${fileDate(nativeDetail.date)} Job-${nativeDetail.ref}`)
                    .catch((e) => alert(e instanceof Error ? e.message : "Could not open job order"))
                }
              >
                🛠 Download Job Order (production)
              </button>
            </div>

            {/* SF Dropbox sync status for this order. */}
            <div className="dbx-order-row">
              <span className="dbx-order-icon" aria-hidden="true">🗂</span>
              <div className="dbx-order-main">
                {nativeDetail.dropbox ? (
                  <>
                    <span
                      className={`adm-chip ${
                        nativeDetail.dropbox.status === "synced"
                          ? nativeDetail.dropbox.done
                            ? "dbx-done"
                            : "dbx-ok"
                          : nativeDetail.dropbox.status === "failed"
                            ? "dbx-off"
                            : "dbx-pending"
                      }`}
                    >
                      {nativeDetail.dropbox.status === "synced"
                        ? nativeDetail.dropbox.done
                          ? "In Done"
                          : "In SF Dropbox"
                        : nativeDetail.dropbox.status === "failed"
                          ? "SF Dropbox failed"
                          : "Pending"}
                    </span>
                    <span className="dbx-order-meta">
                      {nativeDetail.dropbox.filesCount} file
                      {nativeDetail.dropbox.filesCount === 1 ? "" : "s"}
                    </span>
                    <a href="/admin/dropbox" className="adm-link">
                      Open in SF Dropbox →
                    </a>
                    {nativeDetail.dropbox.status === "failed" && nativeDetail.dropbox.error && (
                      <span className="dbx-order-err">{nativeDetail.dropbox.error}</span>
                    )}
                  </>
                ) : (
                  <span className="dbx-order-meta">
                    Not in SF Dropbox yet — added automatically when set to Processing.
                  </span>
                )}
              </div>
              <button
                type="button"
                className="adm-edit-link dbx-order-push"
                onClick={pushDropbox}
                disabled={dbxPushing}
              >
                {dbxPushing ? "Pushing…" : nativeDetail.dropbox ? "Re-push" : "Push now"}
              </button>
            </div>

            {nativeDetail.artworks && nativeDetail.artworks.length > 0 && (
              <>
                <h3 className="adm-drawer-sub">Artwork ({nativeDetail.artworks.length}) — for review</h3>
                <div className="adm-artwork-list">
                  {nativeDetail.artworks.map((a, i) => (
                    <a key={a.url} href={downloadHref(a)} target="_blank" rel="noreferrer" className="adm-artwork-chip">
                      ↓ {a.name || `File ${i + 1}`}
                    </a>
                  ))}
                </div>
              </>
            )}

            <h3 className="adm-drawer-sub">Line items — each can be handled separately</h3>
            {nativeDetail.lines.length > 1 && (
              <div className="adm-setall">
                <span>Set all {nativeDetail.lines.length} items to:</span>
                <select
                  className="adm-select"
                  value={bulkStatus}
                  disabled={savingAll}
                  onChange={(e) => setBulkStatus(e.target.value)}
                >
                  <option value="">Choose status…</option>
                  {statusTiers(nativeStatuses).map((g) => (
                    <optgroup key={g.label} label={g.label}>
                      {g.items.map((s) => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                <button
                  type="button"
                  className="hero-btn primary adm-setall-btn"
                  disabled={!bulkStatus || savingAll}
                  onClick={() => applyAllItemsStatus(bulkStatus)}
                >
                  {savingAll ? "Saving…" : "Apply to all"}
                </button>
              </div>
            )}
            <div className="adm-lineitems">
              <table className="adm-table">
                <thead><tr><th>Item</th><th className="adm-num">Qty</th><th className="adm-num">Total</th><th>Item status</th></tr></thead>
                <tbody>
                  {nativeDetail.lines.map((l, i) => {
                    const done = l.status === "cancelled" || l.status === "refunded";
                    return (
                    <tr key={l.id}>
                      <td>
                        <strong className="adm-job-no">{nativeDetail.ref}-{i + 1}</strong>{" "}
                        {l.name}
                        {l.options.filter((o) => !COST_OPTION_LABELS.has(o.label)).length > 0 && (
                          <div className="adm-line-opts">
                            {l.options.filter((o) => !COST_OPTION_LABELS.has(o.label)).map((o) => {
                              const choices = SWAPPABLE_OPTIONS[o.label];
                              // Only offer editing when EVERY current value is already
                              // in the same-price group — otherwise a swap could change
                              // the price (e.g. LED "None"/"RGB" → a white temperature).
                              const canEdit =
                                !!choices &&
                                o.value.split(" / ").map((p) => p.trim()).filter(Boolean).every((p) => choices.includes(p));
                              const editing = editOpt?.itemId === l.id && editOpt?.label === o.label;
                              if (editing) {
                                // 3D Filament Color can need 2 colours (Side Finishing
                                // Option 2/3); other multi-value options (e.g. Neon
                                // Color) keep however many colours they already have.
                                const slots =
                                  o.label === "3D Filament Color"
                                    ? filamentSlots(l.options)
                                    : Math.max(1, editOptValue.split(" / ").filter((p) => p.trim()).length);
                                const cur = editOptValue.split(" / ");
                                const parts = Array.from({ length: slots }, (_, pi) =>
                                  choices!.includes(cur[pi]) ? cur[pi] : choices!.includes(cur[cur.length - 1]) ? cur[cur.length - 1] : choices![0],
                                );
                                return (
                                  <span key={o.label} className="adm-opt-edit">
                                    {o.label}:{" "}
                                    {parts.map((part, pi) => (
                                      <select
                                        key={pi}
                                        className="adm-select adm-opt-select"
                                        value={part}
                                        disabled={savingOpt}
                                        onChange={(e) => {
                                          const next = [...parts];
                                          next[pi] = e.target.value;
                                          setEditOptValue(next.join(" / "));
                                        }}
                                      >
                                        {choices!.map((v) => <option key={v} value={v}>{v}</option>)}
                                      </select>
                                    ))}
                                    <button type="button" className="adm-edit-link" disabled={savingOpt} onClick={saveItemOption}>
                                      {savingOpt ? "Saving…" : "Save"}
                                    </button>
                                    <button type="button" className="adm-edit-link adm-opt-cancel" disabled={savingOpt} onClick={() => setEditOpt(null)}>
                                      Cancel
                                    </button>
                                  </span>
                                );
                              }
                              return (
                                <span key={o.label}>
                                  {o.label}: {displayOptionValue(o.value, nativeDetail.date)}
                                  {canEdit && (
                                    <button
                                      type="button"
                                      className="adm-opt-pencil"
                                      title={`Change ${o.label} (same price)`}
                                      onClick={() => {
                                        const cur = o.value.split(" / ").map((p) => p.trim()).filter(Boolean);
                                        const sane = (cur.length ? cur : [choices![0]]).map((p) => (choices!.includes(p) ? p : choices![0]));
                                        setEditOpt({ itemId: l.id, label: o.label });
                                        setEditOptValue(sane.join(" / "));
                                      }}
                                    >
                                      ✎
                                    </button>
                                  )}
                                </span>
                              );
                            })}
                          </div>
                        )}
                        {(() => {
                          // Show every file on the line — e.g. the 3D wording
                          // artwork AND the optional Draft Paper — each downloadable.
                          let arts = l.artworks && l.artworks.length ? l.artworks : null;
                          if (!arts) {
                            // Older orders have no per-line artworks. When the whole
                            // order is a single line, its order-level artworks ARE
                            // this line's files — show them all.
                            if (nativeDetail.lines.length === 1 && nativeDetail.artworks && nativeDetail.artworks.length) {
                              arts = nativeDetail.artworks;
                            } else {
                              arts = l.artworkUrl ? [{ url: l.artworkUrl, name: "Artwork" }] : [];
                            }
                          }
                          if (!arts.length) return null;
                          return (
                            <div className="adm-line-opts">
                              {arts.map((a, ai) => (
                                <a key={ai} href={downloadHref(a)} target="_blank" rel="noreferrer" className="adm-edit-link" style={{ marginRight: 12 }}>↓ {a.name || "Artwork"}</a>
                              ))}
                            </div>
                          );
                        })()}
                        {l.refundedAt && <div className="adm-line-opts"><span style={{ color: "#9fe6c0" }}>Refunded RM {money(l.total)}</span></div>}
                      </td>
                      <td className="adm-num">{l.quantity}</td>
                      <td className={`adm-num adm-mono${done ? " " : ""}`} style={done ? { textDecoration: "line-through", opacity: 0.6 } : undefined}>{money(l.total)}</td>
                      <td>
                        <select
                          className="adm-select"
                          value={l.status}
                          disabled={savingItemId === l.id}
                          onChange={(e) => changeNativeItemStatus(l.id, e.target.value, l.name)}
                        >
                          {statusTiers(nativeStatuses).map((g) => (
                            <optgroup key={g.label} label={g.label}>
                              {g.items.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                            </optgroup>
                          ))}
                        </select>
                        {savingItemId === l.id && <em className="adm-card-sub"> Saving…</em>}
                        {l.status === "shipped" && l.deliveryNote && (
                          <div className="adm-delivery-box">
                            <div className="adm-delivery-head">
                              <span>🚚 Delivery details</span>
                              <button
                                type="button"
                                className="adm-edit-link adm-delivery-edit"
                                onClick={() => openEditDelivery(l.id, l.name, l.deliveryNote || "")}
                              >
                                ✎ Edit
                              </button>
                            </div>
                            {l.deliveryNote
                              .split(new RegExp("\\s*[\\u00B7\\u2022\\u2219\\u30FB]\\s*|\\n|;"))
                              .map((s) => s.trim())
                              .filter(Boolean)
                              .map((piece, pi) => (
                                <div key={pi} className="adm-delivery-line">{piece}</div>
                              ))}
                          </div>
                        )}
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Cost estimate — LED metres + 3D-print material metres (box-up). */}
            {(() => {
              const cost = costLinesOf(nativeDetail.lines);
              if (!cost.length) return null;
              return (
                <>
                  <h3 className="adm-drawer-sub">Cost estimate</h3>
                  <div className="adm-cost">
                    {cost.map((c, i) => (
                      <div key={i} className="adm-cost-card">
                        <strong className="adm-cost-name">{c.name}{c.depth ? ` · ${c.depth}cm box up` : ""}</strong>
                        <div className="adm-cost-rows">
                          {c.led != null && (
                            <div className="adm-cost-row"><span>LED strip</span><strong>{c.led.toFixed(2)} m</strong></div>
                          )}
                          {c.outline != null && (
                            <>
                              <div className="adm-cost-row"><span>3D outline</span><strong>{c.outline.toFixed(2)} m</strong></div>
                              {c.depth != null ? (
                                <div className="adm-cost-row is-ordered">
                                  <span>3D material ({c.depth}cm)</span>
                                  <strong>{(c.outline * (c.depth === 5 ? 500 / 3 : (c.depth * 10) / 0.3)).toFixed(1)} m</strong>
                                </div>
                              ) : (
                                <>
                                  <div className="adm-cost-row"><span>3D material @ 3cm</span><strong>{(c.outline * 100).toFixed(1)} m</strong></div>
                                  <div className="adm-cost-row"><span>3D material @ 5cm</span><strong>{(c.outline * (500 / 3)).toFixed(1)} m</strong></div>
                                </>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="adm-cost-hint">Material length ≈ outline × (depth ÷ 0.3mm layer). LED strip = concentric-ring fill at 2cm spacing.</p>
                </>
              );
            })()}

            {nativeDetail.notes && (
              <>
                <h3 className="adm-drawer-sub">Notes</h3>
                <p className="adm-drawer-addr">{nativeDetail.notes}</p>
              </>
            )}

            <h3 className="adm-drawer-sub">Status history</h3>
            <div className="adm-line-opts" style={{ flexDirection: "column", gap: 4 }}>
              {nativeDetail.history.map((h, i) => (
                <span key={i}>
                  {formatDateTime(h.date)} — {h.from ? `${h.from} → ` : ""}{h.to}{h.note ? ` · ${h.note}` : ""}
                  {h.by ? <span style={{ color: "var(--cyan)" }}> · by {h.by}</span> : ""}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {(detail || detailLoading) && (
        <div className="adm-modal-overlay" onClick={() => setDetail(null)}>
          <div className="adm-modal adm-drawer" onClick={(e) => e.stopPropagation()}>
            {detailLoading || !detail ? (
              <p>Loading order…</p>
            ) : (
              <>
                <div className="adm-card-head-row">
                  <h2>Order #{detail.id}</h2>
                  <button type="button" className="adm-logout" onClick={() => setDetail(null)}>
                    Close
                  </button>
                </div>
                <div className="adm-drawer-meta">
                  <div>
                    <span className="adm-key-label">Placed</span>
                    {formatDateTime(detail.date)}
                  </div>
                  <div>
                    <span className="adm-key-label">Total</span>
                    RM {money(detail.total)}
                  </div>
                  <div>
                    <span className="adm-key-label">Payment</span>
                    {detail.paymentMethod ?? "—"}
                  </div>
                  {detail.invoiceNumber && (
                    <div>
                      <span className="adm-key-label">Invoice</span>
                      {detail.invoiceNumber}
                    </div>
                  )}
                </div>

                <label className="adm-modal-field">
                  <span>Status</span>
                  <select
                    className="adm-select"
                    value={detail.status}
                    disabled={savingStatus}
                    onChange={(e) => changeStatus(e.target.value)}
                  >
                    {/* Ensure the current value is selectable even if custom. */}
                    {!statuses.some((s) => s.value === detail.status) && (
                      <option value={detail.status}>{detail.statusLabel}</option>
                    )}
                    {statuses.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                  {savingStatus && <em className="adm-card-sub">Saving…</em>}
                </label>

                <h3 className="adm-drawer-sub">Line items</h3>
                <div className="adm-table-scroll">
                  <table className="adm-table">
                    <thead>
                      <tr>
                        <th>Item</th>
                        <th className="adm-num">Qty</th>
                        <th className="adm-num">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.lines.map((l) => (
                        <tr key={l.id}>
                          <td>
                            {l.name}
                            {l.options.length > 0 && (
                              <div className="adm-line-opts">
                                {l.options.map((o) => (
                                  <span key={o.label}>
                                    {o.label}: {o.value}
                                  </span>
                                ))}
                              </div>
                            )}
                          </td>
                          <td className="adm-num">{l.quantity || "—"}</td>
                          <td className="adm-num adm-mono">{money(l.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="adm-drawer-addr">
                  <div>
                    <h3 className="adm-drawer-sub">Billing</h3>
                    <p>
                      {[detail.billing.first_name, detail.billing.last_name]
                        .filter(Boolean)
                        .join(" ") || "—"}
                      <br />
                      {detail.billing.email}
                      <br />
                      {detail.billing.phone}
                      <br />
                      {[detail.billing.address_1, detail.billing.city, detail.billing.postcode]
                        .filter(Boolean)
                        .join(", ")}
                    </p>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {deliveryModal && (
        <div className="adm-modal-overlay">
          <div className="adm-modal">
            <h2>{deliveryModal.edit ? "Edit Delivery Details" : "Ready to Ship"}</h2>
            <p className="adm-card-sub" style={{ margin: 0 }}>
              {deliveryModal.all
                ? `All ${nativeDetail?.lines.length ?? ""} items — the customer will be emailed these delivery details.`
                : `“${deliveryModal.itemName}” — the customer will be emailed these delivery details.`}
            </p>
            <label className="adm-modal-field">
              Courier
              <select value={dlvCourier} onChange={(e) => setDlvCourier(e.target.value)}>
                {["DHL", "Xendnow", "J&T", "Easy Parcel", "Ninja Van", "Other"].map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </label>
            {dlvCourier === "Other" && (
              <label className="adm-modal-field">
                Courier name
                <input
                  value={dlvCourierOther}
                  onChange={(e) => setDlvCourierOther(e.target.value)}
                  placeholder="Enter courier name"
                />
              </label>
            )}
            <label className="adm-modal-field">
              Tracking number
              <input
                value={dlvTracking}
                onChange={(e) => setDlvTracking(e.target.value)}
                placeholder="e.g. SPXMY0123456789"
              />
            </label>
            <label className="adm-modal-field">
              Contact phone
              <input
                value={dlvPhone}
                onChange={(e) => setDlvPhone(e.target.value)}
                placeholder="e.g. 012-3456789"
              />
            </label>
            <div className="adm-modal-actions">
              <button type="button" className="hero-btn ghost" onClick={() => setDeliveryModal(null)}>
                Cancel
              </button>
              <button type="button" className="hero-btn primary" onClick={submitDeliveryStatus}>
                {deliveryModal.edit ? "Save changes" : "Mark Ready to Ship"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
