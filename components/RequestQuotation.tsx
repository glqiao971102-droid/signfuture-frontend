"use client";

import { useEffect, useRef, useState } from "react";
import { api, ApiError, type QuotationFile } from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";

// The services a member can request a quote for. Mirrors the live catalogue
// categories, plus "Other" for anything bespoke.
const CATEGORIES = [
  "3D LED Box Up",
  "Signboard / Lightbox",
  "Neon Sign",
  "Inkjet Printing",
  "Acrylic",
  "Display System / Banner Stand",
  "Fabric Display / Flag",
  "Materials",
  "Other (describe below)",
];

const UNITS = ["ft", "in", "cm", "mm", "m"] as const;

const MAX_FILES = 10;

// Fallback WhatsApp number (the main sales line) when the member has no
// assigned consultant on file.
const FALLBACK_WA = "60179907559";

// Turn a local/intl phone into a wa.me-friendly number (Malaysia default).
function waNumber(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("60")) return digits;
  if (digits.startsWith("0")) return `60${digits.slice(1)}`;
  return digits;
}

export default function RequestQuotation() {
  const { user } = useAuth();

  const [category, setCategory] = useState("");
  const [title, setTitle] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [width, setWidth] = useState("");
  const [height, setHeight] = useState("");
  const [unit, setUnit] = useState<(typeof UNITS)[number]>("ft");
  const [targetDate, setTargetDate] = useState("");
  const [installation, setInstallation] = useState(false);
  const [remark, setRemark] = useState("");
  const [files, setFiles] = useState<QuotationFile[]>([]);

  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // The member's consultant — so the submit can ping them on WhatsApp.
  const [consultant, setConsultant] = useState<{ name: string; phone: string | null } | null>(null);
  useEffect(() => {
    api.myConsultant().then((r) => setConsultant(r.consultant)).catch(() => {});
  }, []);

  // Build the WhatsApp message + open the consultant's chat pre-filled.
  function notifyConsultant(sent: {
    category: string;
    title: string;
    quantity: number;
    width: string;
    height: string;
    unit: string;
    targetDate: string;
    installation: boolean;
    remark: string;
    files: QuotationFile[];
  }) {
    const wa = waNumber(consultant?.phone) ?? FALLBACK_WA;
    const size = sent.width || sent.height ? `${sent.width || "?"} × ${sent.height || "?"} ${sent.unit}` : "—";
    const lines = [
      `Hi${consultant?.name ? ` ${consultant.name.split(" ")[0]}` : ""}, I'd like a quotation.`,
      `Member: ${user?.name ?? ""}${user?.memberNo ? ` (${user.memberNo})` : ""}`,
      `Product: ${sent.category}`,
      `Project: ${sent.title}`,
      `Qty: ${sent.quantity}`,
      `Size: ${size}`,
      sent.targetDate ? `Target: ${sent.targetDate}` : "",
      `Installation: ${sent.installation ? "Yes" : "No"}`,
      sent.remark ? `Notes: ${sent.remark}` : "",
      sent.files.length ? `Files:\n${sent.files.map((f) => `• ${f.name}: ${f.url}`).join("\n")}` : "",
    ].filter(Boolean);
    const url = `https://api.whatsapp.com/send?phone=${wa}&text=${encodeURIComponent(lines.join("\n"))}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  async function onPickFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);
    if (fileRef.current) fileRef.current.value = "";
    if (!picked.length) return;
    if (files.length + picked.length > MAX_FILES) {
      setMsg({ ok: false, text: `You can attach up to ${MAX_FILES} files.` });
      return;
    }
    setUploading(true);
    setMsg(null);
    try {
      const uploaded: QuotationFile[] = [];
      for (const f of picked) {
        const { url } = await api.uploadFile(f);
        uploaded.push({ url, name: f.name });
      }
      setFiles((prev) => [...prev, ...uploaded]);
    } catch (err) {
      setMsg({ ok: false, text: err instanceof ApiError ? err.message : "Upload failed. Please try again." });
    } finally {
      setUploading(false);
    }
  }

  function removeFile(url: string) {
    setFiles((prev) => prev.filter((f) => f.url !== url));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!category) {
      setMsg({ ok: false, text: "Please choose what you need a quote for." });
      return;
    }
    if (!title.trim()) {
      setMsg({ ok: false, text: "Please give your project a short title." });
      return;
    }
    setSubmitting(true);
    setMsg(null);
    try {
      const qty = Math.max(1, Math.round(Number(quantity) || 1));
      await api.createQuotation({
        category,
        title: title.trim(),
        quantity: qty,
        width: width ? Number(width) : undefined,
        height: height ? Number(height) : undefined,
        unit: width || height ? unit : undefined,
        targetDate: targetDate || undefined,
        installation,
        remark: remark.trim() || undefined,
        files,
      });
      setMsg({ ok: true, text: "Request sent! Opening WhatsApp so your consultant can follow up right away." });
      // Ping the consultant on WhatsApp with the summary + file links.
      notifyConsultant({
        category, title: title.trim(), quantity: qty, width, height, unit, targetDate, installation, remark: remark.trim(), files,
      });
      // Reset the form for the next request.
      setCategory("");
      setTitle("");
      setQuantity("1");
      setWidth("");
      setHeight("");
      setTargetDate("");
      setInstallation(false);
      setRemark("");
      setFiles([]);
    } catch (err) {
      setMsg({ ok: false, text: err instanceof ApiError ? err.message : "Could not send your request." });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rfq-wrap">
      <form className="acct-card acct-section-card" onSubmit={submit}>
        <div className="acct-card-head">
          <h2>Request Quotation</h2>
          <span>Tell us what you need — attach your files and process notes, and we&apos;ll quote you.</span>
        </div>

        <div className="edit-detail-grid">
          <label>
            What do you need a quote for?
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">Select a product / service…</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </label>
          <label>
            Quantity
            <input
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </label>
          <label className="span-2">
            Project title
            <input
              value={title}
              placeholder="e.g. Shopfront signboard for new outlet"
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>

          <label>
            Width
            <input type="number" min={0} value={width} placeholder="optional" onChange={(e) => setWidth(e.target.value)} />
          </label>
          <label>
            Height
            <div className="rfq-size-row">
              <input type="number" min={0} value={height} placeholder="optional" onChange={(e) => setHeight(e.target.value)} />
              <select value={unit} onChange={(e) => setUnit(e.target.value as (typeof UNITS)[number])} aria-label="Unit">
                {UNITS.map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>
          </label>

          <label>
            Target completion date
            <input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
          </label>
          <label className="rfq-check-label">
            <input type="checkbox" checked={installation} onChange={(e) => setInstallation(e.target.checked)} />
            <span>On-site installation needed</span>
          </label>

          <label className="span-2">
            Craftsmanship / process notes
            <textarea
              className="rfq-textarea"
              rows={4}
              value={remark}
              placeholder="Material, finishing, colours, thickness, mounting, lighting, special process — anything that affects the quote."
              onChange={(e) => setRemark(e.target.value)}
            />
          </label>
        </div>

        {/* Reference files */}
        <div className="rfq-files">
          <span className="edit-detail-professions-label">
            Reference files <span className="login-optional">(artwork, photos, PDF — up to {MAX_FILES})</span>
          </span>
          <div className="rfq-file-picker">
            <button
              type="button"
              className="hero-btn ghost rfq-file-btn"
              disabled={uploading || files.length >= MAX_FILES}
              onClick={() => fileRef.current?.click()}
            >
              {uploading ? "Uploading…" : "＋ Add files"}
            </button>
            <input
              ref={fileRef}
              type="file"
              multiple
              accept="image/*,application/pdf,.ai,.eps,.psd,.cdr"
              hidden
              onChange={onPickFiles}
            />
          </div>
          {files.length > 0 && (
            <ul className="rfq-file-list">
              {files.map((f) => (
                <li key={f.url}>
                  <span className="rfq-file-name">📎 {f.name}</span>
                  <button type="button" className="rfq-file-remove" onClick={() => removeFile(f.url)} aria-label={`Remove ${f.name}`}>
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="edit-detail-actions">
          <button type="submit" className="hero-btn primary" disabled={submitting || uploading}>
            {submitting ? "Sending…" : "Submit request"}
          </button>
          <p className="edit-detail-note">
            We&apos;ll reply to {user?.email ?? "your account email"}
            {user?.phone ? ` / ${user.phone}` : ""} via your consultant.
          </p>
        </div>
        {msg && (
          <p className="edit-detail-msg" style={{ color: msg.ok ? "#34d399" : "#f87171" }}>
            {msg.text}
          </p>
        )}
      </form>
    </div>
  );
}
