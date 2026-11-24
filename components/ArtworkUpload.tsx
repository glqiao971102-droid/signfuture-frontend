"use client";

/**
 * Artwork upload with a required "Artwork Quantity" selector first — matches the
 * Inkjet Printing products. The customer picks how many separate artworks they are
 * supplying (1–100), and only THEN is the "Upload your Artwork" file input revealed.
 * Drop-in replacement for the plain `<label className="xprod-artwork">` upload used by
 * the Mounting / Acrylic Sheet product components.
 */
export default function ArtworkUpload({
  qty,
  onQty,
  fileName,
  onFile,
  max = 100,
  accept = ".ai,.pdf,.jpg,.jpeg,.png,.zip",
}: {
  qty: string;
  onQty: (v: string) => void;
  fileName: string;
  onFile: (f: File | null) => void;
  max?: number;
  accept?: string;
}) {
  return (
    <>
      <div className="xprod-field" data-icon="▦">
        <label>Artwork Quantity</label>
        <select value={qty} onChange={(e) => onQty(e.target.value)} required>
          <option value="">Please select artwork quantity</option>
          {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
            <option key={n} value={String(n)}>
              {n} Artwork
            </option>
          ))}
        </select>
      </div>

      {qty ? (
        <label className="xprod-artwork">
          <span>Upload your Artwork</span>
          <input type="file" accept={accept} onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
          {fileName && <span className="xprod-artwork-name">✓ {fileName}</span>}
        </label>
      ) : null}
    </>
  );
}
