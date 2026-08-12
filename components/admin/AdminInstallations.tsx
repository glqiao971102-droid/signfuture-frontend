"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api, type AdminUserRow, type InstallationRow } from "@/lib/api";

// 12-hour AM/PM labels in 30-minute steps; the stored value stays 24-hour "HH:MM".
const TIME_OPTIONS: { value: string; label: string }[] = (() => {
  const out: { value: string; label: string }[] = [];
  for (let h = 0; h < 24; h += 1) {
    for (const m of [0, 30]) {
      const value = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
      const h12 = h % 12 || 12;
      const suffix = h < 12 ? "AM" : "PM";
      out.push({ value, label: `${h12}:${String(m).padStart(2, "0")} ${suffix}` });
    }
  }
  return out;
})();

function timeLabel(v: string | null): string {
  if (!v) return "";
  return TIME_OPTIONS.find((o) => o.value === v)?.label ?? v;
}

const money = (n: number) =>
  n.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function formatDate(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value.includes("T") ? value : value.replace(" ", "T"));
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-MY", { day: "2-digit", month: "short", year: "numeric" });
}

const PER_PAGE = 25;
const ROLE_FILTERS = [
  { value: "", label: "All" },
  { value: "Diamond", label: "Diamond" },
  { value: "Gold", label: "Gold" },
  { value: "Silver", label: "Silver" },
  { value: "customer", label: "No tier" },
  { value: "admin", label: "Admins" },
];

const EMPTY_FORM = {
  installDate: "",
  startTime: "",
  endTime: "",
  invoiceNo: "",
  customerPhone: "",
  installerName: "",
  installerPhone: "",
  address: "",
};

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
    /* ignore */
  }
  return null;
}

export default function AdminInstallations() {
  const [picked, setPicked] = useState<{ id: number; name: string } | null>(null);

  // ---------- Users list (shown until a customer is picked) ----------
  const [rows, setRows] = useState<AdminUserRow[]>([]);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const loadUsers = useCallback(async (p: number, searchTerm: string, roleFilter: string) => {
    setListLoading(true);
    setListError(null);
    try {
      const res = await api.adminUsers({
        page: p,
        perPage: PER_PAGE,
        search: searchTerm || undefined,
        role: roleFilter || undefined,
      });
      setRows(res.data);
      setLastPage(res.meta.lastPage);
      setTotal(res.meta.total);
    } catch (err) {
      setListError(err instanceof Error ? err.message : "Could not load users");
      setRows([]);
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      setPage(1);
      void loadUsers(1, search, role);
    }, 300);
    return () => clearTimeout(t);
  }, [search, role, loadUsers]);

  useEffect(() => {
    void loadUsers(page, search, role);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  // ---------- Installations for the picked customer ----------
  const [installs, setInstalls] = useState<InstallationRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [year, setYear] = useState<string>("all");

  const loadInstalls = useCallback((userId: number) => {
    setLoading(true);
    setError(null);
    api
      .adminInstallations(userId)
      .then((r) => setInstalls(r.data))
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load installations"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (picked) loadInstalls(picked.id);
    else {
      setInstalls([]);
      setYear("all");
    }
  }, [picked, loadInstalls]);

  const years = useMemo(() => {
    const set = new Set<string>();
    installs.forEach((r) => {
      if (r.installDate && /^\d{4}/.test(r.installDate)) set.add(r.installDate.slice(0, 4));
    });
    return [...set].sort().reverse();
  }, [installs]);

  const visible = useMemo(
    () => (year === "all" ? installs : installs.filter((r) => (r.installDate || "").startsWith(year))),
    [installs, year],
  );

  // ---------- Add form ----------
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const setField = (k: keyof typeof EMPTY_FORM, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    if (!picked || saving) return;
    setSaving(true);
    try {
      const geo = form.address.trim() ? await geocode(form.address.trim()) : null;
      await api.adminCreateInstallation({
        userId: picked.id,
        installDate: form.installDate || undefined,
        startTime: form.startTime || undefined,
        endTime: form.endTime || undefined,
        invoiceNo: form.invoiceNo || undefined,
        customerPhone: form.customerPhone || undefined,
        installerName: form.installerName || undefined,
        installerPhone: form.installerPhone || undefined,
        address: form.address || undefined,
        lat: geo?.lat,
        lng: geo?.lng,
      });
      setForm({ ...EMPTY_FORM });
      setShowForm(false);
      loadInstalls(picked.id);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Could not save installation.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (recordId: number) => {
    if (!picked) return;
    if (!confirm("Delete this installation record? This cannot be undone.")) return;
    try {
      await api.adminDeleteInstallation(recordId);
      loadInstalls(picked.id);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Could not delete.");
    }
  };

  // ================= USERS LIST VIEW =================
  if (!picked) {
    return (
      <div className="adm-wrap">
        <h1 className="adm-title">Installations</h1>
        <p className="adm-sub">Pick a customer to see and manage their installation records.</p>

        <div className="adm-toolbar">
          <input
            className="adm-search"
            type="search"
            placeholder="Search login, email or name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="adm-filters">
            {ROLE_FILTERS.map((f) => (
              <button
                key={f.value || "all"}
                type="button"
                className={`adm-filter${role === f.value ? " is-active" : ""}`}
                onClick={() => setRole(f.value)}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="adm-count">
          {listLoading ? "Loading…" : `${total.toLocaleString()} customer${total === 1 ? "" : "s"} — click a row`}
        </div>

        {listError && <div className="quote-empty">{listError}</div>}

        {!listError && (
          <div className="adm-table-scroll">
            <table className="adm-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Login</th>
                  <th>Email</th>
                  <th>Tier</th>
                  <th className="adm-num">Wallet (RM)</th>
                  <th>Registered</th>
                </tr>
              </thead>
              <tbody>
                {listLoading && rows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="adm-empty">
                      Loading customers…
                    </td>
                  </tr>
                )}
                {!listLoading && rows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="adm-empty">
                      No customers match.
                    </td>
                  </tr>
                )}
                {rows.map((u) => (
                  <tr
                    key={u.id}
                    className="adm-row-click"
                    onClick={() => setPicked({ id: u.id, name: u.login || u.email })}
                    title="View installations"
                  >
                    <td className="adm-mono">{u.id}</td>
                    <td className="adm-login">{u.login}</td>
                    <td className="adm-email">{u.email}</td>
                    <td>
                      <span
                        className={
                          u.isAdmin
                            ? "adm-chip adm-chip-admin"
                            : u.tier
                              ? `adm-chip tier-${u.tier.toLowerCase()}`
                              : "adm-chip adm-chip-member"
                        }
                      >
                        {u.isAdmin ? "ADMIN" : u.tier ?? "Member"}
                      </span>
                    </td>
                    <td className="adm-num adm-mono">{money(u.walletBalance)}</td>
                    <td className="adm-date">{formatDate(u.registeredAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

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
      </div>
    );
  }

  // ================= ONE CUSTOMER'S INSTALLATIONS =================
  return (
    <div className="adm-wrap">
      <h1 className="adm-title">Installations</h1>

      <div className="inst-head">
        <div>
          <span className="inst-head-label">Customer</span>
          <strong className="inst-head-name">{picked.name}</strong>
        </div>
        <button type="button" className="adm-filter" onClick={() => setPicked(null)}>
          ← Back to customers
        </button>
      </div>

      <div className="adm-toolbar">
        <div className="adm-filters">
          <button
            type="button"
            className={`adm-filter${year === "all" ? " is-active" : ""}`}
            onClick={() => setYear("all")}
          >
            All years
          </button>
          {years.map((y) => (
            <button
              key={y}
              type="button"
              className={`adm-filter${year === y ? " is-active" : ""}`}
              onClick={() => setYear(y)}
            >
              {y}
            </button>
          ))}
        </div>
        <button type="button" className="hero-btn primary inst-add" onClick={() => setShowForm((s) => !s)}>
          {showForm ? "Close" : "+ Add installation"}
        </button>
      </div>

      {showForm && (
        <form
          className="inst-form"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <div className="inst-form-grid">
            <label className="inst-full">
              Installation date
              <input type="date" value={form.installDate} onChange={(e) => setField("installDate", e.target.value)} />
            </label>
            <label className="inst-full">
              Time (from – to)
              <span className="inst-time">
                <select value={form.startTime} onChange={(e) => setField("startTime", e.target.value)}>
                  <option value="">--:-- --</option>
                  {TIME_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <span className="inst-time-dash">–</span>
                <select value={form.endTime} onChange={(e) => setField("endTime", e.target.value)}>
                  <option value="">--:-- --</option>
                  {TIME_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </span>
            </label>
            <label className="inst-full">
              Installation address
              <input
                type="text"
                placeholder="Street, area, postcode, state (for the customer's map pin)"
                value={form.address}
                onChange={(e) => setField("address", e.target.value)}
              />
            </label>
            <label>
              Invoice No / Job
              <input
                type="text"
                placeholder="IV2606-001"
                value={form.invoiceNo}
                onChange={(e) => setField("invoiceNo", e.target.value)}
              />
            </label>
            <label>
              Customer contact no.
              <input
                type="tel"
                placeholder="01x-xxx xxxx"
                value={form.customerPhone}
                onChange={(e) => setField("customerPhone", e.target.value)}
              />
            </label>
            <label>
              Installer name (给谁做)
              <input
                type="text"
                placeholder="Installer name"
                value={form.installerName}
                onChange={(e) => setField("installerName", e.target.value)}
              />
            </label>
            <label>
              Installer contact no.
              <input
                type="tel"
                placeholder="01x-xxx xxxx"
                value={form.installerPhone}
                onChange={(e) => setField("installerPhone", e.target.value)}
              />
            </label>
          </div>
          <div className="inst-form-actions">
            <button type="submit" className="hero-btn primary" disabled={saving}>
              {saving ? "Saving…" : "Save installation"}
            </button>
            <button
              type="button"
              className="adm-filter"
              onClick={() => {
                setShowForm(false);
                setForm({ ...EMPTY_FORM });
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="adm-count">
        {loading ? "Loading…" : `${visible.length} installation${visible.length === 1 ? "" : "s"}`}
      </div>
      {error && <div className="quote-empty">{error}</div>}

      {!error && (
        <div className="adm-table-scroll">
          <table className="adm-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Time</th>
                <th>Invoice / Job</th>
                <th>Customer phone</th>
                <th>Installer</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {loading && visible.length === 0 && (
                <tr>
                  <td colSpan={6} className="adm-empty">
                    Loading…
                  </td>
                </tr>
              )}
              {!loading && visible.length === 0 && (
                <tr>
                  <td colSpan={6} className="adm-empty">
                    No installations recorded{year === "all" ? "" : ` for ${year}`}.
                  </td>
                </tr>
              )}
              {visible.map((r) => (
                <tr key={r.id}>
                  <td>{r.installDate || "—"}</td>
                  <td>
                    {r.startTime
                      ? `${timeLabel(r.startTime)}${r.endTime ? ` – ${timeLabel(r.endTime)}` : ""}`
                      : "—"}
                  </td>
                  <td>{r.invoiceNo || "—"}</td>
                  <td>{r.customerPhone || "—"}</td>
                  <td>
                    {r.installerName || r.installerPhone
                      ? `${r.installerName || ""}${r.installerPhone ? ` (${r.installerPhone})` : ""}`
                      : "—"}
                  </td>
                  <td>
                    <button type="button" className="inst-del" onClick={() => remove(r.id)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
