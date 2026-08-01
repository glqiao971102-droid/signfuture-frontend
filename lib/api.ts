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
  /** True when the account holds the WordPress `administrator` role. */
  isAdmin: boolean;
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

export type PaymentProvider = "ipay88" | "stripe";

/**
 * How to hand the browser over to the gateway.
 *
 * iPay88 needs a real form POST to its entry page; Stripe hosts the checkout
 * and just needs a redirect. `submitToGateway` handles both.
 */
export type PaymentInitiation =
  | { provider: "ipay88"; refNo: string; action: string; fields: Record<string, string> }
  | { provider: "stripe"; refNo: string; redirectUrl: string };

export type PaymentStatus = {
  refNo: string;
  status: "pending" | "paid" | "failed";
  amount: number;
  currency: string;
  purpose: "topup" | "order";
  errDesc: string | null;
  settledAt: string | null;
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

/**
 * Resolves an image URL for display. Local-storage uploads come back as a
 * relative path ("/uploads/…") and are served by the backend, so prepend the
 * API base. Absolute URLs (S3 in production) are used as-is.
 */
export function resolveImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  return `${API_BASE}${url.startsWith("/") ? "" : "/"}${url}`;
}

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

  /** Creates a brand-new customer account and signs them straight in. */
  async register(input: { name: string; email: string; password: string; phone?: string }) {
    const res = await request<SessionResponse>("/api/v1/auth/register", {
      method: "POST",
      body: JSON.stringify(input),
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

  /** Creates a pending top-up and returns how to reach the chosen gateway. */
  startTopup(amount: number, provider: PaymentProvider = "ipay88") {
    return request<PaymentInitiation>("/api/v1/payments/topup", {
      method: "POST",
      body: JSON.stringify({ amount, provider }),
    });
  },

  paymentStatus(refNo: string) {
    return request<PaymentStatus>(`/api/v1/payments/${encodeURIComponent(refNo)}`);
  },

  // ----- Admin (requires the administrator role; 403 otherwise) -----

  adminUsers(opts: { page?: number; perPage?: number; search?: string; role?: string } = {}) {
    const qs = new URLSearchParams();
    if (opts.page) qs.set("page", String(opts.page));
    if (opts.perPage) qs.set("perPage", String(opts.perPage));
    if (opts.search) qs.set("search", opts.search);
    if (opts.role) qs.set("role", opts.role);
    return request<{ data: AdminUserRow[]; meta: PagedMeta }>(`/api/v1/admin/users?${qs}`);
  },

  adminUser(id: number) {
    return request<MemberProfile>(`/api/v1/admin/users/${id}`);
  },

  adminProducts() {
    return request<{ data: AdminProductRow[] }>("/api/v1/admin/products");
  },

  adminCategories() {
    return request<{ data: { name: string; count: number }[] }>("/api/v1/admin/categories");
  },

  adminStats() {
    return request<AdminStats>("/api/v1/admin/stats/overview");
  },

  adminCreateProduct(name: string, category: string) {
    return request<{ slug: string; name: string; category: string }>("/api/v1/admin/products", {
      method: "POST",
      body: JSON.stringify({ name, category }),
    });
  },

  adminDeleteProduct(slug: string) {
    return request<{ success: boolean }>(`/api/v1/admin/products/${slug}`, { method: "DELETE" });
  },

  adminProduct(slug: string) {
    return request<AdminProductDetail>(`/api/v1/admin/products/${slug}`);
  },

  adminSaveProduct(slug: string, body: { name?: string; active?: boolean; config: unknown }) {
    return request<{ success: boolean; slug: string; previewPrice: number | null }>(
      `/api/v1/admin/products/${slug}`,
      { method: "PUT", body: JSON.stringify(body) },
    );
  },

  /** Uploads a product image (multipart). Returns the stored public URL. */
  async adminUploadProductImage(slug: string, file: File) {
    const form = new FormData();
    form.append("image", file);
    const token = getToken();
    const res = await fetch(`${API_BASE}/api/v1/admin/products/${slug}/image`, {
      method: "POST",
      // Do NOT set Content-Type — the browser adds the multipart boundary.
      headers: token ? { Authorization: `Bearer ${token}`, Accept: "application/json" } : {},
      body: form,
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      throw new ApiError(res.status, body?.message ?? "Upload failed", body?.error ?? null);
    }
    return body as { success: boolean; imageUrl: string; storage: "s3" | "local" };
  },

  adminRemoveProductImage(slug: string) {
    return request<{ success: boolean }>(`/api/v1/admin/products/${slug}/image`, {
      method: "DELETE",
    });
  },

  // ----- Admin: orders -----

  adminOrders(
    opts: { page?: number; perPage?: number; status?: string; search?: string } = {},
  ) {
    const qs = new URLSearchParams();
    if (opts.page) qs.set("page", String(opts.page));
    if (opts.perPage) qs.set("perPage", String(opts.perPage));
    if (opts.status) qs.set("status", opts.status);
    if (opts.search) qs.set("search", opts.search);
    return request<{ data: AdminOrderRow[]; meta: PagedMeta }>(`/api/v1/admin/orders?${qs}`);
  },

  adminOrderStatuses() {
    return request<{ data: { value: string; label: string }[] }>(
      "/api/v1/admin/orders/statuses",
    );
  },

  adminOrder(id: number) {
    return request<OrderDetail>(`/api/v1/admin/orders/${id}`);
  },

  adminUpdateOrderStatus(id: number, status: string) {
    return request<{ success: boolean; status: string }>(
      `/api/v1/admin/orders/${id}/status`,
      { method: "PATCH", body: JSON.stringify({ status }) },
    );
  },

  // ----- Admin: customer detail -----

  adminUserOrders(id: number, page = 1) {
    return request<{ data: OrderSummary[]; meta: PagedMeta }>(
      `/api/v1/admin/users/${id}/orders?page=${page}`,
    );
  },

  adminUserWallet(id: number, page = 1) {
    return request<{ data: WalletTransaction[]; meta: PagedMeta }>(
      `/api/v1/admin/users/${id}/wallet?page=${page}`,
    );
  },

  adminUpdateUserTier(id: number, tier: "Silver" | "Gold" | "Diamond" | "customer") {
    return request<{ success: boolean; tier: string | null }>(
      `/api/v1/admin/users/${id}/tier`,
      { method: "PATCH", body: JSON.stringify({ tier }) },
    );
  },

  // ----- Admin: wallet audit -----

  adminWalletSummary() {
    return request<AdminWalletSummary>("/api/v1/admin/wallet/summary");
  },

  adminAdjustWallet(body: {
    userId: number;
    amount: number;
    type: "credit" | "debit";
    reason: string;
  }) {
    return request<{ success: boolean; transactionId: number; balance: number }>(
      "/api/v1/admin/wallet/adjust",
      { method: "POST", body: JSON.stringify(body) },
    );
  },

  // ----- Admin: invoices, coupons -----

  adminInvoices(opts: { page?: number; perPage?: number; search?: string } = {}) {
    const qs = new URLSearchParams();
    if (opts.page) qs.set("page", String(opts.page));
    if (opts.perPage) qs.set("perPage", String(opts.perPage));
    if (opts.search) qs.set("search", opts.search);
    return request<{ data: AdminInvoiceRow[]; meta: PagedMeta }>(
      `/api/v1/admin/invoices?${qs}`,
    );
  },

  adminCoupons() {
    return request<{ data: AdminCouponRow[] }>("/api/v1/admin/coupons");
  },

  // ----- Admin: dashboard stats (with optional date range) -----

  adminStatsRanged(range?: { from?: string; to?: string }) {
    const qs = new URLSearchParams();
    if (range?.from) qs.set("from", range.from);
    if (range?.to) qs.set("to", range.to);
    const suffix = qs.toString() ? `?${qs}` : "";
    return request<AdminStats>(`/api/v1/admin/stats/overview${suffix}`);
  },

  /** Downloads a CSV report and triggers a browser save. */
  async adminDownloadReport(kind: "orders" | "sales" | "products") {
    const token = getToken();
    const res = await fetch(`${API_BASE}/api/v1/admin/reports/${kind}.csv`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new ApiError(res.status, "Report download failed");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `signfuture-${kind}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },
};

/** A row in the admin all-orders table. */
export type AdminOrderRow = OrderSummary & {
  customer: string;
  customerId: number | null;
};

export type AdminWalletSummary = {
  totals: { topups: number; spent: number; liability: number };
  topBalances: { userId: number; login: string; email: string; balance: number }[];
  recent: {
    id: number;
    userId: number;
    type: "credit" | "debit";
    amount: number;
    details: string | null;
    date: string;
  }[];
};

export type AdminInvoiceRow = {
  orderId: number;
  invoiceNumber: string | null;
  invoiceDate: string | null;
  total: number;
  email: string | null;
  paid: boolean;
};

export type AdminCouponRow = {
  id: number;
  code: string;
  active: boolean;
  description: string | null;
  type: string;
  amount: number;
  used: number;
  usageLimit: number | null;
  minSpend: number | null;
  freeShipping: boolean;
  expiry: string | null;
};

export type AdminStats = {
  kpis: {
    revenue: number;
    orders: number;
    avgOrderValue: number;
    itemsSold: number;
    customers: number;
    walletLiability: number;
    walletTopups: number;
    walletSpent: number;
    thisMonthRevenue: number;
    lastMonthRevenue: number;
  };
  revenueByMonth: { month: string; orders: number; revenue: number }[];
  statusBreakdown: { status: string; orders: number; revenue: number }[];
  topProducts: { name: string; orders: number; qty: number; revenue: number }[];
  topCustomers: { name: string; email: string | null; orders: number; spend: number }[];
  recentOrders: { id: number; status: string; total: number; items: number; date: string; customer: string }[];
  /** Present when the overview was requested with a date range. */
  range?: { from: string | null; to: string | null };
  /** Membership tier headcount, ordered high → low. */
  tiers: { tier: string; members: number }[];
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
  config: import("@/lib/formula").ProductConfig;
  previewPrice: number | null;
};

/** A row in the admin users table. */
export type AdminUserRow = {
  id: number;
  login: string;
  email: string;
  registeredAt: string | null;
  tier: MemberTier | null;
  isAdmin: boolean;
  roles: string[];
  memberNo: string;
  walletBalance: number;
};

/**
 * Hands the browser over to whichever gateway was chosen.
 *
 * Stripe hosts its own checkout page, so a plain redirect is enough. iPay88
 * requires a real browser form POST from the registered Request URL — a
 * fetch/XHR will not do, since the gateway then renders its own payment page.
 */
export function submitToGateway(initiation: PaymentInitiation) {
  if (initiation.provider === "stripe") {
    window.location.href = initiation.redirectUrl;
    return;
  }

  const form = document.createElement("form");
  form.method = "POST";
  form.action = initiation.action;
  form.style.display = "none";

  for (const [name, value] of Object.entries(initiation.fields)) {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = name;
    input.value = value ?? "";
    form.appendChild(input);
  }

  document.body.appendChild(form);
  form.submit();
}
