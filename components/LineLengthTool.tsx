"use client";

import { useRef, useState } from "react";
import { getToken } from "@/lib/api";

/** "1.2 MB" — a compact human file size. */
function prettySize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Shape returned by POST /api/line-length (see lib/linelen/analyze.ts). */
type LineLengthResult = {
  file: string;
  mode: "vector" | "raster";
  measurementScale: number;
  renderScale: number;
  dpi: number;
  pageWidthIn: number;
  pageHeightIn: number;
  contentWidthIn: number;
  contentHeightIn: number;
  lengthMetres: number;
  lengthFeet: number;
  lineWidthMm: number;
  inkPixels: number;
  skeletonPixels: number;
  vectorPaths: number;
  previewDataUrl: string;
};

const IN_PER_FT = 12;

/** "31.0 in · 2 ft 7.0 in" — inches, with a feet+inches breakdown. */
function inchLabel(inches: number): string {
  if (!inches) return "—";
  const ft = Math.floor(inches / IN_PER_FT);
  const rem = inches - ft * IN_PER_FT;
  const parts = ft > 0 ? `${ft} ft ${rem.toFixed(1)} in` : `${rem.toFixed(1)} in`;
  return `${inches.toFixed(1)} in · ${parts}`;
}

/**
 * Member-facing Neon Line Length tool (My Account → Neon Line Length). Upload a black &
 * white artwork; it measures the size and the total metres of the black lines.
 */
export default function LineLengthTool() {
  const [file, setFile] = useState<File | null>(null);
  const [scale, setScale] = useState<"1" | "10">("1");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<LineLengthResult | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  function pickFile(f: File | null) {
    setFile(f);
    setResult(null);
    setError(null);
  }

  async function run() {
    if (!file) {
      setError("Choose an artwork file first (.ai or .pdf).");
      return;
    }
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const token = getToken();
      const qs = new URLSearchParams({ scale, name: file.name });
      const res = await fetch(`/api/line-length?${qs}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/octet-stream",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: await file.arrayBuffer(),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.message || `Analyze failed (${res.status})`);
      setResult(body as LineLengthResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  const step = file ? 2 : 1;
  const stepCls = (n: number) => `an-step${n === step ? " is-active" : ""}${n < step ? " is-done" : ""}`;

  return (
    <section className="an-tool">
      <input
        ref={inputRef}
        type="file"
        accept=".ai,.pdf,application/pdf,application/postscript,application/illustrator"
        hidden
        onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
      />

      {/* Header */}
      <div className="an-head">
        <span className="an-logo" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18" /><path d="m7 14 4-4 3 3 5-6" /></svg>
        </span>
        <div className="an-head-text">
          <div className="an-title-row">
            <h2>Neon Line Length</h2>
            <span className="an-badge">NEON CALCULATOR</span>
          </div>
          <p>Upload a black &amp; white artwork (.ai / .pdf) — it measures the size and the total length of the black lines, like the neon calculator.</p>
        </div>
      </div>

      {/* Steps */}
      <div className="an-steps">
        <div className={stepCls(1)}><span className="an-step-n">1</span> Upload Artwork</div>
        <div className={`an-step-line${step > 1 ? " is-done" : ""}`} />
        <div className={stepCls(2)}><span className="an-step-n">2</span> Measure</div>
      </div>

      {/* Upload + Measurement Setup (two panels, side by side) */}
      <div className="an-panels an-panels-3d">
        {/* Left: Upload */}
        <div className="an-panel an-panel-upload">
          <div className="an-panel-head">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 16V4" /><path d="m7 9 5-5 5 5" /><path d="M5 20h14" /></svg>
            Upload Artwork
          </div>
          <div
            role="button"
            tabIndex={0}
            className={`an-drop an-drop-fill${dragOver ? " is-drag" : ""}${file ? " has-file" : ""}`}
            onClick={() => inputRef.current?.click()}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") inputRef.current?.click(); }}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); pickFile(e.dataTransfer.files?.[0] ?? null); }}
          >
            <span className="an-drop-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 16V4" /><path d="m7 9 5-5 5 5" /><path d="M5 20h14" /></svg>
            </span>
            <div className="an-drop-main">
              <strong>{file ? file.name : "Drop artwork here"}</strong>
              <span>{file ? `${prettySize(file.size)} · click to change file` : "AI, PDF supported · black & white line art"}</span>
              <button type="button" className="an-browse" onClick={(e) => { e.stopPropagation(); inputRef.current?.click(); }}>
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20h16a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1h-7.5l-2-2H4a1 1 0 0 0-1 1v13a1 1 0 0 0 1 1Z" /></svg>
                Browse Files
              </button>
            </div>
          </div>
        </div>

        {/* Right: Measurement Setup */}
        <div className="an-panel">
          <div className="an-panel-head">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6h10M18 6h2M4 12h2M10 12h10M4 18h8M16 18h4" /><circle cx="16" cy="6" r="2" /><circle cx="8" cy="12" r="2" /><circle cx="14" cy="18" r="2" /></svg>
            Measurement Setup
          </div>
          <div className="an-field">
            <span className="an-field-label">File scale</span>
            <div className="an-select">
              <select value={scale} onChange={(e) => setScale(e.target.value as "1" | "10")}>
                <option value="1">Original file (1:1)</option>
                <option value="10">10× reduced (show real size)</option>
              </select>
              <span className="an-select-chev" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
              </span>
            </div>
          </div>
          <p className="an-setup-note">
            Choose <strong>10× reduced</strong> if your file was drawn at 1:10 — the size and line
            length will be shown at real scale. Vector art is measured exactly; flattened images are
            estimated to within ~5%.
          </p>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="an-bottom">
        <div className="an-summary">
          <span className="an-summary-ic" aria-hidden="true"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18" /><path d="m7 14 4-4 3 3 5-6" /></svg></span>
          <div>
            <strong>{scale === "1" ? "Original file (1:1)" : "10× reduced"}</strong>
            <span className="an-summary-status">{busy ? "Measuring…" : file ? "Ready to measure" : "Waiting for artwork"}<i className={file && !busy ? "on" : ""} /></span>
          </div>
        </div>
        <button type="button" className="an-generate" onClick={run} disabled={busy || !file}>
          {busy ? (<><span className="ll-spin" aria-hidden="true" /> Measuring…</>) : (
            <>
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 3v18h18" /><path d="m7 15 4-4 3 3 5-6" /></svg>
              Measure
            </>
          )}
        </button>
      </div>

      {error && <p className="ll-error an-error">⚠ {error}</p>}

      {result && (
        <div className="ll-results ll-results-acct">
          <div className="ll-numbers">
            <div className="ll-headline">
              <span className="ll-headline-label">
                Black-line length
                <span className={`ll-badge ${result.mode}`}>
                  {result.mode === "vector" ? "EXACT · vector" : "ESTIMATE · from image"}
                </span>
              </span>
              <span className="ll-headline-value">{result.lengthMetres.toFixed(2)} m</span>
              <span className="ll-headline-sub">≈ {result.lengthFeet.toFixed(1)} ft</span>
            </div>

            <dl className="ll-stats">
              <div>
                <dt>Artwork size (content)</dt>
                <dd>
                  {inchLabel(result.contentWidthIn)} <span className="ll-x">×</span>{" "}
                  {inchLabel(result.contentHeightIn)}
                </dd>
              </div>
              <div>
                <dt>Page / artboard</dt>
                <dd>
                  {result.pageWidthIn.toFixed(1)} in × {result.pageHeightIn.toFixed(1)} in
                </dd>
              </div>
              {result.mode === "vector" ? (
                <div>
                  <dt>Vector paths</dt>
                  <dd>{result.vectorPaths} paths measured</dd>
                </div>
              ) : (
                <div>
                  <dt>Line thickness (avg)</dt>
                  <dd>{result.lineWidthMm ? `${result.lineWidthMm.toFixed(1)} mm` : "—"}</dd>
                </div>
              )}
              <div>
                <dt>File scale</dt>
                <dd>
                  {result.measurementScale}× {result.mode === "raster" ? `· ${result.dpi} DPI` : ""}
                </dd>
              </div>
            </dl>

            {result.mode === "vector" ? (
              <p className="ll-note">
                Read directly from the file’s {result.vectorPaths} vector paths — the
                exact line length. Scales with the artwork size above.
              </p>
            ) : (
              <p className="ll-note">
                This file is a flattened image (no vector lines), so length is{" "}
                <strong>estimated</strong> from the pixels — accurate to within ~5%, so
                round up a little when ordering. Length scales with the artwork size
                above.
              </p>
            )}
          </div>

          <div className="ll-preview">
            <h3>{result.mode === "vector" ? "Measured paths" : "Traced lines"}</h3>
            <p className="ll-preview-sub">
              {result.mode === "vector"
                ? "The vector paths that were measured."
                : "Grey = detected black artwork · Red = the centerline that was measured."}
            </p>
            {result.previewDataUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={result.previewDataUrl} alt="Measured lines over the artwork" />
            ) : (
              <p className="ll-hint">No preview available for this file.</p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
