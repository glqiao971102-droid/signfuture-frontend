"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, type InstallationRow, type InstallationInput } from "@/lib/api";

// 12-hour AM/PM labels in 30-minute steps; the stored value stays 24-hour "HH:MM".
const TIME_OPTIONS: { value: string; label: string }[] = (() => {
  const out: { value: string; label: string }[] = [];
  for (let h = 0; h < 24; h += 1) {
    for (const m of [0, 30]) {
      const value = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
      const h12 = h % 12 || 12;
      out.push({ value, label: `${h12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}` });
    }
  }
  return out;
})();
const timeLabel = (v: string | null) => (v ? TIME_OPTIONS.find((o) => o.value === v)?.label ?? v : "");

function formatDate(value: string | null): string {
  if (!value) return "—";
  const d = new Date(`${value}T00:00:00`);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-MY", { day: "2-digit", month: "short", year: "numeric" });
}

// ---- Slippy-map (OpenStreetMap) math ----
function latLngToPixel(lat: number, lng: number, zoom: number) {
  const sinLat = Math.sin((lat * Math.PI) / 180);
  const scale = 256 * 2 ** zoom;
  return {
    x: ((lng + 180) / 360) * scale,
    y: (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * scale,
  };
}
function pixelToLatLng(x: number, y: number, zoom: number) {
  const scale = 256 * 2 ** zoom;
  const lng = (x / scale) * 360 - 180;
  const n = Math.PI - (2 * Math.PI * y) / scale;
  const lat = (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
  return { lat, lng };
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  if (!y || !m) return month;
  return new Date(y, m - 1, 1).toLocaleDateString("en-MY", { month: "long", year: "numeric" });
}
function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

type Pt = { lat: number; lng: number };
function fitView(points: Pt[], w: number, h: number): { lat: number; lng: number; zoom: number } {
  if (!points.length) return { lat: 4.2, lng: 108, zoom: 6 };
  if (points.length === 1) return { lat: points[0].lat, lng: points[0].lng, zoom: 12 };
  let minLat = 90,
    maxLat = -90,
    minLng = 180,
    maxLng = -180;
  for (const p of points) {
    minLat = Math.min(minLat, p.lat);
    maxLat = Math.max(maxLat, p.lat);
    minLng = Math.min(minLng, p.lng);
    maxLng = Math.max(maxLng, p.lng);
  }
  let zoom = 13;
  for (; zoom >= 3; zoom -= 1) {
    const a = latLngToPixel(maxLat, minLng, zoom);
    const b = latLngToPixel(minLat, maxLng, zoom);
    if (Math.abs(b.x - a.x) < w - 60 && Math.abs(b.y - a.y) < h - 60) break;
  }
  return { lat: (minLat + maxLat) / 2, lng: (minLng + maxLng) / 2, zoom };
}

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
    /* offline / blocked — no pin */
  }
  return null;
}

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

export default function MyInstallation() {
  const [rows, setRows] = useState<InstallationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    api
      .myInstallations()
      .then((r) => setRows(r.data))
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load installations"))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => load(), [load]);

  // ---- Calendar ----
  const [calMonth, setCalMonth] = useState<string>("");
  useEffect(() => {
    if (calMonth) return;
    const dates = (rows.map((r) => r.installDate).filter(Boolean) as string[]).sort();
    const now = new Date();
    setCalMonth(
      dates[dates.length - 1]?.slice(0, 7) ||
        `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`,
    );
  }, [rows, calMonth]);

  const calCells = useMemo(() => {
    if (!calMonth) return [] as ({ day: number; jobs: InstallationRow[] } | null)[];
    const [y, m] = calMonth.split("-").map(Number);
    const startDow = new Date(y, m - 1, 1).getDay();
    const daysInMonth = new Date(y, m, 0).getDate();
    const byDay: Record<number, InstallationRow[]> = {};
    rows.forEach((r) => {
      if ((r.installDate || "").startsWith(calMonth)) {
        const d = Number((r.installDate as string).slice(8, 10));
        (byDay[d] = byDay[d] || []).push(r);
      }
    });
    const cells: ({ day: number; jobs: InstallationRow[] } | null)[] = [];
    for (let i = 0; i < startDow; i += 1) cells.push(null);
    for (let d = 1; d <= daysInMonth; d += 1) cells.push({ day: d, jobs: byDay[d] || [] });
    return cells;
  }, [calMonth, rows]);

  // ---- Add form ----
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const setField = (k: keyof typeof EMPTY_FORM, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const body: InstallationInput = {
        installDate: form.installDate || undefined,
        startTime: form.startTime || undefined,
        endTime: form.endTime || undefined,
        invoiceNo: form.invoiceNo || undefined,
        customerPhone: form.customerPhone || undefined,
        installerName: form.installerName || undefined,
        installerPhone: form.installerPhone || undefined,
        address: form.address || undefined,
      };
      // Resolve the address to a map pin before saving (best-effort).
      if (form.address.trim()) {
        const c = await geocode(form.address.trim());
        if (c) {
          body.lat = c.lat;
          body.lng = c.lng;
        }
      }
      await api.addMyInstallation(body);
      setForm({ ...EMPTY_FORM });
      setShowForm(false);
      load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Could not save installation.");
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (r: InstallationRow) => {
    try {
      await api.completeMyInstallation(r.id, !r.completed);
      setRows((rs) => rs.map((x) => (x.id === r.id ? { ...x, completed: !x.completed } : x)));
    } catch {
      /* ignore */
    }
  };
  const remove = async (id: number) => {
    if (!confirm("Delete this installation?")) return;
    try {
      await api.deleteMyInstallation(id);
      setRows((rs) => rs.filter((x) => x.id !== id));
    } catch (e) {
      alert(e instanceof Error ? e.message : "Could not delete.");
    }
  };

  // ---- Map (fit-to-bounds by default; the user can zoom / drag to override) ----
  const mapRef = useRef<HTMLDivElement>(null);
  const [mapW, setMapW] = useState(0);
  const mapH = 360;
  const [manualView, setManualView] = useState<{ lat: number; lng: number; zoom: number } | null>(null);
  useEffect(() => {
    const el = mapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setMapW(el.clientWidth));
    ro.observe(el);
    setMapW(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const pins = useMemo(
    () =>
      rows
        .filter((r) => typeof r.lat === "number" && typeof r.lng === "number")
        .map((r) => ({ lat: r.lat as number, lng: r.lng as number, r })),
    [rows],
  );

  const view = manualView ?? (mapW ? fitView(pins, mapW, mapH) : { lat: 4.2, lng: 108, zoom: 6 });

  const zoomBy = (d: number) =>
    setManualView((v) => {
      const base = v ?? (mapW ? fitView(pins, mapW, mapH) : { lat: 4.2, lng: 108, zoom: 6 });
      return { ...base, zoom: Math.max(3, Math.min(18, base.zoom + d)) };
    });

  const drag = useRef<{ x: number; y: number; lat: number; lng: number; zoom: number } | null>(null);
  const onPointerDown = (e: React.PointerEvent) => {
    drag.current = { x: e.clientX, y: e.clientY, lat: view.lat, lng: view.lng, zoom: view.zoom };
    mapRef.current?.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const c = latLngToPixel(d.lat, d.lng, d.zoom);
    const nl = pixelToLatLng(c.x - (e.clientX - d.x), c.y - (e.clientY - d.y), d.zoom);
    setManualView({ lat: nl.lat, lng: nl.lng, zoom: d.zoom });
  };
  const onPointerUp = (e: React.PointerEvent) => {
    drag.current = null;
    mapRef.current?.releasePointerCapture(e.pointerId);
  };

  const tilesAndMarkers = useMemo(() => {
    if (!mapW) return null;
    const center = latLngToPixel(view.lat, view.lng, view.zoom);
    const maxTile = 2 ** view.zoom;
    const tiles: { key: string; left: number; top: number; src: string }[] = [];
    const sx = Math.floor((center.x - mapW / 2) / 256);
    const ex = Math.floor((center.x + mapW / 2) / 256);
    const sy = Math.floor((center.y - mapH / 2) / 256);
    const ey = Math.floor((center.y + mapH / 2) / 256);
    for (let x = sx; x <= ex; x += 1) {
      for (let y = sy; y <= ey; y += 1) {
        if (y < 0 || y >= maxTile) continue;
        const wx = ((x % maxTile) + maxTile) % maxTile;
        tiles.push({
          key: `${x}_${y}`,
          left: x * 256 - center.x + mapW / 2,
          top: y * 256 - center.y + mapH / 2,
          src: `https://tile.openstreetmap.org/${view.zoom}/${wx}/${y}.png`,
        });
      }
    }
    const markers = pins.map((p, i) => {
      const px = latLngToPixel(p.lat, p.lng, view.zoom);
      return {
        key: p.r.id,
        left: px.x - center.x + mapW / 2 + (i ? Math.cos(i) * 8 : 0),
        top: px.y - center.y + mapH / 2 + (i ? Math.sin(i) * 8 : 0),
        completed: p.r.completed,
        title: `${p.r.invoiceNo || "Installation"} — ${p.r.address || ""}`,
      };
    });
    return { tiles, markers };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pins, mapW, view.lat, view.lng, view.zoom]);

  return (
    <section className="acct-card acct-section-card">
      <div className="acct-card-head">
        <h2>My Installation</h2>
        <span>Your installation calendar pins and jobs — kept in sync with our records.</span>
      </div>

      {/* Calendar */}
      <div className="myinst-cal">
        <div className="myinst-cal-head">
          <button type="button" className="myinst-cal-nav" onClick={() => setCalMonth((mth) => shiftMonth(mth, -1))} aria-label="Previous month">
            ‹
          </button>
          <strong>{calMonth ? monthLabel(calMonth) : ""}</strong>
          <button type="button" className="myinst-cal-nav" onClick={() => setCalMonth((mth) => shiftMonth(mth, 1))} aria-label="Next month">
            ›
          </button>
        </div>
        <div className="myinst-cal-grid">
          {WEEKDAYS.map((w) => (
            <span key={w} className="myinst-cal-dow">
              {w}
            </span>
          ))}
          {calCells.map((c, i) =>
            c === null ? (
              <span key={`e${i}`} className="myinst-cal-cell is-empty" />
            ) : (
              <span
                key={c.day}
                className={`myinst-cal-cell${c.jobs.length ? " has-jobs" : ""}`}
                title={c.jobs.map((j) => j.invoiceNo || "Installation").join(", ")}
              >
                <span className="myinst-cal-day">{c.day}</span>
                {c.jobs.length > 0 && <span className="myinst-cal-dot">🚚 {c.jobs.length}</span>}
              </span>
            ),
          )}
        </div>
      </div>

      {/* Map */}
      <div
        ref={mapRef}
        className="myinst-map"
        style={{ height: mapH, cursor: drag.current ? "grabbing" : "grab" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {tilesAndMarkers?.tiles.map((t) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={t.key}
            className="myinst-tile"
            src={t.src}
            alt=""
            loading="lazy"
            draggable={false}
            style={{ left: t.left, top: t.top }}
          />
        ))}
        {tilesAndMarkers?.markers.map((m) => (
          <span
            key={m.key}
            className={`myinst-pin${m.completed ? " is-done" : ""}`}
            style={{ left: m.left, top: m.top }}
            title={m.title}
          >
            🚚
          </span>
        ))}
        {pins.length === 0 && <div className="myinst-map-empty">No mapped addresses yet</div>}
        <div className="myinst-map-zoom">
          <button type="button" onClick={() => zoomBy(1)} aria-label="Zoom in">
            +
          </button>
          <button type="button" onClick={() => zoomBy(-1)} aria-label="Zoom out">
            −
          </button>
          {manualView && (
            <button type="button" onClick={() => setManualView(null)} title="Reset view" aria-label="Reset view">
              ⤾
            </button>
          )}
        </div>
        <span className="myinst-map-credit">OpenStreetMap</span>
      </div>

      {/* Jobs */}
      <div className="myinst-jobs-head">
        <h3>Installation Jobs</h3>
        <button type="button" className="hero-btn primary" onClick={() => setShowForm((s) => !s)}>
          {showForm ? "Close" : "+ Add New Installation"}
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
                placeholder="Street, area, postcode, state (for the map pin)"
                value={form.address}
                onChange={(e) => setField("address", e.target.value)}
              />
            </label>
            <label>
              Invoice No / Job
              <input type="text" placeholder="IV2606-001" value={form.invoiceNo} onChange={(e) => setField("invoiceNo", e.target.value)} />
            </label>
            <label>
              Customer contact no.
              <input type="tel" placeholder="01x-xxx xxxx" value={form.customerPhone} onChange={(e) => setField("customerPhone", e.target.value)} />
            </label>
            <label>
              Installer name
              <input type="text" placeholder="Installer name" value={form.installerName} onChange={(e) => setField("installerName", e.target.value)} />
            </label>
            <label>
              Installer contact no.
              <input type="tel" placeholder="01x-xxx xxxx" value={form.installerPhone} onChange={(e) => setField("installerPhone", e.target.value)} />
            </label>
          </div>
          <div className="inst-form-actions">
            <button type="submit" className="hero-btn primary" disabled={saving}>
              {saving ? "Saving…" : "Save installation"}
            </button>
            <button type="button" className="adm-filter" onClick={() => { setShowForm(false); setForm({ ...EMPTY_FORM }); }}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {error && <p className="order-lines-msg">{error}</p>}
      {!error && (
        <div className="myinst-list">
          {loading && rows.length === 0 && <p className="order-lines-msg">Loading…</p>}
          {!loading && rows.length === 0 && <p className="order-lines-msg">No installations yet.</p>}
          {rows.map((r) => (
            <article key={r.id} className={`myinst-job${r.completed ? " is-done" : ""}`}>
              <span className="myinst-job-icon" aria-hidden="true">🚚</span>
              <div className="myinst-job-main">
                <strong>{r.invoiceNo || "Installation job"}</strong>
                {r.address && <span className="myinst-job-addr">{r.address}</span>}
                <span className="myinst-job-sub">
                  {r.installerName || r.installerPhone
                    ? `Installer: ${r.installerName || ""}${r.installerPhone ? ` ${r.installerPhone}` : ""}`
                    : ""}
                  {r.customerPhone ? ` · Customer: ${r.customerPhone}` : ""}
                </span>
              </div>
              <div className="myinst-job-time">
                <strong>{formatDate(r.installDate)}</strong>
                <span>
                  {r.startTime ? `${timeLabel(r.startTime)}${r.endTime ? ` – ${timeLabel(r.endTime)}` : ""}` : "—"}
                </span>
              </div>
              <label className="myinst-check" title="Completed">
                <input type="checkbox" checked={r.completed} onChange={() => toggle(r)} />
                <span>✓</span>
              </label>
              <button type="button" className="myinst-del" title="Delete" onClick={() => remove(r.id)}>
                ✕
              </button>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
