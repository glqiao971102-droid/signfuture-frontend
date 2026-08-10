// OCR-based Letter / Logo classification.
//
// Product rule: if a record's glyph reads as an English letter or a digit it is
// WORDING (labelled "Letter", priced as Wording); anything the recogniser can't
// read as a character is a "Logo". Once artwork is converted to outlines it is
// geometrically indistinguishable from a logo, so the only way to honour that
// rule is to actually recognise each record's thumbnail. Recognition on
// stylised signage fonts is imperfect by nature — occasional misreads are
// expected and accepted; a standalone graphic that happens to look like a letter
// may read as one, and vice-versa.
import path from "node:path";
import { PNG } from "pngjs";
import type { PSM as PsmMode } from "tesseract.js";

type Labelled = { label: string; image_data_url: string };

// One worker for the whole dev-server lifetime — first use downloads the core
// wasm + English data, later uploads reuse it. Never terminated on purpose.
type Worker = { recognize: (img: Buffer) => Promise<{ data: { text: string; confidence: number } }> };
const WHITELIST = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
// A record is a Letter only if some mode reads a character with AT LEAST this
// confidence. Real letters read at ~77-92 through the pipeline; the spurious
// characters OCR invents on solid logo shapes come back at ~0-38 — so this gate
// keeps the letters (incl. thin I/F that only SINGLE_WORD reads) while sending
// blobs/discs/silhouettes to Logo. (A shape that truly looks like a letter, e.g.
// a plain triangle -> "A", still reads high-confidence; that ambiguity is
// inherent and rare in real multi-part logos.)
const MIN_CONFIDENCE = 50;

let tessPromise: Promise<typeof import("tesseract.js")> | null = null;
function tesseract() {
  if (!tessPromise) tessPromise = import("tesseract.js");
  return tessPromise;
}

// On Vercel the function filesystem is read-only except /tmp, and the language
// data isn't bundled by default — so tesseract.js falls back to downloading
// eng.traineddata from a CDN on every cold start AND fails to write its cache,
// which stalls the analysis past the function timeout (a 504). We ship the raw
// eng.traineddata inside the deployment (see next.config outputFileTracingIncludes)
// and load it straight off disk with caching disabled, so OCR does zero network
// I/O at request time. The WASM core already resolves locally from node_modules.
const TESSDATA_DIR = path.join(process.cwd(), "lib", "tessdata");

// Two workers, one per page-seg mode. SINGLE_BLOCK and SINGLE_CHAR have
// COMPLEMENTARY blind spots in tesseract's LSTM engine: SINGLE_BLOCK returns
// empty for a bare "I" but reads R/B; SINGLE_CHAR reads "I" but drops R/B and
// misreads O->C. Running both and accepting a Letter if EITHER reads a
// character recovers all of them (verified on I L R B F T J 1 …).
const workers = new Map<PsmMode, Promise<Worker>>();
function getWorker(psm: PsmMode): Promise<Worker> {
  let w = workers.get(psm);
  if (!w) {
    w = (async () => {
      const { createWorker, OEM } = await tesseract();
      const worker = await createWorker("eng", OEM.LSTM_ONLY, {
        langPath: TESSDATA_DIR, // local dir holding eng.traineddata (bundled)
        cacheMethod: "none", // never read/write the read-only-fs cache
        gzip: false, // the bundled file is the raw .traineddata, not .gz
      });
      await worker.setParameters({
        tessedit_pageseg_mode: psm,
        tessedit_char_whitelist: WHITELIST,
      });
      return worker as Worker;
    })().catch((error) => {
      workers.delete(psm); // let a later upload retry (e.g. transient download failure)
      throw error;
    });
    workers.set(psm, w);
  }
  return w;
}

// Does this image read as a character (with enough confidence) in this mode?
async function readsLetter(png: Buffer, psm: PsmMode): Promise<boolean> {
  try {
    const worker = await getWorker(psm);
    const { data } = await worker.recognize(png);
    const text = (data.text || "").replace(/[^A-Za-z0-9]/g, "");
    return text.length >= 1 && (data.confidence || 0) >= MIN_CONFIDENCE;
  } catch {
    return false;
  }
}

// "data:image/png;base64,…" -> a PNG buffer flattened onto white. OCR wants dark
// ink on a light background, but the record thumbnails can be transparent-backed
// (the masked-shape crop), so composite any alpha over white first.
function dataUrlToWhitePng(dataUrl: string): Buffer | null {
  const comma = dataUrl.indexOf(",");
  if (comma < 0) return null;
  let png: PNG;
  try {
    png = PNG.sync.read(Buffer.from(dataUrl.slice(comma + 1), "base64"));
  } catch {
    return null;
  }
  const d = png.data;
  for (let i = 0; i < d.length; i += 4) {
    const a = d[i + 3];
    if (a < 255) {
      const inv = 255 - a;
      d[i] = (d[i] * a + 255 * inv) / 255;
      d[i + 1] = (d[i + 1] * a + 255 * inv) / 255;
      d[i + 2] = (d[i + 2] * a + 255 * inv) / 255;
      d[i + 3] = 255;
    }
  }
  return PNG.sync.write(padAndUpscale(png));
}

// Tesseract reads a glyph far more reliably when it is a decent size and has a
// clear margin around it. The record thumbnails are tight and can be small, so
// integer-upscale to ~a 256px long side (nearest-neighbour) and add a white
// border before OCR.
function padAndUpscale(src: PNG): PNG {
  const long = Math.max(src.width, src.height);
  const factor = Math.min(6, Math.max(1, Math.round(256 / Math.max(1, long))));
  const sw = src.width * factor;
  const sh = src.height * factor;
  const pad = Math.max(16, Math.round(Math.max(sw, sh) * 0.18));
  const out = new PNG({ width: sw + pad * 2, height: sh + pad * 2 });
  out.data.fill(255); // white canvas
  for (let y = 0; y < sh; y++) {
    const sy = Math.floor(y / factor);
    for (let x = 0; x < sw; x++) {
      const sx = Math.floor(x / factor);
      const si = (sy * src.width + sx) * 4;
      const di = ((y + pad) * out.width + (x + pad)) * 4;
      out.data[di] = src.data[si];
      out.data[di + 1] = src.data[si + 1];
      out.data[di + 2] = src.data[si + 2];
      out.data[di + 3] = 255;
    }
  }
  return out;
}

/**
 * Re-label each record as "Letter N" or "Logo N" from what its thumbnail reads
 * as. Sequences are renumbered in document order. Throws if the OCR engine can't
 * be started at all, so the caller can fall back to the geometric heuristic.
 */
// Tesseract runs in a worker thread that hangs / crawls inside a Vercel
// serverless function (it's fine on a normal always-on server). Bound it: on a
// timeout or engine failure we mark OCR unavailable for the rest of this process
// and rethrow so classifyRecords() falls back to the geometric row heuristic —
// a slightly less precise Letter/Logo split, but the analysis COMPLETES instead
// of timing out into a 504.
const OCR_BUDGET_MS = 20000;
let ocrUnavailable = false;

export async function ocrRelabel<T extends Labelled>(records: T[]): Promise<T[]> {
  if (!records.length) return records;
  // Diagnostic escape hatch (__diag=nocr) — never set in normal use.
  if ((globalThis as { __SF_SKIP_OCR?: boolean }).__SF_SKIP_OCR) return records;
  if (ocrUnavailable) throw new Error("OCR unavailable in this environment");
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      ocrRelabelImpl(records),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("OCR timed out")), OCR_BUDGET_MS);
      }),
    ]);
  } catch (err) {
    ocrUnavailable = true; // don't hang again on later pages / requests
    throw err;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function ocrRelabelImpl<T extends Labelled>(records: T[]): Promise<T[]> {
  const { PSM } = await tesseract();
  // Start the primary worker up-front: a hard failure here (engine can't init)
  // propagates so the caller falls back to the geometric heuristic. Per-glyph
  // recognition failures below are swallowed (treated as "no character").
  await getWorker(PSM.SINGLE_BLOCK);
  const counts: Record<string, number> = {};
  const out: T[] = [];
  for (const rec of records) {
    let isLetter = false;
    const png = rec.image_data_url ? dataUrlToWhitePng(rec.image_data_url) : null;
    if (png) {
      // Ensemble across page-seg modes — their blind spots are complementary:
      //  • SINGLE_BLOCK: reliable on most glyphs, but returns empty for a bare I/F.
      //  • SINGLE_CHAR : catches some SINGLE_BLOCK misses, drops R/B.
      //  • SINGLE_WORD : the only mode that reads thin I/F.
      // Each read is confidence-gated (see MIN_CONFIDENCE) so a solid logo shape
      // that OCR "reads" as a stray low-confidence character stays a Logo. A
      // record is a Letter if ANY mode reads a confident character.
      isLetter =
        (await readsLetter(png, PSM.SINGLE_BLOCK)) ||
        (await readsLetter(png, PSM.SINGLE_CHAR)) ||
        (await readsLetter(png, PSM.SINGLE_WORD));
    }
    const prefix = isLetter ? "Letter" : "Logo";
    counts[prefix] = (counts[prefix] || 0) + 1;
    out.push({ ...rec, label: `${prefix} ${counts[prefix]}` });
  }
  return out;
}
