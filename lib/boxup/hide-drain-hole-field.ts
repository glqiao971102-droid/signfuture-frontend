/**
 * Hides the "Drain Hole" control.
 *
 * Drain holes are only offered on the frontlit / conceal / channel box-ups —
 * 3D Printer (Frontlit), 3D Stainless Steel Conceal Box Up (Frontlit), 3D EG
 * Conceal Box Up (Frontlit) and Aluminum Channel Box Up. The base renderer emits
 * the control for every product, so all the BACKLIT / FRONT & BACKLIT / acrylic
 * variants hide it via this field (wired into BACKLIT_PRESET, FRONT_BACKLIT_PRESET
 * and the stainless backlit routes that replace extraFields wholesale).
 */
export const HIDE_DRAIN_HOLE_FIELD = {
  afterFieldClass: "box-up-color",
  html: `<style>.drain-hole{display:none !important}</style>`,
} as const;
