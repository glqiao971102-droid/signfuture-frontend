// Lightweight storefront activity beacon. Records page views + key actions and
// batches them to POST /api/v1/track. A stable per-browser "visitor id" (in
// localStorage) lets the admin recognise repeat anonymous visitors; when the
// user is signed in the request carries their token so the account is attached.
import { API_BASE, getToken } from "@/lib/api";

const VISITOR_KEY = "sf.visitor";
const SESSION_KEY = "sf.session";

type TrackEvent = {
  type: "pageview" | "action";
  action?: string;
  path?: string;
  label?: string;
  meta?: unknown;
  durationMs?: number;
};

type QueuedEvent = TrackEvent & { visitorId: string; sessionId: string };

let queue: QueuedEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function rand(): string {
  try {
    return crypto.randomUUID().replace(/-/g, "").slice(0, 20);
  } catch {
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
  }
}

/** Stable per-browser visitor id (persists across sessions). */
export function visitorId(): string {
  if (typeof window === "undefined") return "";
  try {
    let id = localStorage.getItem(VISITOR_KEY);
    if (!id) {
      id = "v" + rand();
      localStorage.setItem(VISITOR_KEY, id);
    }
    return id;
  } catch {
    return "v" + rand();
  }
}

/** Per-tab session id (a new one each fresh tab/session). */
function sessionId(): string {
  if (typeof window === "undefined") return "";
  try {
    let id = sessionStorage.getItem(SESSION_KEY);
    if (!id) {
      id = "s" + rand();
      sessionStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return "s0";
  }
}

/** Queue an event; a flush is scheduled shortly after. */
export function track(ev: TrackEvent): void {
  if (typeof window === "undefined") return;
  queue.push({ ...ev, visitorId: visitorId(), sessionId: sessionId() });
  if (!flushTimer) {
    flushTimer = setTimeout(() => {
      flushTimer = null;
      flush();
    }, 1500);
  }
}

/** Send any queued events. `keepalive` lets the last batch survive tab close. */
export function flush(keepalive = false): void {
  if (typeof window === "undefined" || queue.length === 0) return;
  const events = queue;
  queue = [];
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;
  try {
    void fetch(`${API_BASE}/api/v1/track`, {
      method: "POST",
      headers,
      body: JSON.stringify({ events }),
      keepalive,
    }).catch(() => {});
  } catch {
    /* never let tracking break the app */
  }
}
