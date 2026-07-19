// PDF rasterization via pdfium compiled to WebAssembly — the same engine the
// original Python used through pypdfium2, so rendered pixels match closely.
import { PDFiumLibrary } from "@hyzyla/pdfium";

let libPromise: Promise<Awaited<ReturnType<typeof PDFiumLibrary.init>>> | null = null;
function getLibrary() {
  if (!libPromise) libPromise = PDFiumLibrary.init();
  return libPromise;
}

export type RenderedPage = {
  width: number;
  height: number;
  /** Tightly packed RGB bytes (length = width * height * 3), white background. */
  rgb: Uint8Array;
};

/**
 * Render a single page to an RGB pixel buffer at the given scale (1.0 ≈ 72 DPI),
 * mirroring `page.render(scale=...).to_pil().convert("RGB")`.
 */
export async function renderPageRgb(
  bytes: Uint8Array,
  pageIndex: number,
  scale: number
): Promise<RenderedPage | null> {
  const library = await getLibrary();
  let doc: Awaited<ReturnType<typeof library.loadDocument>> | null = null;
  try {
    doc = await library.loadDocument(Buffer.from(bytes));
    const page = doc.getPage(pageIndex);
    const result = await page.render({ scale, render: "bitmap" });
    const { width, height, data } = result; // data is BGRA
    const rgb = new Uint8Array(width * height * 3);
    for (let i = 0, j = 0; i < data.length; i += 4, j += 3) {
      rgb[j] = data[i + 2];
      rgb[j + 1] = data[i + 1];
      rgb[j + 2] = data[i];
    }
    return { width, height, rgb };
  } catch {
    return null;
  } finally {
    if (doc) {
      try {
        doc.destroy();
      } catch {
        /* ignore */
      }
    }
  }
}
