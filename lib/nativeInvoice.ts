import type { NativeOrderRow } from "@/lib/api";

/**
 * Per-job invoice gate (mirrors the backend): an order's invoice is only ready
 * once every ACTIVE job (not Cancelled) is confirmed — Processing or later. A
 * Waiting / On Hold job blocks the whole invoice.
 */
const CANCELLED = ["cancelled", "refunded", "failed"];
const NOT_READY = ["waiting", "on_hold", "pending", "pending_confirmation"];

const jobStatus = (o: NativeOrderRow, l: NativeOrderRow["items"][number]) => l.status ?? o.status;

export function invoiceReady(o: NativeOrderRow): boolean {
  const active = o.items.filter((l) => !CANCELLED.includes(jobStatus(o, l)));
  return active.length > 0 && !active.some((l) => NOT_READY.includes(jobStatus(o, l)));
}

/** Invoiced amount = sum of the confirmed (non-cancelled) jobs' line totals. */
export function invoiceTotal(o: NativeOrderRow): number {
  return o.items
    .filter((l) => !CANCELLED.includes(jobStatus(o, l)))
    .reduce((s, l) => s + (Number(l.total) || 0), 0);
}
