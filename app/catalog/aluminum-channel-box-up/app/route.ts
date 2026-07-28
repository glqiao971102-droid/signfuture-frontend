import { boxUpRoutes } from "@/lib/boxup/variant";
import {
  ALUMINIUM_CHANNEL_COLOURS,
  boxUpColourSwatchField,
} from "@/lib/boxup/box-up-color-swatches";
import { HIDE_SIDE_FINISHING_FIELD } from "@/lib/boxup/stainless-fields";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Rasterizing large artboards via pdfium can take a few seconds.
export const maxDuration = 120;

const colour = boxUpColourSwatchField(ALUMINIUM_CHANNEL_COLOURS);

// No litMode: the acrylic face lights up as usual. Box Up Color only drives the
// channel returns, which the 3D preview reads off that select.
const { GET, POST } = boxUpRoutes({
  appRoute: "/catalog/aluminum-channel-box-up/app",
  name: "Aluminum Channel Box Up",
  href: "/catalog/aluminum-channel-box-up",
  optionOverrides: [
    colour.optionOverride,
    {
      selectClass: "base-finish-material-select",
      options: `<option>10mm PVC Foam Board</option>`,
    },
  ],
  extraFields: [colour.extraField, HIDE_SIDE_FINISHING_FIELD],
});

export { GET, POST };
