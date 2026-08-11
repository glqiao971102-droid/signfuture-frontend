// Adapted from neon line/tools/ai_measure_server.mjs for the unified Next.js app.
// The HTTP server, filesystem access and Python subprocess have been removed;
// analysis is performed by the ported TypeScript analyzer (./analyze) and
// previews are returned inline as data URLs. The HTML/CSS/JS and pricing logic
// are otherwise unchanged from the original.
import path from "node:path";
import { analyzeNeon } from "./analyze";

export const htmlHeaders = {
  "Content-Type": "text/html; charset=utf-8",
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  "Pragma": "no-cache",
  "Expires": "0",
};

async function readNeonPricing() {
  // The admin pricing file is not bundled; the original always falls back to
  // these defaults (which the live price math does not actually consume).
  return defaultNeonPricing();
}

function defaultNeonPricing() {
  return {
    pricePerMeter: 10,
    backingMaterial: "6mm Clear Acrylic",
    backingPricePerSqft: 18,
    uvPricePerSqft: 0,
    transformerCost: 45,
    installationCost: 150,
    otherCost: 0
  };
}

function normalizeNeonPricing(pricing) {
  return { ...defaultNeonPricing(), ...(pricing || {}) };
}

function formatRM(value) {
  return `RM ${Number(value || 0).toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function priceDetails(content, lineMeters, pricing) {
  const widthIn = content ? Math.ceil(Number(content.width_in || 0) / 6) * 6 : 0;
  const heightIn = content ? Math.ceil(Number(content.height_in || 0) / 6) * 6 : 0;
  const widthFt = widthIn / 12;
  const heightFt = heightIn / 12;
  const sqft = widthFt * heightFt;
  const neonCost = Number(lineMeters || 0) * 25;
  const backingCost = sqft * 15;
  const uvCost = sqft * 7;
  const extraCost = 0;
  return {
    widthIn,
    heightIn,
    widthFt,
    heightFt,
    sqft,
    neonCost,
    backingCost,
    uvCost,
    extraCost,
    totalWithoutUv: neonCost + backingCost + extraCost,
    totalWithUv: neonCost + backingCost + uvCost + extraCost
  };
}

function html(result, error, pricing = defaultNeonPricing()) {
  let report = "";
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
          line_preview_url: result.line_preview_url,
        }];
    const artboardBlocks = artboards.map((artboard) => renderArtboard(artboard, pricing)).join("");
    report = `
      <section class="multi-result">
        <button type="button" class="close-result close-results" aria-label="Close results">&times;</button>
        <h2>${escapeHtml(result.file)}</h2>
        ${artboardBlocks}
      </section>`;
  } else {
    // Before any upload: show all the options (mounting, colors, remark, collect
    // date, order) with empty preview frames. The Dimension/Line Preview images
    // only appear once the customer uploads their artwork.
    const placeholder = {
      name: "Neon Sign",
      isPlaceholder: true,
      content_bbox_in: null,
      total_length_m_neon: 0,
      by_color: {},
      dimension_preview_url: null,
      line_preview_url: null,
    };
    report = `
      <section class="multi-result preview-only">
        <h2>Neon Sign</h2>
        ${renderArtboard(placeholder, pricing)}
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
  <title>Neon Line Calculator</title>
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
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 20px;
      align-items: start;
      justify-content: space-between;
      border: 1px solid rgba(75, 146, 255, 0.42);
      border-radius: 14px;
      padding: 18px;
      background: linear-gradient(180deg, rgba(8, 24, 47, 0.82), rgba(4, 13, 27, 0.88));
      box-shadow: inset 0 0 30px rgba(50, 139, 255, 0.08);
    }
    .multi-result .result { margin-top: 16px; }
    .artboard-header {
      grid-column: 1 / -1;
      display: flex;
      align-items: center;
      gap: 12px;
      min-width: 0;
      padding-right: 44px;
    }
    .artboard-mark {
      width: 44px;
      height: 44px;
      border: 1px solid rgba(53, 216, 255, 0.72);
      border-radius: 8px;
      display: grid;
      place-items: center;
      color: #35d8ff;
      font-weight: 900;
      box-shadow: 0 0 18px rgba(53, 216, 255, 0.28), inset 0 0 18px rgba(53, 216, 255, 0.08);
    }
    .artboard-header h3 { margin: 0; font-size: 22px; color: #f7fbff; }
    .artboard-header p { margin: 5px 0 0; color: #a9c5e8; font-size: 13px; }
    .preview-workspace { display: grid; grid-template-columns: 1fr; gap: 10px; min-width: 0; }
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
    .design-body { display: grid; grid-template-columns: minmax(0, 781px) 430px; gap: 18px; align-items: stretch; justify-content: space-between; }
    .result-info { width: 460px; justify-self: end; }
    .metrics { display: grid; grid-template-columns: 1fr; gap: 10px; }
    .base-options { display: grid; grid-template-columns: 1fr 1fr; gap: 0; }
    .base-options:has(.base-finishing.is-hidden) { grid-template-columns: 1fr; }
    .base-options > div {
      border: 1px solid rgba(63, 176, 255, 0.58);
      padding: 10px;
      background: rgba(3, 15, 31, 0.82);
      box-shadow: inset 0 0 18px rgba(53, 216, 255, 0.08);
    }
    .metrics > div, .summary-card, .tip-panel {
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
    .step-panel { padding: 16px; }
    .step-heading {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 14px;
    }
    .step-dot {
      width: 24px;
      height: 24px;
      border-radius: 50%;
      display: grid;
      place-items: center;
      flex: 0 0 auto;
      color: #fff;
      font-weight: 900;
      font-size: 13px;
      background: linear-gradient(135deg, #7c4dff, #1ecbff);
      box-shadow: 0 0 18px rgba(103, 96, 255, 0.58);
    }
    .step-heading h4 { margin: 0; color: #f7fbff; font-size: 15px; text-transform: uppercase; letter-spacing: 0.4px; }
    .step-heading p { margin: 3px 0 0; color: #a9c5e8; font-size: 12px; }
    .base-options > div:first-child { border-radius: 12px 0 0 12px; }
    .base-options > div:last-child { border-left: 0; border-radius: 0 12px 12px 0; }
    .base-options:has(.base-finishing.is-hidden) > div:first-child { border-radius: 12px; }
    .color-picker { padding: 16px; }
    .color-picker span { margin: 0 0 8px; }
    .color-map {
      position: relative;
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 8px;
      border: 1px solid rgba(63, 176, 255, 0.58);
      border-radius: 10px;
      overflow: hidden;
      background: #020712;
      box-shadow: inset 0 0 18px rgba(53, 216, 255, 0.08);
    }
    .color-map > img { display: none; }
    .color-option {
      position: relative;
      min-width: 0;
      aspect-ratio: 611 / 523;
      border: 2px solid transparent;
      border-radius: 8px;
      padding: 0;
      background: rgba(0, 0, 0, 0.38);
      cursor: pointer;
      overflow: hidden;
      transition: border-color 120ms ease, box-shadow 120ms ease, background 120ms ease;
    }
    .color-option img {
      width: 100%;
      height: 100%;
      display: block;
      object-fit: cover;
      pointer-events: none;
    }
    .color-option:hover {
      border-color: #35d8ff;
      background: rgba(53, 216, 255, 0.08);
      box-shadow: 0 0 16px rgba(53, 216, 255, 0.85), inset 0 0 12px rgba(53, 216, 255, 0.16);
    }
    .color-option.is-selected {
      border-color: #35d8ff;
      background: rgba(53, 216, 255, 0.16);
      box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.8), 0 0 24px rgba(53, 216, 255, 0.95), inset 0 0 18px rgba(53, 216, 255, 0.28);
    }
    .color-option.is-selected::after {
      content: "\\2713";
      position: absolute;
      top: 5px;
      right: 5px;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      display: grid;
      place-items: center;
      color: #03101f;
      font-size: 13px;
      font-weight: 900;
      background: #35d8ff;
      box-shadow: 0 0 12px rgba(53, 216, 255, 0.85);
    }
    .color-picker.has-rgb-selected .color-option:not([data-color="RGB"]) {
      cursor: not-allowed;
    }
    .color-picker.has-rgb-selected .color-option:not([data-color="RGB"])::before {
      content: "";
      position: absolute;
      inset: 0;
      z-index: 2;
      background: rgba(0, 0, 0, 0.7);
      pointer-events: none;
    }
    .selected-color {
      margin-top: 7px;
      color: #9fc8f4;
      font-size: 12px;
      text-align: center;
    }
    .selected-color strong {
      color: #dbe8ff;
      font-size: 15px;
      font-weight: 600;
      line-height: 1.35;
      text-shadow: 0 0 8px rgba(94, 190, 255, 0.28);
    }
    .ai-filter-panel {
      display: grid;
      gap: 7px;
      margin: 0 0 10px;
      padding: 9px 10px;
      border: 1px solid rgba(53, 216, 255, 0.46);
      border-radius: 9px;
      background: rgba(3, 15, 31, 0.76);
      box-shadow: inset 0 0 14px rgba(53, 216, 255, 0.08);
      cursor: pointer;
      transition: border-color 120ms ease, box-shadow 120ms ease, background 120ms ease;
    }
    .ai-filter-panel:hover,
    .ai-filter-panel.is-active {
      border-color: rgba(53, 216, 255, 0.9);
      background: rgba(53, 216, 255, 0.1);
      box-shadow: 0 0 18px rgba(53, 216, 255, 0.26), inset 0 0 18px rgba(53, 216, 255, 0.1);
    }
    .ai-filter-panel > span {
      margin: 0;
      color: #6eb6ff;
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.7px;
    }
    .ai-filter-list {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .ai-filter-list em {
      display: inline-flex;
      align-items: center;
      min-height: 22px;
      padding: 3px 8px;
      border: 1px solid rgba(63, 176, 255, 0.48);
      border-radius: 999px;
      color: #dbe8ff;
      font-size: 11px;
      font-style: normal;
      font-weight: 700;
      background: rgba(53, 216, 255, 0.09);
    }
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
    .collect-date-panel > span {
      display: block;
      color: #6eb6ff;
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.7px;
      margin-bottom: 8px;
    }
    .remark-field {
      width: calc(100% - 4px);
      min-width: 0;
      height: 86px;
      box-sizing: border-box;
      margin: 0 4px 6px 0;
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
      height: 168px;
      border: 1px solid rgba(63, 176, 255, 0.58);
      border-radius: 8px;
      background: rgba(3, 15, 31, 0.95);
      color: #f7fbff;
      font-weight: 800;
      font-size: 12px;
      padding: 5px;
      overflow: hidden;
      display: grid;
      grid-template-rows: minmax(0, 1fr) 20px;
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
    .collect-date-option span {
      display: block;
      margin: 0;
      color: #f7fbff;
      font-size: 12px;
      line-height: 20px;
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
      box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.75), 0 0 18px rgba(53, 216, 255, 0.7), inset 0 0 20px rgba(53, 216, 255, 0.18);
    }
    .collect-date-option.is-disabled {
      opacity: 0.45; filter: grayscale(0.65); pointer-events: none; cursor: not-allowed;
    }
    .collect-date-option.is-disabled::after {
      content: "Closed after 4:00pm"; position: absolute; left: 6px; right: 6px; bottom: 6px;
      padding: 3px 4px; border-radius: 5px; background: rgba(196, 24, 44, 0.92);
      color: #fff; font-size: 10px; font-weight: 800; text-align: center;
    }
    .collect-date-option .collect-date-zoom {
      position: absolute;
      top: 7px;
      right: 7px;
      z-index: 3;
      width: 24px;
      height: 24px;
      border-radius: 50%;
      display: grid;
      place-items: center;
      margin: 0;
      color: #03101f;
      font-size: 15px;
      font-weight: 900;
      line-height: 1;
      background: #35d8ff;
      box-shadow: 0 0 12px rgba(53, 216, 255, 0.85);
      pointer-events: auto;
    }
    .checkout-panel {
      display: grid;
      gap: 10px;
    }
    .checkout-panel > span {
      display: block;
      color: #6eb6ff;
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.7px;
    }
    .terms-row {
      display: grid;
      grid-template-columns: 20px minmax(0, 1fr);
      gap: 9px;
      align-items: start;
      color: #dbe8ff;
      font-size: 12px;
      line-height: 1.35;
    }
    .terms-row input {
      width: 18px;
      height: 18px;
      margin: 0;
      accent-color: #35d8ff;
      cursor: pointer;
    }
    .terms-link {
      appearance: none;
      border: 0;
      padding: 0;
      background: transparent;
      color: #79dfff;
      font: inherit;
      font-weight: 800;
      text-align: left;
      text-decoration: underline;
      text-underline-offset: 3px;
      cursor: pointer;
      box-shadow: none;
    }
    .set-price-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      padding: 9px 10px;
      border: 1px solid rgba(63, 176, 255, 0.42);
      border-radius: 8px;
      background: rgba(3, 15, 31, 0.74);
      color: #9fc8f4;
      font-size: 12px;
    }
    .set-price-row span {
      color: #dbe8ff;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 0.35px;
    }
    .set-price-row strong {
      color: #f7fbff;
      font-size: 14px;
      font-weight: 900;
      white-space: nowrap;
    }
    .set-price-row.is-current {
      border-color: rgba(53, 216, 255, 0.95);
      background: linear-gradient(90deg, rgba(0, 209, 255, 0.18), rgba(3, 15, 31, 0.88));
      box-shadow: 0 0 18px rgba(53, 216, 255, 0.42), inset 0 0 18px rgba(53, 216, 255, 0.14);
    }
    .set-price-row.is-current strong { color: #35d8ff; text-shadow: 0 0 10px rgba(53, 216, 255, 0.55); }
    .quantity-row {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 10px;
      align-items: center;
      color: #dbe8ff;
      font-size: 12px;
    }
    .quantity-control {
      display: grid;
      grid-template-columns: 34px 58px 34px;
      gap: 5px;
      align-items: center;
    }
    .qty-button {
      width: 34px;
      height: 34px;
      min-height: 0;
      padding: 0;
      border-radius: 8px;
      font-size: 17px;
      line-height: 1;
    }
    .quantity-input {
      width: 58px;
      height: 34px;
      border: 1px solid rgba(63, 176, 255, 0.58);
      border-radius: 8px;
      background: rgba(3, 15, 31, 0.95);
      color: #f7fbff;
      font: inherit;
      font-weight: 800;
      text-align: center;
      box-shadow: inset 0 0 18px rgba(53, 216, 255, 0.08);
    }
    .add-cart-button {
      width: 100%;
      min-height: 42px;
      border-radius: 8px;
      padding: 10px 14px;
      font-size: 14px;
      text-transform: uppercase;
      letter-spacing: 0.4px;
    }
    .add-cart-button:disabled {
      cursor: not-allowed;
      opacity: 0.45;
      background: rgba(13, 32, 57, 0.9);
      border-color: rgba(112, 164, 255, 0.34);
      box-shadow: none;
    }
    .add-cart-button.is-added {
      border-color: rgba(66, 239, 125, 0.75);
      background: rgba(8, 49, 35, 0.86);
      box-shadow: 0 0 18px rgba(66, 239, 125, 0.38), inset 0 0 16px rgba(66, 239, 125, 0.12);
    }
    .terms-modal .modal-panel {
      width: min(620px, 92vw);
      height: auto;
      max-height: 82vh;
      align-items: stretch;
      justify-content: flex-start;
      overflow: auto;
    }
    .terms-content { color: #dbe8ff; font-size: 14px; line-height: 1.55; padding: 8px 8px 2px; }
    .terms-content h3 { margin: 0 0 10px; color: #f7fbff; font-size: 18px; }
    .terms-content ul { margin: 10px 0 0; padding-left: 20px; }
    .terms-content li { margin: 7px 0; }
    .collect-date-preview {
      position: fixed;
      z-index: 1200;
      left: 50%;
      top: 50%;
      width: min(920px, 86vw);
      max-height: 84vh;
      transform: translate(-50%, -50%);
      display: none;
      pointer-events: auto;
      cursor: pointer;
      border: 1px solid rgba(53, 216, 255, 0.9);
      border-radius: 12px;
      padding: 8px;
      background: rgba(2, 8, 18, 0.96);
      box-shadow: 0 0 38px rgba(53, 216, 255, 0.46), inset 0 0 24px rgba(53, 216, 255, 0.12);
    }
    .collect-date-preview.is-visible { display: block; }
    .collect-date-preview img {
      width: 100%;
      max-height: calc(84vh - 18px);
      display: block;
      object-fit: contain;
      border-radius: 8px;
    }
    .base-finishing.is-hidden { display: none; }
    .panel-label { color: #dbe8ff; font-size: 16px; font-weight: 800; letter-spacing: 0.4px; text-transform: uppercase; margin-bottom: 12px; }
    .preview-grid { display: flex; flex-wrap: nowrap; gap: 20px; min-width: 0; width: 100%; max-width: 100%; padding-top: 0; margin-left: 0; align-items: flex-start; }
    .preview-grid > .preview-panel { flex: 1 1 0; min-width: 0; height: 500px; }
    .preview-panel {
      min-width: 0;
      border: 1px solid rgba(98, 155, 255, 0.34);
      border-radius: 8px;
      padding: 16px;
      background: radial-gradient(circle at 20% 0%, rgba(53, 216, 255, 0.12), transparent 34%), rgba(6, 20, 40, 0.82);
      box-shadow: inset 0 0 30px rgba(53, 216, 255, 0.07);
      display: flex;
      flex-direction: column;
    }
    .preview {
      height: auto;
      min-height: 0;
      flex: 1;
      background: rgba(3, 12, 26, 0.82);
      border: 1px solid rgba(128, 183, 255, 0.22);
      border-radius: 10px;
      padding: 14px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: inset 0 0 28px rgba(27, 119, 255, 0.12);
    }
    .preview.preview-empty {
      color: #6f89ad;
      font-size: 14px;
      font-weight: 600;
      text-align: center;
      line-height: 1.5;
      padding: 24px;
      border-style: dashed;
      cursor: default;
    }
    .preview-only h2::before { content: "PREVIEW"; }
    .line-preview { background: rgba(3, 12, 26, 0.82); position: relative; overflow: hidden; cursor: zoom-in; }
    .preview-panel:has(.line-preview) { padding-left: 12px; padding-right: 12px; }
    .line-preview img { width: 100%; height: 100%; object-fit: contain; }
    .line-preview > img { position: relative; z-index: 1; pointer-events: none; }
    .result.has-rgb-selected .line-preview > img,
    .design-card.has-rgb-selected .line-preview > img {
      animation: rgbLineShift 2.4s linear infinite;
      filter: saturate(2.1) hue-rotate(0deg);
    }
    .result.has-line-color:not(.has-rgb-selected) .line-preview > img,
    .design-card.has-line-color:not(.has-rgb-selected) .line-preview > img { filter: none; }
    @keyframes rgbLineShift {
      0% { filter: saturate(2.1) hue-rotate(0deg); }
      33% { filter: saturate(2.1) hue-rotate(120deg); }
      66% { filter: saturate(2.1) hue-rotate(240deg); }
      100% { filter: saturate(2.1) hue-rotate(360deg); }
    }
    .preview img { max-width: 100%; max-height: 100%; object-fit: contain; background: #000; cursor: zoom-in; }
    .dimension-preview img, .line-preview img { background: transparent; }
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
    .design-summary {
      position: relative;
      border: 1px solid rgba(116, 83, 255, 0.58);
      border-radius: 8px;
      padding: 12px 17px;
      margin: 4px 0 0;
      min-width: 320px;
      overflow: auto;
      background: radial-gradient(circle at 0% 0%, rgba(132, 74, 255, 0.14), transparent 34%), rgba(5, 16, 34, 0.82);
      box-shadow: 0 0 22px rgba(128, 80, 255, 0.16), inset 0 0 22px rgba(30, 102, 255, 0.08);
    }
    .section-title { margin-bottom: 14px; }
    .section-title h4 { margin: 0; color: #f7fbff; font-size: 15px; text-transform: uppercase; letter-spacing: 0.4px; }
    .section-title p { margin: 4px 0 0; color: #a9c5e8; font-size: 12px; }
    .summary-grid { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 10px; }
    .summary-card { padding: 13px 10px; text-align: center; background: rgba(3, 14, 31, 0.86); }
    .summary-card span { display: block; color: #9fc8f4; font-size: 12px; margin-bottom: 8px; }
    .summary-card strong { display: block; color: #f7fbff; font-size: 14px; line-height: 1.25; }
    .summary-card small { display: block; margin-top: 6px; color: #a9c5e8; font-size: 11px; }
    .total-price-card { border-color: rgba(66, 239, 125, 0.55); background: rgba(8, 49, 35, 0.72); }
    .total-price-card strong { color: #42ef7d; }
    /* Express collect date: keep the surcharged price visible, but warn that the
       order needs company approval (Pending Confirmation). */
    .order-pending-note { display: none; margin: 8px 0 2px; border: 1px solid rgba(255, 176, 60, 0.55); border-radius: 8px; padding: 10px 12px; background: rgba(60, 40, 6, 0.72); color: #ffd79a; font-weight: 700; font-size: 12px; line-height: 1.45; text-align: center; }
    .checkout-panel.is-pending-request .order-pending-note { display: block; }
    /* Special-request review popup. */
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
    .tip-panel { border-radius: 8px; padding: 14px 16px; border-color: rgba(255, 64, 122, 0.62); }
    .tip-panel strong { display: block; color: #f7fbff; margin-bottom: 5px; text-transform: uppercase; }
    .tip-panel p { margin: 0; color: #c8d7ef; font-size: 13px; }
    .action-row { display: flex; justify-content: center; gap: 14px; }
    .action-row button, .action-row .clear-button { width: 180px; }
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
      width: min(920px, 86vw);
      height: min(760px, 84vh);
      border: 1px solid rgba(63, 176, 255, 0.72);
      border-radius: 14px;
      background: rgba(6, 18, 36, 0.94);
      box-shadow: 0 0 36px rgba(53, 216, 255, 0.34), inset 0 0 28px rgba(53, 216, 255, 0.08);
      padding: 18px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .modal-panel img {
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
      border-radius: 8px;
      background: #fff;
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
    @media (max-width: 1120px) {
      form { grid-template-columns: 1fr 1fr; }
      .result { grid-template-columns: 1fr; }
      .design-body { grid-template-columns: 1fr; }
      .result-info { width: 100%; justify-self: stretch; margin-left: 0; }
      .collect-date-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .summary-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .preview-grid { height: auto; }
      .preview { height: 180px; min-height: 180px; flex: none; }
    }
    @media (max-width: 760px) {
      main { padding: 18px 14px 32px; }
      .hero, .multi-result { padding: 18px; }
      .topbar { align-items: flex-start; flex-direction: column; }
      form { grid-template-columns: 1fr; }
      select { min-width: 0; width: 100%; }
      label.scale-control { align-items: flex-start; flex-direction: column; }
      .preview-grid, .status-strip { grid-template-columns: 1fr; }
      .preview { height: 220px; min-height: 220px; }
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
      const formatClientRM = (value) => "RM " + Number(value || 0).toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      let lastAdminUpdatedAt = null;
      const refreshColorImages = () => {
        document.querySelectorAll(".color-option img").forEach((image) => {
          const url = new URL(image.src, location.origin);
          url.searchParams.set("_", Date.now().toString());
          image.src = url.toString();
        });
      };
      const applyAdminPricing = (pricing) => {
        document.querySelectorAll(".total-price-card").forEach((card) => {
          const lineMeters = Number(card.dataset.lineMeters || 0);
          const sqft = Number(card.dataset.sqft || 0);
          const neonCost = lineMeters * 25;
          const backingCost = sqft * 15;
          const uvCost = sqft * 7;
          const extraCost = 0;
          card.dataset.totalWithoutUv = (neonCost + backingCost + extraCost).toFixed(2);
          card.dataset.totalWithUv = (neonCost + backingCost + uvCost + extraCost).toFixed(2);
          card.dataset.uvCost = uvCost.toFixed(2);
          card.dataset.extraCost = extraCost.toFixed(2);
          const note = card.querySelector("small");
          if (note) note.textContent = "Total";
        });
        syncBaseFinishing();
      };
      const refreshAdminPricing = async () => {
        try {
          const response = await fetch("http://127.0.0.1:4173/api/neon-line?_=" + Date.now(), { cache: "no-store" });
          if (!response.ok) return;
          const project = await response.json();
          if (project && project.neon) {
            applyAdminPricing(project.neon);
            if (lastAdminUpdatedAt !== null && project.updatedAt !== lastAdminUpdatedAt) refreshColorImages();
            lastAdminUpdatedAt = project.updatedAt;
          }
        } catch {}
      };
      const quantityForBlock = (block) => {
        const input = block && block.querySelector(".quantity-input");
        const value = Math.max(1, Math.floor(Number(input && input.value) || 1));
        if (input && input.value !== String(value)) input.value = String(value);
        return value;
      };
      // Per-tier rates [Agent, Silver, Gold, Diamond] from the neon price sheet.
      const NEON_RATES = {
        line: { standard: [25, 22, 21, 20], rgb: [50, 45, 44, 43] },
        backing: {
          "6mm Clear Acrylic": { low: [230, 220, 210, 200], high: [250, 240, 230, 220] },
          "PVC Foamboard": { low: [160, 150, 140, 130], high: [150, 140, 130, 120] }
        },
        uv: { low: [280, 270, 260, 190], high: [300, 290, 280, 210] }
      };
      const NEON_SQFT_TO_M2 = 0.09290304;
      const NEON_TIERS = ["agent", "silver", "gold", "diamond"];
      // Backing area comes from the analysed artwork (sq.ft.), converted to m2.
      const neonAreaM2 = (block) => {
        const priceTotal = block && block.querySelector(".total-price-card");
        return Number(priceTotal && priceTotal.dataset.sqft || 0) * NEON_SQFT_TO_M2;
      };
      // Returns [agent, silver, gold, diamond] unit prices (before collect x qty).
      const neonTierUnitPrices = (block) => {
        const priceTotal = block && block.querySelector(".total-price-card");
        const mountingSelect = block && block.querySelector(".mounting-base-select");
        const finishingSelect = block && block.querySelector(".finishing-select");
        const base = (mountingSelect && mountingSelect.value) || "6mm Clear Acrylic";
        const hasUv = base === "6mm Clear Acrylic" && finishingSelect && finishingSelect.value === "UV Printing";
        const lineMeters = Number(priceTotal && priceTotal.dataset.lineMeters || 0);
        const areaM2 = neonAreaM2(block);
        const hasRgb = Boolean(block && block.querySelector('.color-option[data-color="RGB"].is-selected'));
        const lineRates = hasRgb ? NEON_RATES.line.rgb : NEON_RATES.line.standard;
        const bk = NEON_RATES.backing[base] || NEON_RATES.backing["6mm Clear Acrylic"];
        const bracket = areaM2 <= 0.5 ? "low" : "high";
        const backingRates = bk[bracket];
        const uvRates = hasUv ? NEON_RATES.uv[bracket] : [0, 0, 0, 0];
        if (priceTotal) priceTotal.classList.toggle("has-uv", Boolean(hasUv));
        return [0, 1, 2, 3].map((i) => lineMeters * lineRates[i] + areaM2 * backingRates[i] + areaM2 * uvRates[i]);
      };
      const collectMultiplierForBlock = (block) => {
        const selected = block && block.querySelector(".collect-date-option.is-selected");
        return Math.max(1, Number(selected && selected.dataset.multiplier) || 1);
      };
      const syncOrderTotals = (block) => {
        if (!block) return;
        const quantity = quantityForBlock(block);
        const multiplier = collectMultiplierForBlock(block);
        const tierUnit = neonTierUnitPrices(block).map((p) => p * multiplier);
        const tierTotal = tierUnit.map((u) => u * quantity);
        const agentPrices = {};
        NEON_TIERS.forEach((k, i) => { agentPrices[k] = tierTotal[i]; });
        block.querySelectorAll(".agent-price-row").forEach((row) => {
          const agent = row.dataset.agent || "agent";
          const target = row.querySelector("strong");
          if (target) target.textContent = formatClientRM(agentPrices[agent] != null ? agentPrices[agent] : tierTotal[0]);
          const panel = row.closest(".checkout-panel");
          const currentAgent = (panel && panel.dataset.currentAgent) || "agent";
          row.classList.toggle("is-current", agent === currentAgent);
        });
        const priceTotal = block.querySelector(".total-price-card");
        if (priceTotal) {
          priceTotal.dataset.currentUnitPrice = tierUnit[0].toFixed(2);
          priceTotal.dataset.currentMultiplier = multiplier.toFixed(2);
          priceTotal.dataset.currentQuantity = String(quantity);
          priceTotal.dataset.currentTotal = tierTotal[0].toFixed(2);
          const target = priceTotal.querySelector("strong");
          const note = priceTotal.querySelector("small");
          if (target) target.textContent = formatClientRM(tierUnit[0]);
          if (note) note.textContent = "1 set";
        }
        // Express collect dates (multiplier > 1) are a special request: the
        // surcharge is in the price, but the order needs company approval.
        const checkoutPanel = block.querySelector(".checkout-panel");
        if (checkoutPanel) {
          const isExpress = multiplier > 1;
          checkoutPanel.classList.toggle("is-pending-request", isExpress);
          const pendingNote = checkoutPanel.querySelector(".order-pending-note");
          if (pendingNote && isExpress) {
            const selOpt = block.querySelector(".collect-date-option.is-selected span:not(.collect-date-zoom)");
            const cdLabel = selOpt ? selOpt.textContent.trim().split(" ").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ") : "";
            pendingNote.textContent = "Express " + cdLabel + " is subject to company approval. Approved orders will proceed to Processing; otherwise, the order will be cancelled and notification will be provided.";
          }
        }
      };
      // Which Add-to-Cart button opened the express-request review popup, so the
      // modal's Submit button can complete that same add once confirmed.
      let pendingRequestButton = null;
      const showRequestModal = (button, block) => {
        const modal = document.querySelector(".request-modal");
        if (!modal) { button.dataset.reviewOk = "1"; button.click(); return; }
        const selOpt = block && block.querySelector(".collect-date-option.is-selected span:not(.collect-date-zoom)");
        const cdLabel = selOpt ? selOpt.textContent.trim().split(" ").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ") : "this express date";
        const body = modal.querySelector(".request-modal-body");
        if (body) body.textContent = "You picked " + cdLabel + ". This is a special request: our team will review whether we can make it in time. If we can, your order goes straight to Processing. If we cannot, it is cancelled and you are notified. Until then the status is Pending Confirmation.";
        pendingRequestButton = button;
        modal.classList.add("is-open");
        // Anchor the card to the clicked button so it opens where the customer is
        // (the fixed modal is relative to the tall auto-height iframe).
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
      const lineColorValues = {
        "White": [245, 250, 255],
        "3K Warm": [255, 166, 38],
        "4.5K Warm": [255, 214, 112],
        "Red": [255, 36, 44],
        "Lemon Yellow": [245, 255, 0],
        "Yellow": [255, 220, 0],
        "Orange": [255, 118, 24],
        "Ice Blue": [45, 205, 255],
        "Blue": [30, 80, 255],
        "Green": [31, 235, 104],
        "Pink": [255, 52, 175],
        "Purple": [158, 70, 255]
      };
      const resetLinePreviewImage = (block) => {
        const image = block && block.querySelector(".line-preview > img");
        if (!image) return;
        if (!image.dataset.originalSrc) image.dataset.originalSrc = image.currentSrc || image.src;
        image.src = image.dataset.originalSrc;
      };
      const applySolidLineColor = (block, colorName) => {
        const image = block && block.querySelector(".line-preview > img");
        const rgb = lineColorValues[colorName];
        if (!image || !rgb) {
          resetLinePreviewImage(block);
          return;
        }
        if (!image.dataset.originalSrc) image.dataset.originalSrc = image.currentSrc || image.src;
        const source = new Image();
        source.crossOrigin = "anonymous";
        source.onload = () => {
          const canvas = document.createElement("canvas");
          canvas.width = source.naturalWidth || source.width;
          canvas.height = source.naturalHeight || source.height;
          const context = canvas.getContext("2d", { willReadFrequently: true });
          context.drawImage(source, 0, 0, canvas.width, canvas.height);
          const frame = context.getImageData(0, 0, canvas.width, canvas.height);
          const data = frame.data;
          for (let index = 0; index < data.length; index += 4) {
            const alpha = data[index + 3];
            const maxChannel = Math.max(data[index], data[index + 1], data[index + 2]);
            const minChannel = Math.min(data[index], data[index + 1], data[index + 2]);
            const chroma = maxChannel - minChannel;
            if (alpha < 8 || maxChannel < 70 || (maxChannel < 112 && chroma < 34)) continue;
            data[index] = rgb[0];
            data[index + 1] = rgb[1];
            data[index + 2] = rgb[2];
            data[index + 3] = alpha;
          }
          context.putImageData(frame, 0, 0);
          image.src = canvas.toDataURL("image/png");
        };
        source.src = image.dataset.originalSrc;
      };
      const syncColorPickerState = (picker) => {
        if (!picker) return;
        const rgbSelected = Boolean(picker.querySelector('.color-option[data-color="RGB"].is-selected'));
        picker.classList.toggle("has-rgb-selected", rgbSelected);
        const selected = picker.querySelector(".selected-color strong");
        const block = picker.closest(".result, .design-card");
        if (block) {
          const selectedColors = Array.from(picker.querySelectorAll(".color-option.is-selected")).map((item) => item.dataset.color).filter(Boolean);
          const activeColor = picker.dataset.activeColor;
          const keepOriginalPreview = picker.dataset.previewOriginal === "true" || !activeColor;
          const manualSingleColor = selectedColors.length === 1 && selectedColors[0] !== "RGB" ? selectedColors[0] : "";
          const previewColor = keepOriginalPreview ? "" : (rgbSelected ? "RGB" : manualSingleColor);
          block.dataset.activeLineColor = previewColor || "";
          block.classList.toggle("has-rgb-selected", previewColor === "RGB");
          block.classList.toggle("has-line-color", Boolean(previewColor && previewColor !== "RGB"));
          if (previewColor && previewColor !== "RGB") applySolidLineColor(block, previewColor);
          else resetLinePreviewImage(block);
          syncOrderTotals(block);
        }
        const colorsSummary = block && block.querySelector(".summary-colors-used");
        if (selected) {
          const colors = Array.from(picker.querySelectorAll(".color-option.is-selected")).map((item) => item.dataset.color).filter(Boolean);
          selected.textContent = colors.length ? colors.join(", ") : "None";
          if (colorsSummary) colorsSummary.textContent = String(colors.length);
        }
      };
      const syncBaseFinishing = () => {
        document.querySelectorAll(".mounting-base-select").forEach((select) => {
          const metrics = select.closest(".metrics");
          const finishing = metrics && metrics.querySelector(".base-finishing");
          if (!finishing) return;
          finishing.classList.toggle("is-hidden", select.value !== "6mm Clear Acrylic");
          const block = select.closest(".result, .design-card");
          const mountingSummary = block && block.querySelector(".summary-mounting");
          if (mountingSummary) mountingSummary.textContent = select.value;
          const finishingSummary = block && block.querySelector(".summary-finishing");
          const finishingSelect = block && block.querySelector(".finishing-select");
          if (finishingSummary) finishingSummary.textContent = select.value === "6mm Clear Acrylic" && finishingSelect ? finishingSelect.value : "None";
          syncOrderTotals(block);
        });
      };
      window.addEventListener("change", (event) => {
        if (event.target && event.target.matches(".mounting-base-select")) syncBaseFinishing();
        if (event.target && event.target.matches(".finishing-select")) {
          const block = event.target.closest(".result, .design-card");
          const finishingSummary = block && block.querySelector(".summary-finishing");
          if (finishingSummary) finishingSummary.textContent = event.target.value;
          syncBaseFinishing();
        }
        if (event.target && event.target.matches(".terms-checkbox")) {
          const panel = event.target.closest(".checkout-panel");
          const button = panel && panel.querySelector(".add-cart-button");
          if (button) {
            button.disabled = !event.target.checked;
            button.classList.remove("is-added");
            button.textContent = "Add to cart";
          }
        }
        if (event.target && event.target.matches(".quantity-input")) {
          const block = event.target.closest(".result, .design-card");
          const button = block && block.querySelector(".add-cart-button");
          if (button) {
            button.classList.remove("is-added");
            button.textContent = "Add to cart";
          }
          syncOrderTotals(block);
        }
      });
      window.addEventListener("input", (event) => {
        if (event.target && event.target.matches(".quantity-input")) {
          const block = event.target.closest(".result, .design-card");
          const button = block && block.querySelector(".add-cart-button");
          if (button) {
            button.classList.remove("is-added");
            button.textContent = "Add to cart";
          }
          syncOrderTotals(block);
        }
      });
      window.addEventListener("click", (event) => {
        const collectZoom = event.target.closest(".collect-date-zoom");
        if (collectZoom) {
          event.preventDefault();
          event.stopPropagation();
          const dateOption = collectZoom.closest(".collect-date-option");
          const image = dateOption && dateOption.querySelector("img");
          const modal = document.querySelector(".image-modal");
          if (image && modal) {
            const previewImage = modal.querySelector("img");
            previewImage.src = image.src;
            previewImage.alt = image.alt || "Collect date preview";
            modal.classList.add("is-open");
          }
          return;
        }
        const previewImage = event.target.closest(".preview img");
        if (previewImage) {
          const modal = document.querySelector(".image-modal");
          if (modal) {
            modal.querySelector("img").src = previewImage.src;
            modal.querySelector("img").alt = previewImage.alt || "Preview";
            modal.classList.add("is-open");
          }
          return;
        }
        const modalClose = event.target.closest(".modal-close");
        if (modalClose || event.target.classList.contains("image-modal")) {
          const modal = event.target.closest(".image-modal") || document.querySelector(".image-modal.is-open");
          if (modal) modal.classList.remove("is-open");
          return;
        }
        const openCollectPreview = event.target.closest(".collect-date-preview");
        if (openCollectPreview) {
          openCollectPreview.classList.remove("is-visible");
          return;
        }
        const closeButton = event.target.closest(".close-result");
        if (closeButton) {
          const block = closeButton.closest(".multi-result, .result, .design-card");
          if (block) block.remove();
          return;
        }
        const dateOption = event.target.closest(".collect-date-option");
        if (dateOption) {
          if (dateOption.classList.contains("is-disabled")) return;
          const block = dateOption.closest(".result, .design-card");
          const grid = dateOption.closest(".collect-date-grid");
          if (grid) {
            grid.querySelectorAll(".collect-date-option").forEach((item) => item.classList.remove("is-selected"));
            dateOption.classList.add("is-selected");
          }
          const button = block && block.querySelector(".add-cart-button");
          if (button) {
            button.classList.remove("is-added");
            button.textContent = "Add to cart";
          }
          syncOrderTotals(block);
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
        const addCartButton = event.target.closest(".add-cart-button");
        if (addCartButton) {
          if (addCartButton.disabled) return;
          const reqBlock = addCartButton.closest(".result, .design-card");
          const reqExpress = !!(reqBlock && reqBlock.querySelector(".checkout-panel.is-pending-request"));
          // Express collect dates need a special-request review before adding.
          if (reqExpress && addCartButton.dataset.reviewOk !== "1") {
            showRequestModal(addCartButton, reqBlock);
            return;
          }
          addCartButton.dataset.reviewOk = "";
          addCartButton.classList.add("is-added");
          addCartButton.textContent = "Added to cart";
          try {
            const block = addCartButton.closest(".result, .design-card");
            const priceEl = block && block.querySelector(".agent-price-row.is-current strong");
            const price = priceEl ? (parseFloat(priceEl.textContent.replace("RM", "").replace(/,/g, "").trim()) || 0) : 0;
            const qtyEl = block && block.querySelector(".quantity-input");
            const qty = qtyEl ? (parseInt(qtyEl.value, 10) || 1) : 1;
            const baseSizeEl = block && block.querySelector(".summary-card strong");
            const lineEl = block && block.querySelector(".line-total strong");
            const collectEl = block && block.querySelector(".collect-date-option.is-selected span:not(.collect-date-zoom)");
            const collectLabel = collectEl ? collectEl.textContent.trim() : "";
            const pending = !!(block && block.querySelector(".checkout-panel.is-pending-request"));
            const metaParts = [];
            if (baseSizeEl && baseSizeEl.textContent) metaParts.push(baseSizeEl.textContent.trim() + " (W x H)");
            if (lineEl && lineEl.textContent) metaParts.push("Line " + lineEl.textContent.trim());
            if (collectLabel) metaParts.push(collectLabel);
            metaParts.push(qty + " set");
            window.parent.postMessage({
              type: "sign-cart-add",
              item: { label: "Neon Sign", href: "/neon-line", price: price, meta: metaParts.join(", "), status: pending ? "Pending Confirmation" : undefined },
            }, window.location.origin);
          } catch (e) {}
          return;
        }
        const qtyButton = event.target.closest(".qty-button");
        if (qtyButton) {
          const block = qtyButton.closest(".result, .design-card");
          const input = block && block.querySelector(".quantity-input");
          if (input) {
            const direction = qtyButton.dataset.qty === "minus" ? -1 : 1;
            input.value = String(Math.max(1, Math.floor(Number(input.value) || 1) + direction));
            const button = block.querySelector(".add-cart-button");
            if (button) {
              button.classList.remove("is-added");
              button.textContent = "Add to cart";
            }
            syncOrderTotals(block);
          }
          return;
        }
        const termsButton = event.target.closest(".terms-link");
        if (termsButton) {
          event.preventDefault();
          event.stopPropagation();
          const modal = document.querySelector(".terms-modal");
          if (modal) modal.classList.add("is-open");
          return;
        }
        const aiFilter = event.target.closest(".ai-filter-panel");
        if (aiFilter) {
          const picker = aiFilter.closest(".color-picker");
          if (!picker) return;
          const aiColors = (picker.dataset.aiColors || "").split("|").filter(Boolean);
          picker.querySelectorAll(".color-option").forEach((item) => {
            item.classList.toggle("is-selected", aiColors.includes(item.dataset.color));
          });
          picker.dataset.activeColor = "";
          picker.dataset.previewOriginal = "true";
          aiFilter.classList.add("is-active");
          syncColorPickerState(picker);
          return;
        }
        const option = event.target.closest(".color-option");
        if (!option) return;
        const picker = option.closest(".color-picker");
        if (!picker) return;
        picker.dataset.previewOriginal = "false";
        const aiFilterPanel = picker.querySelector(".ai-filter-panel");
        if (aiFilterPanel) aiFilterPanel.classList.remove("is-active");
        const isRgb = option.dataset.color === "RGB";
        const rgbOption = picker.querySelector('.color-option[data-color="RGB"]');
        if (isRgb) {
          const shouldSelectRgb = !option.classList.contains("is-selected");
          picker.querySelectorAll(".color-option").forEach((item) => item.classList.remove("is-selected"));
          if (shouldSelectRgb) option.classList.add("is-selected");
          picker.dataset.activeColor = shouldSelectRgb ? option.dataset.color : "";
        } else if (rgbOption && rgbOption.classList.contains("is-selected")) {
          return;
        } else {
          option.classList.toggle("is-selected");
          picker.dataset.activeColor = option.classList.contains("is-selected") ? option.dataset.color : "";
        }
        syncColorPickerState(picker);
      });
      window.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
          document.querySelectorAll(".image-modal.is-open").forEach((modal) => modal.classList.remove("is-open"));
        }
      });
      window.addEventListener("DOMContentLoaded", () => {
        syncBaseFinishing();
        document.querySelectorAll(".color-picker").forEach(syncColorPickerState);
        refreshAdminPricing();
        setInterval(refreshAdminPricing, 2000);
      });
    })();
  </script>
</head>
<body><main>
<section class="hero">
  <div class="topbar">
    <div class="brand">
      <div>
        <h1>Neon Line Calculator</h1>
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
<section class="manual-quote">
  <style>
    .manual-quote{margin:14px 0 0;padding:18px 20px;border:1px solid rgba(120,180,255,.3);border-radius:14px;background:rgba(10,20,40,.55)}
    .manual-quote h2{margin:0 0 4px;font-size:18px;color:#eaf3ff}
    .manual-quote .mq-sub{margin:0 0 12px;color:#9fb4d0;font-size:13px}
    .mq-grid{display:flex;flex-wrap:wrap;gap:12px;align-items:flex-end}
    .mq-grid label{display:flex;flex-direction:column;gap:5px;font-size:12px;font-weight:700;color:#b9c9dd}
    .mq-grid input[type=number]{width:130px;padding:8px 10px;border-radius:8px;border:1px solid rgba(120,150,190,.4);background:rgba(3,15,31,.6);color:#eaf2ff;font-weight:700}
  </style>
  <h2>Quick Quote &mdash; no upload needed</h2>
  <p class="mq-sub">Enter your size and neon length &mdash; the price shows in the Order box below (all member tiers). Size rounds up to the next 6 inches; UV / mounting follow the options below. Final price is confirmed after you upload your artwork.</p>
  <div class="mq-grid">
    <label>Width (inch)<input id="mqWidth" type="number" min="0" step="0.1" placeholder="0"></label>
    <label>Height (inch)<input id="mqHeight" type="number" min="0" step="0.1" placeholder="0"></label>
    <label>Neon length (meter)<input id="mqMeters" type="number" min="0" step="0.1" placeholder="0"></label>
  </div>
</section>
<script>
  (function () {
    // Feed the manual size + neon length into the real (placeholder) order block,
    // then let the page's own pricing engine recompute all member tiers in the
    // Order box below (respecting mounting / finishing-UV / colour / quantity).
    // Before an upload the block has no total-price-card (the holder for
    // sqft + line-metres), so inject a hidden one the engine can read from.
    var w = document.getElementById("mqWidth"), h = document.getElementById("mqHeight"), m = document.getElementById("mqMeters");
    if (!w) return;
    function getCard() {
      var card = document.querySelector(".total-price-card");
      if (card) return card;
      var panel = document.querySelector(".checkout-panel");
      var block = panel && panel.closest(".result, .design-card");
      if (!block) return null;
      card = document.createElement("div");
      card.className = "total-price-card";
      card.style.display = "none";
      card.innerHTML = "<span>Total Price</span><strong>RM 0.00</strong><small>1 set</small>";
      block.appendChild(card);
      return card;
    }
    function apply() {
      var card = getCard();
      if (!card) return;
      var widthIn = Math.ceil((Number(w.value) || 0) / 6) * 6;
      var heightIn = Math.ceil((Number(h.value) || 0) / 6) * 6;
      var sqft = (widthIn / 12) * (heightIn / 12);
      var meters = Number(m.value) || 0;
      card.dataset.sqft = sqft.toFixed(4);
      card.dataset.lineMeters = meters.toFixed(4);
      var block = card.closest(".result, .design-card");
      var qty = block && block.querySelector(".quantity-input");
      if (qty) qty.dispatchEvent(new Event("input", { bubbles: true }));
    }
    function init() {
      // If artwork was uploaded, the report already rendered a real
      // total-price-card holding the analysed line length. Running the manual
      // Quick Quote would overwrite that card with 0 (its inputs are empty) and
      // zero out the Order price, so hide the panel and do not wire it up.
      if (document.querySelector(".total-price-card")) {
        var mqPanel = document.querySelector(".manual-quote");
        if (mqPanel) mqPanel.style.display = "none";
        return;
      }
      [w, h, m].forEach(function (el) { el.addEventListener("input", apply); });
      apply();
    }
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
    else init();
  })();
</script>
${report}
<div class="image-modal" aria-hidden="true">
  <div class="modal-panel">
    <button type="button" class="modal-close" aria-label="Close preview">&times;</button>
    <img src="" alt="Preview">
  </div>
</div>
<div class="image-modal terms-modal" aria-hidden="true">
  <div class="modal-panel">
    <button type="button" class="modal-close" aria-label="Close terms">&times;</button>
    <div class="terms-content">
      <h3>Terms &amp; Conditions</h3>
      <p>Please read and confirm before placing your order.</p>
      <ul>
        <li>All artwork, size, color, mounting base, finishing, collect date and quantity must be checked before checkout.</li>
        <li>Production will proceed according to the confirmed order details after payment or order confirmation.</li>
        <li>Neon color, brightness and printed finishing may have slight differences from screen preview.</li>
        <li>Collect date is based on working days and may change if artwork, payment, material or production approval is delayed.</li>
        <li>Sunday and public holidays are not counted as working days.</li>
        <li>Custom orders cannot be cancelled or refunded once production has started.</li>
        <li>If there are delays due to factors beyond our control, we will update you accordingly.</li>
      </ul>
    </div>
  </div>
</div>
<div class="collect-date-preview" aria-hidden="true"><img src="" alt=""></div>
<div class="request-modal"><div class="request-modal-backdrop"></div><div class="request-modal-card"><div class="request-modal-title">Special Request Order</div><div class="request-modal-body"></div><div class="request-modal-actions"><button type="button" class="request-modal-cancel">Cancel</button><button type="button" class="request-modal-confirm">Submit Request</button></div></div></div>
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
</main><script src="/neon-layout-editor.js" defer></script></body></html>`;
}

function renderArtboard(artboard, pricing) {
  if (Array.isArray(artboard.designs) && artboard.designs.length > 1) {
    const designCards = artboard.designs.map((design) => renderDesign(design, pricing)).join("");
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
  const isPlaceholder = Boolean(artboard.isPlaceholder);
  const contentSize = content ? `${content.width_in.toFixed(2)} in x ${content.height_in.toFixed(2)} in` : "No vector content found";
  const title = artboard.name || `Artboard ${artboard.page || ""}`.trim();
  const dimensionPreview = artboard.dimension_preview_url
    ? `<div class="preview-panel"><div class="panel-label">Dimension Preview</div><div class="preview dimension-preview"><img src="${artboard.dimension_preview_url}" alt="Dimension preview"></div><div class="preview-total">Content size: <strong>${contentSize}</strong></div></div>`
    : (isPlaceholder ? `<div class="preview-panel"><div class="panel-label">Dimension Preview</div><div class="preview dimension-preview preview-empty">Upload your artwork to generate the dimension preview</div></div>` : "");
  const linePreview = artboard.line_preview_url
    ? `<div class="preview-panel"><div class="panel-label">Line Preview</div><div class="preview line-preview"><img src="${artboard.line_preview_url}" alt="Line preview"></div><div class="line-total">Line total: <strong>${artboard.total_length_m_neon.toFixed(2)} m</strong></div></div>`
    : (isPlaceholder ? `<div class="preview-panel"><div class="panel-label">Line Preview</div><div class="preview line-preview preview-empty">Upload your artwork to generate the line preview</div></div>` : "");
  const lineTotal = `${artboard.total_length_m_neon.toFixed(2)} m`;
  return `
    <div class="result">
      <button type="button" class="close-result" aria-label="Close artboard">&times;</button>
      <div class="artboard-header">
        <div class="artboard-mark">A</div>
        <div>
          <h3>${escapeHtml(title)}</h3>
          <p>Design your perfect neon sign</p>
        </div>
      </div>
      <div class="preview-workspace">
        <div class="preview-grid">${dimensionPreview}${linePreview}</div>
        ${isPlaceholder ? "" : renderDesignSummary(contentSize, lineTotal, artboard.by_color, content, artboard.total_length_m_neon, pricing)}
      </div>
      <div class="result-info">
        <div class="metrics">
          ${renderMountingPanel()}
          ${renderColorPicker(artboard.by_color)}
          ${renderRemarkOptions()}
          ${renderCollectDateOptions()}
          ${renderCheckoutOptions()}
        </div>
      </div>
    </div>`;
}

function renderDesign(design, pricing) {
  const content = design.content_bbox_in;
  const contentSize = content ? `${content.width_in.toFixed(2)} in x ${content.height_in.toFixed(2)} in` : "No vector content found";
  const dimensionPreview = design.dimension_preview_url ? `<div class="preview-panel"><div class="panel-label">Dimension Preview</div><div class="preview dimension-preview"><img src="${design.dimension_preview_url}" alt="Dimension preview"></div><div class="preview-total">Content size: <strong>${contentSize}</strong></div></div>` : "";
  const linePreview = design.line_preview_url ? `<div class="preview-panel"><div class="panel-label">Line Preview</div><div class="preview line-preview"><img src="${design.line_preview_url}" alt="Line preview"></div><div class="line-total">Line total: <strong>${design.total_length_m_neon.toFixed(2)} m</strong></div></div>` : "";
  const lineTotal = `${design.total_length_m_neon.toFixed(2)} m`;
  return `
    <div class="design-card">
      <button type="button" class="close-result" aria-label="Close design">&times;</button>
      <h4>${escapeHtml(design.name || "Design")}</h4>
      <div class="design-body">
        <div class="preview-workspace">
          <div class="preview-grid">${dimensionPreview}${linePreview}</div>
          ${renderDesignSummary(contentSize, lineTotal, design.by_color, content, design.total_length_m_neon, pricing)}
        </div>
        <div class="metrics">
          ${renderMountingPanel()}
          ${renderColorPicker(design.by_color)}
          ${renderRemarkOptions()}
          ${renderCollectDateOptions()}
          ${renderCheckoutOptions()}
        </div>
      </div>
    </div>`;
}

function renderMountingPanel() {
  return `<div class="step-panel"><div class="step-heading"><div class="step-dot">1</div><div><h4>Mounting & Finishing</h4><p>Select how your sign will be mounted and finished</p></div></div><div class="base-options"><div><span>Mounting Base</span><select class="mounting-select mounting-base-select"><option>6mm Clear Acrylic</option><option>PVC Foamboard</option></select></div><div class="base-finishing"><span>Base Finishing</span><select class="mounting-select finishing-select"><option>None</option><option>UV Printing</option></select></div></div></div>`;
}

function renderDesignSummary(contentSize, lineTotal, byColor, content, lineMeters, pricing) {
  const colorCount = detectedPaletteColors(byColor).size;
  const details = priceDetails(content, lineMeters, pricing);
  const baseSize = escapeHtml(contentSize);
  return `<div class="design-summary"><div class="section-title"><h4>Design Summary</h4></div><div class="summary-grid"><div class="summary-card"><span>Base Size</span><strong>${baseSize}</strong><small>W x H</small></div><div class="summary-card"><span>Line Total</span><strong>${escapeHtml(lineTotal)}</strong><small>Neon Tubing</small></div><div class="summary-card"><span>Mounting</span><strong class="summary-mounting">6mm Clear Acrylic</strong><small>Mounting Base</small></div><div class="summary-card"><span>Finishing</span><strong class="summary-finishing">None</strong><small>Base Finishing</small></div><div class="summary-card"><span>Colors Used</span><strong class="summary-colors-used">${colorCount}</strong><small>Neon Colors</small></div><div class="summary-card total-price-card" data-line-meters="${Number(lineMeters || 0).toFixed(4)}" data-sqft="${details.sqft.toFixed(4)}" data-total-without-uv="${details.totalWithoutUv.toFixed(2)}" data-total-with-uv="${details.totalWithUv.toFixed(2)}" data-uv-cost="${details.uvCost.toFixed(2)}" data-extra-cost="${details.extraCost.toFixed(2)}"><span>Total Price</span><strong>${formatRM(details.totalWithoutUv)}</strong><small>1 set</small></div></div></div>`;
}

function renderRemarkOptions() {
  return `
          <div class="order-options step-panel">
            <div class="step-heading"><div class="step-dot">3</div><div><h4>Remark (Optional)</h4><p>Add any special instructions or notes</p></div></div>
            <textarea class="remark-field" aria-label="Remark" placeholder="Type your remark here..."></textarea>
          </div>`;
}

function renderCollectDateOptions() {
  const dates = [
    ["standard7", "1", "7 working days", "collect-date-7-working-days.png"],
    ["normal", "1.3", "4 working days", "collect-date-4-working-days.png"],
    ["quick3", "1.4", "3 working days", "collect-date-3-working-days.png"],
    ["rush2", "1.5", "2 working days", "collect-date-2-working-days.png"],
    ["next", "1.8", "Next working days", "collect-date-next-working-days.png"],
  ];
  const options = dates.map(([key, multiplier, label, file], index) => {
    const src = `/assets/${file}`;
    return `<button type="button" class="collect-date-option${index === 0 ? " is-selected" : ""}" data-collect="${key}" data-multiplier="${multiplier}" aria-label="${label}"><span class="collect-date-zoom" aria-label="Preview ${label}">&#128269;</span><img src="${src}" alt="${label}"><span>${label}</span></button>`;
  }).join("");
  return `<div class="collect-date-panel"><span>Collect Date</span><div class="collect-date-grid">${options}</div></div>`;
}

function renderCheckoutOptions() {
  return `<div class="checkout-panel" data-current-agent="agent"><span>Order</span><div class="set-price-row agent-price-row is-current" data-agent="agent"><span>Agent Price</span><strong>RM 0.00</strong></div><div class="set-price-row agent-price-row" data-agent="silver"><span>Silver Agent Price</span><strong>RM 0.00</strong></div><div class="set-price-row agent-price-row" data-agent="gold"><span>Gold Agent Price</span><strong>RM 0.00</strong></div><div class="set-price-row agent-price-row" data-agent="diamond"><span>Diamond Agent Price</span><strong>RM 0.00</strong></div><div class="order-pending-note"></div><div class="quantity-row"><span>Quantity</span><div class="quantity-control"><button type="button" class="qty-button" data-qty="minus" aria-label="Decrease quantity">-</button><input class="quantity-input" type="number" min="1" step="1" value="1" aria-label="Quantity"><button type="button" class="qty-button" data-qty="plus" aria-label="Increase quantity">+</button></div></div><label class="terms-row"><input type="checkbox" class="terms-checkbox"><span>I agree to the <button type="button" class="terms-link">terms and conditions</button></span></label><button type="button" class="add-cart-button" disabled>Add to cart</button></div>`;
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

function resolveSimilarPair(byColor, selected, firstName, firstRgb, secondName, secondRgb) {
  if (!selected.has(firstName) || !selected.has(secondName) || !Array.isArray(byColor)) return selected;
  let totalWeight = 0;
  const weights = { [firstName]: 0, [secondName]: 0 };
  const average = [0, 0, 0];
  for (const item of byColor) {
    const name = nearestPaletteColor(item.rgb);
    if (name !== firstName && name !== secondName) continue;
    const weight = Number(item.length_m) || 1;
    weights[name] += weight;
    totalWeight += weight;
    average[0] += item.rgb[0] * weight;
    average[1] += item.rgb[1] * weight;
    average[2] += item.rgb[2] * weight;
  }
  if (!totalWeight) return selected;
  const firstRatio = weights[firstName] / totalWeight;
  const secondRatio = weights[secondName] / totalWeight;
  if (firstRatio >= 0.22 && secondRatio >= 0.22) return selected;
  average[0] /= totalWeight;
  average[1] /= totalWeight;
  average[2] /= totalWeight;
  if (colorDistance(average, firstRgb) <= colorDistance(average, secondRgb)) {
    selected.delete(secondName);
  } else {
    selected.delete(firstName);
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
  resolveSimilarPair(byColor, selected, "Red", [255, 0, 32], "Orange", [255, 128, 0]);
  return selected.size ? selected : new Set(["White"]);
}

function renderColorPicker(byColor) {
  const selectedColors = detectedPaletteColors(byColor);
  const colors = [
    ["White", "white"],
    ["3K Warm", "3k-warm"],
    ["4.5K Warm", "45k-warm"],
    ["Red", "red"],
    ["Lemon Yellow", "lemon-yellow"],
    ["Yellow", "yellow"],
    ["Orange", "orange"],
    ["Ice Blue", "ice-blue"],
    ["Blue", "blue"],
    ["Green", "green"],
    ["Pink", "pink"],
    ["Purple", "purple"],
    ["RGB", "rgb"],
  ];
  const options = colors.map(([color, slug]) => {
    return `<button type="button" class="color-option${selectedColors.has(color) ? " is-selected" : ""}" data-color="${escapeHtml(color)}" aria-label="${escapeHtml(color)}"><img src="/assets/neon-color-${slug}.jpg" alt="${escapeHtml(color)}"></button>`;
  }).join("");
  const aiColors = Array.from(selectedColors);
  const aiFilter = `<div class="ai-filter-panel is-active"><span>AI Filter</span><div class="ai-filter-list">${aiColors.length ? aiColors.map((color) => `<em>${escapeHtml(color)}</em>`).join("") : "<em>None</em>"}</div></div>`;
  // Default to the original multi-colour render (each line strokes in its own
  // detected colour) so the Line Preview is colourful on upload. A single-colour
  // tint only kicks in when the customer clicks one colour.
  return `<div class="color-picker step-panel" data-ai-colors="${escapeHtml(aiColors.join("|"))}" data-preview-original="true"><div class="step-heading"><div class="step-dot">2</div><div><h4>Neon Colors</h4><p>Select up to 4 neon colors for your sign</p></div></div>${aiFilter}<div class="color-map"><img src="/assets/neon-color-options.jpg" alt="Neon color options">${options}</div><div class="selected-color">Selected: <strong>${escapeHtml(Array.from(selectedColors).join(", "))}</strong></div></div>`;
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
  const result = { file: null, fields: {} };
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
      result.file = { filename: path.basename(filenameMatch[1]), data };
    } else if (nameMatch) {
      result.fields[nameMatch[1]] = data.toString("utf8").trim();
    }
    start = buffer.indexOf(boundary, nextBoundary + 2);
  }
  return result.file ? result : null;
}
async function analyzeUpload(file, measurementScale = 1) {
  // Run the ported TypeScript analyzer directly on the uploaded bytes.
  const bytes = file.data instanceof Uint8Array ? file.data : new Uint8Array(file.data);
  const result = await analyzeNeon(bytes, file.filename, measurementScale);
  // The analyzer already attaches dimension_preview_url / line_preview_url as
  // inline data URLs at the top level and on every artboard / design.
  return result;
}

// ---- Request handlers used by the Next.js route (app/neon-line/app/route.ts) ----

/** GET handler: render the empty calculator page. */
export async function renderGet() {
  return rewriteAssets(html(null, null, await readNeonPricing()));
}

/** POST handler: parse the multipart upload, analyze, render the result page. */
export async function renderPost(body, contentType) {
  try {
    let file, measurementScale = 1, artwork = null;
    if ((contentType || "").includes("application/x-www-form-urlencoded")) {
      // The browser uploaded the file to the backend and sent us its URL. That
      // saved file IS the order's artwork — remember it so the result page can
      // carry it into the cart.
      const params = new URLSearchParams(body.toString("utf8"));
      const fileUrl = params.get("fileUrl");
      measurementScale = params.get("measurementScale") === "10" ? 10 : 1;
      if (!fileUrl) throw new Error("Please choose an .ai or .pdf file.");
      const res = await fetch(fileUrl);
      if (!res.ok) throw new Error("Could not fetch the uploaded file (" + res.status + ").");
      const filename = params.get("artworkName") || fileUrl.split("/").pop() || "artwork";
      file = { filename, data: Buffer.from(await res.arrayBuffer()) };
      artwork = { url: fileUrl, name: filename };
    } else {
      const upload = parseMultipart(body, contentType);
      if (!upload) throw new Error("Please choose an .ai or .pdf file.");
      measurementScale = upload.fields.measurementScale === "10" ? 10 : 1;
      file = upload.file;
    }
    const result = await analyzeUpload(file, measurementScale);
    return rewriteAssets(html(result, null, await readNeonPricing()), artwork);
  } catch (error) {
    return rewriteAssets(html(null, error.message || String(error), await readNeonPricing()));
  }
}

// Client script injected into every rendered page: intercepts the artwork form
// submit, uploads the (possibly large) file to the backend, then posts only the
// resulting URL to the analyze route — bypassing the serverless body limit.
const UPLOAD_BRIDGE_SCRIPT = `<script>(function(){
  var LIMIT = 4000000; // <=~4MB posts straight to the analyze route (original path); larger goes via the backend to dodge the 4.5MB serverless limit
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
      // Always save the artwork to the backend first (durable + dodges the
      // serverless body limit), then analyze via its URL. The saved file becomes
      // the order's locked artwork (carried into the cart).
      var fd=new FormData(); fd.append("file",file);
      var up=new XMLHttpRequest(); up.open("POST",API+"/api/v1/uploads/artwork");
      up.upload.onprogress=function(ev){ if(ev.lengthComputable) set(Math.round(ev.loaded/ev.total*100)); };
      up.onload=function(){
        if(up.status<200||up.status>=300){ fail("Upload failed ("+up.status+")."); return; }
        var j; try{ j=JSON.parse(up.responseText); }catch(_){ fail("Upload failed (bad response)."); return; }
        analyzing();
        var url=/^https?:/.test(j.url)?j.url:API+j.url;
        var params=new URLSearchParams(); params.set("fileUrl",url); params.set("artworkName",file.name);
        new FormData(form).forEach(function(v,k){ if(k!=="file"&&typeof v==="string") params.set(k,v); });
        fetch(form.getAttribute("action"),{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:params}).then(function(r){ return r.text(); }).then(render).catch(function(err){ fail("Could not analyze the file: "+(err&&err.message||err)); });
      };
      up.onerror=function(){ fail("Upload failed (network)."); };
      up.send(fd);
    });
  }
  if(document.readyState!=="loading") bind(); else document.addEventListener("DOMContentLoaded",bind);
})();</script>`;

// Rewrite the original absolute asset paths / form action to the routes used by
// the unified app (assets live under /neon-line/assets, the form posts to the
// same route the page is served from).
function rewriteAssets(markup, artwork) {
  const out = markup
    .split('action="/analyze"').join('action="/neon-line/app"')
    .split('href="/"').join('href="/neon-line/app"')
    .split('src="/assets/').join('src="/neon-line/assets/')
    .split('url(/assets/').join('url(/neon-line/assets/')
    .split('"/assets/').join('"/neon-line/assets/');
  // Expose the saved artwork so the parent (ProductFrame) can carry it into the
  // cart when this result is added.
  const artScript =
    artwork && artwork.url
      ? `<script>window.__SF_ARTWORK=${JSON.stringify({ url: artwork.url, name: artwork.name })};</script>`
      : "";
  const inject = artScript + UPLOAD_BRIDGE_SCRIPT;
  return out.includes("</body>") ? out.replace("</body>", inject + "</body>") : out + inject;
}








