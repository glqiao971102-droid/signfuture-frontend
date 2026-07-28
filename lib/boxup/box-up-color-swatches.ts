/**
 * Box Up Color as inline colour swatches (single-select).
 *
 * The renderer's own <select class="box-up-color-select"> stays in the DOM as
 * the value carrier - it is what the calculator, the pricing and the 3D preview
 * all read, and its "mounting-select" class is what triggers a preview rebuild.
 * The swatches just set its value and fire a change event.
 *
 * Option labels are meaningful: the preview parses "mirror" / "hairline" /
 * "rose gold" / "gold" / "silver" for metal finishes, and matches the plain
 * names against its paint table. Renaming an option changes how it renders.
 */

export type BoxUpSwatch = { name: string; hex: string; metal?: boolean };

export const ALUMINIUM_CHANNEL_COLOURS: BoxUpSwatch[] = [
  { name: "Black", hex: "#15181c" },
  { name: "White", hex: "#eef1f5" },
  { name: "Red", hex: "#c0182c" },
  { name: "Yellow", hex: "#f2c118" },
  { name: "Green", hex: "#1f7a44" },
  { name: "Blue", hex: "#1b4d9b" },
  { name: "Mirror Gold", hex: "#d6ab5c", metal: true },
  { name: "Mirror Silver", hex: "#dfe3e6", metal: true },
  { name: "Mirror Rose Gold", hex: "#c08a7d", metal: true },
  { name: "Hairline Gold", hex: "#d6ab5c", metal: true },
  { name: "Hairline Silver", hex: "#dfe3e6", metal: true },
  { name: "Hairline Rose Gold", hex: "#c08a7d", metal: true },
];

const style = `<style>
.box-up-color-swatches{display:flex;flex-wrap:wrap;gap:8px;margin-top:6px}
.bc-swatch{position:relative;display:flex;flex-direction:column;align-items:center;gap:4px;
  width:62px;padding:7px 4px 5px;border:1px solid rgba(112,164,255,.32);border-radius:9px;
  background:rgba(4,12,26,.9);cursor:pointer;transition:border-color .15s,box-shadow .15s}
.bc-swatch:hover{border-color:rgba(53,216,255,.6)}
.bc-swatch.is-selected{border-color:#35d8ff;box-shadow:0 0 12px rgba(53,216,255,.35)}
.bc-swatch input{position:absolute;opacity:0;pointer-events:none}
.bc-dot{width:26px;height:26px;border-radius:50%;
  border:1px solid rgba(255,255,255,.35);box-shadow:inset 0 0 6px rgba(0,0,0,.45)}
/* metal finishes get a sheen so mirror and hairline read differently */
.bc-dot.is-mirror{background-image:linear-gradient(135deg,rgba(255,255,255,.85) 0%,rgba(255,255,255,0) 45%,rgba(0,0,0,.25) 100%)}
.bc-dot.is-hairline{background-image:repeating-linear-gradient(90deg,rgba(255,255,255,.30) 0 1px,rgba(0,0,0,.14) 1px 2px)}
.bc-name{font-size:9.5px;line-height:1.15;font-weight:800;color:#dbe8ff;text-align:center}
.bc-swatch.is-selected .bc-name{color:#8fe6ff}
/* the underlying select stays for value/pricing, but is not shown */
.box-up-color .box-up-color-select{display:none}
</style>`;

// The swatch group is injected as a sibling of .box-up-color, not inside it,
// so the select is located via the surrounding result panel.
const script = `<script>
(function(){
  if (window.__boxUpColorSwatchInit) return;
  window.__boxUpColorSwatchInit = true;
  var apply = function(group, value){
    var scope = group.closest('.result, .design-card') || document;
    var sel = scope.querySelector('.box-up-color-select');
    if (!sel || sel.value === value) return;
    sel.value = value;
    // Reuses the calculator's own ".mounting-select" handler to refresh 3D.
    sel.dispatchEvent(new Event('change', { bubbles: true }));
  };
  document.addEventListener('click', function(ev){
    var swatch = ev.target.closest && ev.target.closest('.box-up-color-swatches .bc-swatch');
    if (!swatch) return;
    ev.preventDefault();
    var group = swatch.closest('.box-up-color-swatches');
    group.querySelectorAll('.bc-swatch').forEach(function(s){
      s.classList.toggle('is-selected', s === swatch);
      var input = s.querySelector('input');
      if (input) input.checked = s === swatch;
    });
    apply(group, swatch.dataset.value);
  });
  var boot = function(){
    document.querySelectorAll('.box-up-color-swatches').forEach(function(group){
      var current = group.querySelector('.bc-swatch.is-selected');
      if (current) apply(group, current.dataset.value);
    });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
</script>`;

/** Builds the swatch markup plus the matching <option> list for a product. */
export const boxUpColourSwatchField = (colours: BoxUpSwatch[]) => {
  const swatches = colours
    .map((c, i) => {
      const sheen = /mirror/i.test(c.name)
        ? " is-mirror"
        : /hairline/i.test(c.name)
          ? " is-hairline"
          : "";
      return (
        `<label class="bc-swatch${i === 0 ? " is-selected" : ""}" data-value="${c.name}" title="${c.name}">` +
        `<input type="radio" name="boxUpColour"${i === 0 ? " checked" : ""}>` +
        `<span class="bc-dot${sheen}" style="background-color:${c.hex}"></span>` +
        `<span class="bc-name">${c.name}</span>` +
        `</label>`
      );
    })
    .join("");

  return {
    optionOverride: {
      selectClass: "box-up-color-select",
      options: colours
        .map((c, i) => `<option${i === 0 ? " selected" : ""}>${c.name}</option>`)
        .join(""),
    },
    extraField: {
      afterFieldClass: "box-up-color",
      html: `<div class="box-up-color-swatches">${swatches}</div>` + style + script,
    },
  };
};
