import { boxUpRoutes } from "@/lib/boxup/variant";
import { BACKLIT_PRESET } from "@/lib/boxup/backlit-preset";
import {
  STAINLESS_COLOUR_OPTIONS,
  STAINLESS_GRADE_FIELD,
  HIDE_SIDE_FINISHING_FIELD,
} from "@/lib/boxup/stainless-fields";
import { BASE_ACRYLIC_FIELD } from "@/lib/boxup/base-acrylic-field";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Rasterizing large artboards via pdfium can take a few seconds.
export const maxDuration = 120;

const { GET, POST } = boxUpRoutes({
  ...BACKLIT_PRESET,
  appRoute: "/catalog/stainless-steel-box-up-backlit-acrylic/app",
  name: "3D Stainless Steel Box Up (Backlit with 10mm Clear Acrylic)",
  href: "/catalog/stainless-steel-box-up-backlit-acrylic",
  optionOverrides: [
    // Everything the backlit preset sets except Box Up Color and Surface, both
    // of which are stainless-specific here.
    ...(BACKLIT_PRESET.optionOverrides ?? []).filter(
      (o) =>
        o.selectClass !== "box-up-color-select" &&
        o.selectClass !== "mounting-base-select",
    ),
    // Keeps the black-acrylic value so the face stays unlit; the stainless
    // finish then tints it to match the returns.
    {
      selectClass: "mounting-base-select",
      options: `<option value="3mm Black Acrylic">Stainless Steel</option>`,
    },
    STAINLESS_COLOUR_OPTIONS,
  ],
  // No paint picker (returns take their colour from the stainless finish), plus
  // the 1cm clear-acrylic backing plate that lights with the LED.
  extraFields: [STAINLESS_GRADE_FIELD, HIDE_SIDE_FINISHING_FIELD, BASE_ACRYLIC_FIELD],
});

export { GET, POST };
