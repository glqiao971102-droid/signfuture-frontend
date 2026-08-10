import { boxUpRoutes } from "@/lib/boxup/variant";
import { BACKLIT_PRESET } from "@/lib/boxup/backlit-preset";
import { HIDE_SIDE_FINISHING_FIELD } from "@/lib/boxup/stainless-fields";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Rasterizing large artboards via pdfium can take a few seconds.
export const maxDuration = 120;

// Keeps the backlit preset's 2K-spray material + Box Up Paint Colour swatch
// picker; only relabels the base as EG and hides the 3D-print filament panel.
const { GET, POST } = boxUpRoutes({
  ...BACKLIT_PRESET,
  appRoute: "/catalog/eg-box-up-backlit/app",
  name: "EG Box Up (Backlit)",
  href: "/catalog/eg-box-up-backlit",
  optionOverrides: [
    ...(BACKLIT_PRESET.optionOverrides ?? []).filter(
      (o) => o.selectClass !== "mounting-base-select",
    ),
    { selectClass: "mounting-base-select", options: `<option value="3mm Black Acrylic">EG</option>` },
  ],
  extraFields: [...(BACKLIT_PRESET.extraFields ?? []), HIDE_SIDE_FINISHING_FIELD],
});

export { GET, POST };
