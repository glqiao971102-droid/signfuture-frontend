import { boxUpRoutes } from "@/lib/boxup/variant";
import {
  STAINLESS_COLOUR_OPTIONS,
  HIDE_SIDE_FINISHING_FIELD,
} from "@/lib/boxup/stainless-fields";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Rasterizing large artboards via pdfium can take a few seconds.
export const maxDuration = 120;

// No litMode: the acrylic face lights up as usual. The stainless finish only
// affects the returns, which the 3D preview reads off Box Up Color.
const { GET, POST } = boxUpRoutes({
  appRoute: "/catalog/stainless-steel-box-up-frontlit/app",
  name: "3D Stainless Steel Box Up (Frontlit)",
  href: "/catalog/stainless-steel-box-up-frontlit",
  optionOverrides: [
    STAINLESS_COLOUR_OPTIONS,
    {
      selectClass: "base-finish-material-select",
      options: `<option>10mm PVC Foam Board</option>`,
    },
  ],
  extraFields: [HIDE_SIDE_FINISHING_FIELD],
});

export { GET, POST };
