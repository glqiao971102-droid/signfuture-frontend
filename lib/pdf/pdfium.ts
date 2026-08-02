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
  /** Tightly packed RGB bytes (length = width * height * 3), white background.
   *  Normalised to black artwork on white — used for detection AND the Dimension Preview. */
  rgb: Uint8Array;
  /** Same size, but the ORIGINAL colours composited on white (for the "Original" preview). */
  rgbColor: Uint8Array;
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
    // Render on a TRANSPARENT background so the alpha channel tells us whether each
    // pixel was actually DRAWN — independent of its colour. Without this, pdfium
    // composites on opaque white, so WHITE artwork (a white-ink logo meant for a dark
    // sign) is white-on-white and completely invisible to detection. With alpha we can
    // recognise any drawn shape regardless of colour.
    const result = await page.render({ scale, render: "bitmap", transparent: true });
    const { width, height, data } = result; // R,G,B,A (BGRA + reverse byte order)
    // Decide ONCE whether the page background is transparent (white/light artwork sits
    // on nothing) vs an opaque backdrop (a drawn white/colour rectangle). We only
    // recolour near-white DRAWN pixels to black when the background is transparent —
    // otherwise an opaque WHITE background rectangle (very common) would itself turn
    // black and swallow the whole artwork. Sample the four borders' alpha: a real
    // backdrop reaches the page edges; centred artwork leaves the border transparent.
    let borderSamples = 0, borderTransparent = 0;
    const stepX = Math.max(1, Math.floor(width / 300));
    const stepY = Math.max(1, Math.floor(height / 300));
    for (let x = 0; x < width; x += stepX) {
      const aTop = data[(0 * width + x) * 4 + 3];
      const aBot = data[((height - 1) * width + x) * 4 + 3];
      borderSamples += 2; if (aTop < 8) borderTransparent++; if (aBot < 8) borderTransparent++;
    }
    for (let y = 0; y < height; y += stepY) {
      const aL = data[(y * width + 0) * 4 + 3];
      const aR = data[(y * width + (width - 1)) * 4 + 3];
      borderSamples += 2; if (aL < 8) borderTransparent++; if (aR < 8) borderTransparent++;
    }
    const transparentBg = borderSamples > 0 && borderTransparent / borderSamples > 0.5;
    const rgb = new Uint8Array(width * height * 3);      // black-on-white (detection + Dimension Preview)
    const rgbColor = new Uint8Array(width * height * 3); // original colours (the "Original" preview)
    for (let i = 0, j = 0; i < data.length; i += 4, j += 3) {
      const a = data[i + 3];
      if (a < 8) {
        // Not drawn → background → white (both buffers).
        rgb[j] = 255; rgb[j + 1] = 255; rgb[j + 2] = 255;
        rgbColor[j] = 255; rgbColor[j + 1] = 255; rgbColor[j + 2] = 255;
        continue;
      }
      // Composite the drawn pixel over white (straight alpha) to see its real colour.
      const inv = 255 - a;
      const R = (data[i] * a + 255 * inv) / 255;
      const G = (data[i + 1] * a + 255 * inv) / 255;
      const B = (data[i + 2] * a + 255 * inv) / 255;
      // Original-colour buffer keeps the real composited colour.
      rgbColor[j] = R < 0 ? 0 : R > 255 ? 255 : R;
      rgbColor[j + 1] = G < 0 ? 0 : G > 255 ? 255 : G;
      rgbColor[j + 2] = B < 0 ? 0 : B > 255 ? 255 : B;
      // Detection buffer normalises EVERY file to white-background / black-artwork so
      // recognition is colour-independent (user: "whatever colour, show it as black on
      // white"). Two cases keep a white BACKDROP rectangle from turning black:
      //  • transparent background  -> the whole drawn shape is artwork -> BLACK.
      //  • opaque backdrop (a white rect) -> only the non-near-white pixels are the
      //    artwork on top -> BLACK; the near-white backdrop stays WHITE.
      const nearWhite = R >= 245 && G >= 245 && B >= 245;
      const black = transparentBg ? true : !nearWhite;
      if (black) { rgb[j] = 0; rgb[j + 1] = 0; rgb[j + 2] = 0; }
      else { rgb[j] = 255; rgb[j + 1] = 255; rgb[j + 2] = 255; }
    }
    return { width, height, rgb, rgbColor };
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
