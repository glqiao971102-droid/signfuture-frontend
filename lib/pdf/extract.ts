// Low-level PDF extraction shared by the Neon Line and 3D Box Up analyzers.
// Mirrors what the original Python used pypdf for: page geometry, decoded
// content streams, and the names of image XObjects per page.
import {
  PDFDocument,
  PDFName,
  PDFArray,
  PDFDict,
  PDFRawStream,
  decodePDFRawStream,
} from "pdf-lib";

export type ExtractedPage = {
  /** 1-based page number. */
  page: number;
  widthPt: number;
  heightPt: number;
  /** Concatenated, fully-decoded content stream bytes. */
  content: Uint8Array;
  /** Set of XObject names (with leading slash, e.g. "/Im0") whose /Subtype is /Image. */
  imageNames: Set<string>;
};

function decodeStreamBytes(stream: PDFRawStream): Uint8Array {
  try {
    return decodePDFRawStream(stream).decode();
  } catch {
    // Unsupported filter — fall back to the raw (possibly still-encoded) bytes.
    return stream.getContents();
  }
}

function concatBytes(chunks: Uint8Array[]): Uint8Array {
  // PDF concatenates multiple content streams with whitespace between them.
  const sep = new Uint8Array([0x0a]);
  const parts: Uint8Array[] = [];
  let total = 0;
  chunks.forEach((c, i) => {
    if (i > 0) {
      parts.push(sep);
      total += 1;
    }
    parts.push(c);
    total += c.length;
  });
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

export async function extractPdf(bytes: Uint8Array): Promise<ExtractedPage[]> {
  const doc = await PDFDocument.load(bytes, {
    ignoreEncryption: true,
    throwOnInvalidObject: false,
    updateMetadata: false,
  });
  const pages = doc.getPages();
  const result: ExtractedPage[] = [];

  pages.forEach((page, index) => {
    const leaf = page.node;
    const size = page.getSize();

    // --- content streams ---
    const chunks: Uint8Array[] = [];
    const contents = leaf.Contents();
    const pushStream = (obj: unknown) => {
      if (obj instanceof PDFRawStream) chunks.push(decodeStreamBytes(obj));
    };
    if (contents instanceof PDFArray) {
      for (let i = 0; i < contents.size(); i++) {
        pushStream(contents.lookup(i));
      }
    } else if (contents) {
      pushStream(contents);
    }

    // --- image XObject names ---
    const imageNames = new Set<string>();
    const resources = leaf.Resources();
    if (resources instanceof PDFDict) {
      const xobjects = resources.lookupMaybe(PDFName.of("XObject"), PDFDict);
      if (xobjects instanceof PDFDict) {
        for (const [key] of xobjects.entries()) {
          const obj = xobjects.lookup(key);
          let subtype: unknown;
          if (obj instanceof PDFRawStream) subtype = obj.dict.get(PDFName.of("Subtype"));
          else if (obj instanceof PDFDict) subtype = obj.get(PDFName.of("Subtype"));
          if (subtype instanceof PDFName && subtype.asString() === "/Image") {
            imageNames.add(key.asString());
          }
        }
      }
    }

    result.push({
      page: index + 1,
      widthPt: size.width,
      heightPt: size.height,
      content: concatBytes(chunks),
      imageNames,
    });
  });

  return result;
}
