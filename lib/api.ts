/**
 * Client for the SignFuture AdonisJS backend.
 *
 * Auth is a bearer token issued by POST /api/v1/auth/login and kept in
 * localStorage, since the API lives on a different origin to this app.
 */

export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "http://localhost:3333";

const TOKEN_KEY = "signfuture.token";

export type MemberTier = "Silver" | "Gold" | "Diamond";

export type MemberProfile = {
  id: number;
  login: string;
  email: string;
  name: string;
  firstName: string | null;
  lastName: string | null;
  /** null for accounts with no membership role — a plain WordPress customer. */
  tier: MemberTier | null;
  memberNo: string;
  registeredAt: string | null;
  roles: string[];
  wallet: { balance: number; currency: string };
  phone: string | null;
  billing: Record<string, string | null>;
  shipping: Record<string, string | null>;
  /** Lifetime order count and spend; null for members who never ordered. */
  stats: { orderCount: number; totalSpent: number } | null;
};

export type WalletTransaction = {
  id: number;
  type: "credit" | "debit";
  amount: number;
  balance: number;
  currency: string;
  details: string | null;
  date: string;
};

export type Paginated<T> = {
  data: T[];
  meta: {
    total: number;
    perPage: number;
    currentPage: number;
    lastPage: number;
  };
};

/** Orders use `page` where the wallet endpoint uses `currentPage`. */
export type PagedMeta = {
  total: number;
  page: number;
  perPage: number;
  lastPage: number;
};

/** Customer-facing stage, collapsed from the raw WooCommerce status. */
export type OrderStage =
  | "pending"
  | "processing"
  | "production"
  | "ready"
  | "shipped"
  | "completed"
  | "cancelled";

export type OrderSummary = {
  id: number;
  status: string;
  statusLabel: string;
  stage: OrderStage;
  date: string;
  total: number;
  currency: string;
  itemCount: number;
  invoiceNumber: string | null;
  paymentMethod: string | null;
  shippingMethod: string | null;
};

export type OrderLine = {
  id: number;
  name: string;
  type: string;
  quantity: number;
  total: number;
  subtotal: number;
  /** Configured options for this line (material, finishing, Width, Height…). */
  options: { label: string; value: string }[];
};

export type OrderDetail = OrderSummary & {
  lines: OrderLine[];
  shippingTotal: number;
  billing: Record<string, string | null>;
  shipping: Record<string, string | null>;
  paidAt: string | null;
};

export type InvoiceRow = {
  orderId: number;
  invoiceNumber: string | null;
  invoiceDate: string;
  total: number;
  currency: string;
  status: string;
  statusLabel: string;
};

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (token) window.localStorage.setItem(TOKEN_KEY, token);
    else window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage unavailable (private mode) — session just won't persist */
  }
}

/** Thrown for any non-2xx response, carrying the backend's message. */
export class ApiError extends Error {
  status: number;
  /** Machine-readable code from the backend, e.g. "PASSWORD_RESET_REQUIRED". */
  code: string | null;
  constructor(status: number, message: string, code: string | null = null) {
    super(message);
    this.status = status;
    this.code = code;
    this.name = "ApiError";
  }
}

/**
 * Returned by login when the member has never set a password on this site —
 * every account migrated from WordPress starts in this state.
 */
export const PASSWORD_RESET_REQUIRED = "PASSWORD_RESET_REQUIRED";

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (init.body) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  } catch {
    // fetch only rejects on network-level failures — the API being down, DNS,
    // or CORS. Surface that as something a user can act on.
    throw new ApiError(0, "Cannot reach the server. Is the backend running?");
  }

  const text = await res.text();
  const body = text ? safeJson(text) : null;

  if (!res.ok) {
    const message =
      body?.message ??
      body?.errors?.[0]?.message ??
      body?.error ??
      `Request failed (${res.status})`;
    throw new ApiError(res.status, message, body?.error ?? null);
  }

  return body as T;
}

function safeJson(text: string): any {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

type SessionResponse = {
  token: { type: string; value: string; expiresAt: string | null };
  user: MemberProfile;
};

export const api = {
  /**
   * Throws ApiError with code PASSWORD_RESET_REQUIRED when the member still has
   * to set a password — call firstTimeReset() next.
   */
  async login(identifier: string, password: string) {
    const res = await request<SessionResponse>("/api/v1/auth/login", {
      method: "POST",
      body: JSON.stringify({ identifier, password }),
    });
    setToken(res.token.value);
    return res.user;
  },

  /** Sets the password on a first-time login and signs the member straight in. */
  async firstTimeReset(identifier: string, password: string) {
    const res = await request<SessionResponse>("/api/v1/auth/first-time-reset", {
      method: "POST",
      body: JSON.stringify({ identifier, password }),
    });
    setToken(res.token.value);
    return res.user;
  },

  me() {
    return request<MemberProfile>("/api/v1/auth/me");
  },

  async logout() {
    try {
      await request("/api/v1/auth/logout", { method: "POST" });
    } finally {
      // Drop the local token even if the revoke call fails, so the user is
      // signed out of this browser regardless.
      setToken(null);
    }
  },

  wallet() {
    return request<{ balance: number; currency: string }>("/api/v1/wallet");
  },

  transactions(page = 1, perPage = 20, type?: "credit" | "debit") {
    const qs = new URLSearchParams({ page: String(page), perPage: String(perPage) });
    if (type) qs.set("type", type);
    return request<Paginated<WalletTransaction>>(`/api/v1/wallet/transactions?${qs}`);
  },

  orders(page = 1, perPage = 20, stage?: OrderStage) {
    const qs = new URLSearchParams({ page: String(page), perPage: String(perPage) });
    if (stage) qs.set("stage", stage);
    return request<{ data: OrderSummary[]; meta: PagedMeta }>(`/api/v1/orders?${qs}`);
  },

  order(id: number) {
    return request<OrderDetail>(`/api/v1/orders/${id}`);
  },

  invoices(page = 1, perPage = 20) {
    const qs = new URLSearchParams({ page: String(page), perPage: String(perPage) });
    return request<{ data: InvoiceRow[]; meta: PagedMeta }>(`/api/v1/invoices?${qs}`);
  },

  /** The signed-in member's vouchers (owned + site-wide). */
  vouchers() {
    return request<{ data: Voucher[]; serverTime: string }>("/api/v1/vouchers");
  },

  /** The signed-in member's reward-point balance (members only). */
  points() {
    return request<PointsInfo>("/api/v1/points");
  },

  // ---- Admin: calculator products ----------------------------------------

  adminProducts() {
    return request<{ data: AdminProductRow[] }>("/api/v1/admin/products");
  },

  adminProduct(slug: string) {
    return request<AdminProductDetail>(`/api/v1/admin/products/${slug}`);
  },

  adminUpdateProduct(
    slug: string,
    body: { name?: string; active?: boolean; config: ProductConfig }
  ) {
    return request<{ success: boolean; slug: string; previewPrice: number | null }>(
      `/api/v1/admin/products/${slug}`,
      { method: "PUT", body: JSON.stringify(body) }
    );
  },

  /** Prices a config without saving — powers the editor's live preview. */
  adminPreviewProduct(
    slug: string,
    body: {
      config?: ProductConfig;
      inputs?: Record<string, number>;
      selections?: Record<string, string>;
    }
  ) {
    return request<{ ok: true; price: number } | { ok: false; error: string }>(
      `/api/v1/admin/products/${slug}/preview`,
      { method: "POST", body: JSON.stringify(body) }
    );
  },
};

// ---- Voucher (member-facing) ----------------------------------------------

export type Voucher = {
  code: string;
  title: string;
  description: string | null;
  discountType: "percent" | "fixed";
  discountValue: number;
  /** Ready-to-show label, e.g. "20% off" or "RM 30.00 off". */
  discountLabel: string;
  /** What it applies to, e.g. "All Products" or "Inkjet Printing". */
  appliesTo: string;
  minSpend: number | null;
  /** True for a top-up member perk (member-only or tier-specific). */
  membersOnly?: boolean;
  /** Set when the voucher is a specific tier's top-up reward. */
  requiredTier?: MemberTier | null;
  /** ISO date (YYYY-MM-DD) or null for no expiry. */
  expiresAt: string | null;
  status: "active" | "upcoming" | "expired" | "inactive";
};

// ---- Reward points (member-facing) ----------------------------------------

export type PointsInfo = {
  /** True when the member's tier earns points; false for a plain customer. */
  earning: boolean;
  tier: MemberTier | null;
  /** Points earned per RM 1 of spend. */
  rate: number;
  /** Current point balance. */
  balance: number;
  /** Spend the balance was derived from. */
  qualifyingSpend: number;
};

// ---- Admin product config types (mirror the backend CalcProduct) ----------

export type ProductInput = {
  key: string;
  label: string;
  type: "number" | "integer";
  min?: number;
  max?: number;
  default: number;
  unit?: string;
};
export type ProductChoice = { key: string; label: string; value: number };
export type ProductOption = { key: string; label: string; choices: ProductChoice[] };
export type ProductVariable = { key: string; expr: string };
/**
 * A 2-D price grid keyed by two option selections (e.g. Material × Printing).
 * The looked-up cell `values[rowKey][colKey]` is fed to the formula as `key`.
 */
export type ProductMatrix = {
  key: string;
  label: string;
  rowOption: string;
  colOption: string;
  values: Record<string, Record<string, number>>;
};
export type ProductConfig = {
  inputs: ProductInput[];
  options: ProductOption[];
  constants: Record<string, number>;
  variables: ProductVariable[];
  matrices?: ProductMatrix[];
  formula: string;
  currency?: string;
};

export type AdminProductRow = {
  id: number;
  slug: string;
  name: string;
  category: string;
  active: boolean;
  imageUrl: string | null;
  inputCount: number;
  optionCount: number;
  updatedAt: string | null;
};

export type AdminProductDetail = {
  id: number;
  slug: string;
  name: string;
  category: string;
  active: boolean;
  imageUrl: string | null;
  config: ProductConfig;
  previewPrice: number | null;
};
