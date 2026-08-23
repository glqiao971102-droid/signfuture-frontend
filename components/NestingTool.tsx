"use client";

import { useRef, useState } from "react";
import { getToken } from "@/lib/api";

type NestSheet = {
  index: number;
  usedWIn: number;
  usedHIn: number;
  pieceCount: number;
  utilPct: number;
  previewDataUrl: string;
};
type NestResult = {
  file: string;
  sheetWIn: number;
  sheetHIn: number;
  gapIn: number;
  rotated: boolean;
  totalPieces: number;
  placedPieces: number;
  unplaced: number;
  sheets: NestSheet[];
  warnings: string[];
  outName: string;
  outPdfBase64: string;
};

function prettySize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Member-facing Auto Nesting tool (My Account → Auto Nesting). Upload an artwork
 * with scattered pieces; it packs them tightly onto sheets and returns a
 * ready-to-print, already-laid-out PDF.
 */
export default function NestingTool() {
  const [file, setFile] = useState<File | null>(null);
  const [sheetW, setSheetW] = useState("48");
  const [sheetH, setSheetH] = useState("96");
  const [gapMm, setGapMm] = useState("3");
  const [rotate, setRotate] = useState(true);
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
        w: sheetW || "48", h: sheetH || "96", gap: gapIn,
        rot: rotate ? "1" : "0", name: file.name,
      });
      const res = await fetch(`/api/nest?${qs}`, {
        method: "POST",
        headers: { "Content-Type": "application/octet-stream", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: await file.arrayBuffer(),
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

  function download() {
    if (!result) return;
    const bin = atob(result.outPdfBase64);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    const url = URL.createObjectURL(new Blob([arr], { type: "application/pdf" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = result.outName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  return (
    <section className="acct-card acct-section-card">
      <div className="acct-card-head">
        <h2>Auto Nesting</h2>
        <span>
          Upload an artwork with scattered pieces — it detects each piece and arranges
          them tightly onto {sheetW}″×{sheetH}″ sheets (extra sheets are added if they
          don’t all fit), then gives you a ready-to-print file that opens laid out.
        </span>
      </div>

      <div className="ll-uploader">
        <input
          ref={inputRef}
          type="file"
          accept=".ai,.pdf,application/pdf,application/postscript,application/illustrator"
          hidden
          onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
        />
        <div
          role="button"
          tabIndex={0}
          className={`ll-drop${dragOver ? " is-drag" : ""}${file ? " has-file" : ""}`}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") inputRef.current?.click(); }}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); pickFile(e.dataTransfer.files?.[0] ?? null); }}
        >
          <div className="ll-drop-inner">
            <span className="ll-drop-ic" aria-hidden="true">
              {file ? (
                <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 3v4a1 1 0 0 0 1 1h4" /><path d="M18 21H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9l5 5v11a2 2 0 0 1-2 2Z" /></svg>
              ) : (
                <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 16V4" /><path d="m7 9 5-5 5 5" /><path d="M5 20h14" /></svg>
              )}
            </span>
            <div className="ll-drop-text">
              {file ? (
                <>
                  <strong>{file.name}</strong>
                  <span>{prettySize(file.size)} · click to change file</span>
                </>
              ) : (
                <>
                  <strong>Drop your artwork here</strong>
                  <span>or click to browse — .ai / .pdf</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="nest-opts">
          <label className="nest-field">
            <span className="ll-field-label">Sheet width (in)</span>
            <input type="number" min="1" value={sheetW} onChange={(e) => setSheetW(e.target.value)} />
          </label>
          <label className="nest-field">
            <span className="ll-field-label">Sheet height (in)</span>
            <input type="number" min="1" value={sheetH} onChange={(e) => setSheetH(e.target.value)} />
          </label>
          <label className="nest-field">
            <span className="ll-field-label">Spacing (mm)</span>
            <input type="number" min="0" step="0.5" value={gapMm} onChange={(e) => setGapMm(e.target.value)} />
          </label>
          <label className="nest-check">
            <input type="checkbox" checked={rotate} onChange={(e) => setRotate(e.target.checked)} />
            <span>Allow rotating pieces</span>
          </label>
          <button type="button" className="ll-measure nest-go" onClick={run} disabled={busy || !file}>
            {busy ? (<><span className="ll-spin" aria-hidden="true" /> Arranging…</>) : (
              <>
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="3" width="8" height="8" rx="1" /><rect x="13" y="3" width="8" height="5" rx="1" /><rect x="13" y="10" width="8" height="11" rx="1" /><rect x="3" y="13" width="8" height="8" rx="1" /></svg>
                Arrange
              </>
            )}
          </button>
        </div>
      </div>
      {busy && <p className="ll-hint">Detecting pieces &amp; packing the sheets… large artwork can take several seconds.</p>}
      {error && <p className="ll-error">⚠ {error}</p>}

      {result && (
        <div className="nest-results">
          <div className="nest-summary">
            <div className="nest-summary-stats">
              <div><span className="nest-stat-n">{result.placedPieces}</span><span className="nest-stat-l">pieces</span></div>
              <div><span className="nest-stat-n">{result.sheets.length}</span><span className="nest-stat-l">sheet{result.sheets.length === 1 ? "" : "s"}</span></div>
              <div><span className="nest-stat-n">{result.sheetWIn}×{result.sheetHIn}</span><span className="nest-stat-l">sheet size (in)</span></div>
            </div>
            <button type="button" className="ll-measure" onClick={download}>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3v12" /><path d="m7 10 5 5 5-5" /><path d="M5 21h14" /></svg>
              Download nested file
            </button>
          </div>

          {result.unplaced > 0 && (
            <p className="ll-error">
              ⚠ {result.unplaced} piece{result.unplaced === 1 ? "" : "s"} could not fit a {result.sheetWIn}×{result.sheetHIn}″ sheet
              (too large even rotated) and were left out. Use a bigger sheet or split those pieces.
            </p>
          )}
          {result.warnings?.map((wmsg, i) => (
            <p key={i} className="ll-error">⚠ {wmsg}</p>
          ))}

          <div className="nest-sheets">
            {result.sheets.map((s) => (
              <div key={s.index} className="nest-sheet">
                <div className="nest-sheet-head">
                  <strong>Sheet {s.index + 1}</strong>
                  <span>{s.usedWIn}″ × {s.usedHIn}″ · {s.pieceCount} piece{s.pieceCount === 1 ? "" : "s"} · {s.utilPct}% used</span>
                </div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={s.previewDataUrl} alt={`Sheet ${s.index + 1} layout`} />
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
