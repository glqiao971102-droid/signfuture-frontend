"use client";

import { useRef, useState } from "react";
import { getToken, API_BASE } from "@/lib/api";

type NestSheet = {
  index: number;
  usedWIn: number;
  usedHIn: number;
  pieceCount: number;
  utilPct: number;
  previewDataUrl: string;
  pdfBase64: string;
  outName: string;
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
  const [gapMm, setGapMm] = useState("10");
  const [rotate, setRotate] = useState(true);
  const [holes, setHoles] = useState(false);
  const [drain, setDrain] = useState(false);
  const [drainInfo, setDrainInfo] = useState(false);
  const [drainZoom, setDrainZoom] = useState(false);
  // When the artwork is drawn 10× smaller (a 1:10 file), scale it up ×10 for the layout.
  const [scaledx10, setScaledx10] = useState(false);
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
        rot: rotate ? "1" : "0", holes: holes ? "1" : "0",
        drain: drain ? "1" : "0",
        mscale: scaledx10 ? "10" : "1",
        level: "strong", name: file.name,
      });
      // Uploads to the BACKEND (EC2) — not a Vercel function — so large files
      // aren't capped by Vercel's 4.5 MB payload limit. Sent as multipart so the
      // browser streams the file; no Content-Type header (the browser sets the
      // multipart boundary itself).
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

  function saveSheet(s: NestSheet) {
    const bin = atob(s.pdfBase64);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    const url = URL.createObjectURL(new Blob([arr], { type: "application/pdf" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = s.outName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  // Download every sheet as its OWN file (staggered so the browser allows them all).
  function downloadAll() {
    if (!result) return;
    result.sheets.forEach((s, i) => setTimeout(() => saveSheet(s), i * 350));
  }

  const step = result ? 3 : file ? 2 : 1;
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
          <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><path d="M17.5 14v7M14 17.5h7" /></svg>
        </span>
        <div className="an-head-text">
          <div className="an-title-row">
            <h2>Auto Nesting</h2>
            <span className="an-badge">SMART LAYOUT</span>
          </div>
          <p>Upload your artwork and let the system arrange every piece for maximum material efficiency.</p>
        </div>
      </div>

      {/* Steps */}
      <div className="an-steps">
        <div className={stepCls(1)}><span className="an-step-n">1</span> Upload Artwork</div>
        <div className={`an-step-line${step > 1 ? " is-done" : ""}`} />
        <div className={stepCls(2)}><span className="an-step-n">2</span> Sheet Setup</div>
        <div className={`an-step-line${step > 2 ? " is-done" : ""}`} />
        <div className={stepCls(3)}><span className="an-step-n">3</span> Generate Layout</div>
      </div>

      {/* Upload + Sheet Setup (two panels, side by side) */}
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
              <span>{file ? `${prettySize(file.size)} · click to change file` : "AI, PDF supported · max 50 MB"}</span>
              <button
                type="button"
                className="an-browse"
                onClick={(e) => { e.stopPropagation(); inputRef.current?.click(); }}
              >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20h16a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1h-7.5l-2-2H4a1 1 0 0 0-1 1v13a1 1 0 0 0 1 1Z" /></svg>
                Browse Files
              </button>
            </div>
          </div>
        </div>

        {/* Right: Sheet Setup */}
        <div className="an-panel">
          <div className="an-panel-head">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 8.5 8.5 3 21 15.5 15.5 21 3 8.5Z" /><path d="M7 9l1.5 1.5M10 6l2 2M13.5 9l1.5 1.5" /></svg>
            Sheet Setup
          </div>
          <div className="an-fields">
            <div className="an-field">
              <span className="an-field-label">Sheet width</span>
              <div className="an-input"><input type="number" min="1" value={sheetW} onChange={(e) => setSheetW(e.target.value)} /><span className="an-unit">in</span></div>
            </div>
            <div className="an-field">
              <span className="an-field-label">Sheet height</span>
              <div className="an-input"><input type="number" min="1" value={sheetH} onChange={(e) => setSheetH(e.target.value)} /><span className="an-unit">in</span></div>
            </div>
            <div className="an-field">
              <span className="an-field-label">Spacing</span>
              <div className="an-input"><input type="number" min="0" step="0.5" value={gapMm} onChange={(e) => setGapMm(e.target.value)} /><span className="an-unit">mm</span></div>
            </div>
          </div>

          <span className="an-field-label" style={{ display: "block", margin: "18px 0 9px" }}>Optimization</span>
          <div className="an-opts">
            <div className="an-opt-row">
              <div className="an-opt-text">
                <span className="an-opt-ic" aria-hidden="true"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-3-6.7L21 8" /><path d="M21 3v5h-5" /></svg></span>
                <span>Allow piece rotation</span>
              </div>
              <button type="button" role="switch" aria-checked={rotate} className={`an-toggle${rotate ? " is-on" : ""}`} onClick={() => setRotate(!rotate)}><span /></button>
            </div>
            <div className="an-opt-row">
              <div className="an-opt-text">
                <span className="an-opt-ic" aria-hidden="true"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="2.5" /></svg></span>
                <div className="an-opt-sub">
                  <span>Add drill holes</span>
                  <em><span style={{ color: "#ff5b5b" }}>5 mm wire</span> + <span style={{ color: "#22c7d6" }}>3 mm screws</span></em>
                </div>
              </div>
              <button type="button" role="switch" aria-checked={holes} className={`an-toggle${holes ? " is-on" : ""}`} onClick={() => setHoles(!holes)}><span /></button>
            </div>
            <div className="an-opt-row">
              <div className="an-opt-text">
                <span className="an-opt-ic" aria-hidden="true"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11Z" /></svg></span>
                <div className="an-opt-sub">
                  <span className="an-drain-head">Drain hole<button type="button" className="an-info" aria-label="What is a Drain Hole?" title="What is a Drain Hole?" onClick={() => { setDrainZoom(false); setDrainInfo(true); }}><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="10.5" cy="10.5" r="6.5" /><line x1="15.5" y1="15.5" x2="21" y2="21" /><line x1="10.5" y1="7.7" x2="10.5" y2="13.3" /><line x1="7.7" y1="10.5" x2="13.3" y2="10.5" /></svg></button></span>
                  <em>1 cm half-circle cut at the bottom of each letter</em>
                </div>
              </div>
              <button type="button" role="switch" aria-checked={drain} className={`an-toggle${drain ? " is-on" : ""}`} onClick={() => setDrain(!drain)}><span /></button>
            </div>
            <div className="an-opt-row">
              <div className="an-opt-text">
                <span className="an-opt-ic" aria-hidden="true"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h6v6" /><path d="M9 21H3v-6" /><path d="M21 3l-7 7" /><path d="M3 21l7-7" /></svg></span>
                <div className="an-opt-sub">
                  <span>File drawn at 1:10 scale</span>
                  <em>artwork is 10× smaller — system scales it up ×10</em>
                </div>
              </div>
              <button type="button" role="switch" aria-checked={scaledx10} className={`an-toggle${scaledx10 ? " is-on" : ""}`} onClick={() => setScaledx10(!scaledx10)}><span /></button>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="an-bottom">
        <div className="an-summary">
          <span className="an-summary-ic" aria-hidden="true"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3 9 5-9 5-9-5 9-5Z" /><path d="m3 12 9 5 9-5M3 16l9 5 9-5" /></svg></span>
          <div>
            <strong>{sheetW || "48"} × {sheetH || "96"} in Sheet</strong>
            <span className="an-summary-status">{busy ? "Arranging…" : file ? "Ready to arrange" : "Waiting for artwork"}<i className={file && !busy ? "on" : ""} /></span>
          </div>
        </div>
        <button type="button" className="an-generate" onClick={run} disabled={busy || !file}>
          {busy ? (<><span className="ll-spin" aria-hidden="true" /> Arranging…</>) : (
            <>
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="3" width="8" height="8" rx="1" /><rect x="13" y="3" width="8" height="5" rx="1" /><rect x="13" y="10" width="8" height="11" rx="1" /><rect x="3" y="13" width="8" height="8" rx="1" /></svg>
              Generate Layout
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
              <div><span className="nest-stat-n">{result.sheets.length}</span><span className="nest-stat-l">sheet{result.sheets.length === 1 ? "" : "s"}</span></div>
              <div><span className="nest-stat-n">{result.sheetWIn}×{result.sheetHIn}</span><span className="nest-stat-l">sheet size (in)</span></div>
            </div>
            <button type="button" className="ll-measure" onClick={downloadAll}>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3v12" /><path d="m7 10 5 5 5-5" /><path d="M5 21h14" /></svg>
              {result.sheets.length > 1 ? `Download ${result.sheets.length} files` : "Download nested file"}
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
                  <strong>Sheet {s.index + 1} — {s.usedWIn}″ × {s.usedHIn}″</strong>
                  <span>{s.pieceCount} piece{s.pieceCount === 1 ? "" : "s"} · {s.utilPct}% used</span>
                </div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={s.previewDataUrl} alt={`Sheet ${s.index + 1} layout`} />
                <button type="button" className="nest-sheet-dl" onClick={() => saveSheet(s)}>
                  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3v12" /><path d="m7 10 5 5 5-5" /><path d="M5 21h14" /></svg>
                  Download this sheet ({s.usedWIn}×{s.usedHIn}in)
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {drainInfo && (
        <div className="an-dm" onClick={() => setDrainInfo(false)}>
          <div className="an-dm-card" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="an-dm-close" aria-label="Close" onClick={() => setDrainInfo(false)}>&times;</button>
            <div className="an-dm-figwrap">
              <div className={`an-dm-fig${drainZoom ? " zoomed" : ""}`} onClick={() => setDrainZoom((z) => !z)}>
                <svg viewBox="0 0 900 640" xmlns="http://www.w3.org/2000/svg">
                  <defs>
                    <linearGradient id="an-dm-bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#eef3fa" /><stop offset="1" stopColor="#ffffff" /></linearGradient>
                    <linearGradient id="an-dm-ul" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#3fb0ff" /><stop offset="1" stopColor="#35d8ff" /></linearGradient>
                    <filter id="an-dm-sh" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="8" stdDeviation="12" floodColor="#1c3a66" floodOpacity="0.14" /></filter>
                  </defs>
                  <rect x="0" y="0" width="900" height="640" fill="url(#an-dm-bg)" />
                  <text x="48" y="72" fontFamily="Arial Black, Arial, sans-serif" fontWeight="900" fontSize="42" fill="#12203a">Drain Hole Placement</text>
                  <rect x="50" y="86" width="150" height="5" rx="2.5" fill="url(#an-dm-ul)" />
                  <text x="48" y="124" fontFamily="Arial, sans-serif" fontSize="18" fill="#54627a">{"Drain holes are auto-cut at the lowest point of your artwork, so rainwater can't pool inside the letter."}</text>
                  <g transform="translate(48,158)">
                    <rect width="380" height="374" rx="22" fill="#ffffff" stroke="#dbe3ef" strokeWidth="1.5" filter="url(#an-dm-sh)" />
                    <text x="190" y="252" textAnchor="middle" fontFamily="Arial Black, Arial, sans-serif" fontWeight="900" fontSize="210" fill="#8b95a3">A</text>
                    <path d="M141,252 A9,9 0 0 1 159,252 Z" fill="#ffffff" />
                    <path d="M221,252 A9,9 0 0 1 239,252 Z" fill="#ffffff" />
                    <line x1="150" y1="254" x2="150" y2="288" stroke="#2f9bff" strokeWidth="3" strokeDasharray="1 6" strokeLinecap="round" />
                    <line x1="230" y1="254" x2="230" y2="288" stroke="#2f9bff" strokeWidth="3" strokeDasharray="1 6" strokeLinecap="round" />
                    <path transform="translate(150,292)" d="M0,0 C6,8 8,12 8,16 a8,8 0 1 1 -16,0 C-8,12 -6,8 0,0 Z" fill="#2f9bff" />
                    <path transform="translate(230,292)" d="M0,0 C6,8 8,12 8,16 a8,8 0 1 1 -16,0 C-8,12 -6,8 0,0 Z" fill="#2f9bff" />
                    <line x1="30" y1="318" x2="350" y2="318" stroke="#e4eaf3" strokeWidth="2" />
                    <circle cx="54" cy="350" r="16" fill="#e8f7ee" stroke="#39c46b" strokeWidth="2" />
                    <path d="M46,350 l6,6 l11,-13" fill="none" stroke="#2fa356" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
                    <text x="82" y="345" fontFamily="Arial, sans-serif" fontWeight="800" fontSize="22" fill="#1f8f4e">CORRECT</text>
                    <text x="82" y="367" fontFamily="Arial, sans-serif" fontSize="13.5" fill="#6b7789">Upload artwork in the correct orientation</text>
                  </g>
                  <g transform="translate(472,158)">
                    <rect width="380" height="374" rx="22" fill="#ffffff" stroke="#dbe3ef" strokeWidth="1.5" filter="url(#an-dm-sh)" />
                    <g transform="rotate(180 190 176)"><text x="190" y="252" textAnchor="middle" fontFamily="Arial Black, Arial, sans-serif" fontWeight="900" fontSize="210" fill="#8b95a3">A</text></g>
                    <path d="M181,252 A9,9 0 0 1 199,252 Z" fill="#ffffff" />
                    <line x1="190" y1="254" x2="190" y2="288" stroke="#f0503c" strokeWidth="3" strokeDasharray="1 6" strokeLinecap="round" />
                    <path transform="translate(190,292)" d="M0,0 C6,8 8,12 8,16 a8,8 0 1 1 -16,0 C-8,12 -6,8 0,0 Z" fill="#f0503c" />
                    <line x1="30" y1="318" x2="350" y2="318" stroke="#e4eaf3" strokeWidth="2" />
                    <circle cx="54" cy="350" r="16" fill="#fdecea" stroke="#f0503c" strokeWidth="2" />
                    <path d="M47,343 l14,14 M61,343 l-14,14" fill="none" stroke="#d63a27" strokeWidth="3.2" strokeLinecap="round" />
                    <text x="82" y="345" fontFamily="Arial, sans-serif" fontWeight="800" fontSize="22" fill="#c8382a">WRONG</text>
                    <text x="82" y="367" fontFamily="Arial, sans-serif" fontSize="13.5" fill="#6b7789">Do not rotate or upload upside down</text>
                  </g>
                  <g transform="translate(48,556)">
                    <rect width="804" height="60" rx="14" fill="#fff7e6" stroke="#f0c860" strokeWidth="1.5" />
                    <circle cx="36" cy="30" r="13" fill="#f6c33c" />
                    <text x="36" y="35" textAnchor="middle" fontFamily="Arial Black, Arial, sans-serif" fontWeight="900" fontSize="16" fill="#3a2c05">!</text>
                    <text x="62" y="36" fontFamily="Arial, sans-serif" fontSize="15" fill="#8a6d1f">{"Please check your artwork orientation before uploading — it will not be auto-rotated."}</text>
                  </g>
                </svg>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
