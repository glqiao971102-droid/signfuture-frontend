import { boxUpRoutes } from "@/lib/boxup/variant";
import { PAINT_SWATCH_FIELD } from "@/lib/boxup/paint-swatches";
import { HIDE_SIDE_FINISHING_FIELD } from "@/lib/boxup/stainless-fields";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Rasterizing large artboards via pdfium can take a few seconds.
export const maxDuration = 120;

// No litMode: the acrylic face lights up as usual. EG returns are 2K spray
// painted, chosen via the Box Up Paint Colour swatch picker (same as the 3D
// Printer Backlit), not the 3D-print filament control.
const { GET, POST } = boxUpRoutes({
  appRoute: "/catalog/eg-box-up-frontlit/app",
  name: "EG Box Up (Frontlit)",
  href: "/catalog/eg-box-up-frontlit",
  optionOverrides: [
    // EG frontlit boxes come in two depths only.
    { selectClass: "box-up-size-select", options: `<option selected>6cm</option><option>8cm</option>` },
    // Single 2K-spray material; the actual colour is picked from the swatch grid
    // below. Value keeps "2K Spray" so the paint picker stays visible.
    { selectClass: "box-up-color-select", options: `<option>3D Outdoor Material with 2K Spray</option>` },
    {
      selectClass: "base-finish-material-select",
      options: `<option>10mm PVC Foam Board</option>`,
    },
  ],
  extraFields: [HIDE_SIDE_FINISHING_FIELD, PAINT_SWATCH_FIELD],
});

export { GET, POST };
