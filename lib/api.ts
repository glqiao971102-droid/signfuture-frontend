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
  /** The member's tier discount percentage (0 for Normal). */
  tierDiscount: number;
  /** Largest single top-up ever made (unlocks tiers). */
  largestTopup: number;
  /** True when the account is an admin (role or super-admin email). */
  isAdmin: boolean;
  /** True when the account is a Super Admin (full access + manage permissions). */
  isSuperAdmin?: boolean;
  /** Admin sidebar sections this account may access (all for super admins). */
  adminPermissions?: string[];
  memberNo: string;
  registeredAt: string | null;
  roles: string[];
  wallet: { balance: number; currency: string };
  phone: string | null;
  billing: Record<string, string | null>;
  shipping: Record<string, string | null>;
  /** Lifetime order count and spend; null for members who never ordered. */
  stats: { orderCount: number; totalSpent: number } | null;
  /** This account's own referral code (admins only), else null. */
  referralCode: string | null;
  /** The admin user id that referred this member, else null. */
  referredBy: number | null;
  /** The member's upline (the agent they registered under). Admin view only. */
  upline?: { id: number; name: string; phone: string | null } | null;
  /** Trades the member selected at sign-up (may be empty). */
  professions: string[];
};

/** Trades offered at registration (mirrors the backend PROFESSIONS list). */
export const PROFESSIONS = [
  "Offset Printing",
  "Digital Printing",
  "Inkjet Printing",
  "Signage Advertising",
  "Signboard Installation",
  "Graphic Design",
  "Packaging Printing",
  "Material Supplier",
  "Advertising Agency",
  "Exhibition",
] as const;

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
  | "pending_confirmation"
  | "on_hold"
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

  /** Sends a 6-digit email verification code for registration. */
  sendRegisterOtp(email: string) {
    return request<{ success: boolean; message: string }>(
      "/api/v1/auth/register/send-otp",
      { method: "POST", body: JSON.stringify({ email }) },
    );
  },

  /**
   * Creates a brand-new customer account and signs them straight in.
   * Requires a verified email (otp) and a valid admin referral code.
   */
  async register(input: {
    name: string;
    email: string;
    password: string;
    referralCode: string;
    otp: string;
    phone?: string;
    professions?: string[];
  }) {
    const res = await request<SessionResponse>("/api/v1/auth/register", {
      method: "POST",
      body: JSON.stringify(input),
    });
    setToken(res.token.value);
    return res.user;
  },

  /**
   * Checks a referral code exists and belongs to an admin, before the OTP step.
   * Returns { valid, referrer } — referrer is the admin's display name.
   */
  checkReferral(referralCode: string) {
    return request<{ valid: boolean; referrer?: string | null }>(
      "/api/v1/auth/referral/check",
      { method: "POST", body: JSON.stringify({ referralCode }) },
    );
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

  /**
   * Forgot / first-time password: e-mails a 6-digit code to the account owner.
   * Returns a masked address so the UI can say where it went. Works whether the
   * member is setting a password for the first time or has genuinely forgotten.
   */
  forgotPassword(identifier: string) {
    return request<{ success: boolean; email?: string }>(
      "/api/v1/auth/password/forgot",
      { method: "POST", body: JSON.stringify({ identifier }) },
    );
  },

  /** Verifies the emailed code, sets the new password, and signs the member in. */
  async resetPassword(identifier: string, otp: string, password: string) {
    const res = await request<SessionResponse>("/api/v1/auth/password/reset", {
      method: "POST",
      body: JSON.stringify({ identifier, otp, password }),
    });
    setToken(res.token.value);
    return res.user;
  },

  me() {
    return request<MemberProfile>("/api/v1/auth/me");
  },

  // ----- Agent (proxy) login -----

  /** Requests the agent-login OTP (sent to the authorising inbox). */
  agentRequestOtp(masterPassword: string) {
    return request<{ success: boolean; message: string }>("/api/v1/auth/agent/request-otp", {
      method: "POST",
      body: JSON.stringify({ masterPassword }),
    });
  },

  /** Logs in AS a customer (proxy). Stores the target's session token. */
  async agentLogin(input: { masterPassword: string; otp: string; targetIdentifier: string; agentLabel: string }) {
    const res = await request<{ token: { value: string }; user: MemberProfile; agentMode: boolean; agentLabel: string }>(
      "/api/v1/auth/agent/login",
      { method: "POST", body: JSON.stringify(input) },
    );
    setToken(res.token.value);
    return res;
  },

  // ----- Super admin: permissions -----

  adminAccessSections() {
    return request<{ sections: string[] }>("/api/v1/admin/access/sections");
  },
  adminAccessAdmins() {
    return request<{ data: { id: number; login: string; email: string; level: "super" | "admin"; permissions: string[] }[] }>(
      "/api/v1/admin/access/admins",
    );
  },
  adminSetAccess(id: number, permissions: string[]) {
    return request<{ success: boolean; permissions: string[] }>(
      `/api/v1/admin/access/admins/${id}`,
      { method: "PUT", body: JSON.stringify({ permissions }) },
    );
  },

  // ----- Product pricing config (admin-editable calculator numbers) -----
  adminGetPricing(key: string) {
    return request<{ key: string; config: Record<string, unknown>; isOverride: boolean; defaults: Record<string, unknown> }>(
      `/api/v1/admin/pricing/${key}`,
    );
  },
  adminSavePricing(key: string, config: Record<string, unknown>) {
    return request<{ success: boolean; key: string; config: Record<string, unknown> }>(
      `/api/v1/admin/pricing/${key}`,
      { method: "PUT", body: JSON.stringify({ config }) },
    );
  },
  adminResetPricing(key: string) {
    return request<{ success: boolean; key: string; config: Record<string, unknown> }>(
      `/api/v1/admin/pricing/${key}`,
      { method: "DELETE" },
    );
  },

  /** Admin: the agent-login audit trail. */
  adminAgentLogins(page = 1) {
    return request<{
      data: { id: number; agent: string; targetUserId: number; targetEmail: string; targetLogin: string; ip: string | null; at: string }[];
      meta: PagedMeta;
    }>(`/api/v1/admin/agent-logins?page=${page}`);
  },

  /** Membership tier config (thresholds + discounts) — public. */
  membershipConfig() {
    return request<{ tiers: { key: string; threshold: number; discount: number }[] }>(
      "/api/v1/membership/config",
    );
  },

  /**
   * The signed-in member's consultant = the admin whose referral QR/code they
   * registered under. `consultant` is null when the member has no referrer.
   */
  myConsultant() {
    return request<{
      consultant: { id: number; name: string; phone: string | null } | null;
    }>("/api/v1/membership/consultant", { cache: "no-store" });
  },

  /** Join under an agent's referral code (only if you have no consultant yet). */
  joinConsultant(referralCode: string) {
    return request<{
      success: boolean;
      consultant: { id: number; name: string; phone: string | null } | null;
    }>("/api/v1/membership/consultant/join", {
      method: "POST",
      body: JSON.stringify({ referralCode }),
    });
  },

  /** Tier discount settings (admin). */
  adminTierDiscounts() {
    return request<{ discounts: Record<string, number> }>("/api/v1/admin/settings/tier-discounts");
  },
  adminSetTierDiscounts(discounts: { Silver: number; Gold: number; Diamond: number }) {
    return request<{ success: boolean; discounts: Record<string, number> }>(
      "/api/v1/admin/settings/tier-discounts",
      { method: "PUT", body: JSON.stringify(discounts) },
    );
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

  /** Places a native order. Returns the created order (with ref + status). */
  createOrder(input: {
    items: {
      productSlug?: string;
      productName: string;
      qty: number;
      unitPrice: number;
      options?: { label: string; value: string }[];
      artworkUrl?: string;
      spec?: Record<string, unknown>;
      requiresConfirmation?: boolean;
    }[];
    billing?: Record<string, string>;
    shipping?: Record<string, string>;
    customerName?: string;
    customerEmail?: string;
    customerPhone?: string;
    deliveryMethod?: string;
    collectDate?: string;
    notes?: string;
    paymentMethod: "wallet" | "pending";
    voucherCode?: string;
    tier?: number;
    artworks?: { url: string; name?: string }[];
  }) {
    return request<{ id: number; ref: string; status: string; statusLabel: string; total: number }>(
      "/api/v1/orders",
      { method: "POST", body: JSON.stringify(input) },
    );
  },

  /** Uploads an artwork file for an order, returns its stored URL. */
  async uploadArtwork(file: File) {
    const form = new FormData();
    form.append("artwork", file);
    const token = getToken();
    const res = await fetch(`${API_BASE}/api/v1/orders/artwork`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}`, Accept: "application/json" } : {},
      body: form,
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) throw new ApiError(res.status, body?.message ?? "Upload failed", body?.error ?? null);
    return body as { success: boolean; url: string };
  },

  /** Opens the member's invoice PDF for a native order in a new tab. */
  async openNativeInvoice(id: number) {
    const token = getToken();
    const res = await fetch(`${API_BASE}/api/v1/orders/native/${id}/invoice`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new ApiError(res.status, "Could not load the invoice.", null);
    const url = URL.createObjectURL(await res.blob());
    window.open(url, "_blank");
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  },

  /** Admin: open any native order's invoice PDF. */
  async openAdminNativeInvoice(id: number) {
    const token = getToken();
    const res = await fetch(`${API_BASE}/api/v1/admin/orders/native/${id}/invoice`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new ApiError(res.status, "Could not load the invoice.", null);
    const url = URL.createObjectURL(await res.blob());
    window.open(url, "_blank");
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  },

  /** The member's own native orders. */
  myNativeOrders() {
    return request<{ data: NativeOrderRow[] }>("/api/v1/orders/native");
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

  /** Admin: a customer's recorded installations (optionally one year). */
  adminInstallations(userId: number, year?: string) {
    const qs = new URLSearchParams({ userId: String(userId) });
    if (year) qs.set("year", year);
    return request<{ customer: { id: number; name: string; email: string } | null; data: InstallationRow[] }>(
      `/api/v1/admin/installations?${qs}`,
    );
  },

  /** Admin: record a new installation for a customer. */
  adminCreateInstallation(body: {
    userId: number;
    installDate?: string;
    startTime?: string;
    endTime?: string;
    invoiceNo?: string;
    customerPhone?: string;
    installerName?: string;
    installerPhone?: string;
  }) {
    return request<InstallationRow>(`/api/v1/admin/installations`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  /** Admin: delete an installation record. */
  adminDeleteInstallation(id: number) {
    return request<{ success: boolean }>(`/api/v1/admin/installations/${id}`, { method: "DELETE" });
  },

  /** Admin: edit a member's contact details (email / phone / name). */
  adminUpdateUserContact(id: number, patch: { email?: string; phone?: string; name?: string }) {
    return request<{ success: boolean; profile: MemberProfile }>(
      `/api/v1/admin/users/${id}`,
      { method: "PATCH", body: JSON.stringify(patch) },
    );
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

  adminNativeStatuses() {
    return request<{ data: { value: string; label: string }[] }>(
      "/api/v1/admin/orders/native/statuses",
    );
  },

  adminOrder(id: number) {
    return request<OrderDetail>(`/api/v1/admin/orders/${id}`);
  },

  adminNativeOrder(id: number) {
    return request<NativeOrderDetail>(`/api/v1/admin/orders/native/${id}`);
  },

  adminUpdateOrderStatus(id: number, status: string) {
    return request<{ success: boolean; status: string }>(
      `/api/v1/admin/orders/${id}/status`,
      { method: "PATCH", body: JSON.stringify({ status }) },
    );
  },

  /** Changes a native order's status (writes history + emails the customer). */
  adminUpdateNativeStatus(id: number, status: string, note?: string) {
    return request<{ success: boolean; status: string; statusLabel: string }>(
      `/api/v1/admin/orders/native/${id}/status`,
      { method: "PATCH", body: JSON.stringify({ status, note }) },
    );
  },

  /** Change one line item's status (per-item cancel/refund). */
  adminUpdateNativeItemStatus(id: number, itemId: number, status: string, note?: string) {
    return request<{ success: boolean; status: string; statusLabel: string }>(
      `/api/v1/admin/orders/native/${id}/items/${itemId}/status`,
      { method: "PATCH", body: JSON.stringify({ status, note }) },
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

  /** Promotes a member to administrator and returns their new referral code. */
  adminMakeAdmin(id: number) {
    return request<{ success: boolean; isAdmin: boolean; referralCode: string }>(
      `/api/v1/admin/users/${id}/make-admin`,
      { method: "POST" },
    );
  },

  /** Members referred by this admin (their downline). */
  adminDownline(id: number, page = 1) {
    return request<{
      data: { id: number; login: string; email: string; name: string; registeredAt: string | null }[];
      meta: PagedMeta;
      referralCode: string | null;
    }>(`/api/v1/admin/users/${id}/downline?page=${page}`);
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

  // ----- Vouchers -----

  adminVouchers() {
    return request<{ data: VoucherRow[] }>("/api/v1/admin/vouchers");
  },

  adminCreateVoucher(input: {
    code: string;
    title: string;
    description?: string;
    discountType: "fixed" | "percent";
    discountValue: number;
    scopeType: "all" | "product" | "category";
    scopeValues?: string[];
    minSpend?: number;
    expiresAt?: string;
  }) {
    return request<{ id: number; code: string }>("/api/v1/admin/vouchers", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  adminGrantVoucher(id: number, target: { userIds?: number[]; registeredFrom?: string; registeredTo?: string }) {
    return request<{ success: boolean; granted: number; emailed: number; skipped: number; matched?: number }>(
      `/api/v1/admin/vouchers/${id}/grant`,
      { method: "POST", body: JSON.stringify(target) },
    );
  },

  adminVoucherGrants(id: number) {
    return request<{ data: { userId: number; login: string; email: string; status: string; usedAt: string | null }[] }>(
      `/api/v1/admin/vouchers/${id}/grants`,
    );
  },

  /** Re-send the voucher email to a picked set of already-granted users. */
  adminResendVoucher(id: number, userIds: number[]) {
    return request<{ success: boolean; requested: number; emailed: number }>(
      `/api/v1/admin/vouchers/${id}/resend`,
      { method: "POST", body: JSON.stringify({ userIds }) },
    );
  },

  /** The signed-in member's available vouchers. */
  myVouchers() {
    return request<{ data: MemberVoucher[] }>("/api/v1/vouchers/mine");
  },

  /** Previews the discount a code gives for a set of cart items. */
  previewVoucher(code: string, items: { productName: string; productSlug?: string; lineTotal: number }[]) {
    return request<{ code: string; title: string; discount: number; eligibleNames: string[]; minSpend: number; applicable: boolean }>(
      "/api/v1/vouchers/preview",
      { method: "POST", body: JSON.stringify({ code, items }) },
    );
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

/** A row in the admin all-orders table (native orders carry source + ref). */
export type AdminOrderRow = OrderSummary & {
  customer: string;
  customerId: number | null;
  source?: "native" | "legacy";
  ref?: string;
  /** Per-job statuses (native orders) so the list can show the mix. */
  jobStatuses?: string[];
};

export type NativeOrderRow = {
  id: number;
  ref: string;
  status: string;
  statusLabel: string;
  total: number;
  currency: string;
  date: string | null;
  items: { name: string; qty: number; unitPrice: number; total: number; options: { label: string; value: string }[]; artworkUrl: string | null; status?: string; statusLabel?: string }[];
};

export type NativeOrderDetail = {
  id: number;
  ref: string;
  source: "native";
  status: string;
  statusLabel: string;
  subtotal: number;
  shipping: number;
  discount?: number;
  minAdjustment: number;
  voucherCode?: string | null;
  artworks?: { url: string; name?: string }[];
  total: number;
  currency: string;
  paymentMethod: string;
  paidAt: string | null;
  customer: string | null;
  customerId: number;
  billing: Record<string, string> | null;
  shipping_address: Record<string, string> | null;
  deliveryMethod: string | null;
  collectDate: string | null;
  notes: string | null;
  placedByAgent?: boolean;
  agentLabel?: string | null;
  date: string | null;
  lines: { id: number; name: string; quantity: number; total: number; options: { label: string; value: string }[]; artworkUrl: string | null; status: string; statusLabel: string; refundedAt: string | null }[];
  history: { from: string | null; to: string; note: string | null; date: string | null }[];
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

export type VoucherRow = {
  id: number;
  code: string;
  title: string;
  discountType: "fixed" | "percent";
  discountValue: number;
  scopeType: "all" | "product" | "category";
  scopeValues: string[];
  minSpend: number;
  expiresAt: string | null;
  active: boolean;
  granted: number;
  used: number;
};

export type MemberVoucher = {
  code: string;
  title: string;
  description: string | null;
  discountType: "fixed" | "percent";
  discountValue: number;
  scopeType: "all" | "product" | "category";
  scopeValues: string[];
  minSpend: number;
  expiresAt: string | null;
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
export type InstallationRow = {
  id: number;
  userId: number;
  installDate: string | null;
  startTime: string | null;
  endTime: string | null;
  invoiceNo: string | null;
  customerPhone: string | null;
  installerName: string | null;
  installerPhone: string | null;
  createdAt: string | null;
};

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
