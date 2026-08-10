import { boxUpRoutes } from "@/lib/boxup/variant";
import { BACKLIT_PRESET } from "@/lib/boxup/backlit-preset";
import { HIDE_SIDE_FINISHING_FIELD } from "@/lib/boxup/stainless-fields";
import { BASE_ACRYLIC_FIELD } from "@/lib/boxup/base-acrylic-field";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Rasterizing large artboards via pdfium can take a few seconds.
export const maxDuration = 120;

// Backlit preset (2K-spray material + Box Up Paint Colour swatch) plus the 10mm
// clear-acrylic backing plate; relabels the base as EG and hides the filament.
const { GET, POST } = boxUpRoutes({
  ...BACKLIT_PRESET,
  appRoute: "/catalog/eg-box-up-backlit-acrylic/app",
  name: "EG Box Up (Backlit with 10mm Clear Acrylic)",
  href: "/catalog/eg-box-up-backlit-acrylic",
  optionOverrides: [
    ...(BACKLIT_PRESET.optionOverrides ?? []).filter(
      (o) => o.selectClass !== "mounting-base-select",
    ),
    { selectClass: "mounting-base-select", options: `<option value="3mm Black Acrylic">EG</option>` },
  ],
  extraFields: [...(BACKLIT_PRESET.extraFields ?? []), HIDE_SIDE_FINISHING_FIELD, BASE_ACRYLIC_FIELD],
});

export { GET, POST };
