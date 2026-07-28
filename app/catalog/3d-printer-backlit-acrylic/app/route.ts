import { boxUpRoutes } from "@/lib/boxup/variant";
import { BACKLIT_PRESET } from "@/lib/boxup/backlit-preset";
import { BASE_ACRYLIC_FIELD } from "@/lib/boxup/base-acrylic-field";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Rasterizing large artboards via pdfium can take a few seconds.
export const maxDuration = 120;

const { GET, POST } = boxUpRoutes({
  ...BACKLIT_PRESET,
  appRoute: "/catalog/3d-printer-backlit-acrylic/app",
  name: "3D Printer (Backlit with 10mm Clear Acrylic)",
  href: "/catalog/3d-printer-backlit-acrylic",
  extraFields: [...(BACKLIT_PRESET.extraFields ?? []), BASE_ACRYLIC_FIELD],
});

export { GET, POST };
