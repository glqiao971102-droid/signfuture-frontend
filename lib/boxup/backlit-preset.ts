import type { BoxUpVariant } from "@/lib/boxup/variant";
import { PAINT_SWATCH_FIELD } from "@/lib/boxup/paint-swatches";

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
    // Label only - pricing still keys off the original board value.
    {
      selectClass: "base-finish-material-select",
      options: `<option value="10mm PVC Foam Board">10cm Screw with Nut</option>`,
    },
  ],
  extraFields: [PAINT_SWATCH_FIELD],
};
