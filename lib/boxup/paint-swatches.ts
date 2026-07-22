/**
 * Box Up paint picker: colour swatches shown inline, multi-select.
 *
 * The hidden <select class="mounting-select box-up-paint-select"> is the value
 * carrier. Keeping it means the calculator's existing change handler (which
 * matches ".mounting-select") still rebuilds the 3D preview, so no new wiring
 * is needed on the engine side. Its value is a comma-separated hex list in pick
 * order; the preview paints the whole letter in the first colour only, so extra
 * picks are recorded for the order without splitting the model into two tones.
 */

export const PAINT_COLOURS: { name: string; hex: string }[] = [
  { name: "Black", hex: "#0b0d10" },
  { name: "White", hex: "#f2f4f7" },
  { name: "Silver", hex: "#9aa3ad" },
  { name: "Grey", hex: "#6b6f76" },
  { name: "Red", hex: "#c0182c" },
  { name: "Maroon", hex: "#6d1a2e" },
  { name: "Orange", hex: "#e8641c" },
  { name: "Yellow", hex: "#f2c118" },
  { name: "Cream", hex: "#efe3c4" },
  { name: "Lime", hex: "#7ac143" },
  { name: "Green", hex: "#1f7a44" },
  { name: "Turquoise", hex: "#12a8a2" },
  { name: "Sky Blue", hex: "#3d9be0" },
  { name: "Blue", hex: "#1b4d9b" },
  { name: "Navy", hex: "#152a4d" },
  { name: "Purple", hex: "#6b3fa0" },
  { name: "Pink", hex: "#d94f8a" },
  { name: "Brown", hex: "#6b4a2f" },
  { name: "Gold", hex: "#b8912f" },
  { name: "Copper", hex: "#a85c32" },
];

const swatches = PAINT_COLOURS.map(
  (c, i) =>
    `<label class="paint-swatch${i === 0 ? " is-selected" : ""}" title="${c.name}">` +
    `<input type="checkbox" value="${c.hex}"${i === 0 ? " checked" : ""}>` +
    `<span class="paint-dot" style="background:${c.hex}"></span>` +
    `<span class="paint-name">${c.name}</span>` +
    `</label>`,
).join("");

const style = `<style>
.box-up-paint .paint-swatches{display:flex;flex-wrap:wrap;gap:8px;margin-top:6px}
.box-up-paint .paint-swatch{position:relative;display:flex;flex-direction:column;align-items:center;gap:4px;
  width:58px;padding:7px 4px 5px;border:1px solid rgba(112,164,255,.32);border-radius:9px;
  background:rgba(4,12,26,.9);cursor:pointer;transition:border-color .15s,box-shadow .15s}
.box-up-paint .paint-swatch:hover{border-color:rgba(53,216,255,.6)}
.box-up-paint .paint-swatch.is-selected{border-color:#35d8ff;box-shadow:0 0 12px rgba(53,216,255,.35)}
.box-up-paint .paint-swatch input{position:absolute;opacity:0;pointer-events:none}
.box-up-paint .paint-dot{width:26px;height:26px;border-radius:50%;
  border:1px solid rgba(255,255,255,.35);box-shadow:inset 0 0 6px rgba(0,0,0,.45)}
.box-up-paint .paint-name{font-size:10px;font-weight:800;letter-spacing:.2px;color:#dbe8ff;text-align:center}
.box-up-paint .paint-swatch.is-selected .paint-name{color:#8fe6ff}
.box-up-paint .paint-order{position:absolute;top:3px;right:4px;font-size:9px;font-weight:900;color:#04121f;
  background:#35d8ff;border-radius:50%;width:13px;height:13px;display:none;place-items:center}
.box-up-paint .paint-swatch.is-selected .paint-order{display:grid}
.box-up-paint.is-hidden{display:none}
</style>`;

// Selection order matters (first = face), so clicks append/remove rather than
// rebuild, and each chip shows its position.
const script = `<script>
(function(){
  if (window.__paintSwatchInit) return;
  window.__paintSwatchInit = true;
  var sync = function(field){
    var chosen = [].slice.call(field.querySelectorAll('.paint-swatch'))
      .filter(function(s){ return s.classList.contains('is-selected'); })
      .sort(function(a,b){ return (+a.dataset.order||0) - (+b.dataset.order||0); });
    chosen.forEach(function(s,i){
      s.dataset.order = String(i+1);
      var badge = s.querySelector('.paint-order');
      if (!badge) { badge = document.createElement('span'); badge.className='paint-order'; s.appendChild(badge); }
      badge.textContent = String(i+1);
    });
    var hexes = chosen.map(function(s){ return s.querySelector('input').value; });
    var sel = field.querySelector('.box-up-paint-select');
    if (sel) {
      sel.innerHTML = '<option value="' + hexes.join(',') + '" selected></option>';
      sel.value = hexes.join(',');
      // Reuses the calculator's own ".mounting-select" handler to refresh 3D.
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    }
  };
  document.addEventListener('click', function(ev){
    var swatch = ev.target.closest && ev.target.closest('.box-up-paint .paint-swatch');
    if (!swatch) return;
    ev.preventDefault();
    var field = swatch.closest('.box-up-paint');
    var input = swatch.querySelector('input');
    var selectedNow = swatch.classList.contains('is-selected');
    // Clicking a selected colour deselects it, including the last one.
    swatch.classList.toggle('is-selected', !selectedNow);
    input.checked = !selectedNow;
    if (!selectedNow) {
      swatch.dataset.order = String(Date.now());  // newest goes last
    } else {
      delete swatch.dataset.order;
    }
    sync(field);
  });
  // Paint only applies to the sprayed finish; the plain material uses the
  // 3D Filament Color control instead, so the picker hides itself.
  var syncVisibility = function(){
    document.querySelectorAll('.box-up-paint').forEach(function(field){
      var scope = field.closest('.result, .design-card') || document;
      var colour = scope.querySelector('.box-up-color-select');
      var isSpray = !colour || (colour.value || '').indexOf('2K Spray') !== -1;
      field.classList.toggle('is-hidden', !isSpray);
    });
  };
  document.addEventListener('change', function(ev){
    if (ev.target && ev.target.matches && ev.target.matches('.box-up-color-select')) syncVisibility();
  });
  var boot = function(){
    document.querySelectorAll('.box-up-paint').forEach(sync);
    syncVisibility();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
</script>`;

export const PAINT_SWATCH_FIELD = {
  afterFieldClass: "box-up-color",
  html:
    `<div class="box-up-paint"><span>Box Up Paint Colour</span>` +
    `<div class="paint-swatches">${swatches}</div>` +
    `<select class="mounting-select box-up-paint-select" hidden aria-hidden="true">` +
    `<option value="${PAINT_COLOURS[0].hex}" selected></option>` +
    `</select></div>` +
    style +
    script,
};
