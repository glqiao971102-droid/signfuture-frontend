import { boxUpRoutes } from "@/lib/boxup/variant";
import { BACKLIT_PRESET } from "@/lib/boxup/backlit-preset";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Rasterizing large artboards via pdfium can take a few seconds.
export const maxDuration = 120;

const { GET, POST } = boxUpRoutes({
  ...BACKLIT_PRESET,
  appRoute: "/catalog/3d-printer-backlit/app",
  name: "3D Printer (Backlit)",
  href: "/catalog/3d-printer-backlit",
});

export { GET, POST };
