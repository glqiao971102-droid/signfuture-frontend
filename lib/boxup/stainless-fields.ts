/**
 * Shared pieces for the Stainless Steel Box Up products.
 *
 * The finish names matter: the 3D preview parses them ("mirror" / "hairline" /
 * "rose gold" / "gold" / "silver") to pick the metal colour and roughness for
 * the returns. Renaming an option changes how it renders.
 */
export const STAINLESS_COLOUR_OPTIONS = {
  selectClass: "box-up-color-select",
  options:
    `<option>Original</option>` +
    `<option>Mirror Gold</option>` +
    `<option>Mirror Silver</option>` +
    `<option>Mirror Rose Gold</option>` +
    `<option>Hairline Gold</option>` +
    `<option>Hairline Silver</option>` +
    `<option>Hairline Rose Gold</option>`,
} as const;

/**
 * Stainless steel grade selector, shown ABOVE Box Up Size. The frame/returns are
 * stainless; the grade (201 vs 304) is a material choice. 304 is the higher,
 * more corrosion-resistant grade.
 */
export const STAINLESS_GRADE_FIELD = {
  beforeFieldClass: "box-up-size",
  html:
    `<div class="stainless-grade"><span>Stainless Steel</span>` +
    `<select class="mounting-select stainless-grade-select">` +
    `<option value="201">201 Stainless Steel</option>` +
    `<option value="304">304 Stainless Steel</option>` +
    `</select></div>`,
} as const;

/**
 * The returns are stainless, so the filament / side-finishing controls do not
 * apply. Hidden rather than removed: the renderer still reads those nodes when
 * it builds the mesh, and deleting them would break that lookup.
 */
export const HIDE_SIDE_FINISHING_FIELD = {
  afterFieldClass: "box-up-color",
  html:
    `<style>` +
    `.side-finishing-panel,.color-picker{display:none !important}` +
    `</style>`,
} as const;
