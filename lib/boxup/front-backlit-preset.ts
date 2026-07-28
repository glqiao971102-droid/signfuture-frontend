import type { BoxUpVariant } from "@/lib/boxup/variant";
import { PAINT_SWATCH_FIELD } from "@/lib/boxup/paint-swatches";

/**
 * Shared configuration for front-and-back lit Box Up products.
 *
 * Unlike the reverse-lit preset, the face stays lit here - litMode "both" adds
 * the rear halo on top of the normal front-lit face.
 *
 * Box Up Size (3cm/5cm) and Box Up Color (plain / 2K Spray) keep the renderer's
 * defaults, so they are deliberately not overridden. The paint picker shows
 * itself only for the sprayed finish; the plain material uses 3D Filament Color.
 */
export const FRONT_BACKLIT_PRESET: Omit<
  BoxUpVariant,
  "appRoute" | "name" | "href"
> = {
  litMode: "both",
  optionOverrides: [
    // Keeps the white-acrylic value: it is what makes the face light up and
    // what Surface Finishing / UV Printing key off.
    {
      selectClass: "mounting-base-select",
      options: `<option value="3mm White Acrylic">433 White Acrylic</option>`,
    },
    // Labels only - both values map to the renderer's existing board options.
    {
      selectClass: "base-finish-material-select",
      options:
        `<option value="10mm PVC Foam Board">5cm Screw with Nut</option>` +
        `<option value="3mm ACP Board">10cm Screw with Nut</option>`,
    },
  ],
  extraFields: [PAINT_SWATCH_FIELD],
};
