/**
 * Local (front-end demo) order + invoice store.
 *
 * The real Order Status / Admin / Invoice screens read the backend (WooCommerce),
 * which isn't reachable in this front-end build. So orders placed at checkout are
 * persisted here in localStorage.
 *
 * Each ORDER gets a running number (e.g. 1055) and each JOB (line item) gets its
 * own sub-number (1055-1, 1055-2), its own status (jobs have different working
 * days, so they progress independently), and its own invoice. Everything is
 * client-side and shared across tabs via a storage event + a same-tab event.
 */

export type LocalOrderStage =
  | "pending_confirmation"
  | "on_hold"
  | "processing"
  | "production"
  | "ready"
  | "shipped"
  | "completed"
  | "cancelled";

export type LocalOrderLine = {
  jobNo: string; // "1055-1"
  name: string;
  quantity: number;
  total: number;
  meta?: string;
  stage: LocalOrderStage; // per-job status
};

export type LocalOrder = {
  id: number; // numeric id (timestamp-based) so it never collides with backend ids
  ref: string; // human ref, e.g. "SFABC123"
  orderNo: number; // running order number, e.g. 1055
  date: string; // ISO
  customerName: string;
  customerRef: string;
  itemCount: number;
  subtotal: number;
  shipping: { id: string; label: string; cost: number };
  address: Record<string, string> | null;
  total: number;
  lines: LocalOrderLine[];
};

export type LocalInvoice = {
  number: string; // job number, e.g. "1055-1"
  orderId: number;
  jobIndex: number;
  date: string;
  amount: number;
  stage: LocalOrderStage;
  name: string;
  customerName: string;
};

export const LOCAL_STAGE_LABEL: Record<LocalOrderStage, string> = {
  pending_confirmation: "Pending Confirmation",
  on_hold: "On Hold",
  processing: "Processing",
  production: "In Production",
  ready: "Ready for Collection",
  shipped: "Out for Delivery",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const LOCAL_STAGE_ORDER: LocalOrderStage[] = [
  "pending_confirmation",
  "on_hold",
  "processing",
  "production",
  "ready",
  "shipped",
  "completed",
  "cancelled",
];

// Progress-bar percentage per stage (for the customer view).
export const LOCAL_STAGE_PCT: Record<LocalOrderStage, number> = {
  pending_confirmation: 8,
  on_hold: 8,
  processing: 30,
  production: 52,
  ready: 74,
  shipped: 90,
  completed: 100,
  cancelled: 0,
};

// A job is "confirmed" (ready to invoice) once it moves past Pending Confirmation
// and isn't On Hold. Cancelled jobs are excluded from the order's invoice total.
export function jobIsConfirmed(stage: LocalOrderStage): boolean {
  return stage !== "pending_confirmation" && stage !== "on_hold" && stage !== "cancelled";
}

const KEY = "sign-studio-orders";
const NO_KEY = "sign-studio-order-no";
const EVT = "sign-orders-changed";
const LOCAL_ID_FLOOR = 9_000_000_000;
const ORDER_NO_START = 1055;

export function isLocalOrderId(id: number): boolean {
  return id >= LOCAL_ID_FLOOR;
}

// Bring any stored order (including ones saved by an older shape that had no
// per-job jobNo/stage or an order-level stage) up to the current LocalOrder shape.
function normalizeOrder(raw: Record<string, unknown>, idx: number): LocalOrder {
  const orderNo = typeof raw.orderNo === "number" ? raw.orderNo : ORDER_NO_START + idx;
  const orderStage: LocalOrderStage =
    typeof raw.stage === "string" && (raw.stage as string) in LOCAL_STAGE_LABEL
      ? (raw.stage as LocalOrderStage)
      : "pending_confirmation";
  const rawLines = Array.isArray(raw.lines) ? (raw.lines as Record<string, unknown>[]) : [];
  const lines: LocalOrderLine[] = rawLines.map((l, i) => ({
    name: String(l.name ?? "Item"),
    quantity: Number(l.quantity) || 1,
    total: Number(l.total) || 0,
    meta: l.meta ? String(l.meta) : undefined,
    jobNo: typeof l.jobNo === "string" ? l.jobNo : orderNo + "-" + (i + 1),
    stage:
      typeof l.stage === "string" && (l.stage as string) in LOCAL_STAGE_LABEL
        ? (l.stage as LocalOrderStage)
        : orderStage,
  }));
  return {
    id: Number(raw.id) || LOCAL_ID_FLOOR,
    ref: String(raw.ref ?? ""),
    orderNo,
    date: String(raw.date ?? new Date().toISOString()),
    customerName: String(raw.customerName ?? ""),
    customerRef: String(raw.customerRef ?? ""),
    itemCount: lines.reduce((n, l) => n + l.quantity, 0),
    subtotal: Number(raw.subtotal) || 0,
    shipping:
      (raw.shipping as LocalOrder["shipping"]) || { id: "pickup", label: "Self Collect", cost: 0 },
    address: (raw.address as Record<string, string> | null) ?? null,
    total: Number(raw.total) || 0,
    lines,
  };
}

export function getLocalOrders(): LocalOrder[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as unknown[]) : [];
    if (!Array.isArray(list)) return [];
    return list.map((o, idx) => normalizeOrder((o ?? {}) as Record<string, unknown>, idx));
  } catch {
    return [];
  }
}

function save(list: LocalOrder[]): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list));
    window.dispatchEvent(new CustomEvent(EVT));
  } catch {
    /* ignore */
  }
}

function nextOrderNo(): number {
  let n = ORDER_NO_START;
  try {
    const raw = window.localStorage.getItem(NO_KEY);
    if (raw) n = parseInt(raw, 10) || ORDER_NO_START;
    window.localStorage.setItem(NO_KEY, String(n + 1));
  } catch {
    /* ignore */
  }
  return n;
}

export function addLocalOrder(input: {
  ref: string;
  date: string;
  customerName: string;
  customerRef: string;
  subtotal: number;
  shipping: { id: string; label: string; cost: number };
  address: Record<string, string> | null;
  total: number;
  lines: { name: string; quantity: number; total: number; meta?: string }[];
}): LocalOrder {
  const orderNo = nextOrderNo();
  const lines: LocalOrderLine[] = input.lines.map((l, i) => ({
    ...l,
    jobNo: orderNo + "-" + (i + 1),
    stage: "pending_confirmation",
  }));
  const order: LocalOrder = {
    ref: input.ref,
    date: input.date,
    customerName: input.customerName,
    customerRef: input.customerRef,
    subtotal: input.subtotal,
    shipping: input.shipping,
    address: input.address,
    total: input.total,
    id: LOCAL_ID_FLOOR + Date.now(),
    orderNo,
    itemCount: lines.reduce((n, l) => n + l.quantity, 0),
    lines,
  };
  const list = getLocalOrders();
  list.unshift(order);
  save(list);
  return order;
}

/** Change one job's (line item's) status. */
export function updateLocalJobStatus(orderId: number, jobIndex: number, stage: LocalOrderStage): void {
  const list = getLocalOrders();
  const next = list.map((o) =>
    o.id === orderId
      ? { ...o, lines: o.lines.map((l, i) => (i === jobIndex ? { ...l, stage } : l)) }
      : o,
  );
  save(next);
}

/**
 * Invoices for an order appear only once EVERY active (non-cancelled) job is
 * confirmed — i.e. no job is still Pending Confirmation or On Hold. Then each job
 * shows as a row (job number = invoice number); cancelled jobs are shown as
 * cancelled and excluded from the amount. Until then the order has no invoice.
 */
export function getLocalInvoices(): LocalInvoice[] {
  return getLocalOrders().flatMap((o) => {
    const active = o.lines.filter((l) => l.stage !== "cancelled");
    const anyPending = active.some((l) => l.stage === "pending_confirmation" || l.stage === "on_hold");
    if (active.length === 0 || anyPending) return [];
    return o.lines.map((l, i) => ({
      number: l.jobNo,
      orderId: o.id,
      jobIndex: i,
      date: o.date,
      amount: l.total,
      stage: l.stage,
      name: l.name,
      customerName: o.customerName,
    }));
  });
}

/** Fires on any local-order change (this tab or another). Returns an unsubscribe. */
export function subscribeLocalOrders(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const onCustom = () => cb();
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) cb();
  };
  window.addEventListener(EVT, onCustom);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(EVT, onCustom);
    window.removeEventListener("storage", onStorage);
  };
}
