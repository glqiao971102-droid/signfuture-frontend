/**
 * Clear acrylic backing plate selector, shared by the "with 10mm Clear Acrylic"
 * products.
 *
 * The option value is the plate thickness in millimetres. The 3D preview reads
 * ".base-acrylic-select" and converts that to scene units, so changing the
 * number here is enough to resize the plate.
 */
export const BASE_ACRYLIC_FIELD = {
  // Sits just above Base Finishing.
  beforeFieldClass: "base-finish-material",
  html:
    `<div class="base-acrylic"><span>Base Acrylic</span>` +
    `<select class="mounting-select base-acrylic-select">` +
    `<option value="10">10mm Clear Acrylic</option>` +
    `</select></div>`,
} as const;
