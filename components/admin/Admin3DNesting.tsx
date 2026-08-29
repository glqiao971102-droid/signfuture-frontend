"use client";

import { useRef, useState } from "react";
import { getToken, API_BASE } from "@/lib/api";
import { makeZip, b64ToBytes } from "@/lib/zip";

/** 80 cm print bed, in inches (the nesting engine works in inches). */
const BED_CM = 80;
const BED_IN = BED_CM / 2.54;
const IN_TO_CM = 2.54;

type NestSheet = {
  index: number;
  usedWIn: number;
  usedHIn: number;
  pieceCount: number;
  utilPct: number;
  previewDataUrl: string;
  pdfBase64: string;
  svg?: string;
  dxf?: string;
  outName: string;
};
type NestResult = {
  file: string;
  mode?: "vector" | "raster";
  totalPieces: number;
  placedPieces: number;
  unplaced: number;
  sheets: NestSheet[];
  warnings: string[];
  pieces?: { bin: number; wIn: number; hIn: number; perimeterIn: number }[];
};
type Mode = "slow" | "medium" | "fast";

// 3D print-time model: outline only. time = layers × (outline mm ÷ head speed).
const LAYER_MM = 0.3;
const speedFor = (wIn: number, hIn: number) => (Math.max(wIn, hIn) < 6 ? 25 : 50); // mm/s
// Filament actually consumed per metre of print LINE (toolpath): the round 1.75 mm
// filament is squished into a wide flat bead, so far less filament than line length.
// Calibrated to the slicer: Plate 1 = 729 m line → 116.22 m filament (0.3 mm layer,
// 1.2 mm line width, 1.75 mm filament).
const FILAMENT_PER_LINE_M = 116.22 / 729;
function fmtTime(s: number): string {
  if (!s || !isFinite(s)) return "—";
  const h = Math.floor(s / 3600);
  const m = Math.round((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

const MODES: { key: Mode; label: string; tag: string; desc: string }[] = [
  { key: "slow", label: "Slow", tag: "Fewer plates", desc: "Pack tight — fewest plates. Each plate prints for a long time; use when machines are limited." },
  { key: "medium", label: "Medium", tag: "Balanced", desc: "Fill each plate up to ~2× the slowest letter's time — fewer plates, moderate speed." },
  { key: "fast", label: "Fast", tag: "Fastest output", desc: "Fill each plate up to the slowest letter's time — same fastest overall speed, fewest machines." },
];

function prettySize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
const toCm = (inches: number) => Math.round(inches * IN_TO_CM);

/**
 * Admin 3D Printer File Auto Nesting. Like Auto Nesting but the sheet is the 80×80
 * cm 3D print bed, with a Slow/Medium/Fast density mode: Slow packs everything onto
 * as few plates as possible (longest print each), Fast puts one piece per plate so
 * many plates print in parallel (fastest overall), Medium is in between.
 */
export default function Admin3DNesting() {
  const [file, setFile] = useState<File | null>(null);
  const [gapMm, setGapMm] = useState("30");
  const [heightCm, setHeightCm] = useState("5");
  const [mode, setMode] = useState<Mode>("medium");
  const [fmtPdf, setFmtPdf] = useState(true);
  const [fmtDxf, setFmtDxf] = useState(false);
  const [fmtSvg, setFmtSvg] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<NestResult | null>(null);
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
      const gapIn = ((Number(gapMm) || 0) / 25.4).toString();
      const qs = new URLSearchParams({
        w: String(BED_IN),
        h: String(BED_IN),
        gap: gapIn,
        rot: "1",
        holes: "0",
        mode,
        h3d: heightCm, // print height drives the time-balanced packing
        trim: "0", // keep every plate the full 80×80 cm bed
        perim: "1", // measure each piece's outline for the print-time estimate
        fmt: "svg,dxf", // also emit vector SVG + DXF so the download can offer them
        name: file.name,
      });
      // Backend (EC2) processing — avoids Vercel's 4.5 MB upload cap on big files.
      const fd = new FormData();
      fd.append("file", file, file.name);
      const res = await fetch(`${API_BASE}/api/v1/tools/nest?${qs}`, {
        method: "POST",
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: fd,
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.message || `Nesting failed (${res.status})`);
      setResult(body as NestResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  function saveBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  const step = result ? 3 : file ? 2 : 1;
  const stepCls = (n: number) => `an-step${n === step ? " is-active" : ""}${n < step ? " is-done" : ""}`;

  // Print-time estimate: layers × (outline mm ÷ head speed), summed per plate.
  const layers = ((Number(heightCm) || 0) * 10) / LAYER_MM;
  const pieceSeconds = (p: { wIn: number; hIn: number; perimeterIn: number }) =>
    layers * (p.perimeterIn * 25.4) / speedFor(p.wIn, p.hIn);
  const plateSeconds = (idx: number) =>
    (result?.pieces ?? []).filter((p) => p.bin === idx).reduce((sum, p) => sum + pieceSeconds(p), 0);
  const allPlateSeconds = result ? result.sheets.map((s) => plateSeconds(s.index)) : [];
  const totalSeconds = allPlateSeconds.reduce((a, b) => a + b, 0);
  const maxPlateSeconds = allPlateSeconds.length ? Math.max(...allPlateSeconds) : 0;

  // Filament length actually consumed = print-line length × the extrusion ratio.
  // (Print line = outline perimeter × number of layers; the time model uses the raw
  //  line length via pieceSeconds — only this metres figure is filament.)
  const pieceMeters = (p: { perimeterIn: number }) => ((p.perimeterIn * 25.4 * layers) / 1000) * FILAMENT_PER_LINE_M;
  const plateMeters = (idx: number) =>
    (result?.pieces ?? []).filter((p) => p.bin === idx).reduce((sum, p) => sum + pieceMeters(p), 0);
  const totalMeters = result ? result.sheets.reduce((s, sh) => s + plateMeters(sh.index), 0) : 0;
  const fmtM = (m: number) => (m >= 100 ? `${Math.round(m)} m` : `${m.toFixed(1)} m`);

  // File name per plate: "Plate 1 - 2h 12m 396m".
  const plateFileName = (s: NestSheet) => `Plate ${s.index + 1} - ${fmtTime(plateSeconds(s.index))} ${Math.round(plateMeters(s.index))}m`;

  // Which formats the user ticked (DXF/SVG only exist for vector artwork).
  const vectorOut = result?.mode !== "raster";
  const wantPdf = fmtPdf;
  const wantDxf = fmtDxf && vectorOut;
  const wantSvg = fmtSvg && vectorOut;
  const fmtCount = (wantPdf ? 1 : 0) + (wantDxf ? 1 : 0) + (wantSvg ? 1 : 0);

  /** The chosen-format files for one plate, named "Plate N - …". */
  function plateFiles(s: NestSheet): { name: string; data: Uint8Array }[] {
    const base = plateFileName(s);
    const enc = new TextEncoder();
    const out: { name: string; data: Uint8Array }[] = [];
    if (wantPdf) out.push({ name: `${base}.pdf`, data: b64ToBytes(s.pdfBase64) });
    if (wantDxf && s.dxf) out.push({ name: `${base}.dxf`, data: enc.encode(s.dxf) });
    if (wantSvg && s.svg) out.push({ name: `${base}.svg`, data: enc.encode(s.svg) });
    return out;
  }

  const MIME: Record<string, string> = { pdf: "application/pdf", dxf: "application/dxf", svg: "image/svg+xml" };
  function saveSheet(s: NestSheet) {
    const files = plateFiles(s);
    if (files.length === 0) return;
    if (files.length === 1) {
      const ext = files[0].name.split(".").pop() || "";
      saveBlob(new Blob([files[0].data], { type: MIME[ext] || "application/octet-stream" }), files[0].name);
    } else {
      saveBlob(makeZip(files), `${plateFileName(s)}.zip`);
    }
  }
  function downloadAllZip() {
    if (!result) return;
    const files = result.sheets.flatMap((s) => plateFiles(s));
    if (files.length === 0) return;
    saveBlob(makeZip(files), `${result.file?.replace(/\.[^.]+$/, "") ?? "3D nesting"} plates.zip`);
  }

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
          <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" /><path d="M12 12 20 7.5M12 12v9M12 12 4 7.5" /></svg>
        </span>
        <div className="an-head-text">
          <div className="an-title-row">
            <h2>3D Printer File Auto Nesting</h2>
            <span className="an-badge">3D PRINT · 80×80 cm</span>
          </div>
          <p>Arrange the letters / logos onto 80 × 80 cm 3D-print plates for fewer plates or faster output.</p>
        </div>
      </div>

      {/* Steps */}
      <div className="an-steps">
        <div className={stepCls(1)}><span className="an-step-n">1</span> Upload Artwork</div>
        <div className={`an-step-line${step > 1 ? " is-done" : ""}`} />
        <div className={stepCls(2)}><span className="an-step-n">2</span> Print Setup</div>
        <div className={`an-step-line${step > 2 ? " is-done" : ""}`} />
        <div className={stepCls(3)}><span className="an-step-n">3</span> Generate Plates</div>
      </div>

      {/* Upload + Print Setup (two panels, side by side) */}
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
              <span>{file ? `${prettySize(file.size)} · click to change file` : "AI, PDF supported"}</span>
              <button type="button" className="an-browse" onClick={(e) => { e.stopPropagation(); inputRef.current?.click(); }}>
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20h16a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1h-7.5l-2-2H4a1 1 0 0 0-1 1v13a1 1 0 0 0 1 1Z" /></svg>
                Browse Files
              </button>
            </div>
          </div>
        </div>

        {/* Right: Print Setup */}
        <div className="an-panel">
          <div className="an-panel-head">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" /></svg>
            Print Setup
          </div>
          <div className="an-fields">
            <div className="an-field">
              <span className="an-field-label">Print bed</span>
              <div className="an-input"><input type="text" value="80 × 80" readOnly /><span className="an-unit">cm</span></div>
            </div>
            <div className="an-field">
              <span className="an-field-label">Spacing</span>
              <div className="an-input"><input type="number" min="0" step="0.5" value={gapMm} onChange={(e) => setGapMm(e.target.value)} /><span className="an-unit">mm</span></div>
            </div>
            <div className="an-field">
              <span className="an-field-label">Print height</span>
              <div className="an-input"><input type="number" min="0.3" step="0.5" value={heightCm} onChange={(e) => setHeightCm(e.target.value)} /><span className="an-unit">cm</span></div>
            </div>
          </div>

          <span className="an-field-label" style={{ display: "block", margin: "18px 0 9px" }}>Print speed</span>
          <div className="an-modes">
            {MODES.map((m) => (
              <button
                key={m.key}
                type="button"
                title={m.desc}
                className={`an-mode an-mode-compact${mode === m.key ? " is-on" : ""}`}
                onClick={() => setMode(m.key)}
              >
                <span className="an-mode-title">{m.label}</span>
                <span className="an-mode-tag">{m.tag}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="an-bottom">
        <div className="an-summary">
          <span className="an-summary-ic" aria-hidden="true"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" /><path d="M12 12 20 7.5M12 12v9M12 12 4 7.5" /></svg></span>
          <div>
            <strong>80 × 80 cm plate · {MODES.find((m) => m.key === mode)?.label}</strong>
            <span className="an-summary-status">{busy ? "Arranging…" : file ? "Ready to arrange" : "Waiting for artwork"}<i className={file && !busy ? "on" : ""} /></span>
          </div>
        </div>
        <button type="button" className="an-generate" onClick={run} disabled={busy || !file}>
          {busy ? (<><span className="ll-spin" aria-hidden="true" /> Arranging…</>) : (
            <>
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="3" width="8" height="8" rx="1" /><rect x="13" y="3" width="8" height="5" rx="1" /><rect x="13" y="10" width="8" height="11" rx="1" /><rect x="3" y="13" width="8" height="8" rx="1" /></svg>
              Generate Plates
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
            </>
          )}
        </button>
      </div>

      {error && <p className="ll-error an-error">⚠ {error}</p>}

      {result && (
        <div className="nest-results">
          <div className="nest-summary">
            <div className="nest-summary-stats">
              <div><span className="nest-stat-n">{result.placedPieces}</span><span className="nest-stat-l">pieces</span></div>
              <div><span className="nest-stat-n">{result.sheets.length}</span><span className="nest-stat-l">plate{result.sheets.length === 1 ? "" : "s"}</span></div>
              <div><span className="nest-stat-n">80×80</span><span className="nest-stat-l">plate (cm)</span></div>
            </div>
            <div className="an-dl">
              <div className="an-fmts">
                <span className="an-fmts-label">Download as</span>
                <label className="an-fmt"><input type="checkbox" checked={fmtPdf} onChange={(e) => setFmtPdf(e.target.checked)} /> <b>PDF</b></label>
                <label className={`an-fmt${vectorOut ? "" : " is-off"}`}><input type="checkbox" checked={wantDxf} disabled={!vectorOut} onChange={(e) => setFmtDxf(e.target.checked)} /> <b>DXF</b> <span>AutoCAD</span></label>
                <label className={`an-fmt${vectorOut ? "" : " is-off"}`}><input type="checkbox" checked={wantSvg} disabled={!vectorOut} onChange={(e) => setFmtSvg(e.target.checked)} /> <b>SVG</b> <span>Vector</span></label>
              </div>
              <button type="button" className="ll-measure" onClick={downloadAllZip} disabled={fmtCount === 0}>
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3v12" /><path d="m7 10 5 5 5-5" /><path d="M5 21h14" /></svg>
                Download all plates (ZIP)
              </button>
            </div>
          </div>
          {!vectorOut && (
            <p className="an-fmt-note">This file is a flattened image, so only PDF is available. Upload vector artwork (AI/PDF with paths) for DXF &amp; SVG.</p>
          )}

          {result.pieces && (
            <div className="an-time">
              <div className="an-time-row">
                <div className="an-time-cell">
                  <span className="an-time-n">{fmtTime(maxPlateSeconds)}</span>
                  <span className="an-time-l">if all plates print in parallel<br />(= slowest plate)</span>
                </div>
                <div className="an-time-cell">
                  <span className="an-time-n">{fmtTime(totalSeconds)}</span>
                  <span className="an-time-l">total on one machine<br />(all plates back-to-back)</span>
                </div>
                <div className="an-time-cell">
                  <span className="an-time-n">{fmtM(totalMeters)}</span>
                  <span className="an-time-l">total filament<br />all plates</span>
                </div>
                <div className="an-time-cell">
                  <span className="an-time-n">{result.sheets.length}</span>
                  <span className="an-time-l">plates · {Math.round(layers)} layers<br />@ {heightCm} cm, 0.3 mm</span>
                </div>
              </div>
              <p className="an-time-note">
                Estimate: outline print only, head speed {"<"}6″ = 25 mm/s, ≥6″ = 50 mm/s.
                {result.mode === "raster" ? " This file is a flattened image — outline length is a rough box estimate." : ""}
              </p>
            </div>
          )}

          {result.unplaced > 0 && (
            <p className="ll-error">⚠ {result.unplaced} piece{result.unplaced === 1 ? "" : "s"} won&apos;t fit an 80×80 cm plate (too large even rotated) and were left out.</p>
          )}
          {result.warnings?.map((wmsg, i) => (
            <p key={i} className="ll-error">⚠ {wmsg}</p>
          ))}

          <div className="nest-sheets">
            {result.sheets.map((s) => (
              <div key={s.index} className="nest-sheet">
                <div className="nest-sheet-head">
                  <strong>Plate {s.index + 1} — 80 × 80 cm</strong>
                  <span>{s.pieceCount} piece{s.pieceCount === 1 ? "" : "s"} · {s.utilPct}% used{result.pieces ? ` · ~${fmtTime(plateSeconds(s.index))} · ${fmtM(plateMeters(s.index))} filament` : ""}</span>
                </div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={s.previewDataUrl} alt={`Plate ${s.index + 1} layout`} />
                <button type="button" className="nest-sheet-dl" onClick={() => saveSheet(s)} disabled={fmtCount === 0}>
                  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3v12" /><path d="m7 10 5 5 5-5" /><path d="M5 21h14" /></svg>
                  Download plate {s.index + 1}{fmtCount > 1 ? " (ZIP)" : ""}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
