import type { BoxUpVariant } from "@/lib/boxup/variant";
import { PAINT_SWATCH_FIELD } from "@/lib/boxup/paint-swatches";
import { BASE_FINISH_OPTIONS, BASE_FINISH_PICKER_FIELD } from "@/lib/boxup/base-finish-field";
import { HIDE_DRAIN_HOLE_FIELD } from "@/lib/boxup/hide-drain-hole-field";

/**
 * Shared configuration for reverse-lit ("backlit") Box Up products.
 *
 * Spread this into a route and override `appRoute` / `name` / `href`. Anything
 * listed after the spread wins, so a product that later diverges can replace
 * just the field it needs without copying the whole preset.
 */
export const BACKLIT_PRESET: Omit<BoxUpVariant, "appRoute" | "name" | "href"> = {
  litMode: "back",
  optionOverrides: [
    // Keeps the "3mm Black Acrylic" value so the preview renders a dark panel
    // and the paint picker drives the colour instead.
    {
      selectClass: "mounting-base-select",
      options: `<option value="3mm Black Acrylic">Direct Print Surface</option>`,
    },
    { selectClass: "box-up-size-select", options: `<option selected>3cm</option>` },
    {
      selectClass: "box-up-color-select",
      options: `<option>3D Outdoor Material with 2K Spray</option>`,
    },
    // Base Finishing = a picture picker (see BASE_FINISH_PICKER_FIELD). These
    // options are the hidden value carrier; both are free labels (pricing does
    // NOT key off this select). PVC Flat is disabled once an LED is chosen.
    BASE_FINISH_OPTIONS,
  ],
  // Drain Hole is frontlit/channel-only, so every backlit variant hides it.
  extraFields: [PAINT_SWATCH_FIELD, BASE_FINISH_PICKER_FIELD, HIDE_DRAIN_HOLE_FIELD],
};
