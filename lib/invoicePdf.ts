// Dependency-free PDF generator for Sign Future documents (E-Invoice, Reload
// slip, Statement). Produces a valid single-page A4 PDF as a Blob.
//
// Design: a navy brand header band carrying the company logo (fetched from
// /logo.png and composited onto the band via <canvas>, embedded as a JPEG image
// XObject), brand-coloured section titles, styled tables and a highlighted
// totals box. Because the logo is embedded as binary JPEG, the PDF is assembled
// as a byte array (not a string) so the xref offsets stay valid, and the two
// document builders are async (they await the logo).

export type Party = {
  name: string;
  tin?: string;
  idNo?: string;
  regNo?: string;
  sstId?: string;
  tourismTax?: string;
  msic?: string;
  activity?: string;
  city?: string;
  postal?: string;
  stateCode?: string;
  address?: string;
  contact?: string;
  email?: string;
};

export type EInvoiceItem = {
  classification?: string;
  unit?: string;
  itemRef?: string;
  desc: string;
  details?: string[];
  qty: string;
  unitPrice: string;
  amount: string;
  disc?: string;
  taxRate: string;
  taxAmount: string;
  inclTax: string;
};

export type Payment = {
  mode?: string;
  bankAccount?: string;
  bankName?: string;
  frequency?: string;
  billingPeriod?: string;
};

export type TaxSummary = {
  productPrice: string;
  taxType: string;
  taxRate: string;
  taxAmount: string;
  exemptionDetails: string;
  amountExempted: string;
};

export type InvoiceData = {
  title?: string;
  status?: string;
  invoiceRef: string;
  dateTime: string;
  currency?: string;
  exchangeRate?: string;
  supplier?: Party;
  payment?: Payment;
  buyer: Party;
  items: EInvoiceItem[];
  subtotal: string;
  taxAmount: string;
  totalInclTax: string;
  totalPayable: string;
  taxSummary?: TaxSummary;
};

// ---- Sign Future supplier defaults (from the official e-invoice) ----
export const SIGN_FUTURE_SUPPLIER: Party = {
  name: "Sign Future Industry Sdn Bhd",
  regNo: "201401045570",
  tin: "C23650589000",
  sstId: "W10-1808-21005244",
  tourismTax: "N/A",
  msic: "18110",
  activity: "Printing Company",
  address: "No 9, Jalan Ida 2, Kawasan Perindustrian Desa Aman, 47000 Sungai Buloh, Selangor",
  email: "syprinting@yahoo.com",
  contact: "012-6977 362 (Whatsapp Only)",
};

export const SIGN_FUTURE_PAYMENT: Payment = {
  mode: "Other",
  bankAccount: "3193649219",
  bankName: "Public Bank Berhad",
  frequency: "Monthly",
};

// ---- brand palette (0..1 RGB for PDF) ----
const NAVY = "0.043 0.090 0.188"; // #0b1730 header band
const INK = "0.09 0.13 0.20"; // near-black body text
const MUTED = "0.42 0.48 0.56"; // gray labels
const CYAN = "0.208 0.847 1.0"; // #35d8ff accent
const BOXBG = "0.945 0.965 1.0"; // pale blue totals box
const RULE = "0.80 0.84 0.90"; // hairline rule
const WHITE = "1 1 1";

const esc = (s: string) =>
  String(s)
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/[^\x20-\x7E]/g, "");

// Rough Helvetica advance width (em) for right-aligned numbers/labels.
const approxWidth = (s: string, size: number) => esc(s).length * size * 0.5;

// ---- byte-accurate PDF assembly (supports one embedded JPEG image) ----
type EmbeddedImage = { jpeg: Uint8Array; w: number; h: number };

function assemblePdf(stream: string, image?: EmbeddedImage | null): Blob {
  const enc = new TextEncoder();
  const chunks: Uint8Array[] = [];
  let length = 0;
  const push = (data: Uint8Array | string) => {
    const u = typeof data === "string" ? enc.encode(data) : data;
    chunks.push(u);
    length += u.length;
  };

  const hasImg = !!image;
  const xobjRes = hasImg ? " /XObject <</Im0 7 0 R>>" : "";
  const objDefs = [
    "<</Type /Catalog /Pages 2 0 R>>",
    "<</Type /Pages /Kids [3 0 R] /Count 1>>",
    `<</Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources <</Font <</F1 4 0 R /F2 5 0 R>>${xobjRes}>> /Contents 6 0 R>>`,
    "<</Type /Font /Subtype /Type1 /BaseFont /Helvetica>>",
    "<</Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold>>",
  ];

  const offsets: number[] = [];
  push("%PDF-1.4\n");
  for (let i = 0; i < 5; i++) {
    offsets[i + 1] = length;
    push(`${i + 1} 0 obj\n${objDefs[i]}\nendobj\n`);
  }
  // object 6 — content stream
  const streamBytes = enc.encode(stream);
  offsets[6] = length;
  push(`6 0 obj\n<</Length ${streamBytes.length}>>\nstream\n`);
  push(streamBytes);
  push("\nendstream\nendobj\n");

  let count = 6;
  if (hasImg) {
    count = 7;
    offsets[7] = length;
    push(
      `7 0 obj\n<</Type /XObject /Subtype /Image /Width ${image!.w} /Height ${image!.h} ` +
        `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${image!.jpeg.length}>>\nstream\n`,
    );
    push(image!.jpeg);
    push("\nendstream\nendobj\n");
  }

  const xrefStart = length;
  let xref = `xref\n0 ${count + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= count; i++) xref += String(offsets[i]).padStart(10, "0") + " 00000 n \n";
  push(xref);
  push(`trailer\n<</Size ${count + 1} /Root 1 0 R>>\nstartxref\n${xrefStart}\n%%EOF`);

  return new Blob(chunks as BlobPart[], { type: "application/pdf" });
}

// ---- logo: fetch /logo.png, composite on the navy band, embed as JPEG ----
const LOGO_ASPECT = 1979 / 440; // native logo w/h
let logoCache: EmbeddedImage | null | undefined;

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const b64 = dataUrl.split(",")[1] || "";
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function getBrandLogo(): Promise<EmbeddedImage | null> {
  if (logoCache !== undefined) return logoCache;
  try {
    if (typeof document === "undefined") throw new Error("no dom");
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = reject;
      im.src = "/logo.png";
    });
    const h = 176;
    const w = Math.round(h * (img.width / img.height));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no ctx");
    // fill with the navy band colour so the transparent logo blends seamlessly
    ctx.fillStyle = "#0b1730";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    logoCache = { jpeg: dataUrlToBytes(canvas.toDataURL("image/jpeg", 0.92)), w, h };
  } catch {
    logoCache = null;
  }
  return logoCache;
}

// ---- shared drawing helpers over an ops buffer ----
function pen(ops: string[]) {
  const text = (x: number, y: number, size: number, font: string, s: string, color = INK) =>
    ops.push(`${color} rg BT /${font} ${size} Tf ${x} ${y} Td (${esc(s)}) Tj ET`);
  const textR = (xR: number, y: number, size: number, font: string, s: string, color = INK) =>
    text(xR - approxWidth(s, size), y, size, font, s, color);
  const rule = (x1: number, y: number, x2: number, color = RULE, w = 0.6) =>
    ops.push(`${w} w ${color} RG ${x1} ${y} m ${x2} ${y} l S`);
  const box = (x: number, y: number, w: number, h: number, color: string) =>
    ops.push(`${color} rg ${x} ${y} ${w} ${h} re f`);
  const image = (imX: number, imY: number, imW: number, imH: number) =>
    ops.push(`q ${imW} 0 0 ${imH} ${imX} ${imY} cm /Im0 Do Q`);
  return { text, textR, rule, box, image };
}

// Navy header band with the logo (or a text fallback) + the document title.
function header(ops: string[], logo: EmbeddedImage | null, title: string) {
  const p = pen(ops);
  const bandY = 788;
  const bandH = 54;
  p.box(0, bandY, 595, bandH, NAVY); // navy band
  p.box(0, bandY - 3, 595, 3, CYAN); // cyan accent under the band
  if (logo) {
    const h = 34;
    const w = Math.round(h * LOGO_ASPECT);
    p.image(40, bandY + (bandH - h) / 2, w, h);
  } else {
    p.text(40, bandY + 20, 20, "F2", "SIGN FUTURE", WHITE);
    p.text(40, bandY + 8, 8, "F1", "Brighten Your Future", "0.7 0.8 0.95");
  }
  p.textR(555, bandY + 20, 17, "F2", title, WHITE);
  return bandY - 3; // y just under the accent line
}

function footer(ops: string[], note: string) {
  const p = pen(ops);
  p.rule(40, 66, 555, RULE, 0.6);
  p.text(40, 54, 7.5, "F1", note, MUTED);
  p.textR(555, 54, 7.5, "F2", "signfuture.com.my", CYAN);
}

// =====================================================================
//  E-INVOICE
// =====================================================================
export async function buildInvoicePdf(d: InvoiceData): Promise<Blob> {
  const logo = await getBrandLogo();
  const ops: string[] = [];
  const p = pen(ops);
  const sup = { ...SIGN_FUTURE_SUPPLIER, ...d.supplier };
  const pay = { ...SIGN_FUTURE_PAYMENT, ...d.payment };
  const b = d.buyer;
  const L = 40;
  const R = 555;

  header(ops, logo, d.title ?? "E-INVOICE");

  // meta strip under the band (right-aligned)
  let my = 770;
  const meta: [string, string][] = [
    ["Status", d.status ?? "Pending"],
    ["Invoice Ref.", d.invoiceRef],
    ["Date & Time", d.dateTime],
    ["Currency", `${d.currency ?? "MYR"}  (rate ${d.exchangeRate ?? "1"})`],
  ];
  for (const [k, v] of meta) {
    p.textR(R - approxWidth(v, 8.5) - 6, my, 7.5, "F1", k, MUTED);
    p.textR(R, my, 8.5, "F2", v);
    my -= 13;
  }

  // supplier letterhead (left)
  let ly = 770;
  p.text(L, ly, 11, "F2", sup.name, NAVY);
  ly -= 13;
  p.text(L, ly, 8, "F1", sup.address ?? "", MUTED);
  ly -= 11;
  p.text(L, ly, 8, "F1", `Email: ${sup.email ?? ""}   Tel: ${sup.contact ?? ""}`, MUTED);
  ly -= 6;

  const cardTop = Math.min(ly, my) - 6;

  // supplier details (left column)
  let sy = cardTop - 4;
  p.text(L, sy, 8.5, "F2", "SUPPLIER", CYAN);
  sy -= 14;
  const supLines = [
    ["TIN", sup.tin ?? "N/A"],
    ["Registration No.", sup.regNo ?? "N/A"],
    ["SST ID", sup.sstId ?? "N/A"],
    ["Tourism Tax", sup.tourismTax ?? "N/A"],
    ["MSIC Code", sup.msic ?? "N/A"],
    ["Activity", sup.activity ?? "N/A"],
  ];
  for (const [k, v] of supLines) {
    p.text(L, sy, 8, "F1", k, MUTED);
    p.text(L + 96, sy, 8, "F1", v);
    sy -= 11;
  }

  // payment details (right column)
  let py = cardTop - 4;
  p.text(320, py, 8.5, "F2", "PAYMENT", CYAN);
  py -= 14;
  const payLines = [
    ["Mode", pay.mode ?? "Other"],
    ["Bank Account", pay.bankAccount ?? "N/A"],
    ["Bank", pay.bankName ?? "N/A"],
    ["Frequency", pay.frequency ?? "N/A"],
    ["Billing Period", pay.billingPeriod ?? "N/A"],
  ];
  for (const [k, v] of payLines) {
    p.text(320, py, 8, "F1", k, MUTED);
    p.text(320 + 84, py, 8, "F1", v);
    py -= 11;
  }

  // buyer block (left, below supplier)
  let by = Math.min(sy, py) - 8;
  p.text(L, by, 8.5, "F2", "BUYER", CYAN);
  by -= 14;
  const buyerLines = [
    ["Name", b.name],
    ["TIN", b.tin ?? "N/A"],
    ["ID Number", b.idNo ?? "N/A"],
    ["Registration No.", b.regNo ?? "N/A"],
    ["City", b.city ?? "N/A"],
    ["Postal Code", b.postal ?? "N/A"],
    ["State Code", b.stateCode ?? "N/A"],
    ["Address", b.address ?? "N/A"],
    ["Contact (Mobile)", b.contact ?? "N/A"],
    ["Email", b.email ?? "N/A"],
  ];
  for (const [k, v] of buyerLines) {
    p.text(L, by, 8, "F1", k, MUTED);
    p.text(L + 96, by, 8, "F1", v);
    by -= 11;
  }

  // ---- line-items table ----
  let y = by - 10;
  const cDesc = L;
  const cQty = 318;
  const cUnit = 372;
  const cAmt = 426;
  const cTaxR = 466;
  const cTaxA = 512;
  const cIncl = R;

  p.box(L, y - 4, R - L, 16, NAVY); // navy table header
  p.text(cDesc + 4, y, 7.5, "F2", "DESCRIPTION", WHITE);
  p.textR(cQty, y, 7.5, "F2", "Qty", WHITE);
  p.textR(cUnit, y, 7.5, "F2", "Unit Price", WHITE);
  p.textR(cAmt, y, 7.5, "F2", "Amount", WHITE);
  p.textR(cTaxR, y, 7.5, "F2", "Tax %", WHITE);
  p.textR(cTaxA, y, 7.5, "F2", "Tax Amt", WHITE);
  p.textR(cIncl - 4, y, 7.5, "F2", "Incl. Tax", WHITE);
  y -= 22;

  for (const it of d.items) {
    const tag = [it.classification, it.unit, it.itemRef].filter(Boolean).join("  ");
    if (tag) {
      p.text(cDesc + 4, y, 7.5, "F1", tag, MUTED);
      y -= 11;
    }
    p.text(cDesc + 4, y, 9, "F2", it.desc, INK);
    p.textR(cQty, y, 8, "F1", it.qty);
    p.textR(cUnit, y, 8, "F1", it.unitPrice);
    p.textR(cAmt, y, 8, "F1", it.amount);
    p.textR(cTaxR, y, 8, "F1", it.taxRate);
    p.textR(cTaxA, y, 8, "F1", it.taxAmount);
    p.textR(cIncl - 4, y, 8, "F1", it.inclTax);
    y -= 13;
    for (const dl of it.details ?? []) {
      p.text(cDesc + 10, y, 7.5, "F1", dl, MUTED);
      y -= 10;
    }
    y -= 3;
    p.rule(L, y + 3, R, RULE, 0.4);
  }

  // ---- totals box (right) ----
  y -= 10;
  const boxX = 330;
  const boxW = R - boxX;
  const boxH = 74;
  p.box(boxX, y - boxH + 14, boxW, boxH, BOXBG);
  let ty = y;
  const totRows: [string, string][] = [
    ["Subtotal (excl. tax)", d.subtotal],
    ["Tax Amount", d.taxAmount],
    ["Total (incl. tax)", d.totalInclTax],
  ];
  for (const [label, val] of totRows) {
    p.text(boxX + 10, ty, 8.5, "F1", label, MUTED);
    p.textR(R - 10, ty, 8.5, "F1", val);
    ty -= 15;
  }
  p.rule(boxX + 10, ty + 6, R - 10, RULE, 0.5);
  ty -= 4;
  p.text(boxX + 10, ty, 10.5, "F2", "Total Payable", NAVY);
  p.textR(R - 10, ty, 11.5, "F2", d.totalPayable, NAVY);

  // ---- tax summary ----
  if (d.taxSummary) {
    const t = d.taxSummary;
    let z = y - 4;
    p.text(L, z, 8, "F2", "TAX SUMMARY", CYAN);
    z -= 15;
    p.box(L, z - 3, 290, 15, NAVY);
    p.text(L + 4, z, 6.8, "F2", "Product Price", WHITE);
    p.text(L + 78, z, 6.8, "F2", "Type", WHITE);
    p.text(L + 120, z, 6.8, "F2", "Rate", WHITE);
    p.text(L + 158, z, 6.8, "F2", "Tax", WHITE);
    p.text(L + 205, z, 6.8, "F2", "Exemption", WHITE);
    z -= 16;
    p.text(L + 4, z, 7.5, "F1", t.productPrice);
    p.text(L + 78, z, 7.5, "F1", t.taxType);
    p.text(L + 120, z, 7.5, "F1", t.taxRate);
    p.text(L + 158, z, 7.5, "F1", t.taxAmount);
    p.text(L + 205, z, 7.5, "F1", t.exemptionDetails);
  }

  footer(ops, "This is a computer-generated e-invoice. No signature is required.");
  return assemblePdf(ops.join("\n"), logo);
}

// =====================================================================
//  RELOAD / TOP-UP SLIP
// =====================================================================
export type ReloadSlipData = {
  title?: string;
  tagline?: string;
  transactionDate: string;
  transactionNo: string;
  agentCode: string;
  billingTo: string[];
  rows: { method: string; amount: string }[];
  handlingCharge: string;
  totalAmount: string;
  amountInWords: string;
};

const ONES = [
  "", "ONE", "TWO", "THREE", "FOUR", "FIVE", "SIX", "SEVEN", "EIGHT", "NINE",
  "TEN", "ELEVEN", "TWELVE", "THIRTEEN", "FOURTEEN", "FIFTEEN", "SIXTEEN",
  "SEVENTEEN", "EIGHTEEN", "NINETEEN",
];
const TENS = ["", "", "TWENTY", "THIRTY", "FORTY", "FIFTY", "SIXTY", "SEVENTY", "EIGHTY", "NINETY"];
function below1000(n: number): string {
  let s = "";
  if (n >= 100) {
    s += ONES[Math.floor(n / 100)] + " HUNDRED";
    n %= 100;
    if (n) s += " ";
  }
  if (n >= 20) {
    s += TENS[Math.floor(n / 10)];
    n %= 10;
    if (n) s += "-" + ONES[n];
  } else if (n > 0) {
    s += ONES[n];
  }
  return s;
}
function numToWords(n: number): string {
  n = Math.floor(n);
  if (n === 0) return "ZERO";
  const parts: string[] = [];
  const units: [string, number][] = [["MILLION", 1e6], ["THOUSAND", 1e3]];
  for (const [name, val] of units) {
    if (n >= val) {
      parts.push(below1000(Math.floor(n / val)) + " " + name);
      n %= val;
    }
  }
  if (n > 0) parts.push(below1000(n));
  return parts.join(" ").trim();
}
export function ringgitInWords(amount: number): string {
  const intPart = Math.floor(amount);
  const cents = Math.round((amount - intPart) * 100);
  let w = "RINGGIT MALAYSIA " + numToWords(intPart);
  if (cents > 0) w += " AND " + numToWords(cents) + " SEN";
  return w + " ONLY";
}

export async function buildReloadSlipPdf(d: ReloadSlipData): Promise<Blob> {
  const logo = await getBrandLogo();
  const ops: string[] = [];
  const p = pen(ops);
  const sup = SIGN_FUTURE_SUPPLIER;
  const L = 40;
  const R = 555;

  header(ops, logo, d.title ?? "RELOAD SLIP");

  // transaction meta (right, under band)
  let my = 768;
  const meta: [string, string][] = [
    ["Transaction Date", d.transactionDate],
    ["Transaction No.", d.transactionNo],
    ["Agent Code", d.agentCode],
  ];
  for (const [k, v] of meta) {
    p.textR(R - approxWidth(v, 9) - 8, my, 7.5, "F1", k, MUTED);
    p.textR(R, my, 9, "F2", v);
    my -= 15;
  }

  // company (left)
  let y = 768;
  p.text(L, y, 11, "F2", sup.name, NAVY);
  y -= 13;
  p.text(L, y, 8.5, "F1", sup.address ?? "", MUTED);
  y -= 11;
  p.text(L, y, 8.5, "F1", `TEL: ${sup.contact ?? ""}`, MUTED);
  y -= 11;
  p.text(L, y, 8.5, "F1", `EMAIL: ${sup.email ?? ""}`, MUTED);

  // billing-to card
  let by = Math.min(y, my) - 22;
  p.text(L, by, 8.5, "F2", "BILLING TO", CYAN);
  by -= 15;
  for (const ln of d.billingTo) {
    p.text(L, by, 9.5, ln === d.billingTo[0] ? "F2" : "F1", ln, INK);
    by -= 13;
  }

  // ---- table ----
  let ty = by - 22;
  p.box(L, ty - 4, R - L, 16, NAVY);
  p.text(L + 6, ty, 8.5, "F2", "No.", WHITE);
  p.text(84, ty, 8.5, "F2", "Top Up Method", WHITE);
  p.textR(R - 6, ty, 8.5, "F2", "Amount (RM)", WHITE);
  ty -= 22;
  d.rows.forEach((r, i) => {
    if (i % 2 === 1) p.box(L, ty - 5, R - L, 16, "0.96 0.975 0.99"); // zebra
    p.text(L + 6, ty, 9, "F1", i + 1 + ".");
    p.text(84, ty, 9, "F1", r.method);
    p.textR(R - 6, ty, 9, "F1", r.amount);
    ty -= 18;
  });
  p.rule(L, ty + 6, R, RULE, 0.5);

  // ---- totals box ----
  ty -= 6;
  const boxX = 300;
  const boxW = R - boxX;
  p.box(boxX, ty - 34, boxW, 52, BOXBG);
  p.text(boxX + 10, ty, 9, "F1", "Handling Charge", MUTED);
  p.textR(R - 10, ty, 9, "F1", d.handlingCharge);
  ty -= 16;
  p.rule(boxX + 10, ty + 7, R - 10, RULE, 0.5);
  ty -= 4;
  p.text(boxX + 10, ty, 11, "F2", "Total Amount", NAVY);
  p.textR(R - 10, ty, 12, "F2", d.totalAmount, NAVY);

  // ---- amount in words ----
  ty -= 34;
  p.text(L, ty + 12, 7.5, "F1", "Amount in words", MUTED);
  p.text(L, ty, 9.5, "F2", d.amountInWords, INK);

  footer(ops, "This is a computer-generated slip. No signature is required.");
  return assemblePdf(ops.join("\n"), logo);
}

// =====================================================================
//  STATEMENT (monthly roll-up) — sync, no logo needed
// =====================================================================
export type StatementData = {
  title?: string;
  periodLabel: string;
  memberName: string;
  memberNo: string;
  rows: { date: string; ref: string; product: string; status: string; total: string }[];
  total: string;
};

export async function buildStatementPdf(d: StatementData): Promise<Blob> {
  const logo = await getBrandLogo();
  const ops: string[] = [];
  const p = pen(ops);
  const L = 40;
  const R = 555;

  header(ops, logo, d.title ?? "STATEMENT");
  p.textR(R, 770, 9, "F1", "Period: " + d.periodLabel, MUTED);

  p.text(L, 758, 8.5, "F2", "MEMBER", CYAN);
  p.text(L, 744, 10, "F2", d.memberName, INK);
  p.text(L, 732, 8.5, "F1", "Member No. " + d.memberNo, MUTED);

  let y = 706;
  p.box(L, y - 4, R - L, 16, NAVY);
  p.text(L + 6, y, 8.5, "F2", "Date", WHITE);
  p.text(120, y, 8.5, "F2", "Ref", WHITE);
  p.text(220, y, 8.5, "F2", "Product", WHITE);
  p.textR(R - 6, y, 8.5, "F2", "Total (RM)", WHITE);
  y -= 22;
  d.rows.forEach((r, i) => {
    if (i % 2 === 1) p.box(L, y - 5, R - L, 16, "0.96 0.975 0.99");
    p.text(L + 6, y, 9, "F1", r.date);
    p.text(120, y, 9, "F1", r.ref);
    p.text(220, y, 9, "F1", r.product.slice(0, 42));
    p.textR(R - 6, y, 9, "F1", r.total);
    y -= 18;
  });
  p.rule(L, y + 6, R, RULE, 0.5);
  y -= 8;
  const boxX = 330;
  p.box(boxX, y - 12, R - boxX, 26, BOXBG);
  p.text(boxX + 10, y, 11, "F2", "Total (RM)", NAVY);
  p.textR(R - 10, y, 12, "F2", d.total, NAVY);

  footer(ops, "This is a computer-generated statement.");
  return assemblePdf(ops.join("\n"), logo);
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
