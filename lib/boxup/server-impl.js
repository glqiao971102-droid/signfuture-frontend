// Adapted from 3D发光字/neon_copy_server.mjs for the unified Next.js app.
// The HTTP server, filesystem access and Python subprocess have been removed;
// analysis is performed by the ported TypeScript analyzer (./analyze) and
// previews are returned inline as data URLs. The HTML/CSS/JS (incl. the Three.js
// 3D preview) and the client-side pricing are otherwise unchanged.
import path from "node:path";
import { analyzeBoxup } from "./analyze";

export const htmlHeaders = {
  "Content-Type": "text/html; charset=utf-8",
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  "Pragma": "no-cache",
  "Expires": "0",
};

function html(result, error) {
  let report = "";
  // Shown before any upload: a real options card + sample 3D preview, but with
  // no file data, so Dimension Preview and Letter / Logo records render empty
  // (and the price panel is hidden via .preview-only).
  const PLACEHOLDER_PREVIEW = {
    name: "Preview",
    designs: null,
    content_bbox_in: null,
    page_size_in: null,
    dimension_preview_url: null,
    line_preview_url: null,
    letter_dimensions: null,
    by_color: null,
    artwork_preview_url: null,
  };
  if (error) {
    report = `<section class="error">${escapeHtml(error)}</section>`;
  } else if (result) {
    const artboards = Array.isArray(result.artboards) && result.artboards.length > 0
      ? result.artboards
      : [{
          name: result.file,
          content_bbox_in: result.content_bbox_in,
          total_length_m_neon: result.total_length_m_neon,
          dimension_preview_url: result.dimension_preview_url,
          original_preview_url: result.original_preview_url,
          line_preview_url: result.line_preview_url,
        }];
    const artboardBlocks = artboards.map((artboard) => renderArtboard(artboard)).join("");
    report = `
      <section class="multi-result">
        <button type="button" class="close-result close-results" aria-label="Close results">&times;</button>
        <h2>${escapeHtml(result.file)}</h2>
        ${artboardBlocks}
      </section>`;
  } else {
    // No file yet: let the customer configure options and see the sample 3D
    // preview. The file-dependent panels (Dimension Preview, Letter / Logo
    // records, price) stay hidden until they upload and Calculate.
    report = `
      <style>
        .multi-result.preview-only .order-panel{display:none !important}
        .multi-result.preview-only .close-result{display:none !important}
        .preview-hint{margin:0 0 14px;padding:11px 15px;border:1px dashed rgba(57,151,255,.55);
          border-radius:10px;color:#c3d8f7;font-size:13.5px;background:rgba(7,18,35,.6)}
      </style>
      <section class="multi-result preview-only">
        <p class="preview-hint">Configure your options below. Upload your artwork (.ai / .pdf) and click Calculate to see the Dimension Preview, Letter / Logo records and price.</p>
        ${renderArtboard(PLACEHOLDER_PREVIEW)}
      </section>`;
  }
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="Cache-Control" content="no-store, no-cache, must-revalidate, max-age=0">
  <meta http-equiv="Pragma" content="no-cache">
  <meta http-equiv="Expires" content="0">
  <title>3D Box Up</title>
  <style>
    :root {
      color-scheme: dark;
      font-family: "Segoe UI", Arial, sans-serif;
      --bg: #030813;
      --panel: rgba(7, 18, 35, 0.88);
      --panel-strong: rgba(10, 27, 52, 0.94);
      --line: rgba(57, 151, 255, 0.58);
      --line-soft: rgba(57, 151, 255, 0.24);
      --cyan: #35d8ff;
      --blue: #5a8cff;
      --violet: #8b6cff;
      --green: #42ef7d;
      --text: #f3f7ff;
      --muted: #8fa7c5;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      background:
        linear-gradient(90deg, rgba(53, 216, 255, 0.035) 1px, transparent 1px),
        linear-gradient(0deg, rgba(53, 216, 255, 0.035) 1px, transparent 1px),
        radial-gradient(circle at 18% 12%, rgba(38, 124, 255, 0.2), transparent 28%),
        radial-gradient(circle at 84% 24%, rgba(31, 216, 255, 0.12), transparent 28%),
        var(--bg);
      background-size: 28px 28px, 28px 28px, auto, auto, auto;
      color: var(--text);
    }
    body::before {
      content: "";
      position: fixed;
      inset: 0;
      pointer-events: none;
      background:
        linear-gradient(115deg, transparent 0 28%, rgba(72, 150, 255, 0.08) 28.2%, transparent 28.7% 100%),
        linear-gradient(155deg, transparent 0 62%, rgba(53, 216, 255, 0.07) 62.2%, transparent 62.6% 100%);
      opacity: 0.8;
    }
    main { max-width: 1500px; margin: 0 auto; padding: 30px 34px 42px; position: relative; }
    .hero {
      border: 1px solid var(--line);
      border-radius: 14px;
      padding: 26px 28px 18px;
      background: linear-gradient(180deg, rgba(5, 16, 32, 0.92), rgba(4, 11, 24, 0.82));
      box-shadow: 0 0 34px rgba(30, 132, 255, 0.22), inset 0 0 38px rgba(40, 126, 255, 0.08);
      position: relative;
      overflow: hidden;
    }
    .hero::before, .multi-result::before {
      content: "";
      position: absolute;
      inset: 0;
      pointer-events: none;
      background:
        linear-gradient(90deg, transparent 0 46%, rgba(53, 216, 255, 0.11) 46.1% 46.3%, transparent 46.4%),
        linear-gradient(0deg, transparent 0 72%, rgba(90, 140, 255, 0.12) 72.1% 72.3%, transparent 72.4%);
      opacity: 0.7;
    }
    .topbar { display: flex; justify-content: space-between; gap: 18px; align-items: center; margin-bottom: 22px; position: relative; }
    .brand { display: flex; align-items: center; min-width: 0; }
    h1 { margin: 0; font-size: clamp(30px, 4vw, 44px); line-height: 1; letter-spacing: 1.5px; text-transform: uppercase; text-shadow: 0 0 14px rgba(218, 235, 255, 0.55); }
    .subtitle { margin: 9px 0 0; color: #c8d8ef; font-size: 17px; }
    form {
      position: relative;
      display: grid;
      grid-template-columns: minmax(280px, 1fr) auto auto auto;
      gap: 18px;
      align-items: center;
      padding: 22px 24px;
      border: 1px solid var(--line-soft);
      border-radius: 14px;
      background: rgba(11, 28, 54, 0.78);
      box-shadow: inset 0 0 28px rgba(56, 139, 255, 0.09);
    }
    input[type=file] { color: #dce8fb; min-width: 0; font-size: 15px; }
    input[type=file]::file-selector-button {
      margin-right: 14px;
      border: 1px solid rgba(53, 216, 255, 0.5);
      border-radius: 8px;
      padding: 10px 14px;
      background: rgba(14, 42, 78, 0.94);
      color: #e9f4ff;
      font-weight: 800;
      cursor: pointer;
      box-shadow: inset 0 0 18px rgba(53, 216, 255, 0.12);
    }
    label.scale-control { display: flex; align-items: center; gap: 12px; color: #b9c9df; font-size: 15px; white-space: nowrap; }
    select {
      min-width: 280px;
      background: rgba(4, 12, 26, 0.94);
      color: var(--text);
      border: 1px solid rgba(112, 164, 255, 0.38);
      border-radius: 10px;
      padding: 13px 42px 13px 16px;
      font-size: 16px;
      outline: none;
      box-shadow: inset 0 0 20px rgba(20, 90, 180, 0.08);
    }
    button, .clear-button {
      border: 1px solid rgba(91, 220, 255, 0.62);
      color: #f8fbff;
      padding: 14px 28px;
      border-radius: 10px;
      font-weight: 900;
      cursor: pointer;
      text-decoration: none;
      font-size: 17px;
      text-align: center;
      white-space: nowrap;
    }
    button {
      background: linear-gradient(100deg, #244bff, #08d3e7);
      box-shadow: 0 0 22px rgba(34, 120, 255, 0.65), inset 0 0 16px rgba(255, 255, 255, 0.18);
    }
    .clear-button { background: rgba(13, 32, 57, 0.9); color: #b9c9df; border-color: rgba(112, 164, 255, 0.34); }
    section { margin-top: 22px; }
    .multi-result {
      position: relative;
      border: 1px solid var(--line);
      border-radius: 14px;
      padding: 28px;
      background: rgba(4, 13, 27, 0.88);
      box-shadow: 0 0 34px rgba(45, 111, 255, 0.24), inset 0 0 34px rgba(53, 216, 255, 0.06);
      overflow: hidden;
    }
    .multi-result h2 {
      margin: 0 0 18px;
      font-size: 24px;
      position: relative;
      color: #f7fbff;
      text-shadow: 0 0 12px rgba(210, 231, 255, 0.45);
    }
    .multi-result h2::before { content: "RESULTS"; display: block; margin-bottom: 14px; color: var(--cyan); font-size: 14px; letter-spacing: 1px; text-shadow: 0 0 12px rgba(53, 216, 255, 0.75); }
    .result {
      position: relative;
      display: grid;
      grid-template-columns: 440px 440px 440px;
      gap: 18px;
      align-items: start;
      justify-content: space-between;
      border: 1px solid rgba(75, 146, 255, 0.42);
      border-radius: 14px;
      padding: 18px;
      background: linear-gradient(180deg, rgba(8, 24, 47, 0.82), rgba(4, 13, 27, 0.88));
      box-shadow: inset 0 0 30px rgba(50, 139, 255, 0.08);
    }
    .multi-result .result { margin-top: 16px; }
    .close-result {
      position: absolute;
      top: 10px;
      right: 10px;
      width: 28px;
      height: 28px;
      border-radius: 50%;
      padding: 0;
      display: grid;
      place-items: center;
      border: 1px solid rgba(53, 216, 255, 0.75);
      background: rgba(4, 14, 30, 0.92);
      color: #dff7ff;
      font-size: 20px;
      line-height: 1;
      box-shadow: 0 0 14px rgba(53, 216, 255, 0.45), inset 0 0 12px rgba(53, 216, 255, 0.1);
      z-index: 3;
    }
    .close-result:hover {
      color: #fff;
      border-color: #ff5f8f;
      box-shadow: 0 0 16px rgba(255, 95, 143, 0.65);
    }
    .multi-result > .close-results { top: 14px; right: 14px; }
    .result h3 { margin: 0 0 18px; font-size: 20px; color: #f7fbff; }
    .artboard-wide { grid-column: 1 / -1; min-width: 0; }
    .design-list { display: grid; grid-template-columns: 1fr; gap: 18px; }
    .design-card {
      position: relative;
      border: 1px solid rgba(75, 146, 255, 0.42);
      border-radius: 14px;
      background: rgba(6, 18, 36, 0.88);
      padding: 18px;
      box-shadow: inset 0 0 28px rgba(53, 216, 255, 0.06);
    }
    .design-card h4 { margin: 0 0 14px; font-size: 18px; color: var(--cyan); text-transform: uppercase; letter-spacing: 0.8px; }
    .design-body { display: grid; grid-template-columns: 440px 440px 440px; column-gap: 18px; row-gap: 8px; align-items: start; justify-content: space-between; }
    .design-body > .metrics { grid-column: 3; grid-row: 2; }
    .result-info { grid-column: 3; grid-row: 2; min-width: 0; width: 100%; justify-self: stretch; margin-bottom: -1px; }
    .metrics { display: grid; grid-template-columns: 1fr; gap: 10px; }
    .base-options { display: grid; grid-template-columns: 1fr 1fr; gap: 0; }
    .base-options:has(.base-finishing.is-hidden) { grid-template-columns: 1fr; }
    .metrics div {
      border: 1px solid rgba(63, 176, 255, 0.72);
      border-radius: 12px;
      padding: 9px 10px;
      background:
        linear-gradient(90deg, rgba(53, 216, 255, 0.04) 1px, transparent 1px),
        linear-gradient(0deg, rgba(53, 216, 255, 0.04) 1px, transparent 1px),
        rgba(3, 11, 24, 0.9);
      background-size: 16px 16px;
      box-shadow: 0 0 18px rgba(53, 216, 255, 0.14), inset 0 0 22px rgba(30, 102, 255, 0.08);
    }
    .base-options > div:first-child { border-radius: 12px 0 0 12px; }
    .base-options > div:last-child { border-left: 0; border-radius: 0 12px 12px 0; }
    .base-options:has(.base-finishing.is-hidden) > div:first-child { border-radius: 12px; }
    .color-picker { padding: 9px; }
    .color-picker.is-hidden { display: none; }
    .color-picker span { margin: 0 0 8px; }
    .color-map {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 6px;
      border: 1px solid rgba(63, 176, 255, 0.58);
      border-radius: 10px;
      overflow: hidden;
      background: #020712;
      padding: 6px;
      box-shadow: inset 0 0 18px rgba(53, 216, 255, 0.08);
    }
    .color-map img { display: block; width: 100%; height: 100%; object-fit: cover; pointer-events: none; }
    .color-option {
      position: relative;
      display: block;
      aspect-ratio: 0.74;
      max-height: 118px;
      min-width: 0;
      padding: 0;
      overflow: hidden;
      border: 2px solid transparent;
      border-radius: 8px;
      background: rgba(0, 0, 0, 0);
      cursor: pointer;
      transition: border-color 120ms ease, box-shadow 120ms ease, background 120ms ease;
    }
    .color-option:hover, .color-option.is-selected {
      border-color: #35d8ff;
      background: rgba(53, 216, 255, 0.08);
      box-shadow: 0 0 16px rgba(53, 216, 255, 0.85), inset 0 0 12px rgba(53, 216, 255, 0.16);
    }
    .selected-color {
      margin-top: 7px;
      color: #9fc8f4;
      font-size: 12px;
      text-align: center;
    }
    .selected-color strong { color: #f7fbff; }
    .side-finishing-panel.is-hidden { display: none; }
    .led-color-panel { padding: 9px; }
    .led-color-panel > span { margin: 0 0 8px; }
    .led-color-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
    }
    .led-color-option {
      position: relative;
      min-width: 0;
      height: 132px;
      border: 1px solid rgba(63, 176, 255, 0.58);
      border-radius: 8px;
      background: rgba(3, 15, 31, 0.95);
      color: #f7fbff;
      font-weight: 800;
      font-size: 12px;
      padding: 5px;
      cursor: pointer;
      overflow: hidden;
      display: grid;
      grid-template-rows: minmax(0, 1fr) 16px;
      gap: 4px;
      box-shadow: inset 0 0 18px rgba(53, 216, 255, 0.08);
      transition: border-color 120ms ease, box-shadow 120ms ease;
    }
    .led-color-option img {
      width: 100%;
      height: 100%;
      display: block;
      min-height: 0;
      object-fit: contain;
      object-position: center;
      border-radius: 5px;
      pointer-events: none;
    }
    .led-color-option > span:not(.image-zoom-button) {
      display: block;
      margin: 0;
      color: #f7fbff;
      font-size: 10px;
      line-height: 16px;
      letter-spacing: 0;
      text-align: center;
      text-transform: none;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      pointer-events: none;
    }
    .led-color-option.is-selected {
      border-color: rgba(53, 216, 255, 0.95);
      box-shadow: 0 0 14px rgba(53, 216, 255, 0.48), inset 0 0 18px rgba(53, 216, 255, 0.14);
    }
    .led-color-option.is-none .led-none-text {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 26px;
      font-weight: 900;
      letter-spacing: 1.5px;
      color: #cdddf5;
    }
    .selected-led-color {
      margin-top: 7px;
      color: #9fc8f4;
      font-size: 12px;
      text-align: center;
    }
    .selected-led-color strong { color: #f7fbff; }
    .outer-glow-panel { display: none; padding: 9px; }
    .outer-glow-panel > span { margin: 0 0 8px; }
    .outer-glow-controls {
      display: grid;
      gap: 8px;
      border: 1px solid rgba(63, 176, 255, 0.58);
      border-radius: 10px;
      background: rgba(2, 7, 18, 0.86);
      padding: 9px;
      box-shadow: inset 0 0 18px rgba(53, 216, 255, 0.08);
    }
    .outer-glow-row {
      display: grid;
      grid-template-columns: 96px minmax(0, 1fr) 32px;
      align-items: center;
      gap: 8px;
      color: #dce8fb;
      font-size: 10px;
      font-weight: 800;
    }
    .outer-glow-row input[type="range"] {
      width: 100%;
      accent-color: #35d8ff;
    }
    .outer-glow-row output {
      color: #f7fbff;
      font-size: 10px;
      text-align: right;
    }
    .outer-glow-note {
      color: #8fa7c5;
      font-size: 10px;
      line-height: 1.35;
      text-align: center;
    }
    .side-finishing-panel { padding: 9px; }
    .side-finishing-panel > span { margin: 0 0 8px; }
    .side-finishing-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 7px;
      border: 1px solid rgba(63, 176, 255, 0.58);
      border-radius: 10px;
      background: #020712;
      padding: 7px;
      box-shadow: inset 0 0 18px rgba(53, 216, 255, 0.08);
    }
    .side-finishing-option {
      position: relative;
      min-width: 0;
      aspect-ratio: 1.18;
      padding: 0;
      overflow: hidden;
      border: 2px solid transparent;
      border-radius: 8px;
      background: rgba(3, 15, 31, 0.95);
      color: #f7fbff;
      cursor: pointer;
      display: grid;
      grid-template-rows: 1fr;
      transition: border-color 120ms ease, box-shadow 120ms ease, background 120ms ease;
    }
    .side-finishing-option:hover,
    .side-finishing-option.is-selected {
      border-color: #35d8ff;
      box-shadow: 0 0 16px rgba(53, 216, 255, 0.78), inset 0 0 12px rgba(53, 216, 255, 0.14);
    }
    .side-finishing-preview {
      display: block;
      min-height: 0;
      background:
        linear-gradient(135deg, rgba(255,255,255,0.16), transparent 34%),
        repeating-linear-gradient(90deg, rgba(255,255,255,0.08) 0 1px, transparent 1px 8px),
        linear-gradient(135deg, color-mix(in srgb, var(--side) 92%, #fff), color-mix(in srgb, var(--side) 82%, #111));
    }
    .side-finishing-option:nth-child(2) .side-finishing-preview {
      background:
        linear-gradient(135deg, rgba(255,255,255,0.14), transparent 36%),
        radial-gradient(circle at 35% 30%, rgba(255,255,255,0.12), transparent 28%),
        linear-gradient(135deg, color-mix(in srgb, var(--side) 88%, #fff), color-mix(in srgb, var(--side) 76%, #111));
    }
    .side-finishing-option:nth-child(3) .side-finishing-preview {
      background:
        linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px),
        linear-gradient(0deg, rgba(255,255,255,0.08) 1px, transparent 1px),
        linear-gradient(135deg, color-mix(in srgb, var(--side) 84%, #fff), color-mix(in srgb, var(--side) 74%, #111));
      background-size: 14px 14px, 14px 14px, auto;
    }
    .side-finishing-option img {
      display: block;
      width: 100%;
      height: 100%;
      min-height: 0;
      object-fit: contain;
      object-position: center;
      pointer-events: none;
      background: #020712;
    }
    .image-zoom-button, .dimension-zoom-button {
      position: absolute;
      top: 6px;
      right: 6px;
      width: 24px;
      height: 24px;
      border: 1px solid rgba(53, 216, 255, 0.8);
      border-radius: 999px;
      padding: 0;
      background: rgba(2, 7, 18, 0.76);
      box-shadow: 0 0 10px rgba(53, 216, 255, 0.45);
      cursor: pointer;
      z-index: 3;
    }
    .side-finishing-option .image-zoom-button,
    .collect-date-option .image-zoom-button,
    .led-color-option .image-zoom-button,
    .original-preview .image-zoom-button,
    .dimension-preview .dimension-zoom-button {
      pointer-events: auto;
    }
    .dimension-zoom-button, .original-preview .image-zoom-button { top: 10px; right: 10px; }
    .image-zoom-button::before, .dimension-zoom-button::before {
      content: "";
      position: absolute;
      left: 6px;
      top: 5px;
      width: 8px;
      height: 8px;
      border: 2px solid #e9f7ff;
      border-radius: 999px;
    }
    .image-zoom-button::after, .dimension-zoom-button::after {
      content: "";
      position: absolute;
      left: 14px;
      top: 14px;
      width: 7px;
      height: 2px;
      border-radius: 999px;
      background: #e9f7ff;
      transform: rotate(45deg);
      transform-origin: left center;
    }
    .side-finishing-option strong {
      display: none;
      padding: 5px 3px;
      background: rgba(2, 7, 18, 0.72);
      font-size: 10px;
      line-height: 1;
      text-align: center;
    }
    .selected-side-finishing {
      margin-top: 7px;
      color: #9fc8f4;
      font-size: 12px;
      text-align: center;
    }
    .selected-side-finishing strong { color: #f7fbff; }
    .side-finishing-configs {
      display: grid;
      gap: 8px;
      margin-top: 8px;
    }
    .side-finishing-config {
      display: none;
      gap: 7px;
      padding: 0;
      border: 0;
      border-radius: 0;
      background: transparent;
      box-shadow: none;
    }
    .side-finishing-config.is-active { display: grid; }
    .side-segment-card,
    .side-color-card {
      display: grid;
      grid-template-columns: 1fr;
      gap: 8px;
      align-items: end;
      padding: 6px 0;
      border: 0;
      border-radius: 0;
      background: transparent;
    }
    .side-segment-card span,
    .side-color-card span {
      grid-column: 1 / -1;
      margin: 0;
      color: #dbe8ff;
      font-size: 11px;
      font-weight: 900;
      letter-spacing: 0.3px;
      text-transform: uppercase;
    }
    .side-segment-head {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 76px;
      align-items: center;
      gap: 8px;
    }
    .side-segment-head span {
      grid-column: auto;
      margin: 0;
    }
    .side-mm-wrap {
      position: relative;
      min-width: 0;
    }
    .side-mm-input,
    .side-filament-select {
      width: 100%;
      min-width: 0;
      border: 1px solid rgba(63, 176, 255, 0.58);
      border-radius: 8px;
      background: rgba(3, 15, 31, 0.95);
      color: #f7fbff;
      font-weight: 800;
      font-size: 11px;
      padding: 8px 7px;
      box-shadow: inset 0 0 12px rgba(53, 216, 255, 0.07);
    }
    .side-mm-wrap .side-mm-input {
      padding-right: 27px;
      text-align: right;
    }
    .side-mm-wrap::after {
      content: "mm";
      position: absolute;
      right: 8px;
      top: 50%;
      transform: translateY(-50%);
      color: #9fc8f4;
      font-size: 10px;
      font-weight: 900;
      pointer-events: none;
    }
    .side-filament-select { padding-right: 24px; }
    .side-mm-input[readonly] {
      color: #9fc8f4;
      background: rgba(10, 24, 43, 0.95);
      cursor: default;
    }
    .side-filament-select:disabled {
      color: #9fc8f4;
      opacity: 1;
      background: rgba(10, 24, 43, 0.95);
      cursor: default;
    }
    .side-filament-map {
      grid-column: 1 / -1;
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 6px;
      min-width: 0;
    }
    .side-filament-option {
      position: relative;
      display: block;
      min-width: 0;
      aspect-ratio: 0.74;
      padding: 0;
      overflow: hidden;
      border: 2px solid transparent;
      border-radius: 7px;
      background: rgba(3, 15, 31, 0.95);
      cursor: pointer;
      transition: border-color 120ms ease, box-shadow 120ms ease, opacity 120ms ease;
    }
    .side-filament-option:hover,
    .side-filament-option.is-selected {
      border-color: #35d8ff;
      box-shadow: 0 0 12px rgba(53, 216, 255, 0.72), inset 0 0 10px rgba(53, 216, 255, 0.14);
    }
    .side-filament-option img {
      display: block;
      width: 100%;
      height: 100%;
      object-fit: cover;
      pointer-events: none;
    }
    .side-filament-option:disabled {
      cursor: default;
      opacity: 0.68;
    }
    .side-filament-option:disabled:not(.is-selected) { display: none; }
    .metrics span { display: block; color: #6eb6ff; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.7px; margin-bottom: 6px; }
    .metrics strong { font-size: clamp(20px, 2.1vw, 24px); line-height: 1.1; text-shadow: 0 0 13px rgba(220, 236, 255, 0.45); }
    .mounting-select {
      width: 100%;
      min-width: 0;
      border-color: rgba(63, 176, 255, 0.58);
      background: rgba(3, 15, 31, 0.95);
      color: #f7fbff;
      font-weight: 800;
      font-size: 12px;
      padding: 9px 28px 9px 10px;
      box-shadow: inset 0 0 18px rgba(53, 216, 255, 0.08);
    }
    .order-options { display: grid; grid-template-columns: 1fr; gap: 10px; }
    .collect-date-panel {
      grid-column: 1 / -1;
      border: 1px solid rgba(63, 176, 255, 0.72);
      border-radius: 12px;
      padding: 10px;
      background:
        linear-gradient(90deg, rgba(53, 216, 255, 0.04) 1px, transparent 1px),
        linear-gradient(0deg, rgba(53, 216, 255, 0.04) 1px, transparent 1px),
        rgba(4, 18, 38, 0.9);
      background-size: 14px 14px;
      box-shadow: 0 0 18px rgba(53, 216, 255, 0.14), inset 0 0 22px rgba(30, 102, 255, 0.08);
    }
    .draft-paper-panel {
      grid-column: 1 / -1;
      border: 1px solid rgba(63, 176, 255, 0.72);
      border-radius: 12px;
      padding: 10px;
      background:
        linear-gradient(90deg, rgba(53, 216, 255, 0.04) 1px, transparent 1px),
        linear-gradient(0deg, rgba(53, 216, 255, 0.04) 1px, transparent 1px),
        rgba(4, 18, 38, 0.9);
      background-size: 14px 14px;
      box-shadow: 0 0 18px rgba(53, 216, 255, 0.14), inset 0 0 22px rgba(30, 102, 255, 0.08);
    }
    .draft-paper-panel > span { display: block; font-weight: 700; color: #dbe9ff; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 8px; }
    .draft-paper-body { display: flex; flex-direction: column; gap: 10px; }
    .draft-paper-uplabel { display: block; font-size: 13px; color: #cfe4ff; margin-bottom: 8px; }
    .draft-paper-name { font-size: 12px; color: #7ae0a4; }
    .draft-paper-name[data-empty] { color: #8fa6c4; }
    .draft-paper-scale { display: flex; align-items: center; gap: 10px; }
    .draft-paper-scale > span { font-size: 13px; color: #cfe4ff; }
    .draft-paper-scale-select { flex: 0 0 auto; padding: 7px 9px; border: 1px solid rgba(63, 176, 255, 0.58); border-radius: 8px; background: rgba(3, 15, 31, 0.95); color: #f7fbff; font: inherit; font-size: 13px; }
    .remark-field {
      width: calc(100% - 4px);
      min-width: 0;
      height: 74px;
      box-sizing: border-box;
      margin: 8px 4px 6px 0;
      resize: none;
      border: 1px solid rgba(63, 176, 255, 0.58);
      border-radius: 8px;
      background: rgba(3, 15, 31, 0.95);
      color: #f7fbff;
      font: inherit;
      font-size: 12px;
      padding: 11px 9px;
      box-shadow: inset 0 0 18px rgba(53, 216, 255, 0.08);
    }
    .collect-date-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
    }
    .collect-date-option {
      position: relative;
      min-width: 0;
      height: 132px;
      border: 1px solid rgba(63, 176, 255, 0.58);
      border-radius: 8px;
      background: rgba(3, 15, 31, 0.95);
      color: #f7fbff;
      font-weight: 800;
      font-size: 12px;
      padding: 5px;
      overflow: hidden;
      display: grid;
      grid-template-rows: minmax(0, 1fr) 16px;
      gap: 4px;
      box-shadow: inset 0 0 18px rgba(53, 216, 255, 0.08);
    }
    .collect-date-option img {
      width: 100%;
      height: 100%;
      display: block;
      min-height: 0;
      object-fit: contain;
      object-position: center;
      border-radius: 5px;
      pointer-events: none;
    }
    .collect-date-option > span:not(.image-zoom-button) {
      display: block;
      margin: 0;
      color: #f7fbff;
      font-size: 10px;
      line-height: 16px;
      letter-spacing: 0;
      text-align: center;
      text-transform: none;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      pointer-events: none;
    }
    .collect-date-option.is-selected {
      border-color: rgba(53, 216, 255, 0.95);
      box-shadow: 0 0 14px rgba(53, 216, 255, 0.48), inset 0 0 18px rgba(53, 216, 255, 0.14);
    }
    .collect-date-option.is-disabled {
      opacity: 0.45; filter: grayscale(0.65); pointer-events: none; cursor: not-allowed;
    }
    .collect-date-option.is-disabled::after {
      content: "Closed after 4:00pm"; position: absolute; left: 6px; right: 6px; bottom: 6px;
      padding: 3px 4px; border-radius: 5px; background: rgba(196, 24, 44, 0.92);
      color: #fff; font-size: 10px; font-weight: 800; text-align: center;
    }
    .collect-date-preview {
      position: fixed;
      z-index: 1200;
      left: 50%;
      top: 50%;
      width: min(560px, 58vw);
      max-height: 70vh;
      transform: translate(-50%, -50%);
      display: none;
      pointer-events: none;
      border: 1px solid rgba(53, 216, 255, 0.9);
      border-radius: 12px;
      padding: 8px;
      background: rgba(2, 8, 18, 0.96);
      box-shadow: 0 0 38px rgba(53, 216, 255, 0.46), inset 0 0 24px rgba(53, 216, 255, 0.12);
    }
    .collect-date-preview.is-visible { display: block; }
    .collect-date-preview img {
      width: 100%;
      max-height: calc(70vh - 18px);
      display: block;
      object-fit: contain;
      border-radius: 8px;
    }
    .order-panel {
      grid-column: 1 / -1;
      border: 1px solid rgba(63, 176, 255, 0.72);
      border-radius: 12px;
      padding: 10px;
      background:
        linear-gradient(90deg, rgba(53, 216, 255, 0.04) 1px, transparent 1px),
        linear-gradient(0deg, rgba(53, 216, 255, 0.04) 1px, transparent 1px),
        rgba(4, 18, 38, 0.92);
      background-size: 14px 14px;
      box-shadow: 0 0 18px rgba(53, 216, 255, 0.14), inset 0 0 22px rgba(30, 102, 255, 0.08);
    }
    .metrics .order-panel div {
      border: 0;
      border-radius: 0;
      padding: 0;
      background: transparent;
      box-shadow: none;
    }
    .order-panel > span {
      margin: 0 0 10px;
    }
    .order-total-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      min-height: 38px;
      margin-top: 6px !important;
      border: 1px solid rgba(105, 143, 193, 0.28) !important;
      border-radius: 8px !important;
      padding: 0 10px !important;
      background: rgba(3, 15, 31, 0.56) !important;
    }
    .order-total-row:first-of-type {
      margin-top: 0 !important;
    }
    .order-total-row.is-active-agent {
      border-color: rgba(53, 216, 255, 0.9) !important;
      background: rgba(5, 34, 61, 0.88) !important;
      box-shadow: 0 0 14px rgba(53, 216, 255, 0.16), inset 0 0 18px rgba(53, 216, 255, 0.08) !important;
    }
    .order-total-row span {
      margin: 0;
      color: #b9c9dd;
      font-weight: 750;
    }
    .order-panel .order-price {
      color: #f4f8ff;
      font-size: 14px;
      font-weight: 750;
      text-shadow: none;
    }
    .order-total-row.is-active-agent span {
      color: #d7ecff;
      font-weight: 850;
    }
    .order-total-row.is-active-agent .order-price {
      color: #35d8ff;
      font-weight: 850;
      text-shadow: 0 0 10px rgba(53, 216, 255, 0.34);
    }
    /* RGB LED is quoted manually, not priced automatically: hide the tier prices
       and show a "contact sales" note instead. */
    .order-quote-note {
      display: none;
      margin-top: 6px;
      border: 1px solid rgba(53, 216, 255, 0.6);
      border-radius: 8px;
      padding: 12px 14px;
      background: rgba(5, 34, 61, 0.88);
      color: #d7ecff;
      font-weight: 800;
      line-height: 1.4;
      text-align: center;
    }
    .order-panel.is-rgb-quote .order-total-row { display: none; }
    .order-panel.is-rgb-quote .order-quote-note { display: block; }
    /* Express collect date: keep the surcharged prices visible, but warn that the
       order must be confirmed (Pending Confirmation). */
    .order-pending-note {
      display: none;
      margin-top: 8px;
      border: 1px solid rgba(255, 176, 60, 0.55);
      border-radius: 8px;
      padding: 10px 12px;
      background: rgba(60, 40, 6, 0.72);
      color: #ffd79a;
      font-weight: 700;
      line-height: 1.4;
      text-align: center;
    }
    .order-panel.is-pending-request .order-pending-note { display: block; }
    /* Special-request review popup (express collect dates). */
    .request-modal { display: none; position: fixed; inset: 0; z-index: 4000; align-items: center; justify-content: center; }
    .request-modal.is-open { display: flex; }
    .request-modal-backdrop { position: absolute; inset: 0; background: rgba(2, 8, 20, 0.72); backdrop-filter: blur(2px); }
    .request-modal-card { position: relative; z-index: 1; width: min(460px, 90vw); border: 1px solid rgba(255, 176, 60, 0.5); border-radius: 14px; padding: 22px; background: #0b1220; box-shadow: 0 24px 70px rgba(0, 0, 0, 0.55); }
    .request-modal-title { font-size: 17px; font-weight: 900; color: #ffcf7a; margin-bottom: 10px; }
    .request-modal-body { font-size: 13.5px; line-height: 1.55; color: #d7e4f5; }
    .request-modal-actions { display: flex; gap: 10px; justify-content: flex-end; margin-top: 20px; }
    .request-modal-actions button { padding: 10px 18px; border-radius: 9px; font-weight: 800; font-size: 13px; cursor: pointer; border: 1px solid transparent; }
    .request-modal-cancel { background: transparent; border-color: rgba(255, 255, 255, 0.22); color: #cbd8ec; }
    .request-modal-confirm { background: linear-gradient(135deg, #ffb03c, #ff8a3c); color: #241200; }
    .draft-modal { display: none; position: fixed; inset: 0; z-index: 4000; align-items: center; justify-content: center; }
    .draft-modal.is-open { display: flex; }
    .draft-modal-backdrop { position: absolute; inset: 0; background: rgba(2, 8, 20, 0.72); backdrop-filter: blur(2px); }
    .draft-modal-card { position: relative; z-index: 1; width: min(440px, 90vw); border: 1px solid rgba(63, 176, 255, 0.5); border-radius: 14px; padding: 22px; background: #0b1220; box-shadow: 0 24px 70px rgba(0, 0, 0, 0.55); }
    .draft-modal-title { font-size: 17px; font-weight: 900; color: #7fd0ff; margin-bottom: 10px; }
    .draft-modal-body { font-size: 13.5px; line-height: 1.55; color: #d7e4f5; }
    .draft-modal-actions { display: flex; gap: 10px; justify-content: flex-end; margin-top: 20px; }
    .draft-modal-actions button { padding: 10px 18px; border-radius: 9px; font-weight: 800; font-size: 13px; cursor: pointer; border: 1px solid transparent; }
    .draft-modal-no { background: transparent; border-color: rgba(255, 255, 255, 0.22); color: #cbd8ec; }
    .draft-modal-yes { background: linear-gradient(135deg, #3fb0ff, #35d8ff); color: #04121f; }
    .order-quantity-label {
      margin-top: 12px !important;
      color: #6eb6ff;
      font-size: 11px;
      font-weight: 850;
      letter-spacing: 0.7px;
      text-transform: uppercase;
    }
    .order-quantity-row {
      display: flex;
      justify-content: flex-end;
      align-items: center;
      gap: 6px;
      margin-top: 6px;
    }
    .order-qty-button {
      width: 34px;
      height: 34px;
      min-width: 34px;
      padding: 0;
      border: 1px solid rgba(53, 216, 255, 0.78);
      border-radius: 8px;
      background: linear-gradient(120deg, #3377ff, #16d7f1);
      color: #fff;
      font-size: 18px;
      font-weight: 950;
      line-height: 1;
      box-shadow: 0 0 16px rgba(53, 216, 255, 0.45);
    }
    .order-quantity {
      width: 58px;
      height: 34px;
      border: 1px solid rgba(63, 176, 255, 0.58);
      border-radius: 8px;
      background: rgba(3, 15, 31, 0.95);
      color: #f7fbff;
      font-size: 14px;
      font-weight: 900;
      text-align: center;
    }
    .order-terms {
      display: flex;
      align-items: center;
      gap: 9px;
      margin-top: 10px;
      color: #b7d6ff;
      font-size: 11px;
      font-weight: 850;
      letter-spacing: 0.2px;
    }
    .order-terms input {
      width: 18px;
      height: 18px;
      flex: 0 0 auto;
      accent-color: #35d8ff;
    }
    .order-terms span {
      display: inline;
      margin: 0;
      color: inherit;
      font-size: 11px;
      font-weight: 850;
      letter-spacing: 0.2px;
      text-transform: none;
    }
    .order-terms a {
      color: #d9f4ff;
      text-decoration: underline;
      text-underline-offset: 3px;
    }
    .order-add-button {
      width: 100%;
      min-height: 40px;
      margin-top: 12px;
      border: 1px solid rgba(63, 176, 255, 0.5);
      border-radius: 8px;
      background: linear-gradient(100deg, #3377ff, #17c9ee);
      color: #f7fbff;
      font-size: 14px;
      font-weight: 950;
      letter-spacing: 0.8px;
    }
    .order-add-button:disabled {
      cursor: default;
      opacity: 0.5;
      background: rgba(13, 31, 55, 0.72);
      color: #a9b7c9;
      box-shadow: none;
    }
    .base-finishing.is-hidden { display: none; }
    .item-craft-panel {
      border: 1px solid rgba(63, 176, 255, 0.72);
      border-radius: 12px;
      padding: 10px;
      background:
        linear-gradient(90deg, rgba(53, 216, 255, 0.04) 1px, transparent 1px),
        linear-gradient(0deg, rgba(53, 216, 255, 0.04) 1px, transparent 1px),
        rgba(4, 18, 38, 0.9);
      background-size: 14px 14px;
      box-shadow: 0 0 18px rgba(53, 216, 255, 0.14), inset 0 0 22px rgba(30, 102, 255, 0.08);
    }
    .item-craft-panel.is-hidden { display: none; }
    .item-craft-selected {
      margin: 4px 0 10px;
      color: #f7fbff;
      font-size: 13px;
      font-weight: 900;
    }
    .item-craft-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 8px;
    }
    .item-craft-grid label {
      display: grid;
      gap: 6px;
      color: #9fc8f4;
      font-size: 11px;
      font-weight: 850;
      text-transform: uppercase;
      letter-spacing: 0.4px;
    }
    .item-craft-note {
      margin-top: 8px;
      color: #b7c6dc;
      font-size: 11px;
      line-height: 1.35;
    }
    .item-craft-done {
      width: 100%;
      min-height: 36px;
      margin-top: 10px;
      border-radius: 8px;
      padding: 9px 12px;
      font-size: 12px;
      letter-spacing: 0.3px;
    }
    .letter-dimension-item.has-custom-craft {
      box-shadow: inset 3px 0 0 rgba(53, 216, 255, 0.88);
    }
    .letter-item-craft-note {
      color: #35d8ff;
      font-size: 10px;
      font-weight: 900;
      text-transform: uppercase;
    }
    .panel-label { color: #dbe8ff; font-size: 16px; font-weight: 800; letter-spacing: 0.4px; text-transform: uppercase; margin-bottom: 12px; }
    .original-preview-panel { grid-column: 1; grid-row: 1; }
    .preview-grid { grid-column: 2; grid-row: 1; display: grid; grid-template-columns: 1fr; gap: 12px; min-width: 0; width: 100%; max-width: 100%; padding-top: 4px; align-self: start; }
    .preview-panel {
      min-width: 0;
      height: 390px;
      margin-top: -3px;
      border: 1px solid rgba(98, 155, 255, 0.34);
      border-radius: 14px;
      padding: 7px 14px;
      background: rgba(6, 20, 40, 0.82);
      box-shadow: inset 0 0 30px rgba(53, 216, 255, 0.07);
      display: flex;
      flex-direction: column;
    }
    .preview {
      position: relative;
      min-height: 0;
      flex: 1;
      background: rgba(231, 244, 255, 0.95);
      border: 1px solid rgba(128, 183, 255, 0.28);
      border-radius: 10px;
      padding: 5px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: inset 0 0 28px rgba(27, 119, 255, 0.12);
    }
    .preview.is-loading::after {
      content: "Preview loading";
      color: #8fa7c5;
      font-size: 13px;
      font-weight: 800;
      letter-spacing: 0.3px;
    }
    .line-preview { background: #f8fbff; }
    .original-preview { background: #f8fbff; }
    .original-preview img { cursor: zoom-in; background: #fff; }
    .preview img { max-width: 100%; max-height: 100%; object-fit: contain; background: #000; cursor: zoom-in; }
    .preview img.delayed-preview { display: none; }
    .dimension-preview img, .line-preview img { background: transparent; }
    .dimension-highlight {
      position: absolute;
      z-index: 2;
      pointer-events: none;
      border: 2px solid #ff2c2c;
      border-radius: 3px;
      background: rgba(255, 0, 0, 0.22);
      box-shadow: 0 0 12px rgba(255, 0, 0, 0.8), inset 0 0 10px rgba(255, 0, 0, 0.32);
      opacity: 0;
      transition: opacity 120ms ease;
    }
    .dimension-highlight.is-visible { opacity: 1; }
    .dimension-selection-highlight,
    .dimension-group-highlight {
      position: absolute;
      z-index: 3;
      pointer-events: none;
      border-radius: 3px;
    }
    .dimension-selection-highlight {
      border: 2px solid #1f8cff;
      background: rgba(31, 140, 255, 0.18);
      box-shadow: 0 0 10px rgba(31, 140, 255, 0.72), inset 0 0 8px rgba(31, 140, 255, 0.24);
    }
    .dimension-group-highlight {
      z-index: 4;
      border: 3px solid #2df3ff;
      background: rgba(45, 243, 255, 0.12);
      box-shadow: 0 0 16px rgba(45, 243, 255, 0.82), inset 0 0 12px rgba(45, 243, 255, 0.2);
    }
    .dimension-record-hitbox {
      position: absolute;
      z-index: 5;
      pointer-events: auto;
      cursor: grab;
      border: 1px dashed rgba(31, 140, 255, 0.74);
      border-radius: 3px;
      background: rgba(31, 140, 255, 0.08);
    }
    .dimension-record-hitbox.is-selected {
      border: 2px solid #1f8cff;
      background: rgba(31, 140, 255, 0.22);
      box-shadow: 0 0 12px rgba(31, 140, 255, 0.72);
    }
    .dimension-deleted-marker {
      position: absolute;
      z-index: 7;
      pointer-events: none;
      border: 2px solid rgba(255, 46, 62, 0.95);
      border-radius: 4px;
      background: rgba(255, 31, 45, 0.12);
      box-shadow: 0 0 14px rgba(255, 31, 45, 0.72), inset 0 0 12px rgba(255, 31, 45, 0.18);
    }
    .dimension-deleted-marker::before,
    .dimension-deleted-marker::after {
      content: "";
      position: absolute;
      left: 50%;
      top: 50%;
      width: 128%;
      height: 3px;
      background: #ff233d;
      border-radius: 999px;
      box-shadow: 0 0 9px rgba(255, 35, 61, 0.9);
      transform-origin: center;
    }
    .dimension-deleted-marker::before { transform: translate(-50%, -50%) rotate(45deg); }
    .dimension-deleted-marker::after { transform: translate(-50%, -50%) rotate(-45deg); }
    .dimension-record-hitbox.is-dragging { cursor: grabbing; }
    .dimension-marquee {
      position: absolute;
      z-index: 8;
      pointer-events: none;
      border: 1px solid #2df3ff;
      border-radius: 3px;
      background: rgba(45, 243, 255, 0.14);
      box-shadow: 0 0 12px rgba(45, 243, 255, 0.58);
      display: none;
    }
    .preview-total, .line-total {
      margin-top: 6px;
      padding: 6px 8px;
      border: 1px solid rgba(63, 176, 255, 0.58);
      border-radius: 9px;
      background: rgba(3, 15, 31, 0.92);
      color: #9fc8f4;
      font-size: 12px;
      text-align: center;
      box-shadow: inset 0 0 18px rgba(53, 216, 255, 0.08);
    }
    .preview-total strong, .line-total strong { color: #f7fbff; font-size: 13px; text-shadow: 0 0 10px rgba(220, 236, 255, 0.45); }
    .craft-3d-preview {
      --face: #fffdf5;
      --side: #ded9cd;
      --glow: #f8fbff;
      --led-glow: #f8fbff;
      --depth-x: 42px;
      --depth-y: 12px;
      --depth-z: -48px;
      --shell-opacity: 1;
      grid-column: 1 / 3;
      grid-row: 2;
      min-height: 660px;
      margin-top: 16px;
      border: 1px solid rgba(84, 104, 132, 0.5);
      border-radius: 14px;
      padding: 0;
      background:
        radial-gradient(circle at 52% 18%, rgba(114, 152, 255, 0.09), transparent 24%),
        linear-gradient(180deg, rgba(13, 16, 24, 0.98), rgba(5, 7, 12, 0.99));
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.055), 0 0 30px rgba(11, 18, 32, 0.42);
      overflow: hidden;
      position: relative;
    }
    .craft-3d-title {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 14px;
      margin: 0;
      padding: 14px 16px;
      color: #dbe8ff;
      font-size: 17px;
      font-weight: 900;
      letter-spacing: 0;
      text-transform: none;
      background: rgba(9, 13, 20, 0.78);
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    }
    .craft-3d-title span:first-child::after {
      content: "Active";
      display: inline-block;
      margin-left: 10px;
      padding: 3px 9px;
      border: 1px solid rgba(158, 255, 94, 0.35);
      border-radius: 999px;
      color: #aaff62;
      background: rgba(85, 150, 35, 0.16);
      font-size: 11px;
      font-weight: 900;
      letter-spacing: 0;
      text-transform: none;
      vertical-align: 1px;
    }
    .craft-3d-title span:last-child {
      color: #eaf3ff;
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 0;
      border: 1px solid rgba(255, 255, 255, 0.16);
      border-radius: 8px;
      padding: 8px 12px;
      background: rgba(3, 7, 12, 0.64);
      box-shadow: inset 0 0 14px rgba(255, 255, 255, 0.03);
    }
    .craft-workspace {
      position: relative;
      min-height: 520px;
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      background:
        radial-gradient(circle at 50% 38%, color-mix(in srgb, var(--glow) 13%, transparent), transparent 34%),
        radial-gradient(circle at 50% 72%, rgba(0, 0, 0, 0.72), transparent 42%),
        linear-gradient(180deg, #080a0f, #030408);
    }
    .logo-lab-panel,
    .logo-lab-actions { display: none; }
    .craft-tool-rail,
    .craft-inspector { display: none; }
    .craft-tool-rail {
      display: grid;
      align-content: start;
      gap: 10px;
      padding: 14px 10px;
      border-right: 1px solid rgba(255, 255, 255, 0.08);
      background: rgba(6, 9, 15, 0.62);
      z-index: 4;
    }
    .craft-tool {
      width: 32px;
      height: 32px;
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 9px;
      display: grid;
      place-items: center;
      color: #c8d4e6;
      background: rgba(20, 26, 37, 0.9);
      font-size: 15px;
      font-weight: 900;
    }
    .craft-tool.is-active {
      color: #fff;
      border-color: rgba(87, 125, 255, 0.9);
      background: rgba(42, 63, 126, 0.76);
      box-shadow: 0 0 18px rgba(83, 116, 255, 0.3);
    }
    .craft-3d-stage {
      height: 500px;
      position: relative;
      display: grid;
      place-items: center;
      border: 0;
      border-left: 1px solid rgba(255, 255, 255, 0.08);
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 0;
      background:
        radial-gradient(circle at 36% 24%, rgba(255,255,255,0.16), transparent 26%),
        radial-gradient(ellipse at 50% 78%, rgba(0,0,0,0.58), transparent 48%),
        linear-gradient(180deg, #343434, #242424 56%, #171719);
      background-size: auto;
      perspective: 1250px;
      cursor: grab;
      user-select: none;
      overflow: hidden;
    }
    .craft-3d-stage::before {
      content: "";
      position: absolute;
      inset: 0;
      pointer-events: none;
      background:
        linear-gradient(115deg, transparent 0 42%, rgba(255,255,255,0.055) 42.2%, transparent 43%),
        linear-gradient(90deg, rgba(255,255,255,0.018) 1px, transparent 1px),
        linear-gradient(0deg, rgba(255,255,255,0.015) 1px, transparent 1px);
      background-size: auto, 30px 30px, 30px 30px;
      opacity: 0.62;
    }
    .craft-3d-stage.is-dragging { cursor: grabbing; }
    .craft-3d-stage::after {
      content: "";
      position: absolute;
      left: 26%;
      right: 26%;
      bottom: 86px;
      height: 46px;
      border-radius: 50%;
      background: radial-gradient(ellipse at center, rgba(0,0,0,0.78), transparent 72%);
      filter: blur(18px);
      opacity: 0.62;
    }
    .craft-three-canvas {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      display: block;
      z-index: 2;
    }
    .craft-three-loading {
      position: absolute;
      left: 16px;
      bottom: 14px;
      z-index: 3;
      color: rgba(230, 237, 247, 0.78);
      font-size: 12px;
      font-weight: 800;
      pointer-events: none;
    }
    .craft-three-depth-label {
      position: absolute;
      top: 18px;
      right: 18px;
      z-index: 3;
      min-width: 86px;
      padding: 8px 12px;
      border: 1px solid rgba(255, 255, 255, 0.28);
      border-radius: 10px;
      background: rgba(12, 16, 22, 0.72);
      color: #f7fbff;
      font-size: 13px;
      font-weight: 900;
      text-align: center;
      box-shadow: inset 0 0 18px rgba(255,255,255,0.06), 0 10px 24px rgba(0,0,0,0.28);
      pointer-events: none;
    }
    .craft-three-led-label {
      position: absolute;
      top: 82px;
      right: 18px;
      z-index: 3;
      min-width: 132px;
      padding: 9px 14px;
      border: 1px solid rgba(255, 255, 255, 0.22);
      border-radius: 10px;
      background: rgba(12, 16, 22, 0.68);
      color: #fff6dc;
      font-size: 13px;
      font-weight: 900;
      text-align: center;
      text-shadow: 0 0 10px rgba(255, 184, 107, 0.38);
      box-shadow: inset 0 0 18px rgba(255,255,255,0.05), 0 10px 24px rgba(0,0,0,0.24);
      pointer-events: none;
      display: none;
    }
    .craft-3d-preview.has-led-color .craft-three-led-label { display: block; }
    .craft-3d-model {
      position: relative;
      display: none;
      width: 360px;
      height: 360px;
      transform-style: preserve-3d;
      transform: rotateX(var(--rx, 5deg)) rotateY(var(--ry, -18deg)) rotateZ(0deg);
      transition: transform 120ms ease-out;
      z-index: 1;
    }
    .craft-3d-stage.has-three .craft-3d-model {
      display: none;
    }
    .craft-static-render {
      position: absolute;
      inset: 0;
      z-index: 4;
      pointer-events: none;
      display: grid;
      place-items: center;
      background:
        radial-gradient(circle at 48% 52%, color-mix(in srgb, var(--led-glow) 0%, transparent), transparent 34%),
        radial-gradient(ellipse at 50% 82%, rgba(0,0,0,0.32), transparent 34%);
    }
    .craft-3d-preview.has-led-color .craft-static-render {
      background:
        radial-gradient(circle at 47% 54%, color-mix(in srgb, var(--led-glow) 16%, transparent), transparent 34%),
        radial-gradient(ellipse at 50% 82%, color-mix(in srgb, var(--led-glow) 13%, rgba(0,0,0,0.22)), transparent 36%);
    }
    .craft-static-sign {
      position: relative;
      width: min(54%, 430px);
      aspect-ratio: 1.08;
      transform-style: preserve-3d;
      transform: translateY(-4%) rotateX(0deg) rotateY(0deg);
      transition: transform 160ms ease, width 160ms ease;
      filter: drop-shadow(0 34px 24px rgba(0,0,0,0.46));
    }
    .craft-static-side,
    .craft-static-face {
      position: absolute;
      inset: 0;
      -webkit-mask: url("/assets/company-logo.svg") center / contain no-repeat;
      mask: url("/assets/company-logo.svg") center / contain no-repeat;
    }
    .craft-static-side {
      transform: translate(42px, 12px);
      background:
        linear-gradient(90deg, #f9fbff 0%, #8b929c 18%, #f7f9fb 36%, #686f79 54%, #f5f7fa 76%, #939aa3 100%);
      filter: brightness(0.98) contrast(1.16) saturate(0.7);
      opacity: 0.92;
    }
    .craft-static-face {
      transform: translateZ(1px);
      background:
        radial-gradient(circle at 48% 52%, color-mix(in srgb, var(--face) 58%, #ffffff), color-mix(in srgb, var(--face) 94%, #fff7dc) 46%, var(--face) 74%),
        linear-gradient(160deg, rgba(255,255,255,0.22), transparent 42%);
      box-shadow:
        inset 0 0 28px rgba(255,255,255,0.3),
        inset 0 0 54px color-mix(in srgb, var(--led-glow) 18%, transparent);
      filter:
        drop-shadow(0 0 5px color-mix(in srgb, var(--led-glow) 30%, transparent))
        drop-shadow(0 0 15px color-mix(in srgb, var(--led-glow) 20%, transparent));
    }
    .craft-3d-preview.has-led-color .craft-static-face {
      filter:
        brightness(1.18)
        drop-shadow(0 0 8px color-mix(in srgb, var(--led-glow) 48%, transparent))
        drop-shadow(0 0 24px color-mix(in srgb, var(--led-glow) 28%, transparent));
    }
    .craft-static-face::after {
      content: "";
      position: absolute;
      inset: 0;
      background:
        radial-gradient(circle at 50% 46%, rgba(255,255,255,0.28), transparent 42%),
        linear-gradient(120deg, rgba(255,255,255,0.18), transparent 48%);
      -webkit-mask: url("/assets/company-logo.svg") center / contain no-repeat;
      mask: url("/assets/company-logo.svg") center / contain no-repeat;
    }
    .craft-3d-preview.view-angle .craft-static-sign,
    .craft-3d-preview.view-install .craft-static-sign {
      width: min(58%, 460px);
      transform: translateY(-2%) rotateX(0deg) rotateY(-24deg);
    }
    .craft-3d-preview.view-front .craft-static-side {
      transform: translate(20px, 8px);
      opacity: 0.42;
    }
    .craft-3d-preview.view-side .craft-static-sign {
      width: min(28%, 220px);
      transform: translateY(-2%) rotateY(-82deg);
    }
    .craft-3d-preview.view-side .craft-static-face { filter: brightness(1.05); }
    .craft-3d-preview.view-top .craft-static-sign {
      width: min(46%, 360px);
      transform: translateY(2%) rotateX(78deg) rotateY(-20deg);
    }
    .craft-3d-model::before {
      content: "";
      position: absolute;
      inset: 0;
      display: none;
      transform: translate3d(calc(var(--depth-x) * 0.62), calc(var(--depth-y) * 0.62), calc(var(--depth-z) * 0.62)) scale(0.995);
      background:
        linear-gradient(90deg, #ffffff 0%, #f1f2f3 18%, #c5c8cc 34%, #ffffff 52%, #a9adb2 72%, #ffffff 100%),
        linear-gradient(115deg, #ffffff, #dfe2e6 44%, #9da3aa 100%);
      -webkit-mask: url("/assets/company-logo.svg") center / contain no-repeat;
      mask: url("/assets/company-logo.svg") center / contain no-repeat;
      box-shadow: 24px 18px 30px rgba(0, 0, 0, 0.52);
      opacity: var(--shell-opacity);
      filter: brightness(1.08) contrast(1.08) saturate(0.72);
      z-index: 0;
    }
    .craft-3d-model::after {
      content: "";
      position: absolute;
      display: none;
      left: 50%;
      top: 50%;
      width: 260px;
      height: 180px;
      transform: translate(-50%, -33%) rotateZ(-3deg);
      border-radius: 50%;
      background: radial-gradient(ellipse at center, rgba(0,0,0,0.58), transparent 70%);
      filter: blur(20px);
      z-index: -2;
    }
    .craft-3d-stage.is-dragging .craft-3d-model { transition: none; }
    .craft-3d-solid {
      position: absolute;
      inset: 0;
      display: grid;
      place-items: center;
      transform-style: preserve-3d;
      filter:
        drop-shadow(0 30px 26px rgba(0, 0, 0, 0.58))
        drop-shadow(10px 12px 18px rgba(0, 0, 0, 0.34));
    }
    .craft-3d-solid::before,
    .craft-3d-solid::after {
      content: "";
      position: absolute;
      inset: 0;
      display: grid;
      place-items: center;
      font-family: Impact, "Arial Black", "Segoe UI Black", sans-serif;
      font-size: 330px;
      font-weight: 900;
      line-height: 0.9;
      letter-spacing: 0;
      transform-style: preserve-3d;
      -webkit-text-stroke: 2px rgba(238, 241, 245, 0.5);
      color: transparent;
      -webkit-background-clip: text;
      background-clip: text;
      -webkit-mask: url("/assets/company-logo.svg") center / contain no-repeat;
      mask: url("/assets/company-logo.svg") center / contain no-repeat;
    }
    .craft-3d-solid::before {
      transform: translate3d(var(--depth-x), var(--depth-y), var(--depth-z));
      background-image:
        repeating-linear-gradient(90deg, rgba(255,255,255,0.14) 0 2px, rgba(55,59,65,0.2) 2px 5px),
        linear-gradient(90deg, #f1f3f5 0%, #777c84 11%, #f8f9fa 22%, #8d929a 36%, #f7f8fa 51%, #6c727b 64%, #fafafa 77%, #92979e 88%, #ffffff 100%),
        linear-gradient(180deg, #d9dde2 0%, #858b93 48%, #f0f2f4 100%);
      filter: brightness(1.02) contrast(1.22) saturate(0.72);
      text-shadow:
        0 0 1px rgba(255, 255, 255, 0.26),
        20px 18px 34px rgba(0, 0, 0, 0.68);
      z-index: 1;
    }
    .craft-3d-solid::after {
      transform: translateZ(14px);
      background-image:
        linear-gradient(102deg, rgba(255,255,255,0.62) 0 8%, transparent 8.5% 42%, rgba(255,255,255,0.36) 47%, transparent 57%),
        repeating-linear-gradient(96deg, rgba(255,255,255,0.11) 0 2px, rgba(79,84,92,0.1) 2px 5px),
        linear-gradient(112deg, #f2f4f7 0%, #c2c8d0 18%, #f6f7f8 31%, #9ba2ad 48%, #e8ebef 63%, #b3bac4 78%, #fafafa 100%);
      filter:
        brightness(1.0)
        contrast(1.22)
        saturate(0.76);
      text-shadow:
        0 1px 0 rgba(255, 255, 255, 0.55),
        0 -1px 0 rgba(65, 70, 78, 0.72),
        2px 0 0 rgba(70, 76, 84, 0.22),
        -2px 0 0 rgba(255, 255, 255, 0.18);
      z-index: 3;
    }
    .craft-3d-stage.is-black .craft-3d-solid::after {
      background-image:
        linear-gradient(103deg, #0a0c10 0%, #333944 18%, #050608 34%, #555d68 52%, #0a0c10 74%, #20242b 100%);
      -webkit-text-stroke-color: rgba(255, 255, 255, 0.2);
      filter: brightness(1.03) contrast(1.22);
    }
    .craft-3d-stage.is-thick .craft-3d-solid::before {
      filter: brightness(1.03) contrast(1.28) saturate(0.72);
    }
    .craft-3d-layer {
      position: absolute;
      inset: 0;
      display: block;
      background:
        linear-gradient(90deg, #ffffff 0%, #f5f6f7 34%, #d8dce2 72%, #ffffff 100%);
      -webkit-mask: url("/assets/company-logo.svg") center / contain no-repeat;
      mask: url("/assets/company-logo.svg") center / contain no-repeat;
      transform-style: preserve-3d;
      filter: brightness(1.06) contrast(1.02);
      opacity: calc(var(--shell-opacity) * 0.07);
    }
    .craft-3d-layer.deep { opacity: calc(var(--shell-opacity) * 0.05); }
    .craft-3d-stage.is-standard .craft-3d-layer.deep:nth-of-type(n+14) { display: none; }
    .craft-3d-stage.is-thick .craft-3d-layer.deep { display: block; }
    .craft-3d-face {
      display: grid;
      place-items: center;
      background:
        linear-gradient(145deg, #ffffff 0%, #f3f4f5 24%, #cfd3da 48%, #ffffff 70%, #b7bbc5 100%);
      -webkit-mask: url("/assets/company-logo.svg") center / contain no-repeat;
      mask: url("/assets/company-logo.svg") center / contain no-repeat;
      filter:
        drop-shadow(0 18px 22px rgba(0, 0, 0, 0.5))
        drop-shadow(0 0 16px rgba(255,255,255,0.52))
        drop-shadow(0 0 34px color-mix(in srgb, var(--glow) 30%, transparent));
      opacity: 1;
      z-index: 3;
      transform: translateZ(8px);
    }
    .craft-3d-face::before {
      content: "";
      position: absolute;
      inset: 0;
      background:
        radial-gradient(circle at 78% 76%, rgba(255,255,255,0.92), transparent 18%),
        linear-gradient(110deg, transparent 0 40%, rgba(255,255,255,0.55) 46%, transparent 58%);
      -webkit-mask: url("/assets/company-logo.svg") center / contain no-repeat;
      mask: url("/assets/company-logo.svg") center / contain no-repeat;
      opacity: 0.82;
    }
    .craft-3d-stage.is-black .craft-3d-face {
      text-shadow:
        0 0 9px var(--glow),
        0 0 26px var(--glow),
        0 0 48px var(--glow),
        6px 8px 0 #05070a;
    }
    .craft-3d-stage.is-spray .craft-3d-face {
      filter: drop-shadow(0 0 12px var(--glow)) brightness(1.08);
    }
    .craft-3d-preview.has-led-color .craft-3d-face {
      filter:
        drop-shadow(0 18px 22px rgba(0, 0, 0, 0.5))
        drop-shadow(0 0 18px color-mix(in srgb, var(--led-glow) 58%, transparent))
        drop-shadow(0 0 46px color-mix(in srgb, var(--led-glow) 42%, transparent));
    }
    .craft-3d-badge,
    .craft-depth-callout,
    .craft-viewer-hud,
    .craft-3d-drag {
      display: none;
    }
    .craft-3d-badge {
      position: absolute;
      right: 18px;
      top: 72px;
      min-width: 74px;
      padding: 8px 12px 8px 34px;
      border: 1px solid rgba(255, 255, 255, 0.34);
      border-radius: 10px;
      background:
        linear-gradient(90deg, color-mix(in srgb, var(--side) 82%, #fff), color-mix(in srgb, var(--side) 78%, #111));
      color: #f7fbff;
      font-size: 13px;
      font-weight: 900;
      text-align: center;
      box-shadow: 0 0 18px color-mix(in srgb, var(--glow) 28%, transparent), inset 0 0 16px rgba(255, 255, 255, 0.1);
      z-index: 2;
    }
    .craft-depth-callout {
      position: absolute;
      right: 24%;
      top: 48%;
      width: 132px;
      height: 54px;
      transform: translateY(-50%);
      color: #eef6ff;
      font-size: 12px;
      font-weight: 900;
      text-align: right;
      pointer-events: none;
      z-index: 4;
    }
    .craft-depth-callout::before {
      content: "";
      position: absolute;
      left: 0;
      right: 42px;
      top: 27px;
      height: 1px;
      background: linear-gradient(90deg, transparent, color-mix(in srgb, var(--glow) 62%, #fff));
      box-shadow: 0 0 12px color-mix(in srgb, var(--glow) 36%, transparent);
    }
    .craft-depth-callout::after {
      content: "";
      position: absolute;
      right: 0;
      top: 10px;
      width: 18px;
      height: 34px;
      border-radius: 6px;
      background:
        linear-gradient(90deg, rgba(255,255,255,0.18), rgba(0,0,0,0.1) 62%, rgba(0,0,0,0.22)),
        repeating-linear-gradient(90deg, rgba(255,255,255,0.06) 0 1px, transparent 1px 5px),
        var(--side);
      box-shadow:
        inset -6px 0 8px rgba(0, 0, 0, 0.28),
        0 0 18px color-mix(in srgb, var(--glow) 24%, transparent);
    }
    .craft-depth-callout span {
      position: absolute;
      right: 30px;
      top: 15px;
      padding: 5px 8px;
      border: 1px solid rgba(255, 255, 255, 0.18);
      border-radius: 8px;
      background: rgba(4, 8, 13, 0.7);
      box-shadow: inset 0 0 14px rgba(255, 255, 255, 0.05);
      white-space: nowrap;
    }
    .craft-3d-stage.is-thick .craft-depth-callout {
      right: 22%;
    }
    .craft-3d-stage.is-thick .craft-depth-callout::after {
      width: 30px;
      box-shadow:
        inset -10px 0 12px rgba(0, 0, 0, 0.3),
        0 0 20px color-mix(in srgb, var(--glow) 28%, transparent);
    }
    .craft-viewer-hud {
      position: absolute;
      left: 16px;
      bottom: 16px;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 8px 10px;
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 9px;
      background: rgba(4, 7, 12, 0.62);
      color: #bac7d8;
      font-size: 12px;
      font-weight: 800;
      z-index: 4;
    }
    .craft-inspector {
      padding: 14px;
      border-left: 1px solid rgba(255, 255, 255, 0.08);
      background: rgba(8, 12, 19, 0.78);
      display: grid;
      align-content: start;
      gap: 10px;
    }
    .craft-inspector h4 {
      margin: 0 0 4px;
      color: #f2f7ff;
      font-size: 12px;
      font-weight: 900;
      letter-spacing: 0.4px;
      text-transform: uppercase;
    }
    .craft-inspector-row {
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 9px;
      padding: 9px;
      background: rgba(17, 23, 34, 0.78);
      color: #9aa8ba;
      font-size: 10px;
    }
    .craft-inspector-row strong {
      display: block;
      margin-top: 3px;
      color: #f7fbff;
      font-size: 12px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .craft-3d-badge::before {
      content: "";
      position: absolute;
      left: 10px;
      top: 8px;
      bottom: 8px;
      width: 14px;
      border-radius: 4px;
      background:
        linear-gradient(90deg, rgba(255,255,255,0.78), rgba(255,255,255,0.15)),
        var(--side);
      box-shadow: inset -4px 0 7px rgba(0,0,0,0.24);
    }
    .craft-3d-stage.is-thick .craft-3d-badge {
      padding-left: 42px;
    }
    .craft-3d-stage.is-thick .craft-3d-badge::before {
      width: 20px;
      box-shadow: inset -7px 0 9px rgba(0,0,0,0.28);
    }
    .craft-3d-drag {
      position: absolute;
      left: 50%;
      bottom: 30px;
      z-index: 3;
      transform: translateX(-50%);
      color: rgba(230, 237, 247, 0.62);
      font-size: 13px;
      font-weight: 800;
    }
    .craft-3d-drag::before {
      content: "";
      display: inline-block;
      width: 14px;
      height: 14px;
      margin-right: 8px;
      border: 1px solid currentColor;
      border-radius: 50%;
      vertical-align: -2px;
      box-shadow: 8px 0 0 -6px currentColor, -8px 0 0 -6px currentColor;
    }
    .craft-view-strip {
      display: grid;
      grid-template-columns: repeat(5, minmax(0, 1fr));
      gap: 12px;
      padding: 12px 18px 14px;
      background: rgba(6, 10, 17, 0.92);
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    }
    .craft-view-card {
      --view-icon: #dceeff;
      appearance: none;
      border: 1px solid rgba(255, 255, 255, 0.12);
      min-height: 86px;
      border-radius: 8px;
      background: rgba(12, 32, 55, 0.78);
      color: #dce8fb;
      font-size: 11px;
      font-weight: 800;
      text-align: center;
      display: grid;
      grid-template-rows: 1fr auto;
      align-items: center;
      padding: 8px 8px 9px;
      cursor: pointer;
      box-shadow: none;
      width: auto;
    }
    .craft-view-card:hover {
      --view-icon: #f3fbff;
      border-color: rgba(53, 216, 255, 0.72);
      box-shadow: 0 0 14px rgba(53, 216, 255, 0.18);
    }
    .craft-view-card.is-active {
      --view-icon: #ffffff;
      border-color: rgba(91, 91, 255, 0.95);
      box-shadow: 0 0 0 1px rgba(91, 91, 255, 0.44), 0 0 18px rgba(53, 216, 255, 0.2);
    }
    .craft-view-letter {
      width: 62px;
      height: 62px;
      margin: 0 auto;
      display: block;
      position: relative;
      background: var(--view-icon);
      -webkit-mask: url("/assets/company-logo.svg") center / contain no-repeat;
      mask: url("/assets/company-logo.svg") center / contain no-repeat;
      filter: drop-shadow(0 0 8px rgba(180, 230, 255, 0.26));
    }
    .craft-view-letter::before {
      content: "";
      position: absolute;
      inset: 0;
      background: rgba(53, 216, 255, 0.26);
      -webkit-mask: url("/assets/company-logo.svg") center / contain no-repeat;
      mask: url("/assets/company-logo.svg") center / contain no-repeat;
      transform: translate(-4px, -3px);
      opacity: 0.5;
      filter: none;
    }
    .craft-view-card[data-view="angle"] .craft-view-letter {
      transform: perspective(150px) rotateY(-38deg) rotateZ(-3deg);
      filter: drop-shadow(0 0 8px rgba(180, 230, 255, 0.26));
    }
    .craft-view-letter.side {
      transform: perspective(130px) rotateY(-78deg);
      filter: drop-shadow(0 0 8px rgba(180, 230, 255, 0.26));
    }
    .craft-view-letter.top {
      transform: perspective(120px) rotateX(72deg) scaleY(0.78);
      filter: drop-shadow(0 0 8px rgba(180, 230, 255, 0.26));
    }
    .craft-view-card.install .craft-view-letter {
      transform: perspective(150px) rotateY(-28deg);
      filter: drop-shadow(0 0 8px rgba(180, 230, 255, 0.26));
    }
    .craft-view-card.install {
      background: rgba(12, 32, 55, 0.78);
    }
    .craft-3d-spec {
      display: grid;
      grid-template-columns: 1fr;
      gap: 10px;
      padding: 18px;
      background: linear-gradient(180deg, rgba(10, 14, 22, 0.86), rgba(7, 11, 18, 0.96));
    }
    .craft-summary {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 10px;
    }
    .craft-summary div {
      min-width: 0;
      padding: 10px;
      border: 1px solid rgba(105, 143, 193, 0.25);
      border-radius: 9px;
      background: rgba(5, 15, 29, 0.5);
    }
    .craft-summary strong {
      display: block;
      margin-bottom: 5px;
      color: #8fd2ff;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }
    .craft-summary span {
      color: #f7fbff;
      font-size: 12px;
      line-height: 1.35;
      overflow-wrap: anywhere;
    }
    .craft-material {
      display: grid;
      grid-template-columns: 150px 1fr;
      gap: 14px;
      align-items: center;
      min-width: 0;
    }
    .craft-material h4,
    .craft-feature-grid h4 {
      grid-column: 1 / -1;
      margin: 0;
      color: #f2f7ff;
      font-size: 13px;
      font-weight: 900;
      letter-spacing: 0.4px;
      text-transform: uppercase;
    }
    .craft-stack-demo {
      position: relative;
      height: 118px;
    }
    .craft-stack-demo .stack-s {
      position: absolute;
      left: 18px;
      top: 0;
      width: 95px;
      height: 86px;
      background:
        linear-gradient(145deg, rgba(255,255,255,0.96), #c9cce0 36%, #ffffff 62%, #8f93a8);
      -webkit-mask: url("/assets/company-logo.svg") center / contain no-repeat;
      mask: url("/assets/company-logo.svg") center / contain no-repeat;
      filter: drop-shadow(0 0 5px color-mix(in srgb, var(--glow) 14%, transparent)) drop-shadow(7px 7px 0 color-mix(in srgb, var(--side) 88%, #4e5660));
    }
    .craft-stack-demo .stack-s::before {
      content: none;
    }
    .logo-lab-panel {
      display: grid;
      align-content: start;
      gap: 18px;
      padding: 18px;
      background: #f8f8fb;
      color: #26232d;
      box-shadow: 16px 0 34px rgba(0, 0, 0, 0.22);
      z-index: 3;
    }
    .logo-lab-tabs {
      display: grid;
      grid-template-columns: 1fr 1fr;
      margin: -18px -18px 8px;
      border-bottom: 1px solid #dedce5;
      overflow: hidden;
      border-radius: 12px 0 0 0;
    }
    .logo-lab-tabs span {
      padding: 15px 10px;
      color: #8a8494;
      background: #f0eff4;
      font-size: 13px;
      font-weight: 800;
      text-align: center;
    }
    .logo-lab-tabs span:first-child {
      color: #1f1a28;
      background: #fff;
    }
    .logo-lab-drop {
      min-height: 170px;
      border: 1px dashed #bbb8c4;
      border-radius: 16px;
      display: grid;
      place-items: center;
      gap: 10px;
      padding: 18px;
      color: #9a96a3;
      background: #fff;
      text-align: center;
      font-size: 13px;
      font-weight: 700;
    }
    .logo-lab-upload {
      width: 100%;
      border: 0;
      border-radius: 999px;
      padding: 13px 18px;
      background: #3d3447;
      color: #fff;
      font-weight: 900;
      box-shadow: none;
    }
    .logo-lab-control {
      display: grid;
      gap: 10px;
      color: #2c2933;
      font-size: 13px;
      font-weight: 800;
    }
    .logo-lab-slider {
      height: 24px;
      border-radius: 999px;
      background:
        linear-gradient(90deg, #9a91a5 0 34%, #dedde2 34% 100%);
      position: relative;
    }
    .logo-lab-slider::after {
      content: "";
      position: absolute;
      left: 30%;
      top: 50%;
      width: 24px;
      height: 24px;
      border-radius: 50%;
      transform: translateY(-50%);
      background: #463b50;
      box-shadow: 0 4px 12px rgba(0,0,0,0.18);
    }
    .logo-lab-color {
      display: flex;
      align-items: center;
      gap: 12px;
      color: #a5a1ad;
      font-size: 13px;
      font-weight: 800;
    }
    .logo-lab-swatch {
      width: 48px;
      height: 48px;
      border-radius: 50%;
      background: #4a7bd4;
      box-shadow: 0 7px 18px rgba(74, 123, 212, 0.35);
    }
    .logo-lab-button {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      border-radius: 999px;
      padding: 13px 16px;
      background: #aaa;
      color: #fff;
      font-size: 13px;
      font-weight: 900;
    }
    .logo-lab-button.dark { background: #3d3447; }
    .logo-lab-pro {
      padding: 4px 10px;
      border-radius: 999px;
      background: #7c3cff;
      color: #fff;
      font-size: 11px;
    }
    .logo-lab-actions {
      position: absolute;
      right: 20px;
      bottom: 22px;
      display: grid;
      gap: 10px;
      z-index: 5;
    }
    .logo-lab-pill {
      min-width: 150px;
      padding: 14px 18px;
      border-radius: 18px;
      background: #fff;
      color: #2c2933;
      font-size: 14px;
      font-weight: 800;
      box-shadow: 0 12px 28px rgba(0,0,0,0.22);
    }
    .craft-stack-demo .stack-layer {
      display: none;
    }
    .craft-stack-demo .stack-layer:nth-child(2) { top: 62px; }
    .craft-stack-demo .stack-layer:nth-child(3) { top: 82px; background: rgba(255, 220, 90, 0.16); }
    .craft-stack-demo .stack-layer:nth-child(4) { top: 102px; background: rgba(255, 255, 255, 0.06); }
    .craft-material-lines {
      display: grid;
      gap: 6px;
      min-width: 0;
    }
    .craft-material-lines div {
      position: relative;
      padding-left: 20px;
      color: #dce8fb;
      font-size: 11px;
    }
    .craft-material-lines div::before {
      content: "";
      position: absolute;
      left: 0;
      top: 7px;
      width: 14px;
      height: 1px;
      background: #c9e56b;
    }
    .craft-material-lines strong,
    .craft-feature strong {
      display: block;
      color: #fff;
      font-size: 12px;
    }
    .craft-feature-grid {
      display: grid;
      grid-template-columns: repeat(5, minmax(0, 1fr));
      gap: 10px;
      align-items: stretch;
    }
    .craft-feature {
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 9px;
      padding: 10px 8px;
      background: rgba(13, 18, 27, 0.75);
      text-align: center;
      color: #aeb9c8;
      font-size: 10px;
    }
    .craft-feature i {
      display: grid;
      place-items: center;
      width: 34px;
      height: 34px;
      margin: 0 auto 8px;
      border: 1px solid rgba(255, 255, 255, 0.18);
      border-radius: 9px;
      color: #eaf2ff;
      font-style: normal;
      font-size: 18px;
    }
    .filament-estimate {
      grid-column: 1 / -1;
      width: 100%;
      margin: 4px 0 0;
      border: 1px solid rgba(63, 176, 255, 0.5);
      border-radius: 9px;
      background: rgba(3, 15, 31, 0.92);
      box-shadow: inset 0 0 18px rgba(53, 216, 255, 0.08);
      overflow: hidden;
    }
    .filament-title {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 6px;
      padding: 8px 11px;
      color: #6eb6ff;
      font-size: 11px;
      font-weight: 900;
      letter-spacing: 0.7px;
      text-transform: uppercase;
      border-bottom: 1px solid rgba(63, 176, 255, 0.32);
    }
    .filament-title .filament-sub {
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.3px;
      text-transform: none;
      color: #8fb4dd;
    }
    .filament-head,
    .filament-row {
      display: grid;
      grid-template-columns: minmax(0, 1.4fr) repeat(3, minmax(52px, 1fr));
      gap: 6px;
      align-items: center;
      padding: 5px 11px;
      font-size: 12px;
    }
    .filament-head {
      color: #8fb4dd;
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 0.4px;
      text-transform: uppercase;
      border-bottom: 1px solid rgba(63, 176, 255, 0.2);
    }
    .filament-head span:not(:first-child),
    .filament-row .filament-cell:not(.filament-name) {
      text-align: right;
      font-variant-numeric: tabular-nums;
    }
    .filament-list {
      max-height: 168px;
      overflow-y: auto;
    }
    .filament-row {
      color: #d6e6fb;
      border-top: 1px solid rgba(63, 176, 255, 0.09);
    }
    .filament-name {
      color: #a9c6e8;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .filament-total {
      border-top: 1px solid rgba(63, 176, 255, 0.36);
      background: rgba(53, 216, 255, 0.06);
      color: #eaf3ff;
      font-weight: 700;
    }
    .filament-total strong { color: #7fe9c0; }
    .letter-dimensions {
      grid-column: 3;
      grid-row: 1;
      min-width: 0;
      width: 100%;
      height: 389px;
      margin: 0 0 -10px 0;
      border: 1px solid rgba(63, 176, 255, 0.58);
      border-radius: 9px;
      padding: 0 1px 0 12px;
      background: rgba(3, 15, 31, 0.92);
      overflow: hidden;
      box-shadow: inset 0 0 18px rgba(53, 216, 255, 0.08);
    }
    .letter-dimensions-title {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 8px;
      padding: 7px 9px;
      color: #6eb6ff;
      font-size: 11px;
      font-weight: 900;
      letter-spacing: 0.7px;
      text-transform: uppercase;
      border-bottom: 1px solid rgba(63, 176, 255, 0.36);
    }
    .record-action-buttons {
      display: grid;
      grid-template-columns: minmax(78px, 1.35fr) minmax(88px, 1.45fr) minmax(48px, 0.78fr) minmax(58px, 0.9fr);
      align-items: center;
      gap: 6px;
      flex: 1 1 auto;
      min-width: 0;
    }
    .group-selected-button,
    .special-finishing-button,
    .delete-selected-button,
    .undo-button {
      width: 100%;
      min-width: 0;
      flex: 1 1 auto;
      white-space: nowrap;
      border-radius: 7px;
      padding: 5px 7px;
      border: 1px solid rgba(53, 216, 255, 0.58);
      background: linear-gradient(100deg, rgba(36, 75, 255, 0.95), rgba(8, 211, 231, 0.92));
      color: #eaf8ff;
      font-size: 9px;
      line-height: 1;
      font-weight: 900;
      box-shadow: none;
    }
    .delete-selected-button {
      border-color: rgba(255, 78, 92, 0.8);
      background: linear-gradient(100deg, rgba(180, 20, 45, 0.96), rgba(255, 72, 84, 0.92));
    }
    .undo-button {
      border-color: rgba(255, 211, 85, 0.78);
      background: linear-gradient(100deg, rgba(180, 120, 16, 0.96), rgba(255, 190, 54, 0.92));
      color: #fff9df;
    }
    .special-finishing-button {
      border-color: rgba(53, 216, 255, 0.78);
      background: linear-gradient(100deg, rgba(12, 62, 110, 0.96), rgba(33, 182, 218, 0.9));
      color: #ecfbff;
    }
    .group-selected-button:disabled,
    .special-finishing-button:disabled,
    .delete-selected-button:disabled,
    .undo-button:disabled {
      opacity: 0.42;
      cursor: not-allowed;
    }
    .letter-dimensions.is-group-mode .group-selected-button {
      border-color: rgba(45, 243, 255, 0.9);
      box-shadow: 0 0 12px rgba(45, 243, 255, 0.34);
    }
    .letter-dimensions.is-special-mode .special-finishing-button {
      border-color: rgba(45, 243, 255, 0.95);
      box-shadow: 0 0 14px rgba(45, 243, 255, 0.38);
    }
    .letter-dimension-head {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      padding: 6px 9px;
      color: #6eb6ff;
      font-size: 10px;
      font-weight: 900;
      letter-spacing: 0.6px;
      text-transform: uppercase;
      border-bottom: 1px solid rgba(63, 176, 255, 0.22);
    }
    .letter-dimension-list {
      display: grid;
      grid-template-columns: 1fr;
      max-height: 314px;
      overflow: auto;
    }
    .letter-dimension-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
      padding: 8px 9px;
      color: #dbe8ff;
      font-size: 12px;
      border-top: 1px solid rgba(63, 176, 255, 0.16);
    }
    .letter-dimension-item:hover {
      background: rgba(255, 35, 35, 0.12);
      box-shadow: inset 0 0 0 1px rgba(255, 55, 55, 0.86), 0 0 12px rgba(255, 35, 35, 0.24);
    }
    .letter-dimension-item.is-selected {
      background: rgba(17, 111, 255, 0.3);
      box-shadow: inset 0 0 0 1px rgba(53, 216, 255, 0.95), 0 0 13px rgba(53, 216, 255, 0.28);
    }
    /* In Special Finishing mode the selected record turns amber (matches the panel) */
    .letter-dimensions.is-special-mode .letter-dimension-item.is-selected {
      background: rgba(255, 170, 60, 0.22);
      box-shadow: inset 0 0 0 1px rgba(255, 178, 71, 0.95), 0 0 13px rgba(255, 170, 60, 0.3);
    }
    .letter-dimension-item[data-group-children] {
      border-left: 3px solid rgba(45, 243, 255, 0.95);
    }
    .letter-dimension-item.is-led-warning {
      background: rgba(88, 8, 18, 0.74);
      box-shadow: inset 0 0 0 1px rgba(255, 54, 54, 0.95), 0 0 16px rgba(255, 30, 30, 0.28);
    }
    .letter-item-preview {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      min-width: 0;
      color: #f7fbff;
      font-weight: 800;
    }
    .letter-item-preview img {
      width: 62px;
      height: 62px;
      object-fit: contain;
      border: 1px solid rgba(63, 176, 255, 0.42);
      border-radius: 6px;
      background: #fff;
    }
    .group-preview-stack {
      width: 62px;
      height: 62px;
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 2px;
      padding: 2px;
      border: 1px solid rgba(63, 176, 255, 0.42);
      border-radius: 6px;
      background: #fff;
    }
    .group-preview-stack img {
      width: 100%;
      height: 100%;
      border: 0;
      border-radius: 3px;
      object-fit: contain;
    }
    .letter-dimension-item span:first-child { color: #f7fbff; font-weight: 800; }
    .letter-dimension-size {
      display: inline-flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 4px;
      color: #9fc8f4;
      white-space: nowrap;
      text-align: right;
    }
    .letter-item-price {
      color: #5dffb0;
      font-size: 12px;
      font-weight: 950;
      text-shadow: 0 0 10px rgba(68, 255, 169, 0.32);
    }
    .led-warning-note {
      display: block;
      margin-top: 3px;
      color: #ff5f5f;
      font-size: 10px;
      font-weight: 900;
      white-space: nowrap;
      text-shadow: 0 0 8px rgba(255, 20, 20, 0.58);
    }
    .image-modal {
      position: fixed;
      inset: 0;
      display: none;
      align-items: center;
      justify-content: center;
      padding: 28px;
      background: rgba(1, 6, 15, 0.72);
      backdrop-filter: blur(6px);
      z-index: 1000;
    }
    .image-modal.is-open { display: flex; }
    .modal-panel {
      position: relative;
      width: min(760px, 82vw);
      height: min(620px, 78vh);
      border: 1px solid rgba(63, 176, 255, 0.72);
      border-radius: 14px;
      background: rgba(6, 18, 36, 0.94);
      box-shadow: 0 0 36px rgba(53, 216, 255, 0.34), inset 0 0 28px rgba(53, 216, 255, 0.08);
      padding: 18px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .modal-workspace {
      position: relative;
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      user-select: none;
    }
    .modal-panel img {
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
      border-radius: 8px;
      background: #fff;
    }
    .modal-record-hitbox,
    .modal-selection-box,
    .modal-group-highlight,
    .modal-marquee {
      position: absolute;
      z-index: 3;
      pointer-events: auto;
      border-radius: 3px;
    }
    .modal-record-hitbox {
      cursor: pointer;
      border: 1px dashed rgba(31, 140, 255, 0.74);
      background: rgba(31, 140, 255, 0.08);
    }
    .modal-record-hitbox.is-selected {
      border: 2px solid #1f8cff;
      background: rgba(31, 140, 255, 0.2);
      box-shadow: 0 0 12px rgba(31, 140, 255, 0.74);
    }
    .modal-deleted-marker {
      position: absolute;
      z-index: 5;
      pointer-events: none;
      border: 2px solid rgba(255, 46, 62, 0.96);
      background: rgba(255, 31, 45, 0.12);
      box-shadow: 0 0 14px rgba(255, 31, 45, 0.72), inset 0 0 12px rgba(255, 31, 45, 0.18);
    }
    .modal-deleted-marker::before,
    .modal-deleted-marker::after {
      content: "";
      position: absolute;
      left: 50%;
      top: 50%;
      width: 128%;
      height: 3px;
      background: #ff233d;
      border-radius: 999px;
      box-shadow: 0 0 9px rgba(255, 35, 61, 0.9);
      transform-origin: center;
    }
    .modal-deleted-marker::before { transform: translate(-50%, -50%) rotate(45deg); }
    .modal-deleted-marker::after { transform: translate(-50%, -50%) rotate(-45deg); }
    .modal-selection-box {
      pointer-events: none;
      border: 2px solid #1f8cff;
      background: rgba(31, 140, 255, 0.18);
    }
    .modal-group-highlight {
      pointer-events: none;
      z-index: 4;
      border: 3px solid #2df3ff;
      background: rgba(45, 243, 255, 0.12);
      box-shadow: 0 0 16px rgba(45, 243, 255, 0.82);
    }
    .modal-marquee {
      z-index: 6;
      pointer-events: none;
      border: 1px solid #2df3ff;
      background: rgba(45, 243, 255, 0.14);
      box-shadow: 0 0 12px rgba(45, 243, 255, 0.58);
      display: none;
    }
    .modal-action-bar {
      position: absolute;
      top: -13px;
      right: 28px;
      z-index: 8;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .modal-action-bar[hidden],
    .image-modal.is-simple .modal-action-bar {
      display: none !important;
    }
    .modal-group-button,
    .modal-delete-button,
    .modal-undo-button {
      border-radius: 8px;
      padding: 7px 11px;
      font-size: 11px;
      line-height: 1;
      box-shadow: 0 0 14px rgba(53, 216, 255, 0.45);
    }
    .modal-delete-button {
      border-color: rgba(255, 78, 92, 0.8);
      background: linear-gradient(100deg, rgba(180, 20, 45, 0.96), rgba(255, 72, 84, 0.92));
    }
    .modal-undo-button {
      border-color: rgba(255, 211, 85, 0.78);
      background: linear-gradient(100deg, rgba(180, 120, 16, 0.96), rgba(255, 190, 54, 0.92));
      color: #fff9df;
    }
    .modal-close {
      position: absolute;
      top: -13px;
      right: -13px;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      padding: 0;
      display: grid;
      place-items: center;
      border: 1px solid rgba(53, 216, 255, 0.8);
      background: rgba(4, 14, 30, 0.96);
      color: #dff7ff;
      font-size: 22px;
      line-height: 1;
      box-shadow: 0 0 16px rgba(53, 216, 255, 0.5);
    }
    .status-strip {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 1px;
      margin-top: 22px;
      border: 1px solid rgba(75, 146, 255, 0.48);
      border-radius: 10px;
      background: rgba(75, 146, 255, 0.28);
      overflow: hidden;
      box-shadow: 0 0 22px rgba(30, 132, 255, 0.18);
    }
    .status-strip div { padding: 16px 18px; background: rgba(6, 20, 40, 0.9); color: #74b8ff; font-weight: 800; text-align: center; }
    .error { background: rgba(80, 13, 26, 0.9); border: 1px solid rgba(255, 88, 120, 0.65); padding: 16px; border-radius: 12px; box-shadow: 0 0 22px rgba(255, 88, 120, 0.18); }

    /* Calm result workspace refresh */
    body {
      font-family: Inter, "Segoe UI", Arial, sans-serif;
      background:
        linear-gradient(180deg, #07152a 0%, #061224 48%, #040d1b 100%);
      background-size: auto;
      letter-spacing: 0;
    }
    body::before { display: none; }
    main { max-width: 1760px; padding: 18px 28px 28px; }
    .hero {
      border-color: rgba(78, 133, 196, 0.3);
      border-radius: 16px;
      background: rgba(5, 16, 32, 0.74);
      box-shadow: none;
    }
    .hero::before,
    .multi-result::before { display: none; }
    h1 {
      font-size: clamp(30px, 3vw, 40px);
      letter-spacing: 0.5px;
      text-shadow: none;
      text-transform: none;
    }
    .subtitle { color: #aebed3; font-size: 16px; }
    form {
      border-color: rgba(106, 147, 200, 0.24);
      border-radius: 12px;
      background: rgba(13, 29, 54, 0.66);
      box-shadow: none;
    }
    button,
    .clear-button {
      border-radius: 8px;
      font-size: 15px;
      letter-spacing: 0;
      box-shadow: none;
    }
    button { background: linear-gradient(100deg, #3377ff, #17c9ee); }
    .clear-button { background: rgba(16, 31, 55, 0.9); }
    select,
    .mounting-select,
    .remark-field {
      border-color: rgba(103, 143, 198, 0.36);
      border-radius: 8px;
      background: rgba(6, 16, 31, 0.94);
      box-shadow: none;
    }
    .multi-result {
      border-color: rgba(75, 124, 183, 0.36);
      border-radius: 18px;
      padding: 34px 34px 36px;
      background: linear-gradient(180deg, rgba(6, 18, 36, 0.94), rgba(5, 14, 28, 0.94));
      box-shadow: 0 18px 50px rgba(0, 0, 0, 0.26);
    }
    .multi-result h2 {
      margin: 0 0 24px;
      padding-left: 0;
      min-height: 54px;
      font-size: 30px;
      letter-spacing: 0;
      text-transform: none;
      text-shadow: none;
    }
    .multi-result h2::before {
      content: "RESULTS";
      position: static;
      display: block;
      margin: 0 0 6px;
      color: #35d8ff;
      font-size: 14px;
      letter-spacing: 1.2px;
      text-shadow: none;
    }
    .multi-result h2::after {
      content: "Preview, customize, and download your 3D signage design.";
      display: block;
      margin-top: 8px;
      color: #aebed3;
      font-size: 16px;
      font-weight: 500;
      line-height: 1.35;
    }
    .multi-result::after {
      content: none;
    }
    .result,
    .design-card {
      border: 0;
      border-radius: 0;
      padding: 0;
      background: transparent;
      box-shadow: none;
    }
    .result,
    .design-body {
      grid-template-columns: 1.12fr 0.98fr 1.18fr;
      grid-template-rows: 475px auto;
      column-gap: 16px;
      row-gap: 6px;
      justify-content: stretch;
      align-items: start;
    }
    .preview-grid,
    .letter-dimensions,
    .result-info {
      width: auto;
      max-width: none;
    }
    .preview-panel,
    .letter-dimensions,
    .metrics > div,
    .collect-date-panel {
      border: 1px solid rgba(105, 143, 193, 0.28);
      border-radius: 12px;
      background: linear-gradient(180deg, rgba(15, 33, 58, 0.92), rgba(8, 22, 42, 0.94));
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.035);
    }
    .preview-panel {
      height: 475px;
      padding: 22px;
    }
    .panel-label,
    .letter-dimensions-title,
    .metrics span {
      color: #c9d8eb;
      font-size: 14px;
      font-weight: 850;
      letter-spacing: 0.2px;
      text-transform: uppercase;
    }
    .panel-label { margin-bottom: 22px; }
    .preview {
      border: 0;
      border-radius: 10px;
      background: #eaf3ff;
      box-shadow: none;
      padding: 8px;
    }
    .preview-total,
    .line-total {
      margin-top: 12px;
      padding: 14px 16px;
      border-color: rgba(105, 143, 193, 0.32);
      border-radius: 10px;
      background: rgba(6, 18, 34, 0.82);
      color: #b7c6dc;
      box-shadow: none;
      font-size: 14px;
    }
    .preview-total strong,
    .line-total strong {
      color: #f5f8ff;
      font-size: 15px;
      text-shadow: none;
    }
    .letter-dimensions {
      height: 475px;
      padding: 0 12px 12px;
      margin: 0;
      display: flex;
      flex-direction: column;
    }
    .letter-dimensions-title {
      padding: 14px 4px 10px;
      border-bottom: 0;
      flex-direction: column;
      align-items: flex-start;
      gap: 8px;
    }
    .record-action-buttons {
      display: grid;
      grid-template-columns: minmax(82px, 1.35fr) minmax(92px, 1.45fr) minmax(50px, 0.78fr) minmax(60px, 0.9fr);
      gap: 6px;
      width: 100%;
      justify-content: flex-start;
    }
    .group-selected-button,
    .special-finishing-button,
    .delete-selected-button,
    .undo-button,
    .modal-group-button,
    .modal-delete-button,
    .modal-undo-button {
      border-radius: 8px;
      padding: 9px 6px;
      font-size: 10px;
      letter-spacing: 0;
      box-shadow: none;
    }
    .letter-dimension-head {
      padding: 12px 22px;
      border: 1px solid rgba(105, 143, 193, 0.2);
      border-bottom: 0;
      border-radius: 10px 10px 0 0;
      color: #b8c9df;
      background: rgba(5, 15, 29, 0.55);
      font-size: 12px;
      letter-spacing: 0.3px;
    }
    .letter-dimension-list {
      flex: 1;
      min-height: 0;
      max-height: none;
      border: 1px solid rgba(105, 143, 193, 0.2);
      border-radius: 0 0 10px 10px;
      background: rgba(5, 15, 29, 0.45);
    }
    .letter-dimension-item {
      min-height: 80px;
      padding: 12px 22px;
      border-top-color: rgba(105, 143, 193, 0.16);
      font-size: 14px;
    }
    .letter-dimension-item:hover {
      background: rgba(55, 119, 255, 0.12);
      box-shadow: inset 0 0 0 1px rgba(97, 149, 230, 0.45);
    }
    .letter-dimension-item.is-selected {
      background: rgba(37, 111, 255, 0.2);
      box-shadow: inset 0 0 0 1px rgba(75, 163, 255, 0.78);
    }
    .letter-item-preview img,
    .group-preview-stack {
      width: 62px;
      height: 62px;
      border: 0;
      border-radius: 8px;
    }
    .letter-dimension-size { color: #bdd0e8; font-size: 14px; }
    .result-info {
      width: auto;
      justify-self: stretch;
      border: 1px solid rgba(105, 143, 193, 0.28);
      border-radius: 12px;
      padding: 20px 16px 16px;
      background: linear-gradient(180deg, rgba(15, 33, 58, 0.92), rgba(8, 22, 42, 0.94));
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.035);
    }
    /* Special Finishing mode — clearly different (amber) from the normal blue panel */
    [data-special-finishing-mode="1"] .result-info {
      border-color: rgba(255, 178, 71, 0.72);
      background: linear-gradient(180deg, rgba(58, 40, 12, 0.92), rgba(40, 27, 8, 0.94));
      box-shadow: 0 0 24px rgba(255, 170, 60, 0.26), inset 0 1px 0 rgba(255, 255, 255, 0.05);
    }
    [data-special-finishing-mode="1"] .result-info > h3,
    .design-card[data-special-finishing-mode="1"] > h4 {
      color: #ffb347;
      text-shadow: 0 0 12px rgba(255, 170, 60, 0.5);
    }
    .result-info h3 {
      margin: 0 0 18px;
      font-size: 22px;
      letter-spacing: 0;
      text-shadow: none;
    }
    .metrics { gap: 14px; }
    .metrics div {
      background: linear-gradient(180deg, rgba(14, 31, 55, 0.86), rgba(7, 19, 37, 0.92));
      background-size: auto;
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.035);
    }
    .base-options {
      gap: 14px;
      grid-template-columns: 1fr;
    }
    .base-options > div:first-child,
    .base-options > div:last-child {
      border-radius: 10px;
      border-left: 1px solid rgba(105, 143, 193, 0.28);
    }
    .mounting-select {
      min-height: 44px;
      font-size: 14px;
    }
    .color-picker { padding: 16px; }
    .color-map {
      border-color: rgba(105, 143, 193, 0.28);
      border-radius: 10px;
      background: rgba(4, 12, 25, 0.96);
      box-shadow: none;
    }
    .color-option { border-radius: 8px; }
    .selected-color {
      margin-top: 12px;
      padding: 13px 14px;
      border: 1px solid rgba(105, 143, 193, 0.25);
      border-radius: 10px;
      background: rgba(5, 15, 29, 0.5);
      color: #bdd0e8;
      font-size: 14px;
    }
    .side-finishing-panel .side-finishing-config.is-active {
      padding: 0;
      border: 0;
      border-radius: 0;
      background: transparent;
      box-shadow: none;
    }
    .side-finishing-panel .side-finishing-config.is-active div,
    .side-finishing-panel .side-segment-head,
    .side-finishing-panel .side-filament-map {
      border: 0;
      background: transparent;
      box-shadow: none;
    }
    .side-finishing-panel .side-segment-card {
      padding: 8px;
      border: 1px solid rgba(63, 176, 255, 0.58);
      border-radius: 10px;
      background: rgba(2, 7, 18, 0.48);
      box-shadow: none;
    }
    .side-finishing-panel .side-segment-card:last-child {
      padding-bottom: 8px;
    }
    .remark-field {
      height: 86px;
      margin: 8px 0 0;
      font-size: 14px;
      padding: 14px;
    }
    .close-result {
      top: 18px;
      right: 18px;
      width: 42px;
      height: 42px;
      border-radius: 9px;
      border-color: rgba(122, 158, 211, 0.35);
      background: rgba(13, 27, 49, 0.85);
      box-shadow: none;
      font-size: 24px;
    }
    .multi-result > .close-results {
      top: 24px;
      right: 24px;
    }
    .modal-panel {
      border-color: rgba(105, 143, 193, 0.34);
      border-radius: 14px;
      background: rgba(7, 19, 38, 0.96);
      box-shadow: 0 24px 70px rgba(0, 0, 0, 0.42);
    }
    .modal-close {
      border-radius: 10px;
      background: rgba(13, 27, 49, 0.95);
      box-shadow: none;
    }
    @media (max-width: 1120px) {
      form { grid-template-columns: 1fr 1fr; }
      .result { grid-template-columns: 1fr; }
      .design-body { grid-template-columns: 1fr; }
      .result, .design-body { grid-template-rows: auto; }
      .original-preview-panel, .preview-grid, .letter-dimensions, .craft-3d-preview, .result-info, .design-body > .metrics { grid-column: auto; grid-row: auto; }
      .result-info { width: 100%; justify-self: stretch; margin-left: 0; }
      .letter-dimensions { width: 100%; margin: 0; padding-left: 0; padding-right: 0; }
      .letter-dimension-list { max-height: 260px; }
      .collect-date-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .preview-panel, .letter-dimensions { height: auto; }
      .craft-3d-preview { min-height: 590px; margin-top: 18px; }
      .craft-workspace { min-height: 460px; grid-template-columns: 1fr; }
      .craft-3d-stage { height: 460px; }
      .craft-3d-model { width: 330px; height: 330px; }
      .craft-3d-solid::before,
      .craft-3d-solid::after { font-size: 305px; }
      .craft-3d-model::before,
      .craft-3d-face::before { font-size: 300px; }
      .craft-view-strip { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .craft-3d-spec { grid-template-columns: 1fr; }
      .craft-feature-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .preview { height: 180px; min-height: 180px; flex: none; }
    }
    @media (max-width: 760px) {
      main { padding: 18px 14px 32px; }
      .hero, .multi-result { padding: 18px; }
      .topbar { align-items: flex-start; flex-direction: column; }
      form { grid-template-columns: 1fr; }
      select { min-width: 0; width: 100%; }
      label.scale-control { align-items: flex-start; flex-direction: column; }
      .preview-grid, .status-strip, .letter-dimension-list { grid-template-columns: 1fr; }
      .preview { height: 220px; min-height: 220px; }
      .craft-3d-preview { min-height: 470px; margin-top: 14px; }
      .craft-workspace { min-height: 350px; }
      .craft-3d-stage { height: 350px; }
      .craft-3d-model { width: 250px; height: 250px; }
      .craft-3d-solid::before,
      .craft-3d-solid::after { font-size: 232px; }
      .craft-3d-model::before,
      .craft-3d-face::before { font-size: 215px; }
      .craft-view-strip { grid-template-columns: 1fr; }
      .craft-material { grid-template-columns: 1fr; }
      .craft-feature-grid { grid-template-columns: 1fr; }
      button, .clear-button { width: 100%; }
    }
  </style>
  <script>
    (() => {
      const nav = performance.getEntriesByType("navigation")[0];
      if (nav && nav.type === "reload") {
        const url = new URL("/", location.origin);
        url.searchParams.set("_reload", Date.now().toString());
        location.replace(url);
      }
      window.addEventListener("pageshow", (event) => {
        if (event.persisted) location.reload();
      });
      const syncBaseFinishing = () => {
        document.querySelectorAll(".mounting-base-select").forEach((select) => {
          const metrics = select.closest(".metrics");
          const finishing = metrics && metrics.querySelector(".base-finishing");
          if (!finishing) return;
          const showFinishing =
            document.body.dataset.litMode === "back" || select.value === "3mm White Acrylic";
          finishing.classList.toggle("is-hidden", !showFinishing);
          if (!showFinishing) {
            const finishingSelect = finishing.querySelector(".finishing-select");
            if (finishingSelect) finishingSelect.value = "None";
          }
        });
      };
      const craftColorMap = {
        "White": "#b8b2a8",
        "Translucent White": "#cfd6c8",
        "Translucent Red": "#c94b52",
        "Translucent Yellow": "#d4b93a",
        "Translucent Green": "#46b876",
        "Translucent Blue": "#4e6fc8",
        "Translucent Orange": "#d17832",
        "Translucent Cyclamen": "#8b55b6",
        "3K Warm": "#ffa626",
        "4.5K Warm": "#fff0a5",
        "Red": "#ff1f2d",
        "Lemon Yellow": "#e8ff00",
        "Yellow": "#ffdf00",
        "Orange": "#ff8500",
        "Ice Blue": "#4dd9ff",
        "Blue": "#3657ff",
        "Green": "#20ef75",
        "Pink": "#ff3cac",
        "Purple": "#9b3cff",
        "RGB": "#35ffd4",
      };
      const ledGlowMap = {
        "None": "#f8fbff",
        "3000K": "#ffb35c",
        "4000K": "#fff1c8",
        "10000K": "#9fdcff",
      };
      const getSelectedSideFinishing = (scope) => scope?.querySelector(".selected-side-finishing strong")?.textContent?.trim() || "Option 1";
      const getSideTotalMm = (scope) => (scope?.querySelector(".box-up-size-select")?.value || "5cm") === "3cm" ? 30 : 50;
      const clampSideMm = (value, totalMm) => Math.max(0, Math.min(totalMm, Math.round(Number(value) || 0)));
      const getSideRowColor = (row, fallback) => row?.querySelector(".side-filament-option.is-selected")?.dataset.sideColor || row?.querySelector(".side-filament-select")?.value || fallback;
      const syncMirroredSideColor = (scope) => {
        const rows = Array.from(scope?.querySelectorAll('.side-finishing-config[data-config-for="Option 3"] .side-segment-card') || []);
        if (rows.length < 3) return;
        const firstColor = getSideRowColor(rows[0], "White");
        rows[2].querySelectorAll(".side-filament-option").forEach((button) => {
          button.classList.toggle("is-selected", button.dataset.sideColor === firstColor);
        });
        const thirdSelect = rows[2].querySelector(".side-filament-select");
        if (thirdSelect) thirdSelect.value = firstColor;
      };
      const syncSideMmInputs = (scope) => {
        if (!scope) return;
        const selected = getSelectedSideFinishing(scope);
        const totalMm = getSideTotalMm(scope);
        if (selected === "Option 2") {
          const inputs = Array.from(scope.querySelectorAll('.side-finishing-config[data-config-for="Option 2"] .side-mm-input'));
          if (inputs.length < 2) return;
          inputs.forEach((input) => input.max = totalMm.toString());
          const first = clampSideMm(inputs[0].value, totalMm);
          inputs[0].value = first;
          inputs[1].value = totalMm - first;
        } else if (selected === "Option 3") {
          const inputs = Array.from(scope.querySelectorAll('.side-finishing-config[data-config-for="Option 3"] .side-mm-input'));
          if (inputs.length < 3) return;
          const maxEdge = Math.floor(totalMm / 2);
          inputs.forEach((input) => input.max = maxEdge.toString());
          const edge = Math.min(maxEdge, clampSideMm(inputs[0].value, maxEdge));
          inputs[0].value = edge;
          inputs[2].value = edge;
          inputs[1].value = Math.max(0, totalMm - edge * 2);
          const selects = Array.from(scope.querySelectorAll('.side-finishing-config[data-config-for="Option 3"] .side-segment-card .side-filament-select'));
          if (selects.length >= 3) selects[2].value = selects[0].value;
          syncMirroredSideColor(scope);
        }
      };
      const resetSideMmForBoxSize = (scope) => {
        if (!scope) return;
        const totalMm = getSideTotalMm(scope);
        const option2Inputs = Array.from(scope.querySelectorAll('.side-finishing-config[data-config-for="Option 2"] .side-mm-input'));
        if (option2Inputs.length >= 2) option2Inputs[0].value = Math.round(totalMm / 2);
        const option3Inputs = Array.from(scope.querySelectorAll('.side-finishing-config[data-config-for="Option 3"] .side-mm-input'));
        if (option3Inputs.length >= 3) option3Inputs[0].value = Math.floor(totalMm / 3);
        syncSideMmInputs(scope);
      };
      const getSideSegments = (scope) => {
        syncSideMmInputs(scope);
        const selected = getSelectedSideFinishing(scope);
        const mainColor = scope?.querySelector(".selected-color strong")?.textContent?.split(",")[0]?.trim() || "White";
        if (selected === "Option 2") {
          const rows = Array.from(scope.querySelectorAll('.side-finishing-config[data-config-for="Option 2"] .side-segment-card'));
          return rows.map((row) => ({
            mm: Math.max(0, Number(row.querySelector(".side-mm-input")?.value) || 0),
            color: getSideRowColor(row, mainColor),
          }));
        }
        if (selected === "Option 3") {
          const mmRows = Array.from(scope.querySelectorAll('.side-finishing-config[data-config-for="Option 3"] .side-segment-card'));
          const colors = mmRows.map((row) => getSideRowColor(row, mainColor));
          return mmRows.map((row, index) => ({
            mm: Math.max(0, Number(row.querySelector(".side-mm-input")?.value) || 0),
            color: colors[index % Math.max(1, colors.length)] || mainColor,
          }));
        }
        return [{ mm: 0, color: mainColor }];
      };
      const syncSideFinishingControls = (scope) => {
        if (!scope) return;
        const isSpray = (scope.querySelector(".box-up-color-select")?.value || "").includes("2K Spray");
        scope.querySelectorAll(".side-finishing-panel").forEach((panel) => {
          panel.classList.toggle("is-hidden", isSpray);
        });
        const selected = getSelectedSideFinishing(scope);
        scope.querySelectorAll(".side-finishing-config").forEach((config) => {
          config.classList.toggle("is-active", config.dataset.configFor === selected);
        });
        scope.querySelectorAll(".color-picker").forEach((picker) => {
          picker.classList.toggle("is-hidden", isSpray || selected !== "Option 1");
        });
        if (isSpray) return;
        syncSideMmInputs(scope);
      };
      const sideFinishingSummary = (scope) => {
        const selected = getSelectedSideFinishing(scope);
        if (selected === "Option 1") return "";
        const segments = getSideSegments(scope).filter((item) => item.mm > 0);
        if (!segments.length) return "";
        return " (" + segments.map((item) => item.mm + "mm " + item.color).join(" / ") + ")";
      };
      const selectedCollectDate = (scope) => scope?.querySelector(".collect-date-option.is-selected span")?.textContent?.trim() || "4 working days";
      // When embedded in a content-sized iframe, position: fixed spans the whole
      // tall iframe, so the modal lands far down the page. Place it over the
      // PARENT window's currently-visible viewport so it appears centred on screen.
      // Lock/unlock the PARENT window scroll so the modal fully blocks the rest of
      // the page (LED colour, etc.) until it is closed.
      const setParentScrollLock = (locked) => {
        try {
          if (window.parent && window.parent !== window) {
            window.parent.document.documentElement.style.overflow = locked ? "hidden" : "";
            window.parent.document.body.style.overflow = locked ? "hidden" : "";
          }
        } catch (error) {}
      };
      const placeModalInViewport = (modal) => {
        try {
          if (window.parent && window.parent !== window && window.frameElement) {
            const iframeTop = window.frameElement.getBoundingClientRect().top + window.parent.scrollY;
            const visTop = window.parent.scrollY - iframeTop;
            modal.style.inset = "auto";
            modal.style.position = "absolute";
            modal.style.left = "0";
            modal.style.width = "100%";
            modal.style.top = Math.max(0, visTop) + "px";
            modal.style.height = window.parent.innerHeight + "px";
            setParentScrollLock(true);
            return;
          }
        } catch (error) {}
        // standalone — clear overrides, use the CSS fixed/inset:0
        modal.style.inset = "";
        modal.style.position = "";
        modal.style.left = "";
        modal.style.width = "";
        modal.style.top = "";
        modal.style.height = "";
        setParentScrollLock(true);
      };
      const openSimpleImageModal = (src, alt) => {
        const modal = document.querySelector(".image-modal");
        const image = modal?.querySelector(".modal-workspace img");
        if (!modal || !image || !src) return;
        modalContext = null;
        modal.querySelector(".modal-action-bar")?.setAttribute("hidden", "");
        image.src = src;
        image.alt = alt || "Preview";
        modal.classList.add("is-simple");
        placeModalInViewport(modal);
        modal.classList.add("is-open");
      };
      const syncCraft3D = (scope) => {
        if (!scope) return;
        const panel = scope.querySelector(".craft-3d-preview");
        const stage = panel && panel.querySelector(".craft-3d-stage");
        if (!panel || !stage) return;
        syncSideFinishingControls(scope);
        const surface = scope.querySelector(".mounting-base-select")?.value || "3mm White Acrylic";
        const boxSize = scope.querySelector(".box-up-size-select")?.value || "5cm";
        const boxColor = scope.querySelector(".box-up-color-select")?.value || "3D Outdoor Material";
        const finishing = scope.querySelector(".finishing-select")?.value || "None";
        const ledColor = scope.querySelector(".selected-led-color strong")?.textContent?.trim() || "None";
        const selected = scope.querySelector(".selected-color strong")?.textContent?.split(",")[0]?.trim() || "White";
        const sideSegments = getSideSegments(scope);
        const sideColors = sideSegments.map((item) => item.color).filter(Boolean);
        const sideCssColors = sideColors.map((color) => craftColorMap[color] || craftColorMap.White || "#f8fbff");
        const isBlack = surface === "3mm Black Acrylic";
        const isThick = boxSize === "5cm";
        const ledGlow = ledGlowMap[ledColor] || "#f8fbff";
        const glow = sideCssColors[0] || craftColorMap[selected] || "#f8fbff";
        const setCraftVar = (name, value) => {
          panel.style.setProperty(name, value);
          stage.style.setProperty(name, value);
        };
        setCraftVar("--face", isBlack ? "#06080d" : (ledColor === "3000K" ? "#fff1c2" : ledColor === "4000K" ? "#fff8ea" : ledColor === "10000K" ? "#e6f6ff" : "#fffdf5"));
        setCraftVar("--side", glow);
        setCraftVar("--side-2", sideCssColors[1] || glow);
        setCraftVar("--glow", glow);
        setCraftVar("--led-glow", ledGlow);
        setCraftVar("--depth-x", isThick ? "92px" : "58px");
        setCraftVar("--depth-y", isThick ? "22px" : "14px");
        setCraftVar("--depth-z", isThick ? "-86px" : "-56px");
        setCraftVar("--shell-opacity", "1");
        panel.querySelectorAll("[data-three-depth-label]").forEach((item) => item.textContent = boxSize + " thickness");
        panel.classList.toggle("is-black", isBlack);
        panel.classList.toggle("is-thick", isThick);
        panel.classList.toggle("is-standard", !isThick);
        panel.classList.toggle("is-spray", boxColor.includes("2K Spray"));
        panel.classList.toggle("has-led-color", ledColor !== "None");
        stage.classList.toggle("is-black", isBlack);
        stage.classList.toggle("is-thick", isThick);
        stage.classList.toggle("is-standard", !isThick);
        stage.classList.toggle("is-spray", boxColor.includes("2K Spray"));
        stage.classList.toggle("has-led-color", ledColor !== "None");
        const badge = panel.querySelector(".craft-3d-badge");
        if (badge) badge.textContent = boxSize;
        panel.querySelectorAll("[data-three-led-label]").forEach((item) => {
          item.textContent = ledColor === "3000K" ? "3000K Warm White" : ledColor === "4000K" ? "4000K Natural White" : ledColor === "10000K" ? "10000K Cool White" : "";
        });
        // The spec summary must mirror what the dropdowns show (their option
        // labels), not the raw option value the renderer / pricing keys off. For
        // relabelled products (EG / Stainless / backlit) the two differ, so the
        // value would leak internal names like "3mm Black Acrylic".
        const optionLabel = (selector, fallback) => {
          const sel = scope.querySelector(selector);
          if (!sel) return fallback;
          const opt = sel.options && sel.options[sel.selectedIndex];
          return ((opt ? opt.textContent : sel.value) || fallback).trim();
        };
        // When Side Finishing is hidden (paint / metal returns), the "Option N"
        // filament choice is irrelevant, so show only the box-wall thickness.
        const sidePanel = scope.querySelector(".side-finishing-panel");
        const sideHidden = !sidePanel || getComputedStyle(sidePanel).display === "none";
        panel.querySelectorAll("[data-craft-depth-label]").forEach((item) => item.textContent = boxSize + " side wall");
        panel.querySelectorAll("[data-craft-surface]").forEach((item) => item.textContent = optionLabel(".mounting-base-select", surface) + (finishing !== "None" ? " + " + finishing : ""));
        panel.querySelectorAll("[data-craft-size]").forEach((item) => item.textContent = sideHidden ? (boxSize + " thickness") : (getSelectedSideFinishing(scope) + " / " + boxSize + " thickness" + sideFinishingSummary(scope)));
        panel.querySelectorAll("[data-craft-color]").forEach((item) => item.textContent = optionLabel(".box-up-color-select", boxColor));
        panel.querySelectorAll("[data-craft-led-summary]").forEach((item) => item.textContent = ledColor);
        panel.querySelectorAll("[data-craft-date-summary]").forEach((item) => item.textContent = selectedCollectDate(scope));
        panel.querySelectorAll("[data-craft-back]").forEach((item) => item.textContent = optionLabel(".base-finish-material-select", "10mm PVC Foam Board"));
        window.updateCraftThreePreview?.(panel);
      };
      const syncAllCraft3D = () => {
        document.querySelectorAll(".craft-3d-preview").forEach((panel) => {
          syncCraft3D(panel.closest(".result, .design-card"));
        });
      };
      const enableCraft3DRotation = () => {
        if (window.initCraftThreePreviews) {
          window.initCraftThreePreviews();
          return;
        }
        document.querySelectorAll(".craft-3d-stage").forEach((stage) => {
          if (stage.dataset.rotationReady) return;
          stage.dataset.rotationReady = "1";
          let dragging = false;
          let startX = 0;
          let startY = 0;
          let baseX = 5;
          let baseY = -18;
          let currentX = baseX;
          let currentY = baseY;
          const apply = () => {
            stage.style.setProperty("--rx", currentX + "deg");
            stage.style.setProperty("--ry", currentY + "deg");
          };
          const setView = (view) => {
            const views = {
              front: [0, 0],
              angle: [10, -42],
              side: [5, -72],
              top: [58, -18],
              install: [12, -52],
            };
            const next = views[view] || views.front;
            currentX = next[0];
            currentY = next[1];
            baseX = currentX;
            baseY = currentY;
            stage.dataset.currentView = view;
            const shellOpacity = "1";
            const panel = stage.closest(".craft-3d-preview");
            stage.style.setProperty("--shell-opacity", shellOpacity);
            panel?.style.setProperty("--shell-opacity", shellOpacity);
            apply();
            panel?.querySelectorAll(".craft-view-card").forEach((button) => {
              button.classList.toggle("is-active", button.dataset.view === view);
            });
          };
          apply();
          stage.addEventListener("pointerdown", (event) => {
            if (event.button !== 0) return;
            dragging = true;
            startX = event.clientX;
            startY = event.clientY;
            baseX = currentX;
            baseY = currentY;
            stage.classList.add("is-dragging");
            stage.dataset.currentView = "custom";
            stage.style.setProperty("--shell-opacity", "1");
            stage.closest(".craft-3d-preview")?.style.setProperty("--shell-opacity", "1");
            stage.setPointerCapture(event.pointerId);
          });
          stage.addEventListener("pointermove", (event) => {
            if (!dragging) return;
            currentY = baseY + (event.clientX - startX) * 0.45;
            currentX = Math.max(-70, Math.min(70, baseX - (event.clientY - startY) * 0.35));
            apply();
          });
          const stop = (event) => {
            if (!dragging) return;
            dragging = false;
            stage.classList.remove("is-dragging");
            try { stage.releasePointerCapture(event.pointerId); } catch (_error) {}
          };
          stage.addEventListener("pointerup", stop);
          stage.addEventListener("pointercancel", stop);
          stage.closest(".craft-3d-preview")?.querySelectorAll(".craft-view-card").forEach((button) => {
            button.addEventListener("click", () => setView(button.dataset.view || "front"));
          });
          setView("angle");
          stage.addEventListener("dblclick", () => setView("front"));
        });
      };
      window.addEventListener("change", (event) => {
        if (event.target && event.target.matches(".finishing-select")) {
          const scope = event.target.closest(".result, .design-card");
          if (scope?.dataset.specialFinishingMode === "1") {
            selectedSpecialItems(scope).forEach((item) => {
              item.dataset.itemFinishing = event.target.value;
              syncItemCraftBadge(item);
            });
            syncOrderPanel(scope?.querySelector(".order-panel"));
            syncItemCraftPanel(scope);
            return;
          }
        }
        if (event.target && event.target.matches(".mounting-select")) {
          if (event.target.matches(".box-up-size-select")) resetSideMmForBoxSize(event.target.closest(".result, .design-card"));
          syncBaseFinishing();
          const scope = event.target.closest(".result, .design-card");
          syncCraft3D(scope);
          syncOrderPanel(scope?.querySelector(".order-panel"));
        }
        if (event.target && event.target.matches(".order-terms-checkbox")) {
          const panel = event.target.closest(".order-panel");
          const button = panel?.querySelector(".order-add-button");
          // Keep it disabled unless the artwork has been uploaded, terms or not.
          if (button) button.disabled = !event.target.checked || !(window.__SF_ARTWORK && window.__SF_ARTWORK.url);
        }
      });
      // Must match buildDimensionPreview()'s ml/mt/mr/mb in analyze.ts (the crop
      // image is placed at x=62,y=58 with right/bottom margins 132/30).
      const previewImageMargins = { left: 62, top: 58, right: 132, bottom: 30 };
      const hideDimensionHighlight = (scope) => {
        const highlight = scope && scope.querySelector(".dimension-highlight");
        if (highlight) highlight.classList.remove("is-visible");
      };
      const showDimensionHighlight = (item) => {
        const scope = item.closest(".result, .design-body");
        const preview = scope && scope.querySelector(".dimension-preview");
        const image = preview && preview.querySelector("img");
        if (!preview || !image || !image.naturalWidth || !image.naturalHeight || !item.dataset.highlight) return;
        let data;
        try {
          data = JSON.parse(item.dataset.highlight);
        } catch (_error) {
          return;
        }
        placePreviewBox(preview, image, data, ensurePreviewBox(preview, "dimension-highlight"));
      };
      const ensurePreviewBox = (preview, className) => {
        let box = preview.querySelector("." + className);
        if (!box) {
          box = document.createElement("div");
          box.className = className;
          preview.appendChild(box);
        }
        return box;
      };
      const placePreviewBox = (preview, image, data, box) => {
        const imageBox = image.getBoundingClientRect();
        const previewBox = preview.getBoundingClientRect();
        const contentWidth = Math.max(1, image.naturalWidth - previewImageMargins.left - previewImageMargins.right);
        const contentHeight = Math.max(1, image.naturalHeight - previewImageMargins.top - previewImageMargins.bottom);
        const left = imageBox.left - previewBox.left + ((previewImageMargins.left + data.left * contentWidth) / image.naturalWidth) * imageBox.width;
        const top = imageBox.top - previewBox.top + ((previewImageMargins.top + data.top * contentHeight) / image.naturalHeight) * imageBox.height;
        const width = (data.width * contentWidth / image.naturalWidth) * imageBox.width;
        const height = (data.height * contentHeight / image.naturalHeight) * imageBox.height;
        box.style.left = left + "px";
        box.style.top = top + "px";
        box.style.width = Math.max(8, width) + "px";
        box.style.height = Math.max(8, height) + "px";
        box.classList.add("is-visible");
      };
      const selectedItems = (panel) => Array.from(panel.querySelectorAll(".letter-dimension-item.is-selected"));
      const getDeletedItems = (panel) => {
        if (!panel || !panel.dataset.deletedItems) return [];
        try {
          return JSON.parse(panel.dataset.deletedItems || "[]");
        } catch (_error) {
          return [];
        }
      };
      const setDeletedItems = (panel, items) => {
        if (!panel) return;
        panel.dataset.deletedItems = JSON.stringify(items || []);
      };
      const getUndoStack = (panel) => {
        if (!panel || !panel.dataset.undoStack) return [];
        try {
          return JSON.parse(panel.dataset.undoStack || "[]");
        } catch (_error) {
          return [];
        }
      };
      const setUndoStack = (panel, stack) => {
        if (!panel) return;
        panel.dataset.undoStack = JSON.stringify(stack || []);
      };
      const clearPanelSelection = (panel) => {
        if (!panel) return;
        panel.querySelectorAll(".letter-dimension-item.is-selected").forEach((item) => item.classList.remove("is-selected"));
        syncGroupButtons(panel);
        syncSelectedPreviewFrames(panel);
        syncOrderPanel(panel.closest(".result, .design-card")?.querySelector(".order-panel"));
        syncItemCraftPanel(panel.closest(".result, .design-card"));
        if (modalContext && modalContext.panel === panel) syncModalFrames();
      };
      const syncGroupButtons = (scope = document) => {
        const panels = scope && scope.matches && scope.matches(".letter-dimensions")
          ? [scope]
          : Array.from((scope || document).querySelectorAll(".letter-dimensions"));
        panels.forEach((panel) => {
          const button = panel.querySelector(".group-selected-button");
          const specialButton = panel.querySelector(".special-finishing-button");
          const deleteButton = panel.querySelector(".delete-selected-button");
          const undoButton = panel.querySelector(".undo-button");
          if (!button && !specialButton && !deleteButton && !undoButton) return;
          const count = selectedItems(panel).length;
          const selectedGrouped = selectedItems(panel).filter((item) => item.dataset.groupChildren);
          if (button) {
            button.disabled = false;
            if (selectedGrouped.length >= 1) {
              button.textContent = "Ungroup";
            } else {
              button.textContent = count >= 2 ? "Group" : "Select with Group";
            }
          }
          if (deleteButton) {
            deleteButton.disabled = count < 1;
          }
          if (specialButton) {
            specialButton.disabled = count < 1;
            const scope = panel.closest(".result, .design-card");
            specialButton.textContent = scope?.dataset.specialFinishingMode === "1" ? "Done" : "Special Finishing";
          }
          if (undoButton) {
            undoButton.disabled = getUndoStack(panel).length < 1;
          }
        });
      };
      const syncSelectedPreviewFrames = (panel) => {
        const scope = panel && panel.closest(".result, .design-body");
        const preview = scope && scope.querySelector(".dimension-preview");
        const image = preview && preview.querySelector("img");
        if (!preview || !image || !image.naturalWidth || !image.naturalHeight) return;
        preview.querySelectorAll(".dimension-selection-highlight, .dimension-group-highlight, .dimension-record-hitbox, .dimension-deleted-marker").forEach((box) => box.remove());
        getDeletedItems(panel).forEach((deleted) => {
          if (!deleted.highlight) return;
          const box = document.createElement("div");
          box.className = "dimension-deleted-marker";
          preview.appendChild(box);
          placePreviewBox(preview, image, deleted.highlight, box);
        });
        panel.querySelectorAll(".letter-dimension-item").forEach((item) => {
          if (!item.dataset.highlight || !item.dataset.recordId) return;
          try {
            const data = JSON.parse(item.dataset.highlight);
            const box = document.createElement("div");
            box.className = "dimension-record-hitbox" + (item.classList.contains("is-selected") ? " is-selected" : "");
            box.dataset.recordId = item.dataset.recordId;
            preview.appendChild(box);
            placePreviewBox(preview, image, data, box);
          } catch (_error) {}
        });
        const items = selectedItems(panel).filter((item) => item.dataset.highlight);
        items.forEach((item) => {
          try {
            const data = JSON.parse(item.dataset.highlight);
            const box = document.createElement("div");
            box.className = "dimension-selection-highlight";
            preview.appendChild(box);
            placePreviewBox(preview, image, data, box);
          } catch (_error) {}
        });
        if (items.length >= 2) {
          const data = unionRect(items, "highlight");
          if (data) {
            const box = document.createElement("div");
            box.className = "dimension-group-highlight";
            preview.appendChild(box);
            placePreviewBox(preview, image, data, box);
          }
        }
      };
      const itemByRecordId = (panel, recordId) => panel && panel.querySelector('.letter-dimension-item[data-record-id="' + recordId + '"]');
      const scopeTitle = (scope) => scope?.classList?.contains("design-card")
        ? scope.querySelector(":scope > h4")
        : scope?.querySelector(".result-info > h3");
      const selectedArtboardColor = (scope) => scope?.querySelector(".selected-color strong")?.textContent?.split(",")[0]?.trim() || "White";
      const selectFilamentColor = (scope, color) => {
        const picker = scope?.querySelector(".color-picker");
        if (!picker) return;
        picker.querySelectorAll(".color-option").forEach((item) => item.classList.toggle("is-selected", (item.dataset.color || "White") === color));
        const selected = picker.querySelector(".selected-color strong");
        if (selected) selected.textContent = color || "White";
      };
      const selectedSpecialItems = (scope) => {
        const dimensions = scope?.querySelector(".letter-dimensions");
        return dimensions ? selectedItems(dimensions) : [];
      };
      const setSpecialFinishingMode = (scope, active) => {
        if (!scope) return;
        const title = scopeTitle(scope);
        if (title && !title.dataset.artboardTitle) title.dataset.artboardTitle = title.textContent.trim() || "Artboard 1";
        const finishingSelect = scope.querySelector(".finishing-select");
        if (active) {
          scope.dataset.artboardFinishingValue = finishingSelect?.value || "None";
          scope.dataset.artboardColorValue = selectedArtboardColor(scope);
        }
        scope.dataset.specialFinishingMode = active ? "1" : "0";
        if (title) title.textContent = active ? "Special Finishing" : (title.dataset.artboardTitle || "Artboard 1");
        if (!active) {
          if (finishingSelect && scope.dataset.artboardFinishingValue) finishingSelect.value = scope.dataset.artboardFinishingValue;
          if (scope.dataset.artboardColorValue) selectFilamentColor(scope, scope.dataset.artboardColorValue);
        }
        syncItemCraftPanel(scope);
        const dimensions = scope.querySelector(".letter-dimensions");
        dimensions?.classList.toggle("is-special-mode", !!active);
      };
      const effectiveItemCraft = (item, artboardFinishing, artboardColor) => {
        const itemFinishing = item?.dataset.itemFinishing || "Use Artboard";
        const itemColor = item?.dataset.itemColor || "Use Artboard";
        return {
          finishing: itemFinishing === "Use Artboard" ? artboardFinishing : itemFinishing,
          color: itemColor === "Use Artboard" ? artboardColor : itemColor,
          hasCustom: itemFinishing !== "Use Artboard" || itemColor !== "Use Artboard",
        };
      };
      const syncItemCraftBadge = (item) => {
        if (!item) return;
        const size = item.querySelector(".letter-dimension-size");
        if (!size) return;
        let note = size.querySelector(".letter-item-craft-note");
        const parts = [];
        if ((item.dataset.itemFinishing || "Use Artboard") !== "Use Artboard") parts.push(item.dataset.itemFinishing);
        if ((item.dataset.itemColor || "Use Artboard") !== "Use Artboard") parts.push(item.dataset.itemColor);
        item.classList.toggle("has-custom-craft", parts.length > 0);
        if (!parts.length) {
          note?.remove();
          return;
        }
        if (!note) {
          note = document.createElement("span");
          note.className = "letter-item-craft-note";
          size.appendChild(note);
        }
        note.textContent = parts.join(" / ");
      };
      const syncItemCraftPanel = (scope) => {
        if (!scope) return;
        const panel = scope.querySelector(".item-craft-panel");
        const dimensions = scope.querySelector(".letter-dimensions");
        const selected = dimensions ? selectedItems(dimensions) : [];
        const modeActive = scope.dataset.specialFinishingMode === "1";
        const active = selected.length ? selected[0] : null;
        if (modeActive && !active) {
          const title = scopeTitle(scope);
          scope.dataset.specialFinishingMode = "0";
          if (title) title.textContent = title.dataset.artboardTitle || "Artboard 1";
        }
        dimensions?.classList.toggle("is-special-mode", modeActive && !!active);
        if (!panel) {
          if (modeActive && active) {
            const finishingSelect = scope.querySelector(".finishing-select");
            const artboardFinishing = scope.dataset.artboardFinishingValue || finishingSelect?.value || "None";
            const itemFinishing = active.dataset.itemFinishing || "Use Artboard";
            if (finishingSelect) finishingSelect.value = itemFinishing === "Use Artboard" ? artboardFinishing : itemFinishing;
            const artboardColor = scope.dataset.artboardColorValue || selectedArtboardColor(scope);
            const itemColor = active.dataset.itemColor || "Use Artboard";
            selectFilamentColor(scope, itemColor === "Use Artboard" ? artboardColor : itemColor);
          }
          return;
        }
        panel.classList.toggle("is-hidden", !modeActive || !active);
        if (!modeActive || !active) return;
        const labels = selected.map((item) => item.querySelector(".letter-item-preview strong")?.textContent?.trim()).filter(Boolean);
        const selectedLabel = panel.querySelector(".item-craft-selected");
        if (selectedLabel) selectedLabel.textContent = labels.length === 1 ? labels[0] : labels.length + " selected items";
        const finishing = panel.querySelector('[data-item-craft="finishing"]');
        const color = panel.querySelector('[data-item-craft="color"]');
        const sameValue = (key) => selected.every((item) => (item.dataset[key] || "Use Artboard") === (active.dataset[key] || "Use Artboard"));
        if (finishing) finishing.value = sameValue("itemFinishing") ? (active.dataset.itemFinishing || "Use Artboard") : "Use Artboard";
        if (color) color.value = sameValue("itemColor") ? (active.dataset.itemColor || "Use Artboard") : "Use Artboard";
      };
      // 3D Printer Frontlit price list (per tier: [Agent, Silver, Gold, Diamond]).
      // Base = RM per cm of the letter's longest side, by cm bracket up to 100cm;
      // 101cm+ (>= 1 m2) is priced by area (RM per m2). LED / UV Printing / 2K
      // Spray each add RM per cm of longest side and stack.
      const FRONTLIT_PRICE = (typeof window !== "undefined" && window.__BOXUP_PRICES__ && window.__BOXUP_PRICES__.FRONTLIT) || {
        LOGO: {
          cm: [[40, [1.9, 1.8, 1.78, 1.74]], [80, [2.1, 1.99, 1.97, 1.93]], [100, [2.3, 2.18, 2.16, 2.11]]],
          m2: [260, 247, 244.5, 239.2],
        },
        WORDING: {
          cm: [[40, [1.5, 1.43, 1.41, 1.38]], [80, [1.9, 1.8, 1.78, 1.74]], [100, [2.1, 2, 1.97, 1.93]]],
          m2: [250, 237.5, 235, 230],
        },
        addon: { LED: [0.4, 0.38, 0.37, 0.37], UV: [0.5, 0.48, 0.47, 0.46], Spray: [0.8, 0.76, 0.75, 0.73] },
      };
      // Returns the 4-tier per-letter price [Agent, Silver, Gold, Diamond].
      const frontlitItemTiers = (isLogo, sizeCm, areaM2, hasLed, uvOn, sprayOn) => {
        const tbl = FRONTLIT_PRICE[isLogo ? "LOGO" : "WORDING"];
        const base = [0, 0, 0, 0];
        if (sizeCm > 100) {
          for (let t = 0; t < 4; t++) base[t] = areaM2 * tbl.m2[t];
        } else {
          let rate = tbl.cm[tbl.cm.length - 1][1];
          for (const [upTo, r] of tbl.cm) { if (sizeCm <= upTo) { rate = r; break; } }
          for (let t = 0; t < 4; t++) base[t] = sizeCm * rate[t];
        }
        const add = FRONTLIT_PRICE.addon;
        const out = [0, 0, 0, 0];
        for (let t = 0; t < 4; t++) {
          const perCm = (hasLed ? add.LED[t] : 0) + (uvOn ? add.UV[t] : 0) + (sprayOn ? add.Spray[t] : 0);
          out[t] = base[t] + sizeCm * perCm;
        }
        return out;
      };
      // 3D Printer Backlit price list (per tier: [Agent, Silver, Gold, Diamond]).
      // Base = RM per cm of the letter's longest side by cm bracket (<=100cm), or
      // area x RM/m2 at 101cm+. 2K Spray is INCLUDED in the base. LED White (any
      // of 3000/4000/6000/10000K) adds RM per cm; RGB is quote-on-request (handled
      // separately below). The "with 10mm Clear Acrylic" variant additionally
      // charges a clear-acrylic plate by the letter's bounding-box AREA (RM per m2).
      const BACKLIT_PRICE = (typeof window !== "undefined" && window.__BOXUP_PRICES__ && window.__BOXUP_PRICES__.BACKLIT) || {
        LOGO: {
          cm: [[40, [1.9, 1.8, 1.78, 1.74]], [80, [2.1, 1.99, 1.97, 1.93]], [100, [2.3, 2.18, 2.16, 2.11]]],
          m2: [260, 247, 244.5, 239.2],
        },
        WORDING: {
          cm: [[40, [1.5, 1.43, 1.41, 1.38]], [80, [1.9, 1.8, 1.78, 1.74]], [100, [2.1, 2, 1.97, 1.93]]],
          m2: [250, 237.5, 235, 230],
        },
        ledWhite: [0.4, 0.38, 0.37, 0.37],   // RM per cm when a white LED temperature is selected
        acrylicM2: [350, 300, 290, 280],     // RM per m2 of bounding-box area (acrylic variant only)
      };
      const backlitItemTiers = (isLogo, sizeCm, areaM2, ledWhiteOn, hasAcrylic) => {
        const tbl = BACKLIT_PRICE[isLogo ? "LOGO" : "WORDING"];
        const out = [0, 0, 0, 0];
        for (let t = 0; t < 4; t++) {
          let base;
          if (sizeCm > 100) {
            base = areaM2 * tbl.m2[t];
          } else {
            let rate = tbl.cm[tbl.cm.length - 1][1];
            for (const [upTo, r] of tbl.cm) { if (sizeCm <= upTo) { rate = r; break; } }
            base = sizeCm * rate[t];
          }
          const led = ledWhiteOn ? sizeCm * BACKLIT_PRICE.ledWhite[t] : 0;
          const acrylic = hasAcrylic ? areaM2 * BACKLIT_PRICE.acrylicM2[t] : 0;
          out[t] = base + led + acrylic;
        }
        return out;
      };
      // 3D Printer Front & Backlit price list (litMode "both": lit face + rear
      // halo). Same shape as frontlit — base by cm bracket / area, plus LED White
      // (any white temp), UV Printing, and 2K Spray stacking RM per cm. RGB is
      // quote-on-request (handled separately below).
      const FRONT_BACKLIT_PRICE = (typeof window !== "undefined" && window.__BOXUP_PRICES__ && window.__BOXUP_PRICES__.FRONT_BACKLIT) || {
        LOGO: {
          cm: [[40, [2.9, 2.8, 2.78, 2.74]], [80, [3.1, 2.99, 2.97, 2.93]], [100, [3.3, 3.18, 3.16, 3.11]]],
          m2: [360, 342, 338.4, 331.2],
        },
        WORDING: {
          cm: [[40, [2.5, 2.43, 2.41, 2.38]], [80, [2.9, 2.8, 2.78, 2.74]], [100, [3.1, 3, 2.97, 2.93]]],
          m2: [350, 332.5, 329, 322],
        },
        addon: { LED: [0.4, 0.38, 0.37, 0.37], UV: [0.5, 0.48, 0.47, 0.46], Spray: [0.8, 0.76, 0.75, 0.73] },
        acrylicM2: [350, 300, 290, 280], // RM per m2 of bounding-box area ("with 10mm Clear Acrylic" variant)
      };
      const frontBacklitItemTiers = (isLogo, sizeCm, areaM2, ledWhiteOn, uvOn, sprayOn, hasAcrylic) => {
        const tbl = FRONT_BACKLIT_PRICE[isLogo ? "LOGO" : "WORDING"];
        const out = [0, 0, 0, 0];
        for (let t = 0; t < 4; t++) {
          let base;
          if (sizeCm > 100) {
            base = areaM2 * tbl.m2[t];
          } else {
            let rate = tbl.cm[tbl.cm.length - 1][1];
            for (const [upTo, r] of tbl.cm) { if (sizeCm <= upTo) { rate = r; break; } }
            base = sizeCm * rate[t];
          }
          const add = FRONT_BACKLIT_PRICE.addon;
          const perCm = (ledWhiteOn ? add.LED[t] : 0) + (uvOn ? add.UV[t] : 0) + (sprayOn ? add.Spray[t] : 0);
          const acrylic = hasAcrylic ? areaM2 * FRONT_BACKLIT_PRICE.acrylicM2[t] : 0;
          out[t] = base + sizeCm * perCm + acrylic;
        }
        return out;
      };
      // Aluminum Channel Box Up price list (metal channel returns, lit acrylic
      // face; no litMode). Base by cm bracket / area, plus a CHANNEL FINISH chosen
      // via Box Up Color (Standard = base 0, Mirror / Hairline premium, RM per cm)
      // and LED White + UV Printing add-ons (RM per cm). RGB is quote-on-request.
      const ALU_CHANNEL_PRICE = (typeof window !== "undefined" && window.__BOXUP_PRICES__ && window.__BOXUP_PRICES__.ALU_CHANNEL) || {
        LOGO: {
          cm: [[40, [2.04, 1.93, 1.91, 1.88]], [80, [2.56, 2.43, 2.4, 2.36]], [100, [2.8, 2.66, 2.6, 2.58]]],
          m2: [364, 345.8, 342.2, 334.9],
        },
        WORDING: {
          cm: [[40, [2.04, 1.93, 1.91, 1.88]], [80, [2.56, 2.43, 2.4, 2.36]], [100, [2.8, 2.66, 2.6, 2.58]]],
          m2: [364, 345.8, 342.2, 334.9],
        },
        finish: { mirror: [0.2, 0.2, 0.2, 0.2], hairline: [0.2, 0.2, 0.2, 0.2] }, // standard = 0
        addon: { LED: [0.5, 0.45, 0.4, 0.35], UV: [0.7, 0.68, 0.65, 0.64] },
      };
      const aluChannelItemTiers = (isLogo, sizeCm, areaM2, ledWhiteOn, uvOn, channelFinish) => {
        const tbl = ALU_CHANNEL_PRICE[isLogo ? "LOGO" : "WORDING"];
        const out = [0, 0, 0, 0];
        for (let t = 0; t < 4; t++) {
          let base;
          if (sizeCm > 100) {
            base = areaM2 * tbl.m2[t];
          } else {
            let rate = tbl.cm[tbl.cm.length - 1][1];
            for (const [upTo, r] of tbl.cm) { if (sizeCm <= upTo) { rate = r; break; } }
            base = sizeCm * rate[t];
          }
          const fin = channelFinish === "mirror" ? ALU_CHANNEL_PRICE.finish.mirror[t]
            : channelFinish === "hairline" ? ALU_CHANNEL_PRICE.finish.hairline[t] : 0;
          const add = ALU_CHANNEL_PRICE.addon;
          const perCm = fin + (ledWhiteOn ? add.LED[t] : 0) + (uvOn ? add.UV[t] : 0);
          out[t] = base + sizeCm * perCm;
        }
        return out;
      };
      // 3D Stainless Steel Box Up (Frontlit + Backlit). 201 = one uniform price by
      // size (finish free). 304 base = the Original price, with a per-cm premium
      // for Mirror / Hairline. LED White adds per cm; RGB is quote-on-request.
      // Rows filled once in the source sheet (base, Backlit LED/UV) apply to all 4
      // member tiers. Backlit prices only 20-40 / 41-80cm — 81cm+ is a whole-order
      // quotation. (LOGO and WORDING share the same base here.)
      const STAINLESS_PRICE = (typeof window !== "undefined" && window.__BOXUP_PRICES__ && window.__BOXUP_PRICES__.STAINLESS) || {
        frontlit: {
          base: {
            "201": { cm: [[40, [3.38, 3.21, 3.18, 3.11]], [80, [4.16, 3.95, 3.91, 3.83]], [100, [5.07, 4.82, 4.77, 4.66]]], m2: [650, 617.5, 611, 598] },
            "304": { cm: [[40, [4.42, 4.2, 4.15, 4.07]], [80, [5.2, 4.94, 4.89, 4.78]], [100, [6.11, 5.8, 5.74, 5.62]]], m2: [910, 864.5, 855.4, 837.2] },
          },
          finish304: { mirror: [1.8, 1.8, 1.8, 1.8], hairline: [1.8, 1.8, 1.8, 1.8] },
          ledWhite: [0.5, 0.45, 0.4, 0.35],
          uv: [0.7, 0.68, 0.65, 0.64],
        },
        backlit: {
          base: {
            "201": { cm: [[40, [4.16, 3.95, 3.91, 3.83]], [80, [5.46, 5.19, 5.13, 5.02]]], m2: null },
            "304": { cm: [[40, [5.46, 5.19, 5.13, 5.02]], [80, [6.76, 6.42, 6.35, 6.22]]], m2: null },
          },
          finish304: { mirror: [1.8, 1.8, 1.8, 1.8], hairline: [1.8, 1.8, 1.8, 1.8] },
          ledWhite: [0.8, 0.76, 0.75, 0.74],
          uv: [0.7, 0.67, 0.66, 0.64],
        },
        // Backlit + 10mm Clear Acrylic: the clear-acrylic plate cost is baked
        // into the base per-cm rate (no separate area charge), so this is just a
        // higher-base clone of the plain backlit table. Same 2 size brackets;
        // 81cm+ is still quote-on-request.
        backlitAcrylic: {
          base: {
            "201": { cm: [[40, [6.5, 6.175, 6.11, 5.98]], [80, [7.8, 7.41, 7.332, 7.176]]], m2: null },
            "304": { cm: [[40, [7.15, 6.79, 6.72, 6.57]], [80, [8.45, 8.02, 7.94, 7.77]]], m2: null },
          },
          finish304: { mirror: [1.8, 1.8, 1.8, 1.8], hairline: [1.8, 1.8, 1.8, 1.8] },
          ledWhite: [0.8, 0.76, 0.75, 0.74],
          uv: [0.7, 0.67, 0.66, 0.64],
        },
      };
      const stainlessItemTiers = (variant, grade, sizeCm, areaM2, finish, ledWhiteOn, uvOn) => {
        const cfg = STAINLESS_PRICE[variant];
        const tbl = cfg.base[grade] || cfg.base["201"];
        const out = [0, 0, 0, 0];
        for (let t = 0; t < 4; t++) {
          let base;
          if (sizeCm > 100 && tbl.m2) {
            base = areaM2 * tbl.m2[t];
          } else {
            let rate = tbl.cm[tbl.cm.length - 1][1];
            for (const [upTo, r] of tbl.cm) { if (sizeCm <= upTo) { rate = r; break; } }
            base = sizeCm * rate[t];
          }
          let fin = 0;
          if (grade === "304") {
            if (finish === "mirror") fin = cfg.finish304.mirror[t];
            else if (finish === "hairline") fin = cfg.finish304.hairline[t];
          }
          const led = ledWhiteOn ? cfg.ledWhite[t] : 0;
          const uvr = uvOn ? cfg.uv[t] : 0;
          out[t] = base + sizeCm * (fin + led + uvr);
        }
        return out;
      };
      // EG Box Up price list. Frontlit: one base per size bracket (the customer
      // filled 6cm and 8cm depth identically, and Logo = Wording), 101cm+ by m2,
      // plus LED White / UV Printing per cm. 2K spray is included in the base.
      const EG_PRICE = (typeof window !== "undefined" && window.__BOXUP_PRICES__ && window.__BOXUP_PRICES__.EG) || {
        frontlit: {
          cm: [[40, [2.47, 2.346, 2.32, 2.27]], [80, [3.25, 3.08, 3.05, 2.99]], [100, [4.16, 3.95, 3.91, 3.82]]],
          m2: [700, 665, 658, 644],
          ledWhite: [0.5, 0.45, 0.4, 0.35],
          uv: [0.7, 0.68, 0.65, 0.64],
        },
        // Backlit: only 20-40cm and 41-80cm are priced; 81cm+ is quote-on-request.
        // Logo = Wording (customer filled both identically).
        backlit: {
          cm: [[40, [4.16, 3.95, 3.91, 3.82]], [80, [5.46, 5.18, 5.13, 5.02]]],
          m2: null,
          ledWhite: [0.5, 0.45, 0.4, 0.35],
          uv: [0.7, 0.68, 0.65, 0.64],
        },
        // Backlit + 10mm Clear Acrylic: the acrylic cost is baked into a higher
        // base (customer left the separate acrylic row blank), so it's a
        // higher-base clone of plain backlit. Same 81cm+ quote rule.
        backlitAcrylic: {
          cm: [[40, [5.46, 5.18, 5.13, 5.02]], [80, [6.76, 6.42, 6.35, 6.21]]],
          m2: null,
          ledWhite: [0.5, 0.45, 0.4, 0.35],
          uv: [0.7, 0.68, 0.65, 0.64],
        },
      };
      const egItemTiers = (variant, sizeCm, areaM2, ledWhiteOn, uvOn) => {
        const cfg = EG_PRICE[variant];
        const out = [0, 0, 0, 0];
        for (let t = 0; t < 4; t++) {
          let base;
          if (sizeCm > 100 && cfg.m2) {
            base = areaM2 * cfg.m2[t];
          } else {
            let rate = cfg.cm[cfg.cm.length - 1][1];
            for (const [upTo, r] of cfg.cm) { if (sizeCm <= upTo) { rate = r; break; } }
            base = sizeCm * rate[t];
          }
          const led = ledWhiteOn ? cfg.ledWhite[t] : 0;
          const uvr = uvOn ? cfg.uv[t] : 0;
          out[t] = base + sizeCm * (led + uvr);
        }
        return out;
      };
      const syncOrderPanel = (panel) => {
        if (!panel) return;
        const input = panel.querySelector(".order-quantity");
        const prices = panel.querySelectorAll(".order-price");
        const scope = panel.closest(".result, .design-card");
        const surface = scope?.querySelector(".mounting-base-select")?.value || "3mm White Acrylic";
        const finishing = scope?.dataset.specialFinishingMode === "1"
          ? (scope.dataset.artboardFinishingValue || "None")
          : (scope?.querySelector(".finishing-select")?.value || "None");
        const artboardColor = scope?.dataset.specialFinishingMode === "1"
          ? (scope.dataset.artboardColorValue || "White")
          : selectedArtboardColor(scope);
        const ledColor = scope?.querySelector(".selected-led-color strong")?.textContent?.trim() || "None";
        const ledRate = ledColor === "None" ? 0 : 5;
        const hasLed = ledColor !== "None";
        // Frontlit uses the size-bracket price list; other lit modes keep the
        // legacy per-inch formula until their own price list is provided.
        // (Read the lit mode off the page body element — this runs in a plain
        // script, so the module-scoped LIT_MODE const is not in scope here.)
        // NOTE: do NOT write the literal body tag in any comment before the real
        // one — brand() injects data-lit-mode via .replace on the first match.
        const frontlit = (document.body.dataset.litMode || "") === "";
        // The 3D Printer (Frontlit) is the only frontlit box-up whose Box Up
        // Color offers a "2K Spray" option (stainless / aluminum override that
        // select), so use it to scope this price list to that product alone.
        const boxUpColorSelect = scope?.querySelector(".box-up-color-select");
        // EG Box Up (Frontlit) also carries a 2K Spray option but has its own
        // price list, so exclude it from the 3D-printer detection by name.
        const is3dPrinter = frontlit && !/EG (Conceal )?Box Up/i.test(document.body.dataset.boxupName || "") && !!boxUpColorSelect &&
          Array.from(boxUpColorSelect.options || []).some((o) => /2K Spray/i.test(o.textContent || o.value || ""));
        // 2K Spray is one of the stackable per-cm add-ons in the frontlit price list.
        const spray = is3dPrinter && /2K Spray/i.test(boxUpColorSelect?.value || "");
        // Backlit (litMode "back") uses its own price list: 2K Spray in the base,
        // LED White (any white temp) adds per cm, RGB is quote-on-request. The
        // "with 10mm Clear Acrylic" variant is detected by its Base Acrylic
        // selector and adds a per-m2 clear-acrylic plate.
        // Stainless Steel Box Up (Frontlit / Backlit) has its own price list;
        // detect by product name (no regex parens — they'd be eaten by the
        // template literal). Backlit stainless shares litMode "back" with the
        // 3D-printer backlit, so it is excluded from isBacklit below.
        const boxupName = document.body.dataset.boxupName || "";
        const isStainless = /Stainless Steel/i.test(boxupName);
        const isStainlessFrontlit = isStainless && /Frontlit/i.test(boxupName);
        const isStainlessBacklit = isStainless && /Backlit/i.test(boxupName);
        // The "with 10mm Clear Acrylic" backlit variant has the acrylic cost
        // baked into a higher base price list (no separate acrylic charge).
        const isStainlessBacklitAcrylic = isStainlessBacklit && /Acrylic/i.test(boxupName);
        // EG Box Up: 2K spray painted (colour does not change price). Frontlit has
        // its own base list (6cm/8cm depth priced the same, Logo = Wording).
        const isEg = /EG (Conceal )?Box Up/i.test(boxupName);
        const isEgFrontlit = isEg && /Frontlit/i.test(boxupName);
        // EG backlit (plain vs the "with 10mm Clear Acrylic" variant, which has a
        // higher base with the acrylic baked in). Both: 81cm+ is quote-on-request.
        const isEgBacklit = isEg && /Backlit/i.test(boxupName) && !/Acrylic/i.test(boxupName);
        const isEgBacklitAcrylic = isEg && /Backlit/i.test(boxupName) && /Acrylic/i.test(boxupName);
        const isBacklit = (document.body.dataset.litMode || "") === "back" && !isStainless && !isEgBacklit && !isEgBacklitAcrylic;
        const hasAcrylic = !!scope?.querySelector(".base-acrylic-select");
        const ledWhiteOn = ["3000K", "4000K", "6000K", "10000K"].includes(ledColor);
        // Front & Backlit (litMode "both"): frontlit-style price list with an
        // optional 2K Spray add-on read off the Box Up Color select.
        const isFrontBacklit = (document.body.dataset.litMode || "") === "both";
        const fbSpray = isFrontBacklit && /2K Spray/i.test(boxUpColorSelect?.value || "");
        // Aluminum Channel: identified by product name (Stainless shares the
        // Mirror/Hairline colour options, so option text can't tell them apart).
        // The chosen channel finish comes off the Box Up Color value.
        const isAluChannel = /Aluminum Channel/i.test(document.body.dataset.boxupName || "");
        const channelFinish = /Mirror/i.test(boxUpColorSelect?.value || "") ? "mirror"
          : /Hairline/i.test(boxUpColorSelect?.value || "") ? "hairline" : "standard";
        // Stainless grade (201/204) + finish (Original/Mirror/Hairline). Only
        // 304 charges a Mirror/Hairline premium; 201 is uniform.
        const stainlessGrade = /304/.test(scope?.querySelector(".stainless-grade-select")?.value || "") ? "304" : "201";
        const stainlessFinish = /Mirror/i.test(boxUpColorSelect?.value || "") ? "mirror"
          : /Hairline/i.test(boxUpColorSelect?.value || "") ? "hairline" : "original";
        let stainlessOverSize = false;
        let egOverSize = false;
        let unit = 0;
        const unitTiers = [0, 0, 0, 0];
        scope?.querySelectorAll(".letter-dimension-item").forEach((item) => {
          const itemCraft = effectiveItemCraft(item, finishing, artboardColor);
          const label = item.querySelector(".letter-item-preview strong")?.textContent?.trim() || "";
          // NOTE: this whole HTML doc is emitted from a template literal, so a
          // regex \b here would be swallowed as a backspace escape at build
          // time. Match "Logo" at the start without \b — labels are "Logo N"
          // and wording items are single characters, so this is unambiguous.
          const isLogo = /^Logo/i.test(label);
          let width = 0;
          let height = 0;
          try {
            const box = JSON.parse(item.dataset.bbox || "{}");
            width = Number(box.width) || 0;
            height = Number(box.height) || 0;
          } catch (_error) {}
          if (!width || !height) {
            const sizeText = item.querySelector(".letter-dimension-size")?.textContent || "";
            const match = sizeText.match(/([0-9.]+)\s*in\s*x\s*([0-9.]+)\s*in/i);
            width = Number(match?.[1]) || width;
            height = Number(match?.[2]) || height;
          }
          const size = Math.max(width, height);
          let itemPrice;
          if (is3dPrinter) {
            const sizeCm = size * 2.54;
            const areaM2 = (width * 2.54) * (height * 2.54) / 10000;
            const uvOn = itemCraft.finishing === "UV Printing";
            const tiers = frontlitItemTiers(isLogo, sizeCm, areaM2, hasLed, uvOn, spray);
            for (let t = 0; t < 4; t++) unitTiers[t] += tiers[t];
            itemPrice = tiers[0];
          } else if (isBacklit) {
            const sizeCm = size * 2.54;
            const areaM2 = (width * 2.54) * (height * 2.54) / 10000;
            const tiers = backlitItemTiers(isLogo, sizeCm, areaM2, ledWhiteOn, hasAcrylic);
            for (let t = 0; t < 4; t++) unitTiers[t] += tiers[t];
            itemPrice = tiers[0];
          } else if (isFrontBacklit) {
            const sizeCm = size * 2.54;
            const areaM2 = (width * 2.54) * (height * 2.54) / 10000;
            const uvOn = itemCraft.finishing === "UV Printing";
            const tiers = frontBacklitItemTiers(isLogo, sizeCm, areaM2, ledWhiteOn, uvOn, fbSpray, hasAcrylic);
            for (let t = 0; t < 4; t++) unitTiers[t] += tiers[t];
            itemPrice = tiers[0];
          } else if (isAluChannel) {
            const sizeCm = size * 2.54;
            const areaM2 = (width * 2.54) * (height * 2.54) / 10000;
            const uvOn = itemCraft.finishing === "UV Printing";
            const tiers = aluChannelItemTiers(isLogo, sizeCm, areaM2, ledWhiteOn, uvOn, channelFinish);
            for (let t = 0; t < 4; t++) unitTiers[t] += tiers[t];
            itemPrice = tiers[0];
          } else if (isStainless) {
            const sizeCm = size * 2.54;
            const areaM2 = (width * 2.54) * (height * 2.54) / 10000;
            const uvOn = itemCraft.finishing === "UV Printing";
            const variant = isStainlessFrontlit ? "frontlit" : isStainlessBacklitAcrylic ? "backlitAcrylic" : "backlit";
            const tiers = stainlessItemTiers(variant, stainlessGrade, sizeCm, areaM2, stainlessFinish, ledWhiteOn, uvOn);
            for (let t = 0; t < 4; t++) unitTiers[t] += tiers[t];
            itemPrice = tiers[0];
            // Backlit stainless has no price above 80cm — the whole order is quoted.
            if (isStainlessBacklit && sizeCm > 80) stainlessOverSize = true;
          } else if (isEgFrontlit || isEgBacklit || isEgBacklitAcrylic) {
            const sizeCm = size * 2.54;
            const areaM2 = (width * 2.54) * (height * 2.54) / 10000;
            const uvOn = itemCraft.finishing === "UV Printing";
            const variant = isEgFrontlit ? "frontlit" : isEgBacklitAcrylic ? "backlitAcrylic" : "backlit";
            const tiers = egItemTiers(variant, sizeCm, areaM2, ledWhiteOn, uvOn);
            for (let t = 0; t < 4; t++) unitTiers[t] += tiers[t];
            itemPrice = tiers[0];
            // Backlit EG has no price above 80cm — the whole order is quoted.
            if ((isEgBacklit || isEgBacklitAcrylic) && sizeCm > 80) egOverSize = true;
          } else {
            const baseRate = isLogo ? 8 : 5;
            const uvRate = surface === "3mm White Acrylic" && itemCraft.finishing === "UV Printing" ? 3 : 0;
            itemPrice = size * (baseRate + ledRate + uvRate);
            unit += itemPrice;
          }
          const itemPriceNode = item.querySelector(".letter-item-price");
          if (itemPriceNode) itemPriceNode.textContent = "RM " + itemPrice.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
          syncItemCraftBadge(item);
        });
        const quantity = Math.max(1, Number.parseInt(input?.value || "1", 10) || 1);
        if (input) input.value = quantity;
        // Collect Date surcharge: 7 working days is the base price. Faster
        // turnarounds add a percentage AND require sales confirmation — the order
        // is "requested" and enters Pending Confirmation instead of direct checkout.
        const collectKey = scope?.querySelector(".collect-date-option.is-selected")?.dataset.collect || "standard7";
        const collectSurcharge = ({ standard7: 0, normal: 0.30, quick3: 0.40, rush2: 0.50, next: 0.80 })[collectKey] || 0;
        const collectRequest = collectSurcharge > 0;
        const tierIndex = { agent: 0, silver: 1, gold: 2, diamond: 3 };
        prices.forEach((price) => {
          const tier = price.dataset.agentTier || "agent";
          let total;
          if ((is3dPrinter || isBacklit || isFrontBacklit || isAluChannel || isStainless || isEgFrontlit || isEgBacklit || isEgBacklitAcrylic) && tier in tierIndex) {
            total = unitTiers[tierIndex[tier]] * quantity;
          } else {
            const multiplier = Number.parseFloat(price.dataset.agentMultiplier || "1") || 1;
            total = unit * quantity * multiplier;
          }
          if (collectSurcharge) total *= (1 + collectSurcharge);
          price.textContent = "RM " + total.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        });
        // RGB LED is not auto-priced — it's a manual quotation. When it's the
        // selected LED colour, hide the tier prices, show the "contact sales"
        // note, and block Add to Cart (relabelled). Any other colour restores
        // the normal priced view with the terms checkbox gating the button.
        // Backlit stainless has no listed price above 80cm — quote it too.
        const quoteMode = ledColor === "RGB" || (isStainlessBacklit && stainlessOverSize) || ((isEgBacklit || isEgBacklitAcrylic) && egOverSize);
        panel.classList.toggle("is-rgb-quote", quoteMode);
        // Express collect dates keep the (surcharged) price visible but the order
        // must be requested and confirmed — flag it as a Pending Confirmation.
        const pendingRequest = collectRequest && !quoteMode;
        panel.classList.toggle("is-pending-request", pendingRequest);
        const pendingNote = panel.querySelector(".order-pending-note");
        if (pendingNote && pendingRequest) {
          // No percentage shown to the customer; the surcharge is already in the price.
          const cdLabel = selectedCollectDate(scope).split(" ").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
          pendingNote.textContent = "Express " + cdLabel + " is subject to company approval. Approved orders will proceed to Processing; otherwise, the order will be cancelled and notification will be provided.";
        }
        const addBtn = panel.querySelector(".order-add-button");
        if (addBtn) {
          // Artwork upload is mandatory before an order can be added to cart.
          const uploaded = !!(window.__SF_ARTWORK && window.__SF_ARTWORK.url);
          if (quoteMode) {
            addBtn.disabled = true;
            addBtn.textContent = "REQUEST QUOTATION";
          } else if (!uploaded) {
            addBtn.textContent = "UPLOAD ARTWORK FIRST";
            addBtn.disabled = true;
          } else {
            addBtn.textContent = "ADD TO CART";
            const terms = panel.querySelector(".order-terms-checkbox");
            addBtn.disabled = !(terms && terms.checked);
          }
        }
      };
      // Which Add-to-Cart button opened the express-request review popup, so the
      // modal's Submit button can complete that same add once confirmed.
      let pendingRequestButton = null;
      const showRequestModal = (button, card) => {
        const modal = document.querySelector(".request-modal");
        if (!modal) { button.dataset.reviewOk = "1"; button.click(); return; }
        const collectEl = card && card.querySelector(".collect-date-option.is-selected span");
        const collectLabel = collectEl ? collectEl.textContent.trim() : "this express date";
        const body = modal.querySelector(".request-modal-body");
        if (body) body.textContent = "You picked " + collectLabel + ". This is a special request: our team will review whether we can make it in time. If we can, your order goes straight to Processing. If we cannot, it is cancelled and you are notified. Until then the status is Pending Confirmation.";
        pendingRequestButton = button;
        modal.classList.add("is-open");
        // The modal is fixed inside a tall auto-height iframe, so a plain centre
        // can land off-screen when the customer has scrolled down. Anchor the
        // card to the button they just clicked so it opens right where they are.
        const dialog = modal.querySelector(".request-modal-card");
        const rect = button.getBoundingClientRect();
        if (dialog) {
          const h = dialog.offsetHeight || 220;
          dialog.style.position = "fixed";
          dialog.style.left = "50%";
          dialog.style.transform = "translateX(-50%)";
          dialog.style.top = Math.max(16, rect.top + rect.height / 2 - h / 2) + "px";
        }
      };
      // Draft Paper confirm: when the customer adds to cart without a draft paper
      // file, ask them to confirm (Yes = add anyway, No = go back and upload).
      let pendingDraftButton = null;
      const showDraftConfirm = (button) => {
        const modal = document.querySelector(".draft-modal");
        if (!modal) { button.dataset.draftOk = "1"; button.click(); return; }
        pendingDraftButton = button;
        modal.classList.add("is-open");
        const dialog = modal.querySelector(".draft-modal-card");
        const rect = button.getBoundingClientRect();
        if (dialog) {
          const h = dialog.offsetHeight || 200;
          dialog.style.position = "fixed";
          dialog.style.left = "50%";
          dialog.style.transform = "translateX(-50%)";
          dialog.style.top = Math.max(16, rect.top + rect.height / 2 - h / 2) + "px";
        }
      };
      const toggleRecordSelection = (panel, item) => {
        if (!panel || !item) return;
        if (item.dataset.groupChildren && !item.classList.contains("is-selected")) {
          panel.querySelectorAll(".letter-dimension-item.is-selected").forEach((selected) => selected.classList.remove("is-selected"));
          item.classList.add("is-selected");
        } else {
          item.classList.toggle("is-selected");
        }
        syncGroupButtons(panel);
        syncSelectedPreviewFrames(panel);
        syncOrderPanel(panel.closest(".result, .design-card")?.querySelector(".order-panel"));
        syncItemCraftPanel(panel.closest(".result, .design-card"));
        if (modalContext && modalContext.panel === panel) syncModalFrames();
      };
      let draggingFrame = null;
      let modalContext = null;
      let modalMarquee = null;
      let mainMarquee = null;
      let suppressNextPreviewOpen = false;
      const modalImageMargins = previewImageMargins;
      const placeModalBox = (workspace, image, data, box) => {
        const elBox = image.getBoundingClientRect();
        const workspaceBox = workspace.getBoundingClientRect();
        // The modal image uses object-fit: contain, so the actual rendered picture
        // is letterboxed inside the <img> element box. Compute that real rect so the
        // selection frames line up with the visible content (not the element box).
        const natRatio = image.naturalWidth / Math.max(1, image.naturalHeight);
        const elRatio = elBox.width / Math.max(1, elBox.height);
        let renderW, renderH, offX, offY;
        if (natRatio > elRatio) {
          renderW = elBox.width;
          renderH = elBox.width / natRatio;
          offX = 0;
          offY = (elBox.height - renderH) / 2;
        } else {
          renderH = elBox.height;
          renderW = elBox.height * natRatio;
          offY = 0;
          offX = (elBox.width - renderW) / 2;
        }
        const imgLeft = elBox.left + offX;
        const imgTop = elBox.top + offY;
        const contentWidth = Math.max(1, image.naturalWidth - modalImageMargins.left - modalImageMargins.right);
        const contentHeight = Math.max(1, image.naturalHeight - modalImageMargins.top - modalImageMargins.bottom);
        const left = imgLeft - workspaceBox.left + ((modalImageMargins.left + data.left * contentWidth) / image.naturalWidth) * renderW;
        const top = imgTop - workspaceBox.top + ((modalImageMargins.top + data.top * contentHeight) / image.naturalHeight) * renderH;
        const width = (data.width * contentWidth / image.naturalWidth) * renderW;
        const height = (data.height * contentHeight / image.naturalHeight) * renderH;
        box.style.left = left + "px";
        box.style.top = top + "px";
        box.style.width = Math.max(8, width) + "px";
        box.style.height = Math.max(8, height) + "px";
      };
      const rectsIntersect = (a, b) => a.left <= b.right && a.right >= b.left && a.top <= b.bottom && a.bottom >= b.top;
      const syncModalGroupButton = () => {
        const modal = document.querySelector(".image-modal");
        const button = modal && modal.querySelector(".modal-group-button");
        const deleteButton = modal && modal.querySelector(".modal-delete-button");
        const undoButton = modal && modal.querySelector(".modal-undo-button");
        if (!button || !modalContext) return;
        const selected = selectedItems(modalContext.panel);
        const selectedGrouped = selected.filter((item) => item.dataset.groupChildren);
        button.textContent = selectedGrouped.length >= 1 ? "Ungroup" : "Group";
        button.disabled = selectedGrouped.length < 1 && selected.length < 2;
        if (deleteButton) deleteButton.disabled = selected.length < 1;
        if (undoButton) undoButton.disabled = getUndoStack(modalContext.panel).length < 1;
      };
      const syncModalFrames = () => {
        if (!modalContext) return;
        const { modal, panel } = modalContext;
        const workspace = modal.querySelector(".modal-workspace");
        const image = workspace && workspace.querySelector("img");
        if (!workspace || !image || !image.naturalWidth || !image.naturalHeight) return;
        workspace.querySelectorAll(".modal-record-hitbox, .modal-selection-box, .modal-group-highlight, .modal-deleted-marker").forEach((box) => box.remove());
        getDeletedItems(panel).forEach((deleted) => {
          if (!deleted.highlight) return;
          const box = document.createElement("div");
          box.className = "modal-deleted-marker";
          workspace.appendChild(box);
          placeModalBox(workspace, image, deleted.highlight, box);
        });
        panel.querySelectorAll(".letter-dimension-item").forEach((item) => {
          if (!item.dataset.highlight || !item.dataset.recordId) return;
          try {
            const data = JSON.parse(item.dataset.highlight);
            const hitbox = document.createElement("div");
            hitbox.className = "modal-record-hitbox" + (item.classList.contains("is-selected") ? " is-selected" : "");
            hitbox.dataset.recordId = item.dataset.recordId;
            workspace.appendChild(hitbox);
            placeModalBox(workspace, image, data, hitbox);
          } catch (_error) {}
        });
        const items = selectedItems(panel).filter((item) => item.dataset.highlight);
        items.forEach((item) => {
          try {
            const data = JSON.parse(item.dataset.highlight);
            const box = document.createElement("div");
            box.className = "modal-selection-box";
            workspace.appendChild(box);
            placeModalBox(workspace, image, data, box);
          } catch (_error) {}
        });
        if (items.length >= 2) {
          const data = unionRect(items, "highlight");
          if (data) {
            const box = document.createElement("div");
            box.className = "modal-group-highlight";
            workspace.appendChild(box);
            placeModalBox(workspace, image, data, box);
          }
        }
        syncModalGroupButton();
      };
      const openInteractiveModal = (previewImage) => {
        const modal = document.querySelector(".image-modal");
        if (!modal) return;
        const scope = previewImage.closest(".result, .design-body");
        const panel = scope && scope.querySelector(".letter-dimensions");
        modalContext = { modal, panel };
        const image = modal.querySelector(".modal-workspace img");
        modal.classList.remove("is-simple");
        modal.querySelector(".modal-action-bar")?.removeAttribute("hidden");
        image.src = previewImage.src;
        image.alt = previewImage.alt || "Preview";
        placeModalInViewport(modal);
        modal.classList.add("is-open");
        if (image.complete) syncModalFrames();
        image.onload = syncModalFrames;
      };
      const previewDeltaToDataDelta = (preview, image, dx, dy) => {
        const contentWidth = Math.max(1, image.naturalWidth - previewImageMargins.left - previewImageMargins.right);
        const contentHeight = Math.max(1, image.naturalHeight - previewImageMargins.top - previewImageMargins.bottom);
        return {
          left: dx / Math.max(1, image.getBoundingClientRect().width) * image.naturalWidth / contentWidth,
          top: dy / Math.max(1, image.getBoundingClientRect().height) * image.naturalHeight / contentHeight,
        };
      };
      const moveRecordItem = (item, dx, dy) => {
        if (!item || !item.dataset.highlight || !item.dataset.bbox) return;
        const scope = item.closest(".result, .design-body");
        const preview = scope && scope.querySelector(".dimension-preview");
        const image = preview && preview.querySelector("img");
        if (!preview || !image) return;
        let highlight;
        let bbox;
        try {
          highlight = JSON.parse(item.dataset.highlight);
          bbox = JSON.parse(item.dataset.bbox);
        } catch (_error) {
          return;
        }
        const delta = previewDeltaToDataDelta(preview, image, dx, dy);
        highlight.left += delta.left;
        highlight.top += delta.top;
        bbox.x += delta.left * (image.naturalWidth - previewImageMargins.left - previewImageMargins.right) / image.naturalWidth * Number(scope.querySelector(".preview-total strong")?.textContent?.match(/([0-9.]+)\s*in/)?.[1] || 0);
        bbox.y += delta.top * (image.naturalHeight - previewImageMargins.top - previewImageMargins.bottom) / image.naturalHeight * Number(scope.querySelector(".preview-total strong")?.textContent?.match(/x\s*([0-9.]+)\s*in/)?.[1] || 0);
        item.dataset.highlight = JSON.stringify(highlight);
        item.dataset.bbox = JSON.stringify(bbox);
      };
      const unionRect = (items, key) => {
        const boxes = items.map((item) => {
          try {
            return JSON.parse(item.dataset[key] || "null");
          } catch (_error) {
            return null;
          }
        }).filter(Boolean);
        if (!boxes.length) return null;
        const left = Math.min(...boxes.map((box) => box.x ?? box.left ?? 0));
        const top = Math.min(...boxes.map((box) => box.y ?? box.top ?? 0));
        const right = Math.max(...boxes.map((box) => (box.x ?? box.left ?? 0) + (box.width ?? 0)));
        const bottom = Math.max(...boxes.map((box) => (box.y ?? box.top ?? 0) + (box.height ?? 0)));
        return { left, top, width: right - left, height: bottom - top };
      };
      const nextLogoLabel = (panel) => {
        const nums = Array.from(panel.querySelectorAll(".letter-dimension-item strong"))
          .map((node) => /Logo\s+(\d+)/i.exec(node.textContent || ""))
          .filter(Boolean)
          .map((match) => Number(match[1]));
        return "Logo " + (Math.max(0, ...nums) + 1);
      };
      const renumberTitle = (panel) => {
        const title = panel.querySelector(".record-count");
        if (title) title.textContent = panel.querySelectorAll(".letter-dimension-item").length.toString();
      };
      const deleteSelectedRecords = (button) => {
        const panel = button.closest(".letter-dimensions");
        if (!panel) return;
        const items = selectedItems(panel);
        if (!items.length) return;
        const deletedItems = getDeletedItems(panel);
        const removed = items.map((item) => ({
          html: (() => {
            const clone = item.cloneNode(true);
            clone.classList.remove("is-selected");
            return clone.outerHTML;
          })(),
          nextRecordId: item.nextElementSibling?.dataset?.recordId || "",
          highlight: (() => {
            try {
              return JSON.parse(item.dataset.highlight || "null");
            } catch (_error) {
              return null;
            }
          })(),
        }));
        setDeletedItems(panel, deletedItems.concat(removed.map((item) => ({ highlight: item.highlight })).filter((item) => item.highlight)));
        const undoStack = getUndoStack(panel);
        undoStack.push({ type: "delete", items: removed });
        setUndoStack(panel, undoStack.slice(-20));
        items.forEach((item) => item.remove());
        renumberTitle(panel);
        syncGroupButtons(panel);
        syncSelectedPreviewFrames(panel);
        syncOrderPanel(panel.closest(".result, .design-card")?.querySelector(".order-panel"));
        syncItemCraftPanel(panel.closest(".result, .design-card"));
        if (modalContext && modalContext.panel === panel) syncModalFrames();
      };
      const undoLastAction = (button) => {
        const panel = button.closest(".letter-dimensions");
        const list = panel && panel.querySelector(".letter-dimension-list");
        if (!panel || !list) return;
        const undoStack = getUndoStack(panel);
        const action = undoStack.pop();
        if (!action) return;
        if (action.type === "delete") {
          const deletedItems = getDeletedItems(panel);
          const restoredHighlights = [];
          action.items.forEach((entry) => {
            const wrapper = document.createElement("div");
            wrapper.innerHTML = entry.html || "";
            const item = wrapper.firstElementChild;
            if (!item) return;
            item.classList.remove("is-selected");
            const next = entry.nextRecordId ? itemByRecordId(panel, entry.nextRecordId) : null;
            list.insertBefore(item, next || null);
            if (entry.highlight) restoredHighlights.push(JSON.stringify(entry.highlight));
          });
          const restoredSet = new Set(restoredHighlights);
          setDeletedItems(panel, deletedItems.filter((item) => !item.highlight || !restoredSet.has(JSON.stringify(item.highlight))));
        }
        setUndoStack(panel, undoStack);
        renumberTitle(panel);
        syncGroupButtons(panel);
        syncSelectedPreviewFrames(panel);
        syncOrderPanel(panel.closest(".result, .design-card")?.querySelector(".order-panel"));
        syncItemCraftPanel(panel.closest(".result, .design-card"));
        if (modalContext && modalContext.panel === panel) syncModalFrames();
      };
      const ungroupSelectedRecord = (button) => {
        const panel = button.closest(".letter-dimensions");
        const list = panel && panel.querySelector(".letter-dimension-list");
        const group = panel && selectedItems(panel).find((item) => item.dataset.groupChildren);
        if (!panel || !list || !group) return;
        let children = [];
        try {
          children = JSON.parse(group.dataset.groupChildren || "[]");
        } catch (_error) {
          children = [];
        }
        if (!children.length) return;
        const restored = children.map((html) => {
          const wrapper = document.createElement("div");
          wrapper.innerHTML = html;
          const item = wrapper.firstElementChild;
          if (item) item.classList.remove("is-selected");
          return item;
        }).filter(Boolean);
        restored.forEach((item) => list.insertBefore(item, group));
        group.remove();
        renumberTitle(panel);
        syncGroupButtons(panel);
        syncSelectedPreviewFrames(panel);
        syncOrderPanel(panel.closest(".result, .design-card")?.querySelector(".order-panel"));
        syncItemCraftPanel(panel.closest(".result, .design-card"));
        if (modalContext && modalContext.panel === panel) syncModalFrames();
      };
      const groupSelectedRecords = (button) => {
        const panel = button.closest(".letter-dimensions");
        const list = panel && panel.querySelector(".letter-dimension-list");
        if (!panel || !list) return;
        const items = selectedItems(panel);
        if (items.length < 2) return;
        const bbox = unionRect(items, "bbox");
        const highlight = unionRect(items, "highlight");
        if (!bbox) return;
        const label = nextLogoLabel(panel);
        const width = Math.max(0, bbox.width);
        const height = Math.max(0, bbox.height);
        const warning = false;
        const previews = items.slice(0, 6).map((item) => {
          const img = item.querySelector(".letter-item-preview img");
          return img ? '<img src="' + img.src + '" alt="">' : "";
        }).join("");
        const preview = '<span class="group-preview-stack">' + previews + '</span>';
        const group = document.createElement("div");
        group.className = "letter-dimension-item is-selected" + (warning ? " is-led-warning" : "");
        group.dataset.recordId = "group-" + Date.now().toString(36) + "-" + Math.round(Math.random() * 100000).toString(36);
        group.dataset.groupChildren = JSON.stringify(items.map((item) => {
          const clone = item.cloneNode(true);
          clone.classList.remove("is-selected");
          return clone.outerHTML;
        }));
        group.dataset.bbox = JSON.stringify({ x: bbox.left, y: bbox.top, width, height });
        if (highlight) group.dataset.highlight = JSON.stringify(highlight);
        group.innerHTML = '<span class="letter-item-preview">' + preview + '<strong>' + label + '</strong></span><span class="letter-dimension-size"><span>' + width.toFixed(2) + ' in x ' + height.toFixed(2) + ' in</span><strong class="letter-item-price">RM 0.00</strong></span>';
        list.insertBefore(group, items[0]);
        items.forEach((item) => item.remove());
        panel.querySelectorAll(".letter-dimension-item.is-selected").forEach((item) => {
          if (item !== group) item.classList.remove("is-selected");
        });
        renumberTitle(panel);
        syncGroupButtons(panel);
        syncSelectedPreviewFrames(panel);
        syncOrderPanel(panel.closest(".result, .design-card")?.querySelector(".order-panel"));
        syncItemCraftPanel(panel.closest(".result, .design-card"));
        if (modalContext && modalContext.panel === panel) syncModalFrames();
      };
      window.addEventListener("mouseover", (event) => {
        const item = event.target.closest(".letter-dimension-item");
        if (item) showDimensionHighlight(item);
      });
      window.addEventListener("mouseout", (event) => {
        const item = event.target.closest(".letter-dimension-item");
        if (!item || (event.relatedTarget && item.contains(event.relatedTarget))) return;
        hideDimensionHighlight(item.closest(".result, .design-body"));
      });
      window.addEventListener("click", (event) => {
        const dimZoom = event.target.closest(".dimension-zoom-button");
        if (dimZoom) {
          const img = dimZoom.closest(".dimension-preview")?.querySelector("img");
          if (img && img.src) openInteractiveModal(img);
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        const previewImage = event.target.closest(".preview img");
        if (previewImage) {
          if (suppressNextPreviewOpen) {
            suppressNextPreviewOpen = false;
            return;
          }
          // The Original preview is view-only: zoom, but never selectable.
          if (previewImage.closest(".original-preview")) {
            openSimpleImageModal(previewImage.currentSrc || previewImage.src || previewImage.dataset.src, previewImage.alt || "Original artwork");
          } else {
            openInteractiveModal(previewImage);
          }
          return;
        }
        const modalClose = event.target.closest(".modal-close");
        if (modalClose || event.target.classList.contains("image-modal")) {
          const modal = document.querySelector(".image-modal");
          if (modal) modal.classList.remove("is-open");
          modal?.classList.remove("is-simple");
          modal?.querySelector(".modal-action-bar")?.removeAttribute("hidden");
          setParentScrollLock(false);
          modalContext = null;
          return;
        }
        const zoomButton = event.target.closest(".image-zoom-button");
        if (zoomButton) {
          let zoomSrc = zoomButton.dataset.zoomSrc;
          if (!zoomSrc) {
            const im = zoomButton.closest(".preview")?.querySelector("img");
            zoomSrc = im && (im.currentSrc || im.src || im.dataset.src);
          }
          openSimpleImageModal(zoomSrc, zoomButton.dataset.zoomAlt);
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        const modalButton = event.target.closest(".modal-group-button");
        if (modalButton && modalContext) {
          const selected = selectedItems(modalContext.panel);
          if (selected.some((item) => item.dataset.groupChildren)) {
            ungroupSelectedRecord(modalContext.panel.querySelector(".group-selected-button"));
          } else if (selected.length >= 2) {
            groupSelectedRecords(modalContext.panel.querySelector(".group-selected-button"));
          }
          syncModalFrames();
          return;
        }
        const modalDeleteButton = event.target.closest(".modal-delete-button");
        if (modalDeleteButton && modalContext) {
          deleteSelectedRecords(modalContext.panel.querySelector(".delete-selected-button"));
          syncModalFrames();
          return;
        }
        const modalUndoButton = event.target.closest(".modal-undo-button");
        if (modalUndoButton && modalContext) {
          undoLastAction(modalContext.panel.querySelector(".undo-button"));
          syncModalFrames();
          return;
        }
        const modalFrame = event.target.closest(".modal-record-hitbox");
        if (modalFrame && modalContext) {
          const item = itemByRecordId(modalContext.panel, modalFrame.dataset.recordId);
          if (item) toggleRecordSelection(modalContext.panel, item);
          return;
        }
        const closeButton = event.target.closest(".close-result");
        if (closeButton) {
          const block = closeButton.closest(".multi-result, .result, .design-card");
          if (block) block.remove();
          return;
        }
        const qtyButton = event.target.closest(".order-qty-button");
        if (qtyButton) {
          const panel = qtyButton.closest(".order-panel");
          const input = panel?.querySelector(".order-quantity");
          const current = Math.max(1, Number.parseInt(input?.value || "1", 10) || 1);
          if (input) input.value = qtyButton.dataset.qtyAction === "minus" ? Math.max(1, current - 1) : current + 1;
          syncOrderPanel(panel);
          return;
        }
        const reqConfirm = event.target.closest(".request-modal-confirm");
        if (reqConfirm) {
          const modal = reqConfirm.closest(".request-modal");
          if (modal) modal.classList.remove("is-open");
          if (pendingRequestButton) {
            const btn = pendingRequestButton;
            pendingRequestButton = null;
            btn.dataset.reviewOk = "1";
            btn.click();
          }
          return;
        }
        const reqCancel = event.target.closest(".request-modal-cancel, .request-modal-backdrop");
        if (reqCancel) {
          const modal = reqCancel.closest(".request-modal");
          if (modal) modal.classList.remove("is-open");
          pendingRequestButton = null;
          return;
        }
        const draftYes = event.target.closest(".draft-modal-yes");
        if (draftYes) {
          const modal = draftYes.closest(".draft-modal");
          if (modal) modal.classList.remove("is-open");
          if (pendingDraftButton) {
            const btn = pendingDraftButton;
            pendingDraftButton = null;
            btn.dataset.draftOk = "1";
            btn.click();
          }
          return;
        }
        const draftNo = event.target.closest(".draft-modal-no, .draft-modal-backdrop");
        if (draftNo) {
          const modal = draftNo.closest(".draft-modal");
          if (modal) modal.classList.remove("is-open");
          pendingDraftButton = null;
          return;
        }
        const orderAddButton = event.target.closest(".order-add-button");
        if (orderAddButton && !orderAddButton.disabled) {
          // Express collect dates are a special request: explain the review flow
          // in a popup first, and only add to cart once the customer confirms.
          const reqCard = orderAddButton.closest(".result, .design-card");
          const reqExpress = !!(reqCard && reqCard.querySelector(".order-panel.is-pending-request"));
          if (reqExpress && orderAddButton.dataset.reviewOk !== "1") {
            showRequestModal(orderAddButton, reqCard);
            return;
          }
          // No Draft Paper uploaded? Ask the customer to confirm first.
          const hasDraftPaper = !!(reqCard && reqCard.__sfDraftPaper && reqCard.__sfDraftPaper.url);
          if (!hasDraftPaper && orderAddButton.dataset.draftOk !== "1") {
            showDraftConfirm(orderAddButton);
            return;
          }
          orderAddButton.dataset.reviewOk = "";
          orderAddButton.dataset.draftOk = "";
          orderAddButton.textContent = "ADDED TO CART";
          setTimeout(() => { orderAddButton.textContent = "ADD TO CART"; }, 1200);
          try {
            const sbMode = (typeof window !== "undefined" && window.__SIGNBOARD_MODE__) === true;
            const card = orderAddButton.closest(".result, .design-card");
            const priceEl = card && card.querySelector(".order-total-row.is-active-agent .order-price");
            const price = priceEl ? (parseFloat(priceEl.textContent.replace("RM", "").replace(/,/g, "").trim()) || 0) : 0;
            // Capture the price at EVERY member tier [Agent, Silver, Gold, Diamond]
            // so the cart re-prices automatically when the member upgrades or
            // downgrades, instead of freezing the add-time tier price.
            const readTier = function(a){ var r = card && card.querySelector('.order-price[data-agent-tier="' + a + '"]'); return r ? (parseFloat(r.textContent.replace("RM", "").replace(/,/g, "").trim()) || 0) : price; };
            const tierPrices = ["agent", "silver", "gold", "diamond"].map(readTier);
            const qtyEl = card && card.querySelector(".order-quantity");
            const qty = qtyEl ? (parseInt(qtyEl.value, 10) || 1) : 1;
            const sizeEl = card && card.querySelector(".box-up-size-select");
            const surfaceEl = card && card.querySelector(".mounting-base-select");
            const ledEl = card && card.querySelector(".selected-led-color strong");
            const collectEl = card && card.querySelector(".collect-date-option.is-selected span");
            const collectLabel = collectEl ? collectEl.textContent.trim() : "";
            // Express dates were requested, so the order awaits sales confirmation.
            const pending = !!(card && card.querySelector(".order-panel.is-pending-request"));
            const metaParts = [];
            if (sizeEl && sizeEl.value) metaParts.push(sizeEl.value + " box up");
            if (surfaceEl && surfaceEl.value) metaParts.push(surfaceEl.value);
            if (ledEl && ledEl.textContent && ledEl.textContent.trim() !== "None") metaParts.push("LED " + ledEl.textContent.trim());
            if (collectLabel) metaParts.push(collectLabel);
            metaParts.push(qty + " pcs");
            // Attach the artwork(s): the 3D wording file plus, if uploaded, the
            // optional Draft Paper file — the admin order then shows both.
            const artworks = [];
            if (window.__SF_ARTWORK && window.__SF_ARTWORK.url) {
              artworks.push({ url: window.__SF_ARTWORK.url, name: "3D Wording - " + (window.__SF_ARTWORK.name || "artwork") });
            }
            const dp = card && card.__sfDraftPaper;
            if (dp && dp.url) {
              const scaleEl = card && card.querySelector(".draft-paper-scale-select");
              const scale = scaleEl ? scaleEl.value : "Original";
              artworks.push({ url: dp.url, name: "Draft Paper (" + scale + ") - " + (dp.name || "draft") });
              metaParts.push("Draft Paper: " + scale);
            }
            window.parent.postMessage({
              type: "sign-cart-add",
              item: {
                label: sbMode ? "3D Signboard" : "3D LED Box Up",
                href: sbMode ? "/3d-signboard" : "/3d-box-up",
                price: price,
                tierPrices: tierPrices,
                meta: metaParts.join(", "),
                image: "/3d-box-up/hero.png",
                artworks: artworks.length ? artworks : undefined,
                status: pending ? "Pending Confirmation" : undefined,
              },
            }, window.location.origin);
          } catch (e) {}
          return;
        }
        const dateOption = event.target.closest(".collect-date-option");
        if (dateOption) {
          if (dateOption.classList.contains("is-disabled")) return;
          const grid = dateOption.closest(".collect-date-grid");
          if (grid) {
            grid.querySelectorAll(".collect-date-option").forEach((item) => item.classList.remove("is-selected"));
            dateOption.classList.add("is-selected");
          }
          const dateScope = dateOption.closest(".result, .design-card");
          syncCraft3D(dateScope);
          // Collect Date changes the price (express surcharge), so recompute the
          // order panel too — not just the 3D preview / spec summary.
          syncOrderPanel(dateScope?.querySelector(".order-panel"));
          return;
        }
        const specialButton = event.target.closest(".special-finishing-button");
        if (specialButton && !specialButton.disabled) {
          const scope = specialButton.closest(".result, .design-card");
          setSpecialFinishingMode(scope, scope?.dataset.specialFinishingMode !== "1");
          syncGroupButtons(scope?.querySelector(".letter-dimensions") || scope);
          return;
        }
        const itemCraftDone = event.target.closest(".item-craft-done");
        if (itemCraftDone) {
          const scope = itemCraftDone.closest(".result, .design-card");
          setSpecialFinishingMode(scope, false);
          return;
        }
        const groupButton = event.target.closest(".group-selected-button");
        if (groupButton) {
          const panel = groupButton.closest(".letter-dimensions");
          const selected = selectedItems(panel);
          if (selected.some((item) => item.dataset.groupChildren)) {
            ungroupSelectedRecord(groupButton);
            return;
          }
          if (selectedItems(panel).length >= 2) {
            groupSelectedRecords(groupButton);
          }
          return;
        }
        const deleteButton = event.target.closest(".delete-selected-button");
        if (deleteButton) {
          deleteSelectedRecords(deleteButton);
          return;
        }
        const undoButton = event.target.closest(".undo-button");
        if (undoButton) {
          undoLastAction(undoButton);
          return;
        }
        const recordFrame = event.target.closest(".dimension-record-hitbox");
        if (recordFrame) {
          const scope = recordFrame.closest(".result, .design-body");
          const panel = scope && scope.querySelector(".letter-dimensions");
          const item = itemByRecordId(panel, recordFrame.dataset.recordId);
          if (item) toggleRecordSelection(panel, item);
          return;
        }
        const recordItem = event.target.closest(".letter-dimension-item");
        if (recordItem) {
          const panel = recordItem.closest(".letter-dimensions");
          toggleRecordSelection(panel, recordItem);
          return;
        }
        const ledOption = event.target.closest(".led-color-option");
        if (ledOption) {
          const panel = ledOption.closest(".led-color-panel");
          if (!panel) return;
          panel.querySelectorAll(".led-color-option").forEach((item) => item.classList.toggle("is-selected", item === ledOption));
          const selected = panel.querySelector(".selected-led-color strong");
          if (selected) selected.textContent = ledOption.dataset.ledColor || "None";
          const scope = ledOption.closest(".result, .design-card");
          syncCraft3D(scope);
          syncOrderPanel(scope?.querySelector(".order-panel"));
          window.updateCraftLedFace?.(scope?.querySelector(".craft-3d-preview"));
          return;
        }
        const sideFinishingOption = event.target.closest(".side-finishing-option");
        if (sideFinishingOption) {
          const panel = sideFinishingOption.closest(".side-finishing-panel");
          if (!panel) return;
          panel.querySelectorAll(".side-finishing-option").forEach((item) => item.classList.toggle("is-selected", item === sideFinishingOption));
          const selected = panel.querySelector(".selected-side-finishing strong");
          if (selected) selected.textContent = sideFinishingOption.dataset.sideFinishing || "Option 1";
          syncCraft3D(sideFinishingOption.closest(".result, .design-card"));
          return;
        }
        const sideFilamentOption = event.target.closest(".side-filament-option");
        if (sideFilamentOption && !sideFilamentOption.disabled) {
          const row = sideFilamentOption.closest(".side-segment-card");
          if (!row) return;
          row.querySelectorAll(".side-filament-option").forEach((item) => item.classList.toggle("is-selected", item === sideFilamentOption));
          const select = row.querySelector(".side-filament-select");
          if (select) select.value = sideFilamentOption.dataset.sideColor || "White";
          const scope = sideFilamentOption.closest(".result, .design-card");
          syncMirroredSideColor(scope);
          syncCraft3D(scope);
          return;
        }
        const option = event.target.closest(".color-option");
        if (!option) return;
        const picker = option.closest(".color-picker");
        if (!picker) return;
        const scope = option.closest(".result, .design-card");
        if (scope?.dataset.specialFinishingMode === "1") {
          const color = option.dataset.color || "White";
          picker.querySelectorAll(".color-option").forEach((item) => item.classList.toggle("is-selected", item === option));
          const selected = picker.querySelector(".selected-color strong");
          if (selected) selected.textContent = color;
          selectedSpecialItems(scope).forEach((item) => {
            item.dataset.itemColor = color;
            syncItemCraftBadge(item);
          });
          syncOrderPanel(scope?.querySelector(".order-panel"));
          syncItemCraftPanel(scope);
          return;
        }
        picker.querySelectorAll(".color-option").forEach((item) => item.classList.toggle("is-selected", item === option));
        const selected = picker.querySelector(".selected-color strong");
        if (selected) {
          selected.textContent = option.dataset.color || "White";
        }
        syncCraft3D(option.closest(".result, .design-card"));
      });
      window.addEventListener("input", (event) => {
        const orderQuantity = event.target.closest(".order-quantity");
        if (orderQuantity) {
          syncOrderPanel(orderQuantity.closest(".order-panel"));
          return;
        }
        const sideInput = event.target.closest(".side-mm-input");
        if (sideInput) {
          syncCraft3D(sideInput.closest(".result, .design-card"));
          return;
        }
        const slider = event.target.closest("[data-glow-control]");
        if (!slider) return;
        const panel = slider.closest(".outer-glow-panel");
        const output = panel?.querySelector('[data-glow-value="' + slider.dataset.glowControl + '"]');
        if (output) output.textContent = slider.value;
        const scope = slider.closest(".result, .design-card");
        window.updateCraftLedFace?.(scope?.querySelector(".craft-3d-preview"));
      });
      window.addEventListener("change", (event) => {
        const sideSelect = event.target.closest(".side-filament-select");
        if (!sideSelect) return;
        syncCraft3D(sideSelect.closest(".result, .design-card"));
      });
      window.addEventListener("DOMContentLoaded", () => {
        syncGroupButtons();
        document.querySelectorAll(".result, .design-card").forEach(syncSideFinishingControls);
        document.querySelectorAll(".order-panel").forEach(syncOrderPanel);
        document.querySelectorAll(".result, .design-card").forEach(syncItemCraftPanel);
        document.querySelectorAll(".letter-dimensions").forEach(syncSelectedPreviewFrames);
        document.querySelectorAll(".dimension-preview img").forEach((image) => {
          image.addEventListener("load", () => {
            const scope = image.closest(".result, .design-body");
            const panel = scope && scope.querySelector(".letter-dimensions");
            if (panel) syncSelectedPreviewFrames(panel);
          });
        });
      });
      window.addEventListener("resize", () => document.querySelectorAll(".letter-dimensions").forEach(syncSelectedPreviewFrames));
      window.addEventListener("pointerdown", (event) => {
        const modalWorkspace = event.target.closest(".modal-workspace");
        if (modalWorkspace && modalContext && !event.target.closest(".modal-record-hitbox")) {
          const box = modalWorkspace.getBoundingClientRect();
          modalMarquee = {
            workspace: modalWorkspace,
            x: event.clientX - box.left,
            y: event.clientY - box.top,
            currentX: event.clientX - box.left,
            currentY: event.clientY - box.top,
            moved: false,
          };
          let marquee = modalWorkspace.querySelector(".modal-marquee");
          if (!marquee) {
            marquee = document.createElement("div");
            marquee.className = "modal-marquee";
            modalWorkspace.appendChild(marquee);
          }
          marquee.style.display = "block";
          marquee.style.left = modalMarquee.x + "px";
          marquee.style.top = modalMarquee.y + "px";
          marquee.style.width = "0px";
          marquee.style.height = "0px";
          event.preventDefault();
          return;
        }
        const dimensionPreview = event.target.closest(".dimension-preview");
        if (dimensionPreview && !event.target.closest(".dimension-record-hitbox")) {
          const scope = dimensionPreview.closest(".result, .design-body");
          const panel = scope && scope.querySelector(".letter-dimensions");
          if (panel) {
            const box = dimensionPreview.getBoundingClientRect();
          mainMarquee = {
            preview: dimensionPreview,
            panel,
            x: event.clientX - box.left,
            y: event.clientY - box.top,
            currentX: event.clientX - box.left,
            currentY: event.clientY - box.top,
            moved: false,
          };
            let marquee = dimensionPreview.querySelector(".dimension-marquee");
            if (!marquee) {
              marquee = document.createElement("div");
              marquee.className = "dimension-marquee";
              dimensionPreview.appendChild(marquee);
            }
            marquee.style.display = "block";
            marquee.style.left = mainMarquee.x + "px";
            marquee.style.top = mainMarquee.y + "px";
            marquee.style.width = "0px";
            marquee.style.height = "0px";
            event.preventDefault();
            return;
          }
        }
        // Dimension Preview boxes are click-to-select ONLY. Dragging a box to move/
        // reposition it is intentionally disabled (no draggingFrame is started here).
      });
      window.addEventListener("pointermove", (event) => {
        if (mainMarquee) {
          const box = mainMarquee.preview.getBoundingClientRect();
          mainMarquee.currentX = event.clientX - box.left;
          mainMarquee.currentY = event.clientY - box.top;
          const left = Math.min(mainMarquee.x, mainMarquee.currentX);
          const top = Math.min(mainMarquee.y, mainMarquee.currentY);
          const width = Math.abs(mainMarquee.currentX - mainMarquee.x);
          const height = Math.abs(mainMarquee.currentY - mainMarquee.y);
          mainMarquee.moved = mainMarquee.moved || width > 6 || height > 6;
          const marquee = mainMarquee.preview.querySelector(".dimension-marquee");
          if (marquee) {
            marquee.style.left = left + "px";
            marquee.style.top = top + "px";
            marquee.style.width = width + "px";
            marquee.style.height = height + "px";
          }
          return;
        }
        if (modalMarquee) {
          const box = modalMarquee.workspace.getBoundingClientRect();
          modalMarquee.currentX = event.clientX - box.left;
          modalMarquee.currentY = event.clientY - box.top;
          const left = Math.min(modalMarquee.x, modalMarquee.currentX);
          const top = Math.min(modalMarquee.y, modalMarquee.currentY);
          const width = Math.abs(modalMarquee.currentX - modalMarquee.x);
          const height = Math.abs(modalMarquee.currentY - modalMarquee.y);
          modalMarquee.moved = modalMarquee.moved || width > 6 || height > 6;
          const marquee = modalMarquee.workspace.querySelector(".modal-marquee");
          if (marquee) {
            marquee.style.left = left + "px";
            marquee.style.top = top + "px";
            marquee.style.width = width + "px";
            marquee.style.height = height + "px";
          }
          return;
        }
        if (!draggingFrame) return;
        const dx = event.clientX - draggingFrame.x;
        const dy = event.clientY - draggingFrame.y;
        draggingFrame.x = event.clientX;
        draggingFrame.y = event.clientY;
        moveRecordItem(draggingFrame.item, dx, dy);
        syncSelectedPreviewFrames(draggingFrame.panel);
      });
      window.addEventListener("pointerup", () => {
        if (mainMarquee) {
          const left = Math.min(mainMarquee.x, mainMarquee.currentX);
          const top = Math.min(mainMarquee.y, mainMarquee.currentY);
          const right = Math.max(mainMarquee.x, mainMarquee.currentX);
          const bottom = Math.max(mainMarquee.y, mainMarquee.currentY);
          if (!mainMarquee.moved) {
            const previewImage = mainMarquee.preview.querySelector("img");
            const marquee = mainMarquee.preview.querySelector(".dimension-marquee");
            if (marquee) marquee.style.display = "none";
            if (selectedItems(mainMarquee.panel).length) {
              clearPanelSelection(mainMarquee.panel);
              suppressNextPreviewOpen = true;
            } else if (previewImage) {
              openInteractiveModal(previewImage);
            }
            mainMarquee = null;
            draggingFrame = null;
            return;
          }
          const selectRect = { left, top, right, bottom };
          mainMarquee.preview.querySelectorAll(".dimension-record-hitbox").forEach((box) => {
            const rect = {
              left: Number.parseFloat(box.style.left || "0"),
              top: Number.parseFloat(box.style.top || "0"),
              right: Number.parseFloat(box.style.left || "0") + Number.parseFloat(box.style.width || "0"),
              bottom: Number.parseFloat(box.style.top || "0") + Number.parseFloat(box.style.height || "0"),
            };
            if (rectsIntersect(selectRect, rect)) {
              const item = itemByRecordId(mainMarquee.panel, box.dataset.recordId);
              if (item) item.classList.add("is-selected");
            }
          });
          const marquee = mainMarquee.preview.querySelector(".dimension-marquee");
          if (marquee) marquee.style.display = "none";
          syncGroupButtons(mainMarquee.panel);
          syncSelectedPreviewFrames(mainMarquee.panel);
          if (modalContext && modalContext.panel === mainMarquee.panel) syncModalFrames();
          suppressNextPreviewOpen = true;
          mainMarquee = null;
        }
        if (modalMarquee && modalContext) {
          const left = Math.min(modalMarquee.x, modalMarquee.currentX);
          const top = Math.min(modalMarquee.y, modalMarquee.currentY);
          const right = Math.max(modalMarquee.x, modalMarquee.currentX);
          const bottom = Math.max(modalMarquee.y, modalMarquee.currentY);
          if (!modalMarquee.moved) {
            const marquee = modalMarquee.workspace.querySelector(".modal-marquee");
            if (marquee) marquee.style.display = "none";
            clearPanelSelection(modalContext.panel);
            modalMarquee = null;
            draggingFrame = null;
            return;
          }
          const selectRect = { left, top, right, bottom };
          modalMarquee.workspace.querySelectorAll(".modal-record-hitbox").forEach((box) => {
            const rect = {
              left: Number.parseFloat(box.style.left || "0"),
              top: Number.parseFloat(box.style.top || "0"),
              right: Number.parseFloat(box.style.left || "0") + Number.parseFloat(box.style.width || "0"),
              bottom: Number.parseFloat(box.style.top || "0") + Number.parseFloat(box.style.height || "0"),
            };
            if (rectsIntersect(selectRect, rect)) {
              const item = itemByRecordId(modalContext.panel, box.dataset.recordId);
              if (item) item.classList.add("is-selected");
            }
          });
          const marquee = modalMarquee.workspace.querySelector(".modal-marquee");
          if (marquee) marquee.style.display = "none";
          syncGroupButtons(modalContext.panel);
          syncSelectedPreviewFrames(modalContext.panel);
          syncModalFrames();
          modalMarquee = null;
        }
        draggingFrame = null;
      });
      window.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
          const modal = document.querySelector(".image-modal");
          if (modal) modal.classList.remove("is-open");
          modal?.classList.remove("is-simple");
          modal?.querySelector(".modal-action-bar")?.removeAttribute("hidden");
          setParentScrollLock(false);
          modalContext = null;
        }
      });
      const loadDelayedPreviews = () => {
        document.querySelectorAll("img.delayed-preview[data-src]").forEach((image) => {
          const preview = image.closest(".preview");
          const src = image.dataset.src || "";
          // Inline data: URIs are ready immediately — appending a cache-buster
          // query would corrupt the base64, so load them directly.
          if (src.startsWith("data:")) {
            image.src = src;
            image.classList.remove("delayed-preview");
            image.style.display = "";
            if (preview) preview.classList.remove("is-loading");
            return;
          }
          let tries = 0;
          const tryLoad = async () => {
            tries += 1;
            try {
              const response = await fetch(src + "?t=" + Date.now(), { cache: "no-store" });
              if (response.ok) {
                const blob = await response.blob();
                image.src = URL.createObjectURL(blob);
                image.classList.remove("delayed-preview");
                image.style.display = "";
                if (preview) preview.classList.remove("is-loading");
                return;
              }
            } catch (error) {}
            if (tries < 45) window.setTimeout(tryLoad, 1000);
          };
          if (preview) preview.classList.add("is-loading");
          tryLoad();
        });
      };
      window.addEventListener("DOMContentLoaded", syncBaseFinishing);
      window.addEventListener("DOMContentLoaded", () => {
        enableCraft3DRotation();
        syncAllCraft3D();
      });
      window.addEventListener("DOMContentLoaded", loadDelayedPreviews);
    })();
  </script>
  <script type="importmap">
    {
      "imports": {
        "three": "/vendor/three/build/three.module.js",
        "three/addons/": "/vendor/three/examples/jsm/"
      }
    }
  </script>
  <script>
    window.addEventListener("error", (event) => {
      if (!String(event.filename || "").includes("three") && !String(event.message || "").includes("module")) return;
      document.querySelectorAll(".craft-three-loading").forEach((loader) => {
        loader.textContent = "3D renderer error. Refresh or contact support.";
      });
    }, true);
    window.addEventListener("unhandledrejection", (event) => {
      document.querySelectorAll(".craft-three-loading").forEach((loader) => {
        loader.textContent = "3D renderer error. Refresh or contact support.";
      });
      console.error(event.reason);
    });
  </script>
  <script type="module">
    import * as THREE from "three";
    import { OrbitControls } from "three/addons/controls/OrbitControls.js";
    import { SVGLoader } from "three/addons/loaders/SVGLoader.js";
    import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
    import { RectAreaLightUniformsLib } from "three/addons/lights/RectAreaLightUniformsLib.js";
    import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
    import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
    import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";

    // Lighting mode, set per product via data-lit-mode:
    //   "back" - reverse-lit: opaque face, light spills behind the letter
    //   "both" - front AND back lit: the face lights up and still throws a halo
    //   (unset) - the original front-lit behaviour, unchanged
    // BACKLIT is "is the face unlit"; HALO is "is there a glow behind it".
    // They are separate so "both" can mix a lit face with a rear halo.
    const LIT_MODE = document.body.dataset.litMode || "";
    const BACKLIT = LIT_MODE === "back";
    const HALO = LIT_MODE === "back" || LIT_MODE === "both";

    const logoSvg = await fetch("/assets/company-logo.svg", { cache: "no-store" }).then((response) => {
      if (!response.ok) throw new Error("Company logo SVG could not be loaded.");
      return response.text();
    });
    const svgLoader = new SVGLoader();
    const logoShapes = (() => {
      const data = svgLoader.parse(logoSvg);
      const shapes = [];
      data.paths.forEach((path) => shapes.push(...SVGLoader.createShapes(path)));
      return shapes;
    })();
    const craftScenes = new WeakMap();
    const filamentSideColors = {
      "White": 0xb8b2a8,
      "Translucent White": 0xcfd6c8,
      "Translucent Red": 0xc94b52,
      "Translucent Yellow": 0xd4b93a,
      "Translucent Green": 0x46b876,
      "Translucent Blue": 0x4e6fc8,
      "Translucent Orange": 0xd17832,
      "Translucent Cyclamen": 0x8b55b6,
    };

    const filamentSideColor = (filamentColor) => filamentSideColors[filamentColor] ?? filamentSideColors.White;
    const filamentGlowColor = (filamentColor) => {
      if (filamentColor === "Translucent White") return 0xf3fff0;
      return filamentSideColor(filamentColor);
    };
    // Translucent filament lets the LED light through, so its side glows with the
    // selected LED colour; with no LED it glows with the filament's own colour.
    const sideGlowHex = (filamentColor, ledColor) => {
      if (ledColor && ledColor !== "None") {
        const led = ledMaterialSettings(ledColor, false);
        if (led && led.emissive) return led.emissive;
      }
      return filamentGlowColor(filamentColor);
    };
    const isWhiteFilamentSide = (filamentColor) => !filamentColor || filamentColor === "White";
    const isTranslucentFilamentSide = (filamentColor) => /^Translucent\b/i.test(filamentColor || "");
    const tonedColor = (hex, factor) => {
      const color = new THREE.Color(hex);
      color.r *= factor;
      color.g *= factor;
      color.b *= factor;
      return color;
    };
    const getSideTotalMm = (scope) => (scope?.querySelector(".box-up-size-select")?.value || "5cm") === "3cm" ? 30 : 50;
    const clampSideMm = (value, totalMm) => Math.max(0, Math.min(totalMm, Math.round(Number(value) || 0)));
    const getSideRowColor = (row, fallback) => row?.querySelector(".side-filament-option.is-selected")?.dataset.sideColor || row?.querySelector(".side-filament-select")?.value || fallback;
    const getSideMaterialConfig = (scope) => {
      const selected = scope?.querySelector(".selected-side-finishing strong")?.textContent?.trim() || "Option 1";
      const mainColor = scope?.querySelector(".selected-color strong")?.textContent?.split(",")[0]?.trim() || "White";
      const totalMm = getSideTotalMm(scope);
      if (selected === "Option 2") {
        const rows = Array.from(scope.querySelectorAll('.side-finishing-config[data-config-for="Option 2"] .side-segment-card'));
        const first = clampSideMm(rows[0]?.querySelector(".side-mm-input")?.value || Math.round(totalMm / 2), totalMm);
        const colors = rows.map((row) => getSideRowColor(row, mainColor));
        return { colors: [colors[0] || mainColor, colors[1] || mainColor], weights: [first, totalMm - first] };
      }
      if (selected === "Option 3") {
        const mmRows = Array.from(scope.querySelectorAll('.side-finishing-config[data-config-for="Option 3"] .side-segment-card'));
        const colors = mmRows.map((row) => getSideRowColor(row, mainColor));
        const maxEdge = Math.floor(totalMm / 2);
        const edge = Math.min(maxEdge, clampSideMm(mmRows[0]?.querySelector(".side-mm-input")?.value || Math.round(totalMm / 3), maxEdge));
        return {
          colors: [colors[0] || mainColor, colors[1] || mainColor, colors[0] || mainColor],
          weights: [edge, Math.max(0, totalMm - edge * 2), edge],
        };
      }
      return { colors: [mainColor], weights: [1] };
    };
    const segmentIndexForZ = (z, frontZ, backZ, weights) => {
      const depth = Math.max(0.0001, frontZ - backZ);
      const fromFront = Math.max(0, Math.min(depth, frontZ - z));
      const total = weights.reduce((sum, weight) => sum + Math.max(0, weight || 0), 0) || weights.length || 1;
      let cursor = 0;
      let lastPositiveIndex = 0;
      for (let index = 0; index < weights.length; index += 1) {
        const weight = Math.max(0, weights[index] || 0);
        if (weight <= 0) continue;
        lastPositiveIndex = index;
        cursor += depth * (weight / total);
        if (fromFront <= cursor || index === weights.length - 1) return index;
      }
      return lastPositiveIndex;
    };
    const extrusionStepCount = (sideConfig) => {
      const weights = sideConfig?.weights?.length ? sideConfig.weights : [1];
      const total = weights.reduce((sum, weight) => sum + Math.max(0, Math.round(weight || 0)), 0);
      return Math.max(1, Math.min(96, total || 1));
    };
    const hasTranslucentSide = (sideConfig) => (sideConfig?.colors || []).some(isTranslucentFilamentSide);

    const getStageSize = (stage) => {
      const rect = stage.getBoundingClientRect();
      return {
        width: Math.max(320, Math.floor(rect.width || 640)),
        height: Math.max(260, Math.floor(rect.height || 460)),
      };
    };

    const disposeObject = (object) => {
      object.traverse((child) => {
        if (child.geometry) child.geometry.dispose();
        if (Array.isArray(child.material)) child.material.forEach((material) => material.dispose());
        else if (child.material) child.material.dispose();
      });
    };

    const ledMaterialSettings = (ledColor, isBlack) => {
      // A black face normally means "no light escapes". Reverse-lit signs are
      // the exception: the panel is black *and* the LED still lights the wall
      // behind it, so the colour table must still be consulted.
      if ((isBlack && !BACKLIT) || ledColor === "None") {
        return { color: isBlack ? 0x101217 : 0xffffff, emissive: 0x000000, intensity: 0, coreOpacity: 0, bloomOpacity: 0, lightIntensity: 0, bloomStrength: 0, bloomRadius: 0.55, bloomThreshold: 0.1 };
      }
      const settings = {
        "3000K": { color: 0xfff2c4, emissive: 0xffb35c, intensity: 3.85, coreOpacity: 0.18, bloomOpacity: 0.42, lightIntensity: 0.9, bloomStrength: 0.72, bloomRadius: 0.38, bloomThreshold: 0.32, opacity: 0.96, transmission: 0.2, thickness: 0.62, attenuationColor: 0xffd89a, attenuationDistance: 1.15 },
        "4000K": { color: 0xfff8e8, emissive: 0xfff1d0, intensity: 3.8, coreOpacity: 0.18, bloomOpacity: 0.42, lightIntensity: 0.82, bloomStrength: 0.7, bloomRadius: 0.36, bloomThreshold: 0.32 },
        "10000K": { color: 0xe8f6ff, emissive: 0x8fd8ff, intensity: 3.9, coreOpacity: 0.18, bloomOpacity: 0.44, lightIntensity: 0.9, bloomStrength: 0.76, bloomRadius: 0.38, bloomThreshold: 0.3 },
        "RGB": { color: 0xff3366, emissive: 0xff0044, intensity: 3.95, coreOpacity: 0.2, bloomOpacity: 0.5, lightIntensity: 1.0, bloomStrength: 0.85, bloomRadius: 0.42, bloomThreshold: 0.24 },
      };
      return settings[ledColor] || { color: 0xffffff, emissive: 0x000000, intensity: 0, coreOpacity: 0, bloomOpacity: 0, lightIntensity: 0, bloomStrength: 0, bloomRadius: 0.55, bloomThreshold: 0.1 };
    };

    const renderCraftScene = (state) => {
      if (state.composer) state.composer.render();
      else state.renderer.render(state.scene, state.camera);
    };

    const createAcrylicFaceMaterial = (ledColor, isBlack, isUvPrinting = false) => {
      const led = ledMaterialSettings(ledColor, isBlack);
      const enabled = !isBlack && ledColor !== "None";
      return new THREE.ShaderMaterial({
        uniforms: {
          baseColor: { value: new THREE.Color(isBlack ? 0x000000 : led.color) },
          glowColor: { value: new THREE.Color(led.emissive || 0x000000) },
          ledPower: { value: enabled ? Math.min(1.45, Math.max(0.25, led.intensity / 2.4)) : 0 },
          acrylicOpacity: { value: enabled ? 0.96 : 1 },
          blackMode: { value: isBlack ? 1 : 0 },
          uvPrintMode: { value: isUvPrinting ? 1 : 0 },
          boundsMin: { value: new THREE.Vector2(-1, -1) },
          boundsMax: { value: new THREE.Vector2(1, 1) },
        },
        vertexShader: [
          "varying vec3 vLocalPosition;",
          "varying vec3 vNormalView;",
          "void main() {",
          "  vLocalPosition = position;",
          "  vNormalView = normalize(normalMatrix * normal);",
          "  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);",
          "}",
        ].join("\\n"),
        fragmentShader: [
          "uniform vec3 baseColor;",
          "uniform vec3 glowColor;",
          "uniform float ledPower;",
          "uniform float acrylicOpacity;",
          "uniform float blackMode;",
          "uniform float uvPrintMode;",
          "uniform vec2 boundsMin;",
          "uniform vec2 boundsMax;",
          "varying vec3 vLocalPosition;",
          "varying vec3 vNormalView;",
          "void main() {",
          "  vec2 size = max(boundsMax - boundsMin, vec2(0.0001));",
          "  vec2 uv = clamp((vLocalPosition.xy - boundsMin) / size, 0.0, 1.0);",
          "  float center = 1.0 - smoothstep(0.0, 0.72, distance(uv, vec2(0.5)));",
          "  float faceAngle = pow(abs(vNormalView.z), 0.18);",
          "  if (blackMode > 0.5) {",
          "    vec3 blackAcrylic = baseColor + vec3(0.006, 0.007, 0.009) * faceAngle;",
          "    gl_FragColor = vec4(blackAcrylic, 1.0);",
          "    return;",
          "  }",
          "  if (uvPrintMode > 0.5) {",
          "    vec3 purpleA = vec3(0.45, 0.16, 0.78);",
          "    vec3 purpleB = vec3(0.58, 0.25, 0.86);",
          "    float softSweep = smoothstep(0.04, 0.96, uv.x);",
          "    float softGlow = smoothstep(0.12, 0.82, 1.0 - distance(uv, vec2(0.32, 0.72)));",
          "    vec3 printColor = mix(purpleA, purpleB, softSweep * 0.72 + softGlow * 0.14);",
          "    printColor *= 0.96 + faceAngle * 0.06;",
          "    gl_FragColor = vec4(printColor, 1.0);",
          "    return;",
          "  }",
          "  float milk = ledPower * (0.08 + center * 0.1);",
          "  vec3 warmWhite = mix(baseColor, vec3(1.0, 0.92, 0.72), 0.22 + center * 0.16);",
          "  vec3 acrylic = mix(warmWhite, glowColor, milk);",
          "  acrylic += warmWhite * ledPower * (0.36 + center * 0.32);",
          "  acrylic += glowColor * ledPower * (0.06 + center * 0.08);",
          "  acrylic *= 0.96 + faceAngle * 0.08;",
          "  gl_FragColor = vec4(acrylic, acrylicOpacity);",
          "}",
        ].join("\\n"),
        transparent: false,
        depthWrite: true,
        side: THREE.DoubleSide,
        toneMapped: false,
      });
    };

    const updateAcrylicFaceBounds = (material, geometry) => {
      if (!material?.uniforms?.boundsMin || !geometry?.boundingBox) return;
      material.uniforms.boundsMin.value.set(geometry.boundingBox.min.x, geometry.boundingBox.min.y);
      material.uniforms.boundsMax.value.set(geometry.boundingBox.max.x, geometry.boundingBox.max.y);
    };

    const getOuterGlowControls = (panel) => {
      const scope = panel?.closest(".result, .design-card") || panel;
      const read = (name, fallback) => {
        const value = Number.parseFloat(scope?.querySelector('[data-glow-control="' + name + '"]')?.value || fallback);
        return Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : fallback;
      };
      const strength = read("strength", 70);
      const size = read("size", 55);
      const brightness = read("brightness", 70);
      return {
        strength,
        size,
        brightness,
        strengthMultiplier: strength / 70,
        sizeMultiplier: size / 55,
        brightnessMultiplier: brightness / 70,
      };
    };

    const applyLedFaceMaterial = (state, ledColor, isBlack, isUvPrinting = false) => {
      const face = Array.isArray(state?.mesh?.material) ? state.mesh.material[0] : null;
      if (!face) return;
      const led = ledMaterialSettings(ledColor, isBlack);
      // Backlit: the front panel is opaque and unlit - only the halo behind it
      // carries the LED colour. Its tint follows the stainless finish when the
      // product has one, otherwise the Box Up paint pick.
      const faceScope = state.panel?.closest(".result, .design-card");
      const stainlessFace = boxUpFinishSpec(faceScope);
      const faceTint = stainlessFace ? stainlessFace.color : boxUpPaintHex(faceScope);
      const faceLed = BACKLIT
        ? { ...ledMaterialSettings("None", isBlack), color: faceTint }
        : led;
      const glowControls = getOuterGlowControls(state.panel);
      const translucentSide = hasTranslucentSide(getSideMaterialConfig(state.panel?.closest(".result, .design-card")));
      if (face.uniforms?.ledPower) {
        const enabled = !BACKLIT && !isBlack && ledColor !== "None";
        face.uniforms.baseColor.value.setHex(!BACKLIT && isBlack ? 0x000000 : faceLed.color);
        face.uniforms.glowColor.value.setHex(faceLed.emissive || 0x000000);
        face.uniforms.ledPower.value = enabled ? Math.min(2.1, Math.max(0.15, (led.intensity / 2.4) * glowControls.brightnessMultiplier)) : 0;
        face.uniforms.acrylicOpacity.value = enabled ? 0.96 : 1;
        if (face.uniforms.blackMode) face.uniforms.blackMode.value = isBlack ? 1 : 0;
        if (face.uniforms.uvPrintMode) face.uniforms.uvPrintMode.value = isUvPrinting ? 1 : 0;
      } else {
        face.color.setHex(faceLed.color);
        face.emissive.setHex(faceLed.emissive);
        face.emissiveIntensity = faceLed.intensity;
        face.transparent = !BACKLIT && !isBlack && ledColor !== "None";
        face.opacity = faceLed.opacity || 1;
        face.roughness = isBlack ? 0.22 : ledColor === "None" ? 0.12 : 0.18;
        face.clearcoatRoughness = ledColor === "None" ? 0.055 : 0.08;
        face.transmission = isBlack ? 0 : led.transmission ?? (ledColor === "None" ? 0.05 : 0.18);
        face.thickness = led.thickness ?? (ledColor === "None" ? 0.08 : 0.35);
        face.attenuationColor?.setHex(led.attenuationColor || led.emissive || 0xffffff);
        face.attenuationDistance = led.attenuationDistance || 1.6;
        face.ior = 1.49;
        face.reflectivity = ledColor === "None" ? 0.78 : 0.42;
        face.envMapIntensity = ledColor === "None" ? 0.95 : 0.38;
        face.toneMapped = false;
      }
      face.needsUpdate = true;
      if (state.faceGlow) {
        const enabled = (HALO || !isBlack) && ledColor !== "None";
        state.faceGlow.visible = enabled;
        const baseGlowScale = ledColor === "3000K" ? 1.018 : ledColor === "4000K" ? 1.017 : ledColor === "10000K" ? 1.018 : 1.002;
        const glowScale = 1 + (baseGlowScale - 1) * glowControls.sizeMultiplier;
        const halo = state.faceGlow.userData.haloMaterials;
        if (halo) {
          // Graded backlit shells: keep the built-in falloff, just retint and
          // rescale the whole stack. Children are shells here, so the
          // front-lit bloom-mesh rescale is skipped via the else branch.
          for (const shellMaterial of halo) {
            shellMaterial.color.setHex(led.emissive || led.color);
            shellMaterial.opacity = enabled
              ? Math.min(1, shellMaterial.userData.baseOpacity * glowControls.strengthMultiplier)
              : 0;
            shellMaterial.needsUpdate = true;
          }
        } else {
          const core = state.faceGlow.userData.coreMaterial;
          const bloom = state.faceGlow.userData.bloomMaterial;
          const bloomMesh = state.faceGlow.children?.[1];
          if (bloomMesh) bloomMesh.scale.setScalar(glowScale);
          if (core) {
            core.color.setHex(led.color);
            core.opacity = enabled ? Math.min(1, led.coreOpacity * glowControls.strengthMultiplier) : 0;
            core.needsUpdate = true;
          }
          if (bloom) {
            bloom.color.setHex(led.emissive);
            bloom.opacity = enabled ? Math.min(1, led.bloomOpacity * glowControls.strengthMultiplier) : 0;
            bloom.needsUpdate = true;
          }
        }
      }
      if (state.baseAcrylic) {
        const plateMaterial = state.baseAcrylic.material;
        const plateLit = ledColor !== "None";
        plateMaterial.emissive.setHex(plateLit ? led.emissive : 0x000000);
        plateMaterial.emissiveIntensity = plateLit ? 1.35 : 0;
        plateMaterial.opacity = plateLit ? 0.62 : 0.34;
        plateMaterial.transmission = plateLit ? 0.55 : 0.92;
        plateMaterial.needsUpdate = true;
      }
      if (state.ledFaceLight) {
        state.ledFaceLight.visible = (HALO || !isBlack) && ledColor !== "None";
        state.ledFaceLight.color.setHex(led.emissive);
        state.ledFaceLight.intensity = !isBlack && ledColor !== "None" ? led.lightIntensity * glowControls.strengthMultiplier : 0;
      }
      if (state.bloomPass) {
        // A translucent side always glows, even with a black-acrylic face surface.
        const faceBloom = (HALO || !isBlack) ? led.bloomStrength * glowControls.strengthMultiplier : 0;
        state.bloomPass.strength = Math.max(faceBloom, translucentSide ? 1.05 : 0);
        state.bloomPass.radius = Math.max(led.bloomRadius * glowControls.sizeMultiplier, translucentSide ? 0.58 : 0);
        state.bloomPass.threshold = translucentSide ? 0.02 : led.bloomThreshold;
      }
      if (state.keyLight) {
        const baseIntensity = state.keyLight.userData.baseIntensity || state.keyLight.intensity;
        state.keyLight.intensity = !isBlack && ledColor !== "None" ? baseIntensity * 0.75 : baseIntensity;
      }
      // translucent sides take on the LED colour (light passes through the side)
      if (state.sideGlow) {
        state.sideGlow.traverse((object) => {
          if (object.material && object.material.userData && object.material.userData.filamentColor) {
            object.material.color.setHex(sideGlowHex(object.material.userData.filamentColor, ledColor));
            object.material.needsUpdate = true;
          }
        });
      }
      if (Array.isArray(state?.mesh?.material)) {
        state.mesh.material.forEach((material) => {
          if (material && material.userData && material.userData.translucentFilament) {
            material.emissive.setHex(sideGlowHex(material.userData.translucentFilament, ledColor));
            material.needsUpdate = true;
          }
        });
      }
      // A backlit product's face is "black" (unlit), but its halo still glows -
      // so RGB must keep cycling whenever there's a halo (back / both modes).
      state.rgbAnim = ledColor === "RGB" && !isUvPrinting && (!isBlack || translucentSide || HALO);
      renderCraftScene(state);
    };

    const animateRgbFace = (state) => {
      const hue = (performance.now() * 0.00016) % 1;
      if (!state._rgbGlow) state._rgbGlow = new THREE.Color();
      if (!state._rgbBase) state._rgbBase = new THREE.Color();
      const glow = state._rgbGlow.setHSL(hue, 1.0, 0.5);
      const base = state._rgbBase.setHSL(hue, 1.0, 0.72);
      const face = Array.isArray(state?.mesh?.material) ? state.mesh.material[0] : null;
      if (face && face.uniforms?.glowColor) {
        // A pure-backlit face keeps its finish colour; only the halo cycles.
        if (!BACKLIT) face.uniforms.baseColor.value.copy(base);
        face.uniforms.glowColor.value.copy(glow);
      }
      if (state.faceGlow) {
        // Backlit: retint the graded shell stack. Front-lit: the core/bloom pair.
        const halo = state.faceGlow.userData.haloMaterials;
        if (halo) {
          for (const shellMaterial of halo) shellMaterial.color.copy(glow);
        } else {
          const core = state.faceGlow.userData.coreMaterial;
          const bloom = state.faceGlow.userData.bloomMaterial;
          if (core) core.color.copy(base);
          if (bloom) bloom.color.copy(glow);
        }
      }
      // The clear-acrylic backing plate glows with the LED, so it cycles too.
      if (state.baseAcrylic) state.baseAcrylic.material.emissive.copy(glow);
      if (state.ledFaceLight) state.ledFaceLight.color.copy(glow);
      // translucent sides cycle with the RGB hue too
      if (state.sideGlow) {
        state.sideGlow.traverse((object) => {
          if (object.material && object.material.userData && object.material.userData.filamentColor) {
            object.material.color.copy(glow);
          }
        });
      }
      if (Array.isArray(state?.mesh?.material)) {
        state.mesh.material.forEach((material) => {
          if (material && material.userData && material.userData.translucentFilament) {
            material.emissive.copy(glow);
          }
        });
      }
    };

    const createFrontFaceGlowMesh = (geometry, ledColor, isBlack) => {
      geometry.computeBoundingBox();
      geometry.computeVertexNormals();
      const source = geometry.index ? geometry.toNonIndexed() : geometry;
      const position = source.getAttribute("position");
      const normal = source.getAttribute("normal");
      const frontZ = geometry.boundingBox.max.z;
      const backZ = geometry.boundingBox.min.z;
      const faceBand = Math.max(0.035, (geometry.boundingBox.max.z - geometry.boundingBox.min.z) * 0.08);
      const vertices = [];

      for (let vertex = 0; vertex < position.count; vertex += 3) {
        let avgZ = 0;
        let avgNormalZ = 0;
        for (let point = 0; point < 3; point += 1) {
          const index = vertex + point;
          avgZ += position.getZ(index);
          avgNormalZ += normal.getZ(index);
        }
        avgZ /= 3;
        avgNormalZ /= 3;
        const isFrontCap = avgNormalZ > 0.45 && avgZ >= frontZ - faceBand;
        if (!isFrontCap) continue;
        for (let point = 0; point < 3; point += 1) {
          const index = vertex + point;
          vertices.push(
            position.getX(index) + normal.getX(index) * 0.024,
            position.getY(index) + normal.getY(index) * 0.024,
            position.getZ(index) + normal.getZ(index) * 0.024
          );
        }
      }

      if (source !== geometry) source.dispose();
      const glowGeometry = new THREE.BufferGeometry();
      glowGeometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
      glowGeometry.computeVertexNormals();
      const led = ledMaterialSettings(ledColor, isBlack);
      const enabled = (HALO || !isBlack) && ledColor !== "None";
      const glowScale = ledColor === "3000K" ? 1.018 : ledColor === "4000K" ? 1.017 : ledColor === "10000K" ? 1.018 : 1.002;
      const coreMaterial = new THREE.MeshBasicMaterial({
        color: led.color,
        transparent: true,
        opacity: enabled ? led.coreOpacity : 0,
        blending: THREE.NormalBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
        toneMapped: false,
      });
      const bloomMaterial = new THREE.MeshBasicMaterial({
        color: led.emissive,
        transparent: true,
        opacity: enabled ? led.bloomOpacity : 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
        toneMapped: false,
      });
      const coreMesh = new THREE.Mesh(glowGeometry, coreMaterial);
      const bloomMesh = new THREE.Mesh(glowGeometry.clone(), bloomMaterial);
      bloomMesh.scale.setScalar(glowScale);
      const glowGroup = new THREE.Group();
      glowGroup.add(coreMesh, bloomMesh);
      glowGroup.renderOrder = 8;
      glowGroup.visible = enabled;
      glowGroup.userData.coreMaterial = coreMaterial;
      glowGroup.userData.bloomMaterial = bloomMaterial;
      // Layer 1 is the bloom-only pass, which renders without the letter - a
      // halo placed there would shine straight through the opaque panel. The
      // reverse-lit halo therefore stays on the default layer so the letter
      // occludes it and only the spill around the edges shows.
      if (!HALO) glowGroup.traverse((object) => object.layers.set(1));
      if (HALO) {
        // Reverse-lit spill. One flat shape reads as a plate stuck behind the
        // letter, so the halo is built from concentric shells that get wider
        // and fainter - the additive falloff is what makes it read as light.
        // Each shell is scaled about the artwork centre in vertex space so it
        // stays concentric no matter where the geometry sits.
        const center = new THREE.Vector3();
        geometry.boundingBox.getCenter(center);
        const behind = -((frontZ - backZ) + 0.06);
        const shells = [
          { spread: 1.02, opacity: 0.16 },
          { spread: 1.06, opacity: 0.115 },
          { spread: 1.11, opacity: 0.08 },
          { spread: 1.18, opacity: 0.055 },
          { spread: 1.27, opacity: 0.034 },
          { spread: 1.38, opacity: 0.02 },
          { spread: 1.54, opacity: 0.011 },
        ];
        for (const child of [...glowGroup.children]) glowGroup.remove(child);
        const haloMaterials = [];
        for (const shell of shells) {
          const shellVerts = new Array(vertices.length);
          for (let i = 0; i < vertices.length; i += 3) {
            shellVerts[i] = center.x + (vertices[i] - center.x) * shell.spread;
            shellVerts[i + 1] = center.y + (vertices[i + 1] - center.y) * shell.spread;
            shellVerts[i + 2] = vertices[i + 2] + behind;
          }
          const shellGeometry = new THREE.BufferGeometry();
          shellGeometry.setAttribute("position", new THREE.Float32BufferAttribute(shellVerts, 3));
          const shellMaterial = new THREE.MeshBasicMaterial({
            color: led.emissive || led.color,
            transparent: true,
            opacity: enabled ? shell.opacity : 0,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            side: THREE.DoubleSide,
            toneMapped: false,
          });
          shellMaterial.userData.baseOpacity = shell.opacity;
          haloMaterials.push(shellMaterial);
          glowGroup.add(new THREE.Mesh(shellGeometry, shellMaterial));
        }
        glowGroup.userData.haloMaterials = haloMaterials;
        delete glowGroup.userData.coreMaterial;
        delete glowGroup.userData.bloomMaterial;
      }
      return glowGroup;
    };

    const createTranslucentSideGlowMesh = (geometry, sideConfig, ledColor) => {
      const colors = sideConfig?.colors?.length ? sideConfig.colors : ["White"];
      if (!colors.some(isTranslucentFilamentSide)) return null;
      geometry.computeBoundingBox();
      geometry.computeVertexNormals();
      const source = geometry.index ? geometry.toNonIndexed() : geometry;
      const position = source.getAttribute("position");
      const normal = source.getAttribute("normal");
      const frontZ = geometry.boundingBox.max.z;
      const backZ = geometry.boundingBox.min.z;
      const weights = sideConfig?.weights?.length ? sideConfig.weights : colors.map(() => 1);
      const segments = colors.map(() => []);

      for (let vertex = 0; vertex < position.count; vertex += 3) {
        let avgZ = 0;
        let avgNormalZ = 0;
        for (let point = 0; point < 3; point += 1) {
          const index = vertex + point;
          avgZ += position.getZ(index);
          avgNormalZ += normal.getZ(index);
        }
        avgZ /= 3;
        avgNormalZ /= 3;
        const segmentIndex = segmentIndexForZ(avgZ, frontZ, backZ, weights);
        if (!isTranslucentFilamentSide(colors[segmentIndex]) || Math.abs(avgNormalZ) > 0.88) continue;
        for (let point = 0; point < 3; point += 1) {
          const index = vertex + point;
          segments[segmentIndex].push(
            position.getX(index) + normal.getX(index) * 0.035,
            position.getY(index) + normal.getY(index) * 0.035,
            position.getZ(index) + normal.getZ(index) * 0.035
          );
        }
      }

      if (source !== geometry) source.dispose();
      const glowGroup = new THREE.Group();
      segments.forEach((vertices, index) => {
        if (!vertices.length) return;
        const glowGeometry = new THREE.BufferGeometry();
        glowGeometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
        glowGeometry.computeVertexNormals();
        const glowColor = sideGlowHex(colors[index], ledColor);
        const material = new THREE.MeshBasicMaterial({
          color: glowColor,
          transparent: true,
          opacity: 0.42,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          side: THREE.DoubleSide,
          toneMapped: false,
        });
        material.userData.filamentColor = colors[index];
        const mesh = new THREE.Mesh(glowGeometry, material);
        mesh.renderOrder = 7;
        mesh.layers.enable(0);
        mesh.layers.enable(1);
        glowGroup.add(mesh);
        const aura = new THREE.Mesh(glowGeometry.clone(), material.clone());
        aura.material.opacity = 0.22;
        aura.scale.setScalar(1.025);
        aura.renderOrder = 6;
        aura.layers.enable(0);
        aura.layers.enable(1);
        glowGroup.add(aura);
      });
      if (!glowGroup.children.length) return null;
      glowGroup.traverse((object) => {
        object.layers.enable(0);
        object.layers.enable(1);
      });
      return glowGroup;
    };

    // Box Up paint colour. The <option value> carries the hex so the picker
    // stays a plain select and the 3D shell can use the value directly.
    const BACKLIT_DEFAULT_SHELL = 0x0b0d10;
    // The picker stores its selection as a comma-separated hex list in pick
    // order. Only the first entry is rendered - the letter is one solid colour.
    const boxUpPaintList = (scope) => {
      const raw = scope?.querySelector(".box-up-paint-select")?.value || "";
      const hexes = raw
        .split(",")
        .map((part) => part.trim())
        .filter((part) => /^#[0-9a-f]{6}$/i.test(part))
        .map((part) => parseInt(part.slice(1), 16));
      return hexes.length ? hexes : [BACKLIT_DEFAULT_SHELL];
    };
    const boxUpPaintHex = (scope) => boxUpPaintList(scope)[0];
    const boxUpSideHex = boxUpPaintHex;

    // Some products drive the returns off Box Up Color instead of the filament
    // picker. Two families are recognised:
    //   metal - "mirror"/"hairline"/"original": reflective or brushed steel
    //   plain - a named paint colour: matte-ish coated aluminium
    // Returns null for every other product so their materials are untouched.
    const PLAIN_BOX_UP_COLORS = {
      black: 0x15181c,
      white: 0xeef1f5,
      red: 0xc0182c,
      yellow: 0xf2c118,
      green: 0x1f7a44,
      blue: 0x1b4d9b,
    };
    const boxUpFinishSpec = (scope) => {
      const value = (scope?.querySelector(".box-up-color-select")?.value || "")
        .trim()
        .toLowerCase();
      const mirror = value.includes("mirror");
      const hairline = value.includes("hairline");
      const original = value === "original";
      if (mirror || hairline || original) {
        // "rose gold" must be tested before "gold" - it contains that word.
        const color = value.includes("rose gold")
          ? 0xc08a7d
          : value.includes("gold")
            ? 0xd6ab5c
            : value.includes("silver")
              ? 0xdfe3e6
              : 0xc2c7cb;
        return {
          color,
          metalness: 1,
          roughness: mirror ? 0.045 : hairline ? 0.34 : 0.22,
          envMapIntensity: mirror ? 1.9 : 1.15,
        };
      }
      const plain = PLAIN_BOX_UP_COLORS[value];
      if (plain === undefined) return null;
      // Coated aluminium: a little sheen, nowhere near mirror steel.
      return { color: plain, metalness: 0.18, roughness: 0.46, envMapIntensity: 0.65 };
    };

    const createMaterialSet = (isBlack, ledColor, sideConfig, isUvPrinting = false, sidePaintHex = null, stainless = null) => {
      const face = createAcrylicFaceMaterial(ledColor, isBlack, isUvPrinting);
      const colors = sideConfig?.colors?.length ? sideConfig.colors : ["White"];
      const createShellMaterial = (colorName, factor, bevel = false) => {
        const isWhite = isWhiteFilamentSide(colorName);
        const isTranslucent = isTranslucentFilamentSide(colorName);
        // EG Box Up (Frontlit) "conceal" look: the beveled rim around the lit
        // face is rendered as a dark matte trim, framing the panel like the
        // reference photo (a border connecting around the front).
        var concealName = document.body.dataset.boxupName || "";
        var isEgFrontlit = /EG (Conceal )?Box Up/i.test(concealName) && /Frontlit/i.test(concealName);
        var isConcealTrim = bevel && isEgFrontlit;
        // Reverse-lit letters have an opaque black shell all round, so the side
        // colour is forced to match the face instead of the filament pick.
        // EG Box Up (Frontlit) is 2K-spray painted, so its returns follow the
        // Box Up Paint Colour (sidePaintHex) too — same as the reverse-lit ones.
        const color = stainless
          ? new THREE.Color(stainless.color)
          : (BACKLIT || isEgFrontlit)
            ? new THREE.Color(sidePaintHex ?? BACKLIT_DEFAULT_SHELL)
            : isWhite ? new THREE.Color(filamentSideColor(colorName)) : tonedColor(filamentSideColor(colorName), factor);
        const emissive = !BACKLIT && isTranslucent ? new THREE.Color(sideGlowHex(colorName, ledColor)) : new THREE.Color(0x000000);
        const shell = new THREE.MeshPhysicalMaterial({
          color,
          emissive,
          emissiveIntensity: isTranslucent ? (bevel ? 1.15 : 0.92) : 0,
          metalness: stainless ? stainless.metalness : isWhite ? 0 : bevel ? 0.02 : 0.03,
          roughness: stainless
            ? stainless.roughness
            : isWhite ? 0.82 : isTranslucent ? (bevel ? 0.24 : 0.32) : bevel ? 0.42 : 0.58,
          clearcoat: isWhite ? 0 : isTranslucent ? 0.42 : bevel ? 0.28 : 0.18,
          clearcoatRoughness: isWhite ? 1 : isTranslucent ? 0.18 : bevel ? 0.28 : 0.46,
          reflectivity: isWhite ? 0 : isTranslucent ? 0.52 : bevel ? 0.36 : 0.28,
          envMapIntensity: stainless ? stainless.envMapIntensity : isWhite ? 0.06 : isTranslucent ? 0.9 : bevel ? 0.72 : 0.42,
          specularIntensity: isWhite ? 0 : isTranslucent ? 0.78 : bevel ? 0.5 : 0.28,
          specularColor: isWhite ? 0xb8b2a8 : 0xffffff,
          transmission: isTranslucent ? 0.22 : 0,
          thickness: isTranslucent ? 0.38 : 0,
          attenuationColor: filamentSideColor(colorName),
          attenuationDistance: isTranslucent ? 1.2 : Infinity,
          side: THREE.DoubleSide,
        });
        if (isConcealTrim) {
          shell.color.setHex(0x0f1116);
          shell.emissive.setHex(0x000000);
          shell.emissiveIntensity = 0;
          shell.metalness = 0;
          shell.roughness = 0.72;
          shell.clearcoat = 0.12;
          shell.reflectivity = 0.16;
          shell.needsUpdate = true;
        }
        shell.userData.translucentFilament = isTranslucent ? colorName : null;
        return shell;
      };
      const sideMaterials = colors.map((color) => createShellMaterial(color, 0.62, false));
      const bevelMaterials = colors.map((color) => createShellMaterial(color, 0.78, true));
      return [face, ...sideMaterials, ...bevelMaterials];
    };

    const removeOpenBackCap = (geometry) => {
      geometry.computeBoundingBox();
      geometry.computeVertexNormals();
      const source = geometry.index ? geometry.toNonIndexed() : geometry;
      const position = source.getAttribute("position");
      const normal = source.getAttribute("normal");
      const backZ = geometry.boundingBox.min.z;
      const backBand = Math.max(0.035, (geometry.boundingBox.max.z - geometry.boundingBox.min.z) * 0.1);
      const keptPositions = [];

      for (let vertex = 0; vertex < position.count; vertex += 3) {
        let avgZ = 0;
        let avgNormalZ = 0;
        for (let point = 0; point < 3; point += 1) {
          const index = vertex + point;
          avgZ += position.getZ(index);
          avgNormalZ += normal.getZ(index);
        }
        avgZ /= 3;
        avgNormalZ /= 3;
        const isRearCap = avgZ <= backZ + backBand && avgNormalZ < -0.18;
        if (isRearCap) continue;
        for (let point = 0; point < 3; point += 1) {
          const index = vertex + point;
          keptPositions.push(position.getX(index), position.getY(index), position.getZ(index));
        }
      }

      if (source !== geometry) source.dispose();
      geometry.dispose();
      const openGeometry = new THREE.BufferGeometry();
      openGeometry.setAttribute("position", new THREE.Float32BufferAttribute(keptPositions, 3));
      openGeometry.computeVertexNormals();
      openGeometry.computeBoundingBox();
      return openGeometry;
    };

    const assignCraftMaterialGroups = (geometry, sideConfig) => {
      const FRONT_FACE_MATERIAL = 0;
      const colors = sideConfig?.colors?.length ? sideConfig.colors : ["White"];
      const weights = sideConfig?.weights?.length ? sideConfig.weights : colors.map(() => 1);
      const sideMaterialStart = 1;
      const bevelMaterialStart = 1 + colors.length;
      const normal = geometry.getAttribute("normal");
      const position = geometry.getAttribute("position");
      const index = geometry.index;
      const triangleCount = (index ? index.count : normal.count) / 3;
      geometry.computeBoundingBox();
      const frontZ = geometry.boundingBox.max.z;
      const backZ = geometry.boundingBox.min.z;
      const faceBand = Math.max(0.035, (geometry.boundingBox.max.z - geometry.boundingBox.min.z) * 0.08);
      geometry.clearGroups();
      let groupStart = 0;
      let groupMaterial = null;
      for (let triangle = 0; triangle < triangleCount; triangle += 1) {
        const offset = triangle * 3;
        let normalZ = 0;
        let positionZ = 0;
        for (let point = 0; point < 3; point += 1) {
          const vertexIndex = index ? index.getX(offset + point) : offset + point;
          normalZ += normal.getZ(vertexIndex);
          positionZ += position.getZ(vertexIndex);
        }
        const avgNormalZ = normalZ / 3;
        const avgPositionZ = positionZ / 3;
        const isFlatCap = avgNormalZ > 0.45 && avgPositionZ >= frontZ - faceBand;
        const segmentIndex = segmentIndexForZ(avgPositionZ, frontZ, backZ, weights);
        const materialIndex = isFlatCap
          ? FRONT_FACE_MATERIAL
          : Math.abs(avgNormalZ) > 0.18
            ? bevelMaterialStart + segmentIndex
            : sideMaterialStart + segmentIndex;
        if (groupMaterial === null) {
          groupMaterial = materialIndex;
          groupStart = offset;
        } else if (materialIndex !== groupMaterial) {
          geometry.addGroup(groupStart, offset - groupStart, groupMaterial);
          groupStart = offset;
          groupMaterial = materialIndex;
        }
      }
      geometry.addGroup(groupStart, triangleCount * 3 - groupStart, groupMaterial ?? 0);
    };

    const fitCamera = (state) => {
      const box = new THREE.Box3().setFromObject(state.group);
      const sphere = box.getBoundingSphere(new THREE.Sphere());
      const views = {
        front: [0, 0.08, 1],
        angle: [0.62, 0.18, 1],
        side: [1.2, 0.12, 0.04],
        top: [0.22, 1.12, 0.48],
        install: [0.62, 0.18, 1],
      };
      const next = views[state.currentView || "angle"] || views.angle;
      const fov = THREE.MathUtils.degToRad(state.camera.fov);
      const distance = Math.max(7, sphere.radius / Math.sin(fov / 2) * 1.02);
      state.camera.position.set(distance * next[0], distance * next[1], distance * next[2]);
      state.camera.near = 0.1;
      state.camera.far = 100;
      state.camera.updateProjectionMatrix();
      state.controls.target.copy(sphere.center);
      state.controls.update();
    };

    const buildLetterMesh = async (state, panel) => {
      state.panel = panel;
      const boxSize = panel.closest(".result, .design-card")?.querySelector(".box-up-size-select")?.value || "5cm";
      const surface = panel.closest(".result, .design-card")?.querySelector(".mounting-base-select")?.value || "3mm White Acrylic";
      const finishing = panel.closest(".result, .design-card")?.querySelector(".finishing-select")?.value || "None";
      const ledColor = panel.closest(".result, .design-card")?.querySelector(".selected-led-color strong")?.textContent?.trim() || "None";
      const sideConfig = getSideMaterialConfig(panel.closest(".result, .design-card"));
      const extrusionSteps = extrusionStepCount(sideConfig);
      const isBlack = surface === "3mm Black Acrylic";
      const depth = 3.2;
      const targetDepth = boxSize === "5cm" ? 0.9 : 0.75;
      panel.querySelectorAll("[data-three-depth-label]").forEach((item) => item.textContent = boxSize + " thickness");

      if (state.mesh) {
        state.group.remove(state.mesh);
        disposeObject(state.mesh);
      }
      if (state.faceGlow) {
        state.group.remove(state.faceGlow);
        disposeObject(state.faceGlow);
        state.faceGlow = null;
      }
      if (state.sideGlow) {
        state.group.remove(state.sideGlow);
        disposeObject(state.sideGlow);
        state.sideGlow = null;
      }
      if (state.baseAcrylic) {
        state.group.remove(state.baseAcrylic);
        disposeObject(state.baseAcrylic);
        state.baseAcrylic = null;
      }

      let geometry = new THREE.ExtrudeGeometry(logoShapes, {
        depth,
        curveSegments: 42,
        steps: extrusionSteps,
        bevelEnabled: true,
        bevelThickness: 0.12,
        bevelSize: 0.155,
        bevelOffset: 0,
        bevelSegments: 24,
      });
      geometry.computeBoundingBox();
      geometry.center();
      const rawSize = new THREE.Vector3();
      geometry.boundingBox.getSize(rawSize);
      const xyScale = 4.9 / Math.max(rawSize.x, rawSize.y);
      const zScale = targetDepth / Math.max(rawSize.z, 0.001);
      geometry.scale(xyScale, -xyScale, -zScale);
      geometry.computeBoundingBox();
      geometry.center();
      geometry = removeOpenBackCap(geometry);
      assignCraftMaterialGroups(geometry, sideConfig);

      const mesh = new THREE.Mesh(geometry, createMaterialSet(isBlack, ledColor, sideConfig, surface === "3mm White Acrylic" && finishing === "UV Printing", boxUpSideHex(panel.closest(".result, .design-card")), boxUpFinishSpec(panel.closest(".result, .design-card"))));
      const faceGlow = createFrontFaceGlowMesh(geometry, ledColor, isBlack);
      const sideGlow = createTranslucentSideGlowMesh(geometry, sideConfig, ledColor);
      updateAcrylicFaceBounds(mesh.material[0], geometry);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.rotation.x = 0;
      mesh.rotation.y = 0;
      state.mesh = mesh;
      state.group.add(mesh);
      state.faceGlow = faceGlow;
      state.group.add(faceGlow);
      state.sideGlow = sideGlow;
      if (sideGlow) state.group.add(sideGlow);

      // Optional clear acrylic backing plate, mounted flush behind the letter.
      // Box Up depth maps 3cm -> 0.75 units, so 1mm is 0.25/10 units.
      const baseAcrylicMm = Number(
        panel.closest(".result, .design-card")?.querySelector(".base-acrylic-select")?.value || 0,
      );
      if (baseAcrylicMm > 0) {
        const plateDepth = (targetDepth / (boxSize === "5cm" ? 50 : 30)) * baseAcrylicMm;
        let plateGeometry = new THREE.ExtrudeGeometry(logoShapes, {
          depth,
          curveSegments: 42,
          steps: 1,
          bevelEnabled: false,
        });
        plateGeometry.computeBoundingBox();
        plateGeometry.center();
        const plateRaw = new THREE.Vector3();
        plateGeometry.boundingBox.getSize(plateRaw);
        plateGeometry.scale(
          xyScale,
          -xyScale,
          -(plateDepth / Math.max(plateRaw.z, 0.001)),
        );
        plateGeometry.computeBoundingBox();
        plateGeometry.center();
        // The whole sheet lights up with the LED - it is the lit element of a
        // reverse-lit build, not just a mounting plate.
        const plateLed = ledMaterialSettings(ledColor, isBlack);
        const plateLit = ledColor !== "None";
        const plate = new THREE.Mesh(
          plateGeometry,
          new THREE.MeshPhysicalMaterial({
            color: 0xeaf4ff,
            emissive: new THREE.Color(plateLit ? plateLed.emissive : 0x000000),
            emissiveIntensity: plateLit ? 1.35 : 0,
            transparent: true,
            opacity: plateLit ? 0.62 : 0.34,
            roughness: 0.06,
            metalness: 0,
            transmission: plateLit ? 0.55 : 0.92,
            thickness: plateDepth,
            ior: 1.49,
            clearcoat: 1,
            clearcoatRoughness: 0.05,
            side: THREE.DoubleSide,
            depthWrite: false,
            toneMapped: false,
          }),
        );
        // Sits directly behind the letter: half of each depth, back to back.
        plate.position.z = -(targetDepth / 2 + plateDepth / 2);
        plate.renderOrder = 6;
        state.baseAcrylic = plate;
        state.group.add(plate);
      }

      fitCamera(state);
      applyLedFaceMaterial(state, ledColor, isBlack, surface === "3mm White Acrylic" && finishing === "UV Printing");
    };

    const renderLoop = (state) => {
      if (!state.running) return;
      state.controls.update();
      if (state.rgbAnim) animateRgbFace(state);
      renderCraftScene(state);
      requestAnimationFrame(() => renderLoop(state));
    };

    const createCraftScene = async (stage) => {
      if (craftScenes.has(stage)) return craftScenes.get(stage);
      const canvas = stage.querySelector(".craft-three-canvas");
      if (!canvas) return null;
      stage.classList.add("has-three");
      const loading = stage.querySelector(".craft-three-loading");
      const loadingTimer = window.setTimeout(() => {
        if (loading && loading.isConnected) loading.textContent = "Loading local 3D engine...";
      }, 4500);
      const { width, height } = getStageSize(stage);
      const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(width, height, false);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.08;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;

      const scene = new THREE.Scene();
      scene.background = null;
      RectAreaLightUniformsLib.init();
      const pmrem = new THREE.PMREMGenerator(renderer);
      scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.025).texture;

      const camera = new THREE.PerspectiveCamera(30, width / height, 0.1, 100);
      const composer = new EffectComposer(renderer);
      composer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      composer.setSize(width, height);
      const renderPass = new RenderPass(scene, camera);
      const bloomPass = new UnrealBloomPass(new THREE.Vector2(width, height), 0, 0.55, 0.1);
      bloomPass.selectionScene = scene;
      bloomPass.selectionCamera = camera;
      bloomPass.selectionLayer = 1;
      composer.addPass(renderPass);
      composer.addPass(bloomPass);

      const controls = new OrbitControls(camera, stage);
      controls.enabled = false;
      controls.autoRotate = false;
      controls.enableDamping = true;
      controls.dampingFactor = 0.08;
      controls.enablePan = false;
      controls.mouseButtons = {
        LEFT: THREE.MOUSE.ROTATE,
        MIDDLE: null,
        RIGHT: null,
      };
      controls.minDistance = 5.8;
      controls.maxDistance = 18;
      controls.minPolarAngle = Math.PI * 0.18;
      controls.maxPolarAngle = Math.PI * 0.72;
      stage.addEventListener("pointerdown", (event) => {
        controls.enabled = event.button === 0;
      }, true);
      window.addEventListener("pointerup", () => {
        controls.enabled = false;
      });
      window.addEventListener("pointercancel", () => {
        controls.enabled = false;
      });

      const group = new THREE.Group();
      group.rotation.y = 0;
      group.rotation.x = 0;
      scene.add(group);

      const softboxLeft = new THREE.RectAreaLight(0xffffff, 4.2, 8.4, 4.8);
      softboxLeft.position.set(-3.9, 4.1, 5.2);
      softboxLeft.lookAt(0, 0, 0);
      scene.add(softboxLeft);

      const softboxRight = new THREE.RectAreaLight(0xeef5ff, 1.2, 5.6, 3.4);
      softboxRight.position.set(4.6, 2.7, 2.7);
      softboxRight.lookAt(0, 0.05, 0);
      scene.add(softboxRight);

      const key = new THREE.DirectionalLight(0xffffff, 6.2);
      key.userData.baseIntensity = 6.2;
      key.position.set(-3.4, 4.8, 6.8);
      key.castShadow = true;
      key.shadow.mapSize.set(2048, 2048);
      key.shadow.camera.near = 0.5;
      key.shadow.camera.far = 20;
      key.shadow.bias = -0.00018;
      scene.add(key);

      const rim = new THREE.DirectionalLight(0xf4f8ff, 5.8);
      rim.position.set(6.2, 3.5, -5.4);
      scene.add(rim);

      const fill = new THREE.HemisphereLight(0xffffff, 0x111316, 0.28);
      scene.add(fill);

      const ledFaceLight = new THREE.PointLight(0xffb86b, 0, 6.4, 2);
      ledFaceLight.position.set(0, 0.24, BACKLIT ? -2.6 : 2.95);
      ledFaceLight.visible = false;
      scene.add(ledFaceLight);

      const floor = new THREE.Mesh(
        new THREE.PlaneGeometry(14, 9),
        new THREE.ShadowMaterial({ color: 0x000000, opacity: 0.52 })
      );
      floor.rotation.x = -Math.PI / 2;
      floor.position.y = -2.18;
      floor.receiveShadow = true;
      // The reverse-lit halo extends below the letter, i.e. past this plane.
      // The shadow catcher only needs to tint, so stop it writing depth or it
      // clips the lower half of the spill.
      if (HALO) floor.material.depthWrite = false;
      scene.add(floor);

      const state = { renderer, composer, bloomPass, scene, camera, controls, group, mesh: null, faceGlow: null, sideGlow: null, ledFaceLight, keyLight: key, running: true, currentView: "angle" };
      craftScenes.set(stage, state);
      await buildLetterMesh(state, stage.closest(".craft-3d-preview"));
      stage.closest(".craft-3d-preview")?.querySelectorAll(".craft-view-card").forEach((button) => {
        button.addEventListener("click", () => {
          state.currentView = button.dataset.view || "angle";
          fitCamera(state);
          button.closest(".craft-3d-preview")?.querySelectorAll(".craft-view-card").forEach((item) => {
            item.classList.toggle("is-active", item === button);
          });
        });
      });
      stage.closest(".craft-3d-preview")?.querySelectorAll(".craft-view-card").forEach((button) => {
        button.classList.toggle("is-active", button.dataset.view === "angle");
      });
      window.clearTimeout(loadingTimer);
      stage.querySelector(".craft-three-loading")?.remove();
      renderLoop(state);
      // The very first build can land before the stage is fully laid out
      // (notably in the pre-upload preview), yielding a degenerate mesh that
      // never refreshes. Rebuild after layout settles so the logo always shows.
      const rebuildOnce = () => {
        const panel = stage.closest(".craft-3d-preview");
        if (panel && state.running) buildLetterMesh(state, panel).catch(() => {});
      };
      requestAnimationFrame(() => requestAnimationFrame(rebuildOnce));
      window.setTimeout(rebuildOnce, 250);
      return state;
    };

    const resizeCraftScene = (stage, state) => {
      const { width, height } = getStageSize(stage);
      state.camera.aspect = width / height;
      state.camera.updateProjectionMatrix();
      state.renderer.setSize(width, height, false);
      state.composer?.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      state.composer?.setSize(width, height);
    };

    window.initCraftThreePreviews = () => {
      document.querySelectorAll(".craft-3d-stage").forEach((stage) => {
        createCraftScene(stage).catch((error) => {
          console.error("Three.js craft preview failed", error);
          stage.classList.remove("has-three");
          const loader = stage.querySelector(".craft-three-loading");
          if (loader) loader.textContent = "3D renderer failed to load";
        });
      });
    };

    window.updateCraftThreePreview = (panel) => {
      const stage = panel?.querySelector(".craft-3d-stage");
      const state = stage && craftScenes.get(stage);
      if (!stage) return;
      if (!state) {
        window.initCraftThreePreviews();
        return;
      }
      buildLetterMesh(state, panel).catch((error) => console.error("Three.js craft preview update failed", error));
    };

    window.updateCraftLedFace = (panel) => {
      const stage = panel?.querySelector(".craft-3d-stage");
      const state = stage && craftScenes.get(stage);
      if (!state?.mesh) return;
      const scope = panel.closest(".result, .design-card");
      const ledColor = scope?.querySelector(".selected-led-color strong")?.textContent?.trim() || "None";
      const surface = scope?.querySelector(".mounting-base-select")?.value || "3mm White Acrylic";
      const finishing = scope?.querySelector(".finishing-select")?.value || "None";
      applyLedFaceMaterial(state, ledColor, surface === "3mm Black Acrylic", surface === "3mm White Acrylic" && finishing === "UV Printing");
    };

    window.addEventListener("resize", () => {
      document.querySelectorAll(".craft-3d-stage").forEach((stage) => {
        const state = craftScenes.get(stage);
        if (state) resizeCraftScene(stage, state);
      });
    });

    if (document.readyState === "loading") {
      window.addEventListener("DOMContentLoaded", window.initCraftThreePreviews);
    } else {
      window.initCraftThreePreviews();
    }
  </script>
</head>
<body><main>
<section class="hero">
  <div class="topbar">
    <div class="brand">
      <div>
        <h1>3D Box Up</h1>
        <p class="subtitle">Calculate neon line length from your artwork</p>
      </div>
    </div>
  </div>
  <form method="post" enctype="multipart/form-data" action="/analyze">
    <input type="file" name="file" accept=".ai,.pdf" required>
    <label class="scale-control">File scale
      <select name="measurementScale">
        <option value="1">Original file</option>
        <option value="10">10x reduced file (show original size)</option>
      </select>
    </label>
    <button type="submit">Calculate</button>
    <a class="clear-button" href="/">Clear</a>
  </form>
</section>
${report}
<div class="image-modal" aria-hidden="true">
  <div class="modal-panel">
    <div class="modal-action-bar">
      <button type="button" class="modal-group-button" disabled>Group</button>
      <button type="button" class="modal-delete-button" disabled>Delete</button>
      <button type="button" class="modal-undo-button" disabled>Restore</button>
    </div>
    <button type="button" class="modal-close" aria-label="Close preview">&times;</button>
    <div class="modal-workspace"><img src="" alt="Preview"></div>
  </div>
</div>
<div class="collect-date-preview" aria-hidden="true"><img src="" alt=""></div>
<div class="request-modal"><div class="request-modal-backdrop"></div><div class="request-modal-card"><div class="request-modal-title">Special Request Order</div><div class="request-modal-body"></div><div class="request-modal-actions"><button type="button" class="request-modal-cancel">Cancel</button><button type="button" class="request-modal-confirm">Submit Request</button></div></div></div>
<div class="draft-modal"><div class="draft-modal-backdrop"></div><div class="draft-modal-card"><div class="draft-modal-title">No Draft Paper uploaded</div><div class="draft-modal-body">You have not uploaded a Draft Paper file. Add to cart without it?</div><div class="draft-modal-actions"><button type="button" class="draft-modal-no">No</button><button type="button" class="draft-modal-yes">Yes, add to cart</button></div></div></div>
<div class="status-strip">
  <div>Line Precision</div>
  <div>Artwork & PDF Files</div>
  <div>Real-time Preview</div>
  <div>Private Local App</div>
</div>
<script>
  // "Next working days" collection closes each day at 4:00pm.
  (function () {
    var CUTOFF_HOUR = 16;
    function apply() {
      var closed = new Date().getHours() >= CUTOFF_HOUR;
      document.querySelectorAll('.collect-date-option[data-collect="next"]').forEach(function (btn) {
        btn.classList.toggle("is-disabled", closed);
        btn.disabled = closed;
        if (closed && btn.classList.contains("is-selected")) {
          var grid = btn.closest(".collect-date-grid");
          var std = grid && (grid.querySelector('.collect-date-option[data-collect="standard7"]') || grid.querySelector('.collect-date-option:not([data-collect="next"])'));
          if (std) {
            grid.querySelectorAll(".collect-date-option").forEach(function (i) { i.classList.remove("is-selected"); });
            std.classList.add("is-selected");
          }
        }
      });
    }
    function boot() { apply(); setInterval(apply, 30000); }
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
    else boot();
  })();
</script>
</main></body></html>`;
}

function renderArtboard(artboard) {
  if (Array.isArray(artboard.designs) && artboard.designs.length > 1) {
    const designCards = artboard.designs.map((design) => renderDesign(design)).join("");
    const title = artboard.name || `Artboard ${artboard.page || ""}`.trim();
    return `
      <div class="result artboard-designs">
        <button type="button" class="close-result" aria-label="Close artboard">&times;</button>
        <div class="artboard-wide">
          <h3>${escapeHtml(title)}</h3>
          <div class="design-list">${designCards}</div>
        </div>
      </div>`;
  }
  const content = artboard.content_bbox_in;
  const contentSize = content ? `${content.width_in.toFixed(2)} in x ${content.height_in.toFixed(2)} in` : "No vector content found";
  const pageSize = artboard.page_size_in ? `${artboard.page_size_in.width_in.toFixed(2)} in x ${artboard.page_size_in.height_in.toFixed(2)} in` : "";
  const title = artboard.name || `Artboard ${artboard.page || ""}`.trim();
  const originalPreview = artboard.original_preview_url ? `<div class="preview-panel original-preview-panel"><div class="panel-label">Original</div><div class="preview original-preview"><img class="delayed-preview" data-src="${artboard.original_preview_url}" alt="Original artwork"><span class="image-zoom-button" data-zoom-alt="Original artwork" aria-label="Zoom original artwork"></span></div><div class="preview-total">Original colour artwork</div></div>` : "";
  const dimensionPreview = artboard.dimension_preview_url ? `<div class="preview-panel"><div class="panel-label">Dimension Preview</div><div class="preview dimension-preview"><img class="delayed-preview" data-src="${artboard.dimension_preview_url}" alt="Dimension preview"><span class="dimension-zoom-button" aria-label="Zoom dimension preview"></span></div><div class="preview-total">Content size: <strong>${contentSize}</strong></div></div>` : "";
  const linePreview = artboard.line_preview_url && hasNeonLines(artboard) ? `<div class="preview-panel"><div class="panel-label">Line Preview</div><div class="preview line-preview"><img class="delayed-preview" data-src="${artboard.line_preview_url}" alt="Line preview"></div><div class="line-total">Line total: <strong>${artboard.total_length_m_neon.toFixed(2)} m</strong></div></div>` : "";
  const letterDimensions = renderLetterDimensions(artboard.letter_dimensions);
  return `
    <div class="result">
      <button type="button" class="close-result" aria-label="Close artboard">&times;</button>
      ${originalPreview}
      <div class="preview-grid">${dimensionPreview}${linePreview}</div>
      ${letterDimensions}
      ${renderFilamentEstimate(artboard)}
      ${renderCraft3DPreview(artboard.artwork_preview_url, pageSize)}
      <div class="result-info">
        <h3>${escapeHtml(title)}</h3>
        <div class="metrics">
          <div class="base-options">
            <div><span>Surface</span><select class="mounting-select mounting-base-select"><option>3mm White Acrylic</option><option>3mm Black Acrylic</option></select></div>
            <div class="base-finishing"><span>Surface Finishing</span><select class="mounting-select finishing-select"><option>None</option><option>UV Printing</option></select></div>
          </div>
          <div class="box-up-size"><span>Box Up Size</span><select class="mounting-select box-up-size-select"><option>3cm</option><option selected>5cm</option></select></div>
          <div class="box-up-color"><span>Box Up Color</span><select class="mounting-select box-up-color-select"><option>3D Outdoor Material</option><option>3D Outdoor Material with 2K Spray</option></select></div>
          ${renderSideFinishingOptions()}
          ${renderColorPicker(artboard.by_color)}
          <div class="base-finish-material"><span>Base Finishing</span><select class="mounting-select base-finish-material-select"><option>10mm PVC Foam Board</option><option>3mm ACP Board</option></select></div>
          ${renderLedColorOptions()}
          ${renderOuterGlowControls()}
          ${renderRemarkOptions()}
          ${renderDraftPaperOptions()}
          ${renderCollectDateOptions()}
          ${renderOrderPanel()}
        </div>
      </div>
    </div>`;
}

function renderDesign(design) {
  const content = design.content_bbox_in;
  const contentSize = content ? `${content.width_in.toFixed(2)} in x ${content.height_in.toFixed(2)} in` : "No vector content found";
  const originalPreview = design.original_preview_url ? `<div class="preview-panel original-preview-panel"><div class="panel-label">Original</div><div class="preview original-preview"><img class="delayed-preview" data-src="${design.original_preview_url}" alt="Original artwork"><span class="image-zoom-button" data-zoom-alt="Original artwork" aria-label="Zoom original artwork"></span></div><div class="preview-total">Original colour artwork</div></div>` : "";
  const dimensionPreview = design.dimension_preview_url ? `<div class="preview-panel"><div class="panel-label">Dimension Preview</div><div class="preview dimension-preview"><img class="delayed-preview" data-src="${design.dimension_preview_url}" alt="Dimension preview"><span class="dimension-zoom-button" aria-label="Zoom dimension preview"></span></div><div class="preview-total">Content size: <strong>${contentSize}</strong></div></div>` : "";
  const linePreview = design.line_preview_url && hasNeonLines(design) ? `<div class="preview-panel"><div class="panel-label">Line Preview</div><div class="preview line-preview"><img class="delayed-preview" data-src="${design.line_preview_url}" alt="Line preview"></div><div class="line-total">Line total: <strong>${design.total_length_m_neon.toFixed(2)} m</strong></div></div>` : "";
  const letterDimensions = renderLetterDimensions(design.letter_dimensions);
  return `
    <div class="design-card">
      <button type="button" class="close-result" aria-label="Close design">&times;</button>
      <h4>${escapeHtml(design.name || "Design")}</h4>
      <div class="design-body">
        ${originalPreview}
        <div class="preview-grid">${dimensionPreview}${linePreview}</div>
        ${letterDimensions}
        ${renderFilamentEstimate(design)}
        ${renderCraft3DPreview(design.artwork_preview_url)}
        <div class="metrics">
          <div class="base-options">
            <div><span>Surface</span><select class="mounting-select mounting-base-select"><option>3mm White Acrylic</option><option>3mm Black Acrylic</option></select></div>
            <div class="base-finishing"><span>Surface Finishing</span><select class="mounting-select finishing-select"><option>None</option><option>UV Printing</option></select></div>
          </div>
          <div class="box-up-size"><span>Box Up Size</span><select class="mounting-select box-up-size-select"><option>3cm</option><option selected>5cm</option></select></div>
          <div class="box-up-color"><span>Box Up Color</span><select class="mounting-select box-up-color-select"><option>3D Outdoor Material</option><option>3D Outdoor Material with 2K Spray</option></select></div>
          ${renderSideFinishingOptions()}
          ${renderColorPicker(design.by_color)}
          <div class="base-finish-material"><span>Base Finishing</span><select class="mounting-select base-finish-material-select"><option>10mm PVC Foam Board</option><option>3mm ACP Board</option></select></div>
          ${renderLedColorOptions()}
          ${renderOuterGlowControls()}
          ${renderRemarkOptions()}
          ${renderDraftPaperOptions()}
          ${renderCollectDateOptions()}
          ${renderOrderPanel()}
        </div>
      </div>
    </div>`;
}

function renderCraft3DPreview(artworkUrl, pageSize) {
  const sideLayers = "";
  const artworkAttr = artworkUrl ? ` data-artwork-src="${artworkUrl}"` : "";
  const pageSizeAttr = pageSize ? ` data-page-size="${pageSize}"` : "";
  return `
        <div class="craft-3d-preview"${artworkAttr}${pageSizeAttr}>
          <div class="craft-3d-title"><span>3D Logo Generator</span><span>Live Preview</span></div>
          <div class="craft-workspace">
            <div class="craft-3d-stage">
              <canvas class="craft-three-canvas" aria-label="3D stainless steel channel letter preview"></canvas>
              <div class="craft-three-loading">Loading real 3D model...</div>
              <div class="craft-three-depth-label" data-three-depth-label>5cm thickness</div>
              <div class="craft-three-led-label" data-three-led-label></div>
              <div class="craft-3d-model">
                <span class="craft-3d-solid" aria-hidden="true"></span>
              </div>
            </div>
          </div>
          <div class="craft-view-strip">
            <button type="button" class="craft-view-card is-active" data-view="front"><span class="craft-view-letter"></span><span>Front View</span></button>
            <button type="button" class="craft-view-card" data-view="angle"><span class="craft-view-letter"></span><span>45&deg; View</span></button>
            <button type="button" class="craft-view-card" data-view="side"><span class="craft-view-letter side"></span><span>Side View</span></button>
            <button type="button" class="craft-view-card" data-view="top"><span class="craft-view-letter top"></span><span>Top View</span></button>
            <button type="button" class="craft-view-card install" data-view="install"><span class="craft-view-letter"></span><span>Thickness</span></button>
          </div>
          <div class="craft-3d-spec">
            <div class="craft-summary">
              <div><strong>Surface</strong><span data-craft-surface>3mm White Acrylic</span></div>
              <div><strong>Box Up</strong><span data-craft-color>3D Outdoor Material</span></div>
              <div><strong>Side Finishing</strong><span data-craft-size>Option 1 / 5cm thickness</span></div>
              <div><strong>Base Finishing</strong><span data-craft-back>10mm PVC Foam Board</span></div>
              <div><strong>LED Color</strong><span data-craft-led-summary>None</span></div>
              <div><strong>Collect Date</strong><span data-craft-date-summary>4 working days</span></div>
            </div>
          </div>
        </div>`;
  return `
        <div class="craft-3d-preview">
          <div class="craft-3d-title"><span>Front Lit 3D Letter</span><span>Night View</span></div>
          <div class="craft-workspace">
            <div class="craft-tool-rail" aria-hidden="true">
              <span class="craft-tool is-active">⟳</span>
              <span class="craft-tool">◈</span>
              <span class="craft-tool">▣</span>
              <span class="craft-tool">✦</span>
            </div>
            <div class="craft-3d-stage">
              <div class="craft-3d-model">
                ${sideLayers}
                <span class="craft-3d-layer craft-3d-face" style="transform: translate3d(0, 0, 2px);" aria-hidden="true"></span>
              </div>
            </div>
            <div class="craft-inspector">
              <h4>Inspector</h4>
              <div class="craft-inspector-row">Surface<strong data-craft-surface>3mm White Acrylic</strong></div>
              <div class="craft-inspector-row">Depth<strong data-craft-size>5cm thickness</strong></div>
              <div class="craft-inspector-row">Lighting<strong data-craft-color>LED Color: None / 3D Outdoor Material</strong></div>
              <div class="craft-inspector-row">Back Panel<strong data-craft-back>10mm PVC Foam Board</strong></div>
            </div>
          </div>
          <div class="craft-view-strip">
            <button type="button" class="craft-view-card is-active" data-view="front"><span class="craft-view-letter"></span><span>Front View</span></button>
            <button type="button" class="craft-view-card" data-view="angle"><span class="craft-view-letter"></span><span>45&deg; View</span></button>
            <button type="button" class="craft-view-card" data-view="side"><span class="craft-view-letter side"></span><span>Side View</span></button>
            <button type="button" class="craft-view-card" data-view="top"><span class="craft-view-letter top"></span><span>Top View</span></button>
            <button type="button" class="craft-view-card install" data-view="install"><span class="craft-view-letter"></span><span>Installation</span></button>
          </div>
          <div class="craft-3d-spec">
            <div class="craft-material">
              <h4>Material &amp; Structure</h4>
              <div class="craft-stack-demo">
                <span class="stack-s"></span>
                <span class="stack-layer"></span>
                <span class="stack-layer"></span>
                <span class="stack-layer"></span>
              </div>
              <div class="craft-material-lines">
                <div><strong>Acrylic Face</strong><span data-craft-surface>3mm White Acrylic</span></div>
                <div><strong>LED Module</strong><span data-craft-color>LED Color: None / 3D Outdoor Material</span></div>
                <div><strong>Side Wall</strong><span data-craft-size>5cm thickness</span></div>
                <div><strong>Back Panel</strong><span data-craft-back>10mm PVC Foam Board</span></div>
              </div>
            </div>
            <div class="craft-feature-grid">
              <h4>Performance</h4>
              <div class="craft-feature"><i>↧</i><strong>Energy Saving</strong><span>Low Power LED</span></div>
              <div class="craft-feature"><i>◷</i><strong>Long Lifespan</strong><span>50,000+ Hours</span></div>
              <div class="craft-feature"><i>♢</i><strong>Waterproof</strong><span>IP65 Rated</span></div>
              <div class="craft-feature"><i>⚒</i><strong>Easy Install</strong><span>Plug &amp; Play</span></div>
              <div class="craft-feature"><i>◇</i><strong>Warranty</strong><span>Quality Assured</span></div>
            </div>
          </div>
        </div>`;
}

function renderLetterDimensions(dimensions) {
  if (!Array.isArray(dimensions) || dimensions.length === 0) return "";
  const items = dimensions.slice(0, 80).map((item, index) => {
    const label = item.label || `Letter ${index + 1}`;
    const width = Number(item.width_in || 0).toFixed(2);
    const height = Number(item.height_in || 0).toFixed(2);
    const preview = item.image_data_url ? `<img src="${item.image_data_url}" alt="${escapeHtml(label)} preview">` : "";
    const highlight = item.highlight_pct ? ` data-highlight="${escapeHtml(JSON.stringify(item.highlight_pct))}"` : "";
    const bbox = item.bbox_in ? ` data-bbox="${escapeHtml(JSON.stringify({ x: Number(item.bbox_in.x_in || 0), y: Number(item.bbox_in.y_in || 0), width: Number(item.bbox_in.width_in || item.width_in || 0), height: Number(item.bbox_in.height_in || item.height_in || 0) }))}"` : "";
    const led = item.led_clearance || null;
    const warningClass = led && led.too_small ? " is-led-warning" : "";
    const warning = led && led.too_small ? `<span class="led-warning-note">⚠ Only ${Number(led.min_clearance_cm || 0).toFixed(2)}cm (&lt; 1.2cm) — LED can't fit</span>` : "";
    return `<div class="letter-dimension-item${warningClass}" data-record-id="record-${index}"${highlight}${bbox}><span class="letter-item-preview">${preview}<strong>${escapeHtml(label)}</strong></span><span class="letter-dimension-size"><span>${width} in x ${height} in${warning}</span><strong class="letter-item-price">RM 0.00</strong></span></div>`;
  }).join("");
  return `<div class="letter-dimensions"><div class="letter-dimensions-title"><span>Letter / Logo records (<span class="record-count">${dimensions.length}</span>)</span><span class="record-action-buttons"><button type="button" class="group-selected-button">Select with Group</button><button type="button" class="special-finishing-button" disabled>Special Finishing</button><button type="button" class="delete-selected-button" disabled>Delete</button><button type="button" class="undo-button" disabled>Restore</button></span></div><div class="letter-dimension-head"><span>Item</span><span>Width x Height / Price</span></div><div class="letter-dimension-list">${items}</div></div>`;
}

// 3D-print filament estimate: the letters' outline is the "line" a printed
// channel-letter return traces once per 0.3mm layer, so filament length ≈
// outline × (Box Up depth ÷ 0.3mm). Shown per letter plus a total for the two
// Box Up depths (5cm / 3cm). Wrapped in FILAMENT markers so brand() can strip it
// from non-3D-printer box-up products (stainless steel, aluminium).
function renderFilamentEstimate(item) {
  // The "3D Print Filament Estimate" panel is removed — no longer shown.
  return "";
  const totalM = Number(item && item.total_outline_length_m) || 0;
  if (!(totalM > 0)) return "";
  const LAYER_MM = 0.3;
  const f5 = 50 / LAYER_MM; // 5cm depth ≈ 166.67 layers
  const f3 = 30 / LAYER_MM; // 3cm depth = 100 layers
  const letters = Array.isArray(item.letter_dimensions) ? item.letter_dimensions : [];
  const rows = letters
    .map((letter, index) => {
      const om = Number(letter && letter.outline_length_m) || 0;
      if (!(om > 0)) return "";
      const label = (letter && letter.label) || `Letter ${index + 1}`;
      return `<div class="filament-row"><span class="filament-cell filament-name">${escapeHtml(label)}</span><span class="filament-cell">${om.toFixed(2)} m</span><span class="filament-cell">${(om * f5).toFixed(1)} m</span><span class="filament-cell">${(om * f3).toFixed(1)} m</span></div>`;
    })
    .join("");
  return `<!--FILAMENT-START--><div class="filament-estimate">
    <div class="filament-title"><span>3D Print Filament Estimate</span><span class="filament-sub">0.3&nbsp;mm layer · filament = outline &times; (depth &divide; 0.3&nbsp;mm)</span></div>
    <div class="filament-head"><span>Item</span><span>Outline</span><span>5cm deep</span><span>3cm deep</span></div>
    <div class="filament-list">${rows}</div>
    <div class="filament-row filament-total"><span class="filament-cell filament-name">Total</span><span class="filament-cell">${totalM.toFixed(2)} m</span><span class="filament-cell"><strong>${(totalM * f5).toFixed(1)} m</strong></span><span class="filament-cell"><strong>${(totalM * f3).toFixed(1)} m</strong></span></div>
  </div><!--FILAMENT-END-->`;
}

function renderRemarkOptions() {
  return `
          <div class="order-options">
            <div><span>Remark</span><textarea class="remark-field" aria-label="Remark"></textarea></div>
          </div>`;
}

function renderLedColorOptions() {
  const ledColors = [
    ["None", "None", null],
    ["3000K", "3000K Warm White", "led-color-3000k.png"],
    ["4000K", "4000K Natural White", "led-color-4000k.png"],
    ["10000K", "10000K Ultra Cool", "led-color-10000k.png"],
    ["RGB", "RGB Multicolor", "led-color-rgb.png"],
  ];
  const options = ledColors.map(([key, label, file], index) => {
    const sel = index === 0 ? " is-selected" : "";
    if (!file) {
      return `<button type="button" class="led-color-option is-none${sel}" data-led-color="${key}" aria-label="${key} LED color"><span class="led-none-text" aria-hidden="true">NONE</span><span>None</span></button>`;
    }
    const src = `/assets/${file}`;
    return `<button type="button" class="led-color-option${sel}" data-led-color="${key}" aria-label="${escapeHtml(label)}"><img src="${src}" alt="${escapeHtml(label)}"><span>${escapeHtml(label)}</span><span class="image-zoom-button" data-zoom-src="${src}" data-zoom-alt="${escapeHtml(label)}" aria-label="View ${escapeHtml(label)} larger"></span></button>`;
  }).join("");
  return `<div class="led-color-panel"><span>LED Color</span><div class="led-color-grid">${options}</div><div class="selected-led-color">Selected: <strong>None</strong></div></div>`;
}

function renderOuterGlowControls() {
  return `<div class="outer-glow-panel"><span>Outer Glow Control</span><div class="outer-glow-controls">
    <label class="outer-glow-row">Glow Strength<input type="range" min="0" max="100" value="71" data-glow-control="strength"><output data-glow-value="strength">71</output></label>
    <label class="outer-glow-row">Glow Size<input type="range" min="0" max="100" value="37" data-glow-control="size"><output data-glow-value="size">37</output></label>
    <label class="outer-glow-row">Face Brightness<input type="range" min="0" max="100" value="0" data-glow-control="brightness"><output data-glow-value="brightness">0</output></label>
    <div class="outer-glow-note">Controls LED outer glow, bloom radius, and acrylic face brightness.</div>
  </div></div>`;
}

function renderSideFinishingOptions() {
  const options = [1, 2, 3].map((option) => {
    const src = `/assets/side-finishing-option-${option}.png`;
    return `<button type="button" class="side-finishing-option${option === 1 ? " is-selected" : ""}" data-side-finishing="Option ${option}" aria-label="Side finishing option ${option}"><img src="${src}" alt="Side finishing option ${option}"><span class="image-zoom-button" data-zoom-src="${src}" data-zoom-alt="Side finishing option ${option}" aria-label="View side finishing option ${option} larger"></span></button>`;
  }).join("");
  const filamentOptions = renderFilamentSelectOptions();
  const filamentMap = (selected = "White", disabled = false) => renderSideFilamentMap(selected, disabled);
  const option2Rows = [1, 2].map((row) => `
    <div class="side-segment-card">
      <div class="side-segment-head"><span>Extrusion ${row}</span><label class="side-mm-wrap"><input class="side-mm-input" type="number" min="0" max="50" step="1" value="${row === 1 ? 25 : 25}"${row === 2 ? " readonly" : ""} aria-label="Option 2 extrusion ${row} millimeter"></label></div>
      <select class="side-filament-select" hidden aria-label="Option 2 extrusion ${row} 3D filament color">${filamentOptions}</select>
      ${filamentMap("White")}
    </div>`).join("");
  const option3Rows = [1, 2, 3].map((row) => `
    <div class="side-segment-card">
      <div class="side-segment-head"><span>Extrusion ${row === 3 ? 1 : row}</span><label class="side-mm-wrap"><input class="side-mm-input" type="number" min="0" max="25" step="1" value="${row === 1 ? 15 : row === 2 ? 20 : 15}"${row > 1 ? " readonly" : ""} aria-label="Option 3 extrusion ${row === 3 ? 1 : row} millimeter"></label></div>
      <select class="side-filament-select" hidden aria-label="Option 3 extrusion ${row === 3 ? 1 : row} 3D filament color"${row === 3 ? " disabled" : ""}>${filamentOptions}</select>
      ${filamentMap("White", row === 3)}
    </div>`).join("");
  return `<div class="side-finishing-panel"><span>Side Finishing</span><div class="side-finishing-grid">${options}</div><div class="selected-side-finishing">Selected: <strong>Option 1</strong></div><div class="side-finishing-configs"><div class="side-finishing-config" data-config-for="Option 2">${option2Rows}</div><div class="side-finishing-config" data-config-for="Option 3">${option3Rows}</div></div></div>`;
}

function renderCollectDateOptions() {
  const dates = [
    ["standard7", "7 working days", "collect-date-7-working-days.png"],
    ["normal", "4 working days", "collect-date-4-working-days.png"],
    ["quick3", "3 working days", "collect-date-3-working-days.png"],
    ["rush2", "2 working days", "collect-date-2-working-days.png"],
    ["next", "Next working days", "collect-date-next-working-days.png"],
  ];
  const options = dates.map(([key, label, file], index) => {
    const src = `/assets/${file}`;
    return `<button type="button" class="collect-date-option${index === 0 ? " is-selected" : ""}" data-collect="${key}" aria-label="${escapeHtml(label)}"><img src="${src}" alt="${escapeHtml(label)}"><span>${escapeHtml(label)}</span><span class="image-zoom-button" data-zoom-src="${src}" data-zoom-alt="${escapeHtml(label)}" aria-label="View ${escapeHtml(label)} larger"></span></button>`;
  }).join("");
  return `<div class="collect-date-panel"><span>Collect Date</span><div class="collect-date-grid">${options}</div></div>`;
}

function renderDraftPaperOptions() {
  return `<div class="draft-paper-panel"><span>Draft Paper</span><div class="draft-paper-body">
    <div class="draft-paper-scale"><span>File Type</span><select class="draft-paper-scale-select"><option value="Original">Original file</option><option value="10x Reduced">10x Reduced file</option></select></div>
    <div class="draft-paper-upload"><label class="draft-paper-uplabel">Upload Draft Paper (.ai / .pdf)</label><input type="file" class="draft-paper-file" accept=".ai,.pdf"></div>
    <span class="draft-paper-name" data-empty="1">Optional — attach your draft paper file.</span>
  </div></div>`;
}

function renderOrderPanel() {
  return `<div class="order-panel" data-unit-price="634.77">
    <span>Order</span>
    <div class="order-total-row is-active-agent"><span>Agent Price</span><strong class="order-price" data-agent-tier="agent" data-agent-multiplier="1">RM 0.00</strong></div>
    <div class="order-total-row"><span>Silver Agent Price</span><strong class="order-price" data-agent-tier="silver" data-agent-multiplier="0.95">RM 0.00</strong></div>
    <div class="order-total-row"><span>Gold Agent Price</span><strong class="order-price" data-agent-tier="gold" data-agent-multiplier="0.9">RM 0.00</strong></div>
    <div class="order-total-row"><span>Diamond Agent Price</span><strong class="order-price" data-agent-tier="diamond" data-agent-multiplier="0.8">RM 0.00</strong></div>
    <div class="order-quote-note">This configuration is quoted individually — please contact our sales person to request a quotation.</div>
    <div class="order-pending-note"></div>
    <div class="order-quantity-label">Quantity</div>
    <div class="order-quantity-row">
      <button type="button" class="order-qty-button" data-qty-action="minus" aria-label="Decrease quantity">-</button>
      <input class="order-quantity" type="number" min="1" step="1" value="1" aria-label="Quantity">
      <button type="button" class="order-qty-button" data-qty-action="plus" aria-label="Increase quantity">+</button>
    </div>
    <label class="order-terms"><input class="order-terms-checkbox" type="checkbox"> <span>I AGREE TO THE <a href="#" tabindex="-1">terms and conditions</a></span></label>
    <button type="button" class="order-add-button" disabled>ADD TO CART</button>
  </div>`;
}

function renderItemCraftPanel() {
  return `<div class="item-craft-panel is-hidden">
    <span>Special Finishing</span>
    <div class="item-craft-selected">No item selected</div>
    <div class="item-craft-grid">
      <label>Surface Finishing<select class="mounting-select item-craft-select" data-item-craft="finishing"><option>Use Artboard</option><option>None</option><option>UV Printing</option></select></label>
      <label>3D Filament Color<select class="mounting-select item-craft-select" data-item-craft="color"><option>Use Artboard</option>${renderFilamentSelectOptions()}</select></label>
    </div>
    <div class="item-craft-note">This special craft only applies to the selected Letter / Logo.</div>
    <button type="button" class="item-craft-done">Done</button>
  </div>`;
}

function nearestPaletteColor(rgb) {
  const palette = [
    ["White", [255, 255, 255]],
    ["3K Warm", [255, 166, 38]],
    ["4.5K Warm", [255, 240, 165]],
    ["Red", [255, 0, 0]],
    ["Lemon Yellow", [230, 255, 0]],
    ["Yellow", [255, 220, 0]],
    ["Orange", [255, 128, 0]],
    ["Ice Blue", [77, 217, 255]],
    ["Blue", [0, 60, 255]],
    ["Green", [0, 220, 90]],
    ["Pink", [255, 55, 165]],
    ["Purple", [128, 0, 255]],
    ["RGB", [100, 220, 180]],
  ];
  if (!Array.isArray(rgb) || rgb.length < 3) return null;
  let best = null;
  let bestDistance = Infinity;
  for (const [name, target] of palette) {
    const distance = (rgb[0] - target[0]) ** 2 + (rgb[1] - target[1]) ** 2 + (rgb[2] - target[2]) ** 2;
    if (distance < bestDistance) {
      best = name;
      bestDistance = distance;
    }
  }
  return best;
}

function colorDistance(rgb, target) {
  return (rgb[0] - target[0]) ** 2 + (rgb[1] - target[1]) ** 2 + (rgb[2] - target[2]) ** 2;
}

function resolveSimilarWarmColors(byColor, selected) {
  if (!selected.has("3K Warm") || !selected.has("Orange") || !Array.isArray(byColor)) return selected;
  let totalWeight = 0;
  const average = [0, 0, 0];
  for (const item of byColor) {
    const name = nearestPaletteColor(item.rgb);
    if (name !== "3K Warm" && name !== "Orange") continue;
    const weight = Number(item.length_m) || 1;
    totalWeight += weight;
    average[0] += item.rgb[0] * weight;
    average[1] += item.rgb[1] * weight;
    average[2] += item.rgb[2] * weight;
  }
  if (!totalWeight) return selected;
  average[0] /= totalWeight;
  average[1] /= totalWeight;
  average[2] /= totalWeight;
  const orangeDistance = colorDistance(average, [255, 128, 0]);
  const warmDistance = colorDistance(average, [255, 166, 38]);
  if (orangeDistance <= warmDistance) {
    selected.delete("3K Warm");
  } else {
    selected.delete("Orange");
  }
  return selected;
}

function detectedPaletteColors(byColor) {
  const selected = new Set();
  if (Array.isArray(byColor)) {
    for (const item of byColor) {
      const name = nearestPaletteColor(item.rgb);
      if (name) selected.add(name);
    }
  }
  resolveSimilarWarmColors(byColor, selected);
  return selected.size ? selected : new Set(["White"]);
}

function renderColorPicker(byColor) {
  const colors = [
    ["White", "filament-white.jpg"],
    ["Translucent White", "filament-translucent-white.jpg"],
    ["Translucent Red", "filament-translucent-red.jpg"],
    ["Translucent Yellow", "filament-translucent-yellow.jpg"],
    ["Translucent Green", "filament-translucent-green.jpg"],
    ["Translucent Blue", "filament-translucent-blue.jpg"],
    ["Translucent Orange", "filament-translucent-orange.jpg"],
    ["Translucent Cyclamen", "filament-translucent-cyclamen.jpg"],
  ];
  const availableColors = new Set(colors.map(([color]) => color));
  const selectedColors = new Set(Array.from(detectedPaletteColors(byColor)).map((color) => ({
    "3K Warm": "Translucent Orange",
    "4.5K Warm": "Translucent White",
    Red: "Translucent Red",
    Yellow: "Translucent Yellow",
    "Lemon Yellow": "Translucent Yellow",
    Green: "Translucent Green",
    "Ice Blue": "Translucent Blue",
    Blue: "Translucent Blue",
    Orange: "Translucent Orange",
    Purple: "Translucent Cyclamen",
    Pink: "Translucent Cyclamen",
    RGB: "Translucent Green",
  })[color] || color).filter((color) => availableColors.has(color)));
  if (!selectedColors.size) selectedColors.add("White");
  const selectedColor = selectedColors.values().next().value || "White";
  const options = colors.map(([color, file]) => {
    return `<button type="button" class="color-option${selectedColor === color ? " is-selected" : ""}" data-color="${escapeHtml(color)}" aria-label="${escapeHtml(color)}"><img src="/assets/${escapeHtml(file)}" alt="${escapeHtml(color)} filament"></button>`;
  }).join("");
  return `<div class="color-picker"><span>3D Filament Color</span><div class="color-map">${options}</div><div class="selected-color">Selected: <strong>${escapeHtml(selectedColor)}</strong></div></div>`;
}

function renderFilamentSelectOptions() {
  return [
    "White",
    "Translucent White",
    "Translucent Red",
    "Translucent Yellow",
    "Translucent Green",
    "Translucent Blue",
    "Translucent Orange",
    "Translucent Cyclamen",
  ].map((color) => `<option value="${escapeHtml(color)}">${escapeHtml(color)}</option>`).join("");
}

function filamentColorOptions() {
  return [
    ["White", "filament-white.jpg"],
    ["Translucent White", "filament-translucent-white.jpg"],
    ["Translucent Red", "filament-translucent-red.jpg"],
    ["Translucent Yellow", "filament-translucent-yellow.jpg"],
    ["Translucent Green", "filament-translucent-green.jpg"],
    ["Translucent Blue", "filament-translucent-blue.jpg"],
    ["Translucent Orange", "filament-translucent-orange.jpg"],
    ["Translucent Cyclamen", "filament-translucent-cyclamen.jpg"],
  ];
}

function renderSideFilamentMap(selectedColor = "White", disabled = false) {
  const buttons = filamentColorOptions().map(([color, file]) => {
    return `<button type="button" class="side-filament-option${selectedColor === color ? " is-selected" : ""}" data-side-color="${escapeHtml(color)}" aria-label="${escapeHtml(color)}"${disabled ? " disabled" : ""}><img src="/assets/${escapeHtml(file)}" alt="${escapeHtml(color)} filament"></button>`;
  }).join("");
  return `<div class="side-filament-map">${buttons}</div>`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks);
}

function parseMultipart(buffer, contentType) {
  const boundaryMatch = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType || "");
  if (!boundaryMatch) return null;
  const boundaryText = boundaryMatch[1] || boundaryMatch[2];
  const boundary = Buffer.from(`--${boundaryText}`);
  const result = { file: null, spec: null, fields: {} };
  let start = buffer.indexOf(boundary);
  while (start >= 0) {
    const headerStart = start + boundary.length + 2;
    const headerEnd = buffer.indexOf(Buffer.from("\r\n\r\n"), headerStart);
    if (headerEnd < 0) break;
    const nextBoundary = buffer.indexOf(Buffer.from(`\r\n--${boundaryText}`), headerEnd + 4);
    if (nextBoundary < 0) break;
    const headers = buffer.slice(headerStart, headerEnd).toString("latin1");
    const nameMatch = /name="([^"]+)"/i.exec(headers);
    const filenameMatch = /filename="([^"]*)"/i.exec(headers);
    const data = buffer.slice(headerEnd + 4, nextBoundary);
    if (nameMatch && filenameMatch && filenameMatch[1]) {
      const fname = path.basename(filenameMatch[1]);
      // A .json upload is the Illustrator "spec" sidecar (exact grouping + sizes);
      // the .ai/.pdf is the artwork used for rendering.
      if (/\.json$/i.test(fname)) {
        try { result.spec = JSON.parse(data.toString("utf8")); } catch (e) { /* ignore malformed spec */ }
      } else {
        result.file = { filename: fname, data };
      }
    } else if (nameMatch) {
      result.fields[nameMatch[1]] = data.toString("utf8").trim();
    }
    start = buffer.indexOf(boundary, nextBoundary + 2);
  }
  return result.file ? result : null;
}

function applyWordingLabels(result, wordingText) {
  const labels = String(wordingText || "").replace(/\s+/g, "").split("").filter(Boolean);
  if (labels.length === 0) return result;
  const relabel = (dimensions) => {
    if (!Array.isArray(dimensions)) return;
    let index = 0;
    for (const item of dimensions) {
      if (index >= labels.length) break;
      if (String(item.label || "").startsWith("Letter") || item.source === "raster-outline") {
        item.label = labels[index];
        index += 1;
      }
    }
  };
  relabel(result.letter_dimensions);
  if (Array.isArray(result.artboards)) {
    for (const artboard of result.artboards) {
      relabel(artboard.letter_dimensions);
      if (Array.isArray(artboard.designs)) {
        for (const design of artboard.designs) relabel(design.letter_dimensions);
      }
    }
  }
  return result;
}

function previewUrl(name) {
  return `/previews/${encodeURIComponent(name)}`;
}

function hasNeonLines(item) {
  return Number(item && item.total_length_m_neon) > 0 && Number(item && item.path_count_neon) > 0;
}

function attachExpectedPreviewUrls(result, id) {
  const dimensionBase = `${id}-dimension`;
  const lineBase = `${id}-lines`;
  result.dimension_preview_url = previewUrl(`${dimensionBase}-artboard-1.jpg`);
  result.line_preview_url = hasNeonLines(result) ? previewUrl(`${lineBase}-artboard-1.jpg`) : null;
  if (Array.isArray(result.artboards)) {
    result.artboards = result.artboards.map((artboard) => {
      const page = artboard.page || 1;
      const designs = Array.isArray(artboard.designs) ? artboard.designs.map((design) => {
        const designNumber = design.design || 1;
        return {
          ...design,
          dimension_preview_url: previewUrl(`${dimensionBase}-artboard-${page}-design-${designNumber}.jpg`),
          line_preview_url: hasNeonLines(design) ? previewUrl(`${lineBase}-artboard-${page}-design-${designNumber}.jpg`) : null,
        };
      }) : [];
      return {
        ...artboard,
        dimension_preview_url: previewUrl(`${dimensionBase}-artboard-${page}.jpg`),
        line_preview_url: hasNeonLines(artboard) ? previewUrl(`${lineBase}-artboard-${page}.jpg`) : null,
        designs,
      };
    });
  }
  return result;
}

async function analyzeUpload(file, measurementScale = 1, wordingText = "", spec = null) {
  // Run the ported TypeScript analyzer directly on the uploaded bytes. The
  // analyzer already attaches dimension_preview_url / line_preview_url (inline
  // data URLs) at the top level and on every artboard / design. When a spec sidecar
  // is uploaded, records come straight from the file's real grouping + sizes.
  const bytes = file.data instanceof Uint8Array ? file.data : new Uint8Array(file.data);
  const result = await analyzeBoxup(bytes, file.filename, measurementScale, spec);
  return applyWordingLabels(result, wordingText);
}

// ---- Request handlers used by the Next.js route (app/3d-box-up/app/route.ts) ----

export async function renderGet(appRoute = "/3d-box-up/app") {
  // Build marker so a deploy can be detected from a plain GET (see the 504 fix).
  return rewriteAssets(html(), appRoute) + "\n<!--sf-build:ocr-timeout-->";
}

export async function renderPost(body, contentType, appRoute = "/3d-box-up/app") {
  try {
    let file, fields = {}, spec = null, artwork = null;
    if ((contentType || "").includes("application/x-www-form-urlencoded")) {
      // The browser saved the file to the backend and sent its URL — that file
      // IS the order's artwork; remember it so the result carries it to the cart.
      const params = new URLSearchParams(body.toString("utf8"));
      const fileUrl = params.get("fileUrl");
      if (!fileUrl) throw new Error("Please choose an .ai or .pdf file.");
      params.forEach((v, k) => { if (k !== "fileUrl") fields[k] = v; });
      if (fields.spec) { try { spec = JSON.parse(fields.spec); } catch (e) { /* ignore */ } }
      const res = await fetch(fileUrl);
      if (!res.ok) throw new Error("Could not fetch the uploaded file (" + res.status + ").");
      const filename = fields.artworkName || fileUrl.split("/").pop() || "artwork";
      file = { filename, data: Buffer.from(await res.arrayBuffer()) };
      artwork = { url: fileUrl, name: filename };
    } else {
      const upload = parseMultipart(body, contentType);
      if (!upload) throw new Error("Please choose an .ai or .pdf file.");
      file = upload.file; fields = upload.fields; spec = upload.spec;
    }
    const measurementScale = fields.measurementScale === "10" ? 10 : 1;
    // Diagnostic only: skip OCR to isolate whether tesseract is the Vercel stall.
    globalThis.__SF_SKIP_OCR = fields.__diag === "nocr";
    let result;
    try {
      result = await analyzeUpload(file, measurementScale, fields.wordingText || "", spec || null);
    } finally {
      globalThis.__SF_SKIP_OCR = false;
    }
    return rewriteAssets(html(result), appRoute, artwork);
  } catch (error) {
    return rewriteAssets(html(null, error.message || String(error)), appRoute);
  }
}

// Rewrite original absolute paths to the routes used by the unified app: assets
// under /3d-box-up/assets, the Three.js vendor under /3d-box-up/vendor, and the
// form posts back to the route the page is served from.
// Banner-style hero image at the top of the 3D Box Up page (like the Banner
// page). Shows /3d-box-up/hero.png when present, otherwise a styled placeholder.
const HERO_BANNER = `<style>
.tdhero{position:relative;margin:0 0 22px;aspect-ratio:3/1;border-radius:16px;overflow:hidden;border:1px solid rgba(57,151,255,.45);background:linear-gradient(135deg,#0a1730,#04101f);display:grid;place-items:center}
.tdhero .tdhero-bg{position:absolute;inset:0;z-index:0;width:100%;height:100%;object-fit:cover;filter:blur(22px) brightness(.5);transform:scale(1.12)}
.tdhero .tdhero-img{position:absolute;inset:0;z-index:1;width:100%;height:100%;object-fit:contain;display:block}
.tdhero .tdhero-fallback{position:absolute;z-index:0;text-align:center;text-transform:uppercase;pointer-events:none}
.tdhero .tdhero-fallback strong{display:block;color:#e8f2ff;font-size:clamp(22px,3.4vw,40px);font-weight:800;letter-spacing:.05em;text-shadow:0 0 22px rgba(53,216,255,.55)}
.tdhero .tdhero-fallback span{font-size:clamp(11px,1.4vw,15px);letter-spacing:.28em;color:#8fb4e6}
</style>
<div class="tdhero"><img class="tdhero-bg" src="/3d-box-up/hero.png" alt="" aria-hidden="true" onerror="this.style.display='none'"><img class="tdhero-img" src="/3d-box-up/hero.png" alt="3D Box Up" onerror="this.style.display='none'"><div class="tdhero-fallback"><strong>3D Box Up</strong><span>LED Box-Up Letters</span></div></div>`;

// HD-render overlay for the 3D preview: shows /3d-box-up/render/<led>.png by
// default (exact high-def look per LED colour) with a button to switch to the
// rotatable WebGL preview. Falls back to WebGL when no render image exists.
const LED_HD_FEATURE = `<style>
/* Letter / Logo records panel only — tidy buttons (2x2), and keep the size /
   price on the right without overlapping the preview image. Other panels untouched. */
.letter-dimension-list{overflow-x:hidden !important;padding-right:14px !important;scrollbar-gutter:stable !important}
.letter-dimension-head{padding-right:20px !important}
.letter-dimensions-title{flex-direction:column !important;align-items:stretch !important;gap:8px !important}
.record-action-buttons{display:grid !important;grid-template-columns:1fr 1fr !important;gap:6px !important}
.record-action-buttons button{width:100% !important;min-width:0 !important;white-space:nowrap !important}
.letter-dimension-item{display:grid !important;grid-template-columns:minmax(0,1fr) auto !important;flex-wrap:nowrap !important;gap:7px !important;align-items:center !important;padding-left:8px !important;padding-right:8px !important}
.letter-item-preview{min-width:0 !important;overflow:hidden !important}
.letter-item-preview strong{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.letter-item-preview img,.group-preview-stack{width:42px !important;height:42px !important;flex:0 0 auto !important}
.letter-dimension-size{justify-self:end !important;white-space:nowrap !important;text-align:right !important;font-size:10px !important}
.letter-item-price{font-size:11px !important}
.craft-3d-stage{position:relative}
.led-hd-overlay{position:absolute;inset:0;z-index:6;display:none;background:#05080f;border-radius:inherit;overflow:hidden}
.craft-3d-preview.hd-mode .led-hd-overlay{display:block}
.craft-3d-preview.hd-mode.hd-missing .led-hd-overlay{display:none}
.led-hd-img{width:100%;height:100%;object-fit:contain;display:block}
.led-hd-toggle{position:absolute;left:12px;bottom:12px;z-index:7;display:inline-flex;align-items:center;gap:6px;padding:8px 14px;border-radius:10px;border:1px solid rgba(57,151,255,.6);background:rgba(3,10,22,.7);color:#eaf4ff;font-size:12px;font-weight:700;cursor:pointer;backdrop-filter:blur(4px)}
.led-hd-toggle:hover{border-color:#35d8ff;background:rgba(53,216,255,.18)}
.craft-3d-preview.hd-missing .led-hd-toggle{display:none}
</style>
<script>(function(){
  var MAP={"3000K":"/3d-box-up/render/3000k.png","4000K":"/3d-box-up/render/4200k.png","10000K":"/3d-box-up/render/10000k.png","None":"/3d-box-up/render/none.png"};
  function ledOf(root){try{var s=(root||document).querySelector(".led-color-option.is-selected");return s?s.getAttribute("data-led-color"):"None";}catch(e){return "None";}}
  function enhance(preview){
    try{
      if(preview.dataset.hdEnhanced)return; preview.dataset.hdEnhanced="1";
      var stage=preview.querySelector(".craft-3d-stage")||preview;
      var overlay=document.createElement("div"); overlay.className="led-hd-overlay";
      var img=document.createElement("img"); img.className="led-hd-img"; img.alt="LED render";
      img.addEventListener("error",function(){preview.classList.add("hd-missing");});
      img.addEventListener("load",function(){preview.classList.remove("hd-missing");});
      overlay.appendChild(img); stage.appendChild(overlay);
      var btn=document.createElement("button"); btn.type="button"; btn.className="led-hd-toggle"; btn.textContent="3D Interactive";
      preview.appendChild(btn);
      preview.classList.add("hd-mode");
      var scope=preview.closest(".result, .design-card")||document;
      function update(){var url=MAP[ledOf(scope)]||MAP["None"]; if(img.getAttribute("src")!==url){preview.classList.remove("hd-missing"); img.setAttribute("src",url);}}
      btn.addEventListener("click",function(){preview.classList.toggle("hd-mode"); btn.textContent=preview.classList.contains("hd-mode")?"3D Interactive":"Show Photo";});
      scope.addEventListener("click",function(e){if(e.target.closest&&e.target.closest(".led-color-option"))setTimeout(update,40);});
      update();
    }catch(e){}
  }
  function scan(){try{document.querySelectorAll(".craft-3d-preview").forEach(enhance);}catch(e){}}
  if(document.readyState!=="loading")scan(); else document.addEventListener("DOMContentLoaded",scan);
  try{new MutationObserver(scan).observe(document.documentElement,{childList:true,subtree:true});}catch(e){}
})();</script>`;

// Intercepts the artwork form submit: uploads the (possibly large) .ai/.pdf to
// the backend and posts only the URL to the analyze route, bypassing the
// serverless request-body limit that was causing 413 / "no reflect".
const UPLOAD_BRIDGE_SCRIPT = `<script>(function(){
  function ov(){ var o=document.getElementById("sf-up-ov"); if(o) return o; o=document.createElement("div"); o.id="sf-up-ov"; o.style.cssText="position:fixed;inset:0;z-index:99999;display:none;align-items:center;justify-content:center;background:rgba(3,8,19,.75)"; o.innerHTML='<div style="width:min(360px,86vw);background:#0b1220;border:1px solid rgba(56,189,248,.4);border-radius:16px;padding:22px 24px;text-align:center;color:#e6eefc;font-family:system-ui,-apple-system,sans-serif;box-shadow:0 20px 60px rgba(0,0,0,.5)"><div id="sf-up-l" style="font-size:15px;font-weight:600;margin-bottom:12px">Uploading…</div><div style="height:10px;border-radius:99px;background:rgba(255,255,255,.12);overflow:hidden"><div id="sf-up-b" style="height:100%;width:0%;background:linear-gradient(90deg,#3b82f6,#35d8ff);transition:width .15s"></div></div><div id="sf-up-p" style="font-size:13px;color:#9fb3c8;margin-top:8px">0%</div></div>'; document.body.appendChild(o); return o; }
  function show(l){ var o=ov(); o.style.display="flex"; set(0); lab(l); }
  function hide(){ var o=document.getElementById("sf-up-ov"); if(o) o.style.display="none"; }
  function set(p){ var b=document.getElementById("sf-up-b"),t=document.getElementById("sf-up-p"); if(b)b.style.width=p+"%"; if(t)t.textContent=p+"%"; }
  function lab(s){ var l=document.getElementById("sf-up-l"); if(l)l.textContent=s; }
  function analyzing(){ lab("Analyzing your artwork…"); set(100); var t=document.getElementById("sf-up-p"); if(t)t.textContent="Please wait…"; }
  function render(h){ document.open(); document.write(h); document.close(); }
  function fail(m){ hide(); alert(m); }
  function bind(){
    var fi=document.querySelector('form[enctype="multipart/form-data"] input[type="file"][name="file"]'); var form=fi&&fi.form; if(!form||form.__sfBound) return; form.__sfBound=true;
    var API=(location.hostname==="localhost"||location.hostname==="127.0.0.1")?"http://localhost:3333":"https://api.signfuturegroup.com";
    form.addEventListener("submit",function(e){
      var f=form.querySelector('input[type="file"][name="file"]'); if(!f||!f.files||!f.files[0]) return; e.preventDefault();
      var file=f.files[0]; show("Uploading your artwork…");
      // Upload the file ONCE to the backend, then analyze it by URL. Uploading it
      // twice in parallel (analyze route + artwork save) split the uplink and
      // slowed the progress bar; the single upload IS the artwork and the analyze
      // route fetches it server-side, so the result page always sets __SF_ARTWORK.
      var fd=new FormData(); fd.append("file",file);
      var up=new XMLHttpRequest(); up.open("POST",API+"/api/v1/uploads/artwork");
      up.upload.onprogress=function(ev){ if(ev.lengthComputable) set(Math.round(ev.loaded/ev.total*100)); };
      up.onload=function(){ if(up.status<200||up.status>=300){ fail("Upload failed ("+up.status+")."); return; } var j; try{ j=JSON.parse(up.responseText); }catch(_){ fail("Upload failed (bad response)."); return; } analyzing(); var url=/^https?:/.test(j.url)?j.url:API+j.url; var params=new URLSearchParams(); params.set("fileUrl",url); params.set("artworkName",file.name); new FormData(form).forEach(function(v,k){ if(k!=="file"&&typeof v==="string") params.set(k,v); }); fetch(form.getAttribute("action"),{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:params}).then(function(r){ return r.text(); }).then(render).catch(function(err){ fail("Could not analyze the file: "+(err&&err.message||err)); }); };
      up.onerror=function(){ fail("Upload failed (network)."); }; up.send(fd);
    });
  }
  if(document.readyState!=="loading") bind(); else document.addEventListener("DOMContentLoaded",bind);
})();</script>`;

// Draft Paper: a SECOND, optional upload. On file pick, upload it to the same
// artwork endpoint and stash {url,name} on the card as __sfDraftPaper; the
// add-to-cart handler then sends it as a second artwork on the order.
const DRAFT_PAPER_SCRIPT = `<script>(function(){
  var API=(location.hostname==="localhost"||location.hostname==="127.0.0.1")?"http://localhost:3333":"https://api.signfuturegroup.com";
  document.addEventListener("change",function(e){
    var input=e.target;
    if(!input||!input.classList||!input.classList.contains("draft-paper-file")) return;
    var file=input.files&&input.files[0]; if(!file) return;
    var card=input.closest&&input.closest(".result, .design-card");
    var nameEl=card&&card.querySelector(".draft-paper-name");
    if(nameEl){ nameEl.removeAttribute("data-empty"); nameEl.textContent="Uploading "+file.name+"..."; }
    var fd=new FormData(); fd.append("file",file);
    var up=new XMLHttpRequest(); up.open("POST",API+"/api/v1/uploads/artwork");
    up.onload=function(){
      if(up.status<200||up.status>=300){ if(nameEl){ nameEl.setAttribute("data-empty","1"); nameEl.textContent="Upload failed ("+up.status+"). Try again."; } return; }
      var j; try{ j=JSON.parse(up.responseText); }catch(_){ if(nameEl){ nameEl.setAttribute("data-empty","1"); nameEl.textContent="Upload failed (bad response)."; } return; }
      var url=/^https?:/.test(j.url)?j.url:API+j.url;
      if(card) card.__sfDraftPaper={ url:url, name:file.name };
      if(nameEl){ nameEl.removeAttribute("data-empty"); nameEl.textContent="Attached: "+file.name; }
    };
    up.onerror=function(){ if(nameEl){ nameEl.setAttribute("data-empty","1"); nameEl.textContent="Upload failed (network)."; } };
    up.send(fd);
  });
})();</script>`;

function rewriteAssets(markup, appRoute = "/3d-box-up/app", artwork) {
  const signboardFlag = appRoute.indexOf("3d-signboard") !== -1
    ? '<script>window.__SIGNBOARD_MODE__=true;</script><script type="module" src="/3d-box-up/assets/signboard.js"></script>'
    : "";
  const artScript =
    artwork && artwork.url
      ? `<script>window.__SF_ARTWORK=${JSON.stringify({ url: artwork.url, name: artwork.name })};</script>`
      : "";
  return markup
    .split("</body>").join(signboardFlag + LED_HD_FEATURE + artScript + UPLOAD_BRIDGE_SCRIPT + DRAFT_PAPER_SCRIPT + "</body>")
    .split("<body><main>").join("<body><main>" + HERO_BANNER)
    .split('action="/analyze"').join('action="' + appRoute + '"')
    .split('href="/"').join('href="' + appRoute + '"')
    .split('"/vendor/').join('"/3d-box-up/vendor/')
    .split('"/assets/').join('"/3d-box-up/assets/')
    .split("'/vendor/").join("'/3d-box-up/vendor/")
    .split("'/assets/").join("'/3d-box-up/assets/")
    .split('src="/assets/').join('src="/3d-box-up/assets/')
    .split('url(/assets/').join('url(/3d-box-up/assets/')
    .split('fetch("/assets/').join('fetch("/3d-box-up/assets/')
    .split("fetch('/assets/").join("fetch('/3d-box-up/assets/");
}
