/**
 * Box Up Base Finishing picker — SINGLE-select image tiles (backlit products).
 *
 * Two mounting methods:
 *   • "10cm Screw with Nut" — stand-off screws; leaves the gap a backlit sign
 *     needs so light escapes behind the letter.
 *   • "PVC Flat" — flush PVC-foamboard blocks glued to the back.
 *
 * When an LED colour is selected the flush "PVC Flat" mount would block the
 * backlight, so it is DISABLED and any existing PVC Flat pick reverts to the
 * screw mount.
 *
 * The original <select class="base-finish-material-select"> stays in the DOM
 * (hidden) as the VALUE CARRIER — the price/summary/preview all read its
 * selected option — so a tile click just sets its value and fires 'change',
 * reusing the calculator's own wiring with no new engine hooks. Mirrors the
 * paint-swatch field's document.write-safe init guard.
 */

const SCREW = "10cm Screw with Nut";
const PVC_FLAT = "PVC Flat";

// Product-render images. Drop the two files at these paths under public/.
const SCREW_IMG = "/3d-box-up/base-screw.png";
const PVC_IMG = "/3d-box-up/base-pvc-flat.png";

const tile = (label: string, img: string) =>
  `<button type="button" class="bf-tile" data-bf="${label}">` +
  `<img src="${img}" alt="${label}" onerror="this.style.visibility='hidden'">` +
  `<span>${label}</span>` +
  // Magnifier — reuses the calculator's global .image-zoom-button handler, which
  // opens the shared image modal from data-zoom-src (same as the LED tiles).
  `<span class="image-zoom-button" data-zoom-src="${img}" data-zoom-alt="${label}" aria-label="View ${label} larger"></span>` +
  `</button>`;

const tiles = tile(SCREW, SCREW_IMG) + tile(PVC_FLAT, PVC_IMG);

const style = `<style>
/* The original Base Finishing dropdown is replaced by the tiles below. */
.base-finish-material { display: none !important; }
.base-finish-picker > span { display:block; margin:0 0 8px; color:#35d8ff; font-size:12px; font-weight:800; letter-spacing:.4px; }
.base-finish-picker .bf-tiles { display:grid; grid-template-columns:repeat(2, minmax(0,1fr)); gap:8px; }
.base-finish-picker .bf-tile {
  position:relative; min-width:0; height:132px; border:1px solid rgba(63,176,255,.58);
  border-radius:8px; background:rgba(3,15,31,.95); color:#f7fbff; font-weight:800; padding:5px;
  cursor:pointer; overflow:hidden; display:grid; grid-template-rows:minmax(0,1fr) 16px; gap:4px;
  box-shadow:inset 0 0 18px rgba(53,216,255,.08); transition:border-color .12s ease, box-shadow .12s ease;
}
.base-finish-picker .bf-tile img { width:100%; height:100%; display:block; min-height:0; object-fit:contain; object-position:center; border-radius:5px; pointer-events:none; background:#fff; }
.base-finish-picker .bf-tile > span:not(.image-zoom-button) { display:block; margin:0; color:#f7fbff; font-size:10px; line-height:16px; text-align:center; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; pointer-events:none; }
.base-finish-picker .bf-tile .image-zoom-button { pointer-events:auto; }
.base-finish-picker .bf-tile:hover { border-color:rgba(53,216,255,.7); }
.base-finish-picker .bf-tile.is-selected { border-color:rgba(53,216,255,.95); box-shadow:0 0 14px rgba(53,216,255,.48), inset 0 0 18px rgba(53,216,255,.14); }
.base-finish-picker .bf-tile.is-disabled { opacity:.4; cursor:not-allowed; filter:grayscale(.6); }
.base-finish-picker .bf-tile.is-disabled::after { content:"Not with LED"; position:absolute; inset:auto 0 18px; text-align:center; font-size:9px; color:#ffd7c2; letter-spacing:.3px; }
.base-finish-picker .bf-led-note { margin:7px 0 0; color:#9fc8f4; font-size:11px; line-height:1.35; }
</style>`;

const script = `<script>
(function(){
  // Guard on <html> (not window/document): the calculator re-renders results via
  // document.open()/write()/close(), which drops listeners but reuses window AND
  // document; document.write DOES rebuild <html>, so a flag there is wiped each
  // render and the delegated handler re-attaches without double-binding.
  var root = document.documentElement;
  if (root.__baseFinishInit) return;
  root.__baseFinishInit = true;

  var selectFor = function(field){
    var prev = field.previousElementSibling;
    if (prev){ var s = prev.querySelector && prev.querySelector('.base-finish-material-select'); if (s) return s; }
    var scope = (field.closest && field.closest('.result, .design-card')) || document;
    return scope.querySelector('.base-finish-material-select');
  };
  var ledOn = function(field){
    var scope = (field.closest && field.closest('.result, .design-card')) || document;
    var led = scope.querySelector('.selected-led-color strong');
    var t = led && led.textContent ? led.textContent.trim() : 'None';
    return !!t && t !== 'None';
  };
  var pick = function(field, label){
    field.querySelectorAll('.bf-tile').forEach(function(t){
      t.classList.toggle('is-selected', t.getAttribute('data-bf') === label);
    });
    var sel = selectFor(field);
    if (sel && sel.value !== label){
      sel.value = label;
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    }
  };
  var applyLed = function(field){
    var on = ledOn(field);
    var pvc = field.querySelector('.bf-tile[data-bf="${PVC_FLAT}"]');
    var note = field.querySelector('.bf-led-note');
    if (pvc) pvc.classList.toggle('is-disabled', on);
    if (note) note.hidden = !on;
    if (on){
      var sel = selectFor(field);
      var isPvc = (sel && sel.value === '${PVC_FLAT}') || (pvc && pvc.classList.contains('is-selected'));
      if (isPvc) pick(field, '${SCREW}');
    }
  };

  document.addEventListener('click', function(ev){
    // The magnifier is handled by the calculator's own .image-zoom-button
    // listener (opens the image modal) — ignore it here so it doesn't also
    // select the tile, and so it still zooms even on the disabled PVC tile.
    if (ev.target.closest && ev.target.closest('.image-zoom-button')) return;
    var tile = ev.target.closest && ev.target.closest('.base-finish-picker .bf-tile');
    if (tile){
      ev.preventDefault();
      if (tile.classList.contains('is-disabled')) return; // PVC Flat blocked by LED
      pick(tile.closest('.base-finish-picker'), tile.getAttribute('data-bf'));
      return;
    }
    // Re-evaluate the LED gate after any LED tile click (no event is dispatched
    // for an LED change, so piggy-back on the same delegated click).
    if (ev.target.closest && ev.target.closest('.led-color-option')){
      setTimeout(function(){ document.querySelectorAll('.base-finish-picker').forEach(applyLed); }, 50);
    }
  });

  var boot = function(){
    document.querySelectorAll('.base-finish-picker').forEach(function(field){
      var sel = selectFor(field);
      pick(field, (sel && sel.value) ? sel.value : '${SCREW}');
      applyLed(field);
    });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
</script>`;

export const BASE_FINISH_PICKER_FIELD = {
  afterFieldClass: "base-finish-material",
  html:
    `<div class="base-finish-picker"><span>Base Finishing</span>` +
    `<div class="bf-tiles">${tiles}</div>` +
    `<p class="bf-led-note" hidden>PVC Flat isn’t available with LED — the screw stand-off leaves the gap the backlight needs.</p>` +
    `</div>` +
    style +
    script,
};

/**
 * Base-finish select override: two mounting methods as the value carrier's
 * options (the picker above shows them as image tiles). Values equal the
 * labels; the summary/preview read the selected option's TEXT and pricing does
 * NOT key off this select, so both are free labels.
 */
export const BASE_FINISH_OPTIONS = {
  selectClass: "base-finish-material-select",
  options:
    `<option value="${SCREW}">${SCREW}</option>` +
    `<option value="${PVC_FLAT}">${PVC_FLAT}</option>`,
};
