/**
 * Box Up paint picker: colour swatches shown inline, MULTI-select.
 *
 * A letter/logo can be sprayed in several colours, so clicking toggles each
 * swatch on/off and the picks are kept in CLICK ORDER (at least one must stay
 * selected). The hidden <select class="mounting-select box-up-paint-select"> is
 * the value carrier: its value is the comma-separated hex list in pick order.
 * Keeping the select means the calculator's existing change handler (matching
 * ".mounting-select") still rebuilds the 3D preview with no new engine wiring —
 * and the preview/engine already paint the letter with the FIRST hex
 * (boxUpPaintList[0]), which is exactly the primary colour.
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
.box-up-paint.is-hidden{display:none}
</style>`;

// Multi-select: clicking toggles a colour on/off, keeping the picks in click
// order (at least one colour must remain selected).
const script = `<script>
(function(){
  // Guard on <html>, not window/document: the calculator re-renders results via
  // document.open()/write()/close() (server-impl render()). That removes every
  // listener on document but REUSES the same window AND document objects, so a
  // flag on either survives the reset and blocks re-binding — leaving the
  // swatches dead after the first upload. document.write does rebuild the
  // documentElement (<html>) node, so a flag there is wiped on every render and
  // the delegated handler re-attaches, while still preventing double-binding
  // within a single document.
  var root = document.documentElement;
  if (root.__paintSwatchInit) return;
  root.__paintSwatchInit = true;
  var sync = function(field){
    // All selected swatches, ordered by when they were clicked (data-pick).
    var picked = [].slice.call(field.querySelectorAll('.paint-swatch.is-selected'));
    picked.sort(function(a, b){
      return (parseInt(a.getAttribute('data-pick') || '0', 10)) - (parseInt(b.getAttribute('data-pick') || '0', 10));
    });
    var hexes = picked.map(function(s){ var i = s.querySelector('input'); return i ? i.value : ''; }).filter(Boolean);
    if (!hexes.length) hexes = ['${PAINT_COLOURS[0].hex}'];
    var val = hexes.join(',');
    var sel = field.querySelector('.box-up-paint-select');
    if (sel) {
      sel.innerHTML = '<option value="' + val + '" selected></option>';
      sel.value = val;
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
    if (swatch.classList.contains('is-selected')) {
      // Toggle OFF — but never leave zero colours selected.
      if (field.querySelectorAll('.paint-swatch.is-selected').length <= 1) return;
      swatch.classList.remove('is-selected');
      if (input) input.checked = false;
      swatch.removeAttribute('data-pick');
    } else {
      // Toggle ON — stamp this pick's position in the click order.
      var seq = (parseInt(field.getAttribute('data-pick-seq') || '0', 10)) + 1;
      field.setAttribute('data-pick-seq', String(seq));
      swatch.classList.add('is-selected');
      if (input) input.checked = true;
      swatch.setAttribute('data-pick', String(seq));
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
    document.querySelectorAll('.box-up-paint').forEach(function(field){
      // Give the pre-selected (first) swatch a pick position so later picks
      // order after it, then push the initial value to the hidden select.
      var first = field.querySelector('.paint-swatch.is-selected');
      if (first && !first.getAttribute('data-pick')) {
        field.setAttribute('data-pick-seq', '1');
        first.setAttribute('data-pick', '1');
      }
      sync(field);
    });
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
