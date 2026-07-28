import { boxUpRoutes } from "@/lib/boxup/variant";
import { FRONT_BACKLIT_PRESET } from "@/lib/boxup/front-backlit-preset";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Rasterizing large artboards via pdfium can take a few seconds.
export const maxDuration = 120;

const { GET, POST } = boxUpRoutes({
  ...FRONT_BACKLIT_PRESET,
  appRoute: "/catalog/3d-printer-front-backlit/app",
  name: "3D Printer (Front & Backlit)",
  href: "/catalog/3d-printer-front-backlit",
});

export { GET, POST };
