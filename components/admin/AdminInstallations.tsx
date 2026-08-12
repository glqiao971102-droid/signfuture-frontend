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

const EMPTY_FORM = {
  installDate: "",
  startTime: "",
  endTime: "",
  invoiceNo: "",
  customerPhone: "",
  installerName: "",
  installerPhone: "",
};

export default function AdminInstallations() {
  // ----- customer picker -----
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<AdminUserRow[]>([]);
  const [searching, setSearching] = useState(false);
  const [picked, setPicked] = useState<{ id: number; name: string } | null>(null);

  useEffect(() => {
    if (picked) return;
    const term = search.trim();
    if (!term) {
      setResults([]);
      return;
    }
    setSearching(true);
    const t = setTimeout(() => {
      api
        .adminUsers({ search: term, perPage: 12 })
        .then((r) => setResults(r.data))
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(t);
  }, [search, picked]);

  // ----- installations for the picked customer -----
  const [rows, setRows] = useState<InstallationRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [year, setYear] = useState<string>("all");

  const load = useCallback((userId: number) => {
    setLoading(true);
    setError(null);
    api
      .adminInstallations(userId)
      .then((r) => setRows(r.data))
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load installations"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (picked) load(picked.id);
    else {
      setRows([]);
      setYear("all");
    }
  }, [picked, load]);

  const years = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => {
      if (r.installDate && /^\d{4}/.test(r.installDate)) set.add(r.installDate.slice(0, 4));
    });
    return [...set].sort().reverse();
  }, [rows]);

  const visible = useMemo(
    () => (year === "all" ? rows : rows.filter((r) => (r.installDate || "").startsWith(year))),
    [rows, year],
  );

  // ----- add form -----
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const setField = (k: keyof typeof EMPTY_FORM, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    if (!picked || saving) return;
    setSaving(true);
    try {
      await api.adminCreateInstallation({
        userId: picked.id,
        installDate: form.installDate || undefined,
        startTime: form.startTime || undefined,
        endTime: form.endTime || undefined,
        invoiceNo: form.invoiceNo || undefined,
        customerPhone: form.customerPhone || undefined,
        installerName: form.installerName || undefined,
        installerPhone: form.installerPhone || undefined,
      });
      setForm({ ...EMPTY_FORM });
      setShowForm(false);
      load(picked.id);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Could not save installation.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: number) => {
    if (!picked) return;
    if (!confirm("Delete this installation record? This cannot be undone.")) return;
    try {
      await api.adminDeleteInstallation(id);
      load(picked.id);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Could not delete.");
    }
  };

  return (
    <div className="adm-wrap">
      <h1 className="adm-title">Installations</h1>
      <p className="adm-sub">Pick a customer to see every installation on record — filter by year, add new, or delete.</p>

      {!picked ? (
        <div className="inst-picker">
          <input
            className="adm-search"
            type="search"
            placeholder="Search customer by login, email or name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
          {search.trim() && (
            <div className="inst-results">
              {searching && <div className="adm-empty">Searching…</div>}
              {!searching && results.length === 0 && <div className="adm-empty">No customers match.</div>}
              {results.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  className="inst-result"
                  onClick={() => {
                    setPicked({ id: u.id, name: u.login || u.email });
                    setSearch("");
                    setResults([]);
                  }}
                >
                  <span className="inst-result-name">{u.login || u.email}</span>
                  <span className="inst-result-meta">
                    {u.email} · #{u.memberNo || u.id}
                    {u.tier ? ` · ${u.tier}` : ""}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="inst-head">
            <div>
              <span className="inst-head-label">Customer</span>
              <strong className="inst-head-name">{picked.name}</strong>
            </div>
            <button type="button" className="adm-filter" onClick={() => setPicked(null)}>
              ← Change customer
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
        </>
      )}
    </div>
  );
}
