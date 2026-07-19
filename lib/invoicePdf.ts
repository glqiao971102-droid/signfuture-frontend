// Dependency-free PDF generator for Malaysian LHDN-style E-Invoices.
// Produces a valid single-page A4 PDF (Helvetica) as a Blob, downloadable client-side.

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
  classification?: string; // e.g. "022"
  unit?: string; // e.g. "EA"
  itemRef?: string; // e.g. "#789487-1"
  desc: string; // product name
  details?: string[]; // extra spec lines
  qty: string;
  unitPrice: string; // "RM6.40"
  amount: string; // line amount excl. tax "RM28.35"
  disc?: string; // "-" or "10%"
  taxRate: string; // "10%"
  taxAmount: string; // "RM0.64"
  inclTax: string; // amount incl. tax "RM7.04"
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
  title?: string; // "E-INVOICE"
  status?: string; // "Pending"
  invoiceRef: string;
  dateTime: string;
  currency?: string; // "MYR"
  exchangeRate?: string; // "1"
  supplier?: Party; // defaults to Sign Future
  payment?: Payment;
  buyer: Party;
  items: EInvoiceItem[];
  subtotal: string; // total excluding tax
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

const esc = (s: string) =>
  String(s)
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    // strip non-ASCII so byte length == char length (keeps xref offsets valid)
    .replace(/[^\x20-\x7E]/g, "");

// Rough Helvetica advance width (em) for right-aligned numbers/labels.
const approxWidth = (s: string, size: number) => esc(s).length * size * 0.5;

function pdfFromOps(ops: string[]): Blob {
  const stream = ops.join("\n");
  const objs: Record<number, string> = {
    1: "<</Type /Catalog /Pages 2 0 R>>",
    2: "<</Type /Pages /Kids [3 0 R] /Count 1>>",
    3: "<</Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources <</Font <</F1 4 0 R /F2 5 0 R>>>> /Contents 6 0 R>>",
    4: "<</Type /Font /Subtype /Type1 /BaseFont /Helvetica>>",
    5: "<</Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold>>",
    6: "<</Length " + stream.length + ">>\nstream\n" + stream + "\nendstream",
  };
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  for (let i = 1; i <= 6; i++) {
    offsets[i] = pdf.length;
    pdf += `${i} 0 obj\n${objs[i]}\nendobj\n`;
  }
  const xrefStart = pdf.length;
  pdf += "xref\n0 7\n0000000000 65535 f \n";
  for (let i = 1; i <= 6; i++) {
    pdf += String(offsets[i]).padStart(10, "0") + " 00000 n \n";
  }
  pdf += "trailer\n<</Size 7 /Root 1 0 R>>\nstartxref\n" + xrefStart + "\n%%EOF";
  return new Blob([pdf], { type: "application/pdf" });
}

export function buildInvoicePdf(d: InvoiceData): Blob {
  const ops: string[] = [];
  const text = (x: number, y: number, size: number, font: string, s: string) =>
    ops.push(`BT /${font} ${size} Tf ${x} ${y} Td (${esc(s)}) Tj ET`);
  const textR = (xR: number, y: number, size: number, font: string, s: string) =>
    text(xR - approxWidth(s, size), y, size, font, s);
  const line = (x1: number, y1: number, x2: number, y2: number, w = 0.6) =>
    ops.push(`${w} w 0.55 0.6 0.7 RG ${x1} ${y1} m ${x2} ${y2} l S`);

  const sup = { ...SIGN_FUTURE_SUPPLIER, ...d.supplier };
  const pay = { ...SIGN_FUTURE_PAYMENT, ...d.payment };
  const b = d.buyer;
  const L = 40; // left margin
  const R = 555; // right edge

  // ---- letterhead (left) ----
  text(L, 808, 13, "F2", `${sup.name} (${sup.regNo})`);
  text(L, 794, 8, "F1", sup.address ?? "");
  text(L, 783, 8, "F1", "Email: " + (sup.email ?? ""));
  text(L, 772, 8, "F1", "Contact No: " + (sup.contact ?? ""));

  // ---- e-invoice meta (right) ----
  textR(R, 808, 14, "F2", d.title ?? "E-INVOICE");
  textR(R, 793, 8, "F1", "E-Invoice Status: " + (d.status ?? "Pending"));
  textR(R, 782, 8, "F1", "Original Invoice Ref. No.: " + d.invoiceRef);
  textR(R, 771, 8, "F1", "Invoice Date and Time: " + d.dateTime);
  textR(R, 760, 8, "F1", "Invoice Currency Code: " + (d.currency ?? "MYR"));
  textR(R, 749, 8, "F1", "Currency Exchange Rate: " + (d.exchangeRate ?? "1"));

  line(L, 742, R, 742);

  // ---- supplier block (left) ----
  let ly = 728;
  text(L, ly, 9, "F2", sup.name.toUpperCase());
  ly -= 14;
  const supLines = [
    "Supplier TIN: " + (sup.tin ?? "N/A"),
    "Supplier Registration Number: " + (sup.regNo ?? "N/A"),
    "Supplier SST ID: " + (sup.sstId ?? "N/A"),
    "Supplier Tourism Tax: " + (sup.tourismTax ?? "N/A"),
    "Supplier MSIC code: " + (sup.msic ?? "N/A"),
    "Supplier Business Activity Description: " + (sup.activity ?? "N/A"),
  ];
  for (const s of supLines) {
    text(L, ly, 8, "F1", s);
    ly -= 11;
  }

  // ---- payment block (right) ----
  let py = 728;
  const payLines = [
    "Payment Mode: " + (pay.mode ?? "Other"),
    "Bank Account no.: " + (pay.bankAccount ?? "N/A"),
    pay.bankName ?? "",
    "Frequency of billing: " + (pay.frequency ?? "N/A"),
    "Billing Period: " + (pay.billingPeriod ?? "N/A"),
  ];
  for (const s of payLines) {
    if (s) text(320, py, 8, "F1", s);
    py -= 12;
  }

  // ---- buyer block (left) ----
  ly -= 6;
  const buyerLines = [
    "Buyer Name: " + b.name,
    "Buyer TIN: " + (b.tin ?? "N/A"),
    "Buyer Identification Number: " + (b.idNo ?? "N/A"),
    "Buyer Registration Number: " + (b.regNo ?? "N/A"),
    "Buyer City Name: " + (b.city ?? "N/A"),
    "Buyer Postal Code: " + (b.postal ?? "N/A"),
    "Buyer State Code: " + (b.stateCode ?? "N/A"),
    "Buyer Address: " + (b.address ?? "N/A"),
    "Buyer Contact Number (Mobile): " + (b.contact ?? "N/A"),
    "Buyer Email: " + (b.email ?? "N/A"),
  ];
  for (const s of buyerLines) {
    text(L, ly, 8, "F1", s);
    ly -= 11;
  }

  // ---- line items table ----
  let y = Math.min(ly, py) - 8;
  // column x positions (right edges for numeric columns)
  const cDesc = L;
  const cQty = 318;
  const cUnit = 372;
  const cAmt = 426;
  const cTaxR = 466;
  const cTaxA = 512;
  const cIncl = R;

  line(L, y + 4, R, y + 4);
  text(cDesc, y - 6, 7.5, "F2", "Description");
  textR(cQty, y - 6, 7.5, "F2", "Qty");
  textR(cUnit, y - 6, 7.5, "F2", "Unit Price");
  textR(cAmt, y - 6, 7.5, "F2", "Amount");
  textR(cTaxR, y - 6, 7.5, "F2", "Tax %");
  textR(cTaxA, y - 6, 7.5, "F2", "Tax Amt");
  textR(cIncl, y - 6, 7.5, "F2", "Incl. Tax");
  y -= 12;
  line(L, y, R, y);
  y -= 14;

  for (const it of d.items) {
    const tag = [it.classification, it.unit, it.itemRef].filter(Boolean).join("  ");
    if (tag) {
      text(cDesc, y, 7.5, "F1", tag);
      y -= 11;
    }
    // numeric row aligned to the product-name line
    text(cDesc, y, 9, "F2", it.desc);
    textR(cQty, y, 8, "F1", it.qty);
    textR(cUnit, y, 8, "F1", it.unitPrice);
    textR(cAmt, y, 8, "F1", it.amount);
    textR(cTaxR, y, 8, "F1", it.taxRate);
    textR(cTaxA, y, 8, "F1", it.taxAmount);
    textR(cIncl, y, 8, "F1", it.inclTax);
    y -= 13;
    for (const dl of it.details ?? []) {
      text(cDesc + 6, y, 7.5, "F1", dl);
      y -= 10;
    }
    y -= 4;
  }

  line(L, y + 4, R, y + 4);

  // ---- totals (right) ----
  y -= 12;
  const totRows: [string, string][] = [
    ["Subtotal / Total excluding tax", d.subtotal],
    ["Tax Amount", d.taxAmount],
    ["Total including tax", d.totalInclTax],
  ];
  for (const [label, val] of totRows) {
    text(360, y, 8.5, "F1", label);
    textR(R, y, 8.5, "F1", val);
    y -= 14;
  }
  text(360, y, 10.5, "F2", "Total Payable Amount");
  textR(R, y, 10.5, "F2", d.totalPayable);
  y -= 22;

  // ---- tax summary ----
  if (d.taxSummary) {
    const t = d.taxSummary;
    line(L, y + 4, R, y + 4);
    text(L, y - 6, 7, "F2", "Total Product / Service Price");
    text(190, y - 6, 7, "F2", "Tax type");
    text(255, y - 6, 7, "F2", "Tax Rate");
    text(315, y - 6, 7, "F2", "Tax amount");
    text(390, y - 6, 7, "F2", "Tax Exemption");
    text(475, y - 6, 7, "F2", "Amount Exempted");
    y -= 18;
    text(L, y, 8, "F1", t.productPrice);
    text(190, y, 8, "F1", t.taxType);
    text(255, y, 8, "F1", t.taxRate);
    text(315, y, 8, "F1", t.taxAmount);
    text(390, y, 8, "F1", t.exemptionDetails);
    text(475, y, 8, "F1", t.amountExempted);
  }

  // ---- footer ----
  text(L, 60, 7.5, "F1", "This is a computer-generated e-invoice. No signature is required.");
  text(L, 50, 7.5, "F1", sup.name + "  |  signfuture.com.my");

  return pdfFromOps(ops);
}

// ---- simple statement (monthly roll-up of invoices) ----
export type StatementData = {
  title?: string;
  periodLabel: string;
  memberName: string;
  memberNo: string;
  rows: { date: string; ref: string; product: string; status: string; total: string }[];
  total: string;
};

export function buildStatementPdf(d: StatementData): Blob {
  const ops: string[] = [];
  const text = (x: number, y: number, size: number, font: string, s: string) =>
    ops.push(`BT /${font} ${size} Tf ${x} ${y} Td (${esc(s)}) Tj ET`);
  const textR = (xR: number, y: number, size: number, font: string, s: string) =>
    text(xR - approxWidth(s, size), y, size, font, s);
  const line = (x1: number, y1: number, x2: number, y2: number, w = 0.6) =>
    ops.push(`${w} w 0.55 0.6 0.7 RG ${x1} ${y1} m ${x2} ${y2} l S`);

  const sup = SIGN_FUTURE_SUPPLIER;
  text(40, 800, 20, "F2", "SIGN FUTURE");
  text(40, 784, 9, "F1", sup.name + " (" + sup.regNo + ")");
  textR(555, 802, 16, "F2", d.title ?? "STATEMENT");
  textR(555, 786, 10, "F1", "Period: " + d.periodLabel);
  line(40, 774, 555, 774);

  text(40, 754, 10, "F2", "Member");
  text(40, 740, 9, "F1", d.memberName + "  (Member " + d.memberNo + ")");

  let y = 712;
  text(40, y, 9, "F2", "Date");
  text(120, y, 9, "F2", "Ref");
  text(220, y, 9, "F2", "Product");
  textR(555, y, 9, "F2", "Total (RM)");
  line(40, y - 6, 555, y - 6);
  y -= 22;
  for (const r of d.rows) {
    text(40, y, 9, "F1", r.date);
    text(120, y, 9, "F1", r.ref);
    text(220, y, 9, "F1", r.product.slice(0, 40));
    textR(555, y, 9, "F1", r.total);
    y -= 18;
  }
  line(360, y - 2, 555, y - 2);
  y -= 18;
  text(360, y, 11, "F2", "Total (RM)");
  textR(555, y, 11, "F2", d.total);

  text(40, 60, 8, "F1", "This is a computer-generated statement.  |  signfuture.com.my");
  return pdfFromOps(ops);
}

// ---- reload / top-up confirmation slip ----
export type ReloadSlipData = {
  title?: string; // "RELOAD CONFIRMATION SLIP"
  tagline?: string; // left header line, e.g. "Brighten Your Future"
  transactionDate: string; // "20 June 2026"
  transactionNo: string;
  agentCode: string;
  billingTo: string[]; // name + address lines
  rows: { method: string; amount: string }[]; // top-up methods + amounts (no "RM")
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

export function buildReloadSlipPdf(d: ReloadSlipData): Blob {
  const ops: string[] = [];
  const text = (x: number, y: number, size: number, font: string, s: string) =>
    ops.push(`BT /${font} ${size} Tf ${x} ${y} Td (${esc(s)}) Tj ET`);
  const textR = (xR: number, y: number, size: number, font: string, s: string) =>
    text(xR - approxWidth(s, size), y, size, font, s);
  const line = (x1: number, y1: number, x2: number, y2: number, w = 0.6) =>
    ops.push(`${w} w 0.55 0.6 0.7 RG ${x1} ${y1} m ${x2} ${y2} l S`);

  const sup = SIGN_FUTURE_SUPPLIER;
  const L = 40;
  const R = 555;

  // header
  text(L, 805, 11, "F1", d.tagline ?? "Brighten Your Future");
  textR(R, 805, 14, "F2", d.title ?? "RELOAD CONFIRMATION SLIP");

  // company (left)
  let y = 782;
  text(L, y, 11, "F2", sup.name.toUpperCase());
  y -= 13;
  for (const ln of (sup.address ?? "").split(", ")) {
    text(L, y, 8.5, "F1", ln);
    y -= 11;
  }
  text(L, y, 8.5, "F1", "TEL : " + (sup.contact ?? ""));
  y -= 11;
  text(L, y, 8.5, "F1", "EMAIL : " + (sup.email ?? ""));

  // transaction (right)
  text(320, 782, 9, "F1", "Transaction Date  : " + d.transactionDate);
  text(320, 768, 9, "F1", "Transaction No.   : " + d.transactionNo);

  // agent code + billing to
  let by = y - 26;
  text(L, by, 9, "F2", "Agent Code : " + d.agentCode);
  by -= 22;
  text(L, by, 9, "F2", "Billing To :");
  by -= 15;
  for (const ln of d.billingTo) {
    text(L, by, 9, "F1", ln);
    by -= 12;
  }

  // table
  let ty = by - 20;
  line(L, ty + 12, R, ty + 12);
  text(L, ty, 9, "F2", "No.");
  text(80, ty, 9, "F2", "Top Up Method");
  textR(R, ty, 9, "F2", "Amount (RM)");
  ty -= 6;
  line(L, ty, R, ty);
  ty -= 18;
  d.rows.forEach((r, i) => {
    text(L, ty, 9, "F1", i + 1 + ".");
    text(80, ty, 9, "F1", r.method);
    textR(R, ty, 9, "F1", r.amount);
    ty -= 18;
  });
  ty -= 4;
  line(300, ty + 12, R, ty + 12);
  text(360, ty, 9, "F1", "Handling Charge");
  textR(R, ty, 9, "F1", d.handlingCharge);
  ty -= 18;
  text(360, ty, 10, "F2", "Total Amount");
  textR(R, ty, 10, "F2", d.totalAmount);
  line(300, ty - 6, R, ty - 6);

  // amount in words
  ty -= 28;
  text(L, ty, 9, "F2", d.amountInWords);

  // note
  text(L, 60, 8, "F1", "Note: This is a computer generated. No signature required.");
  return pdfFromOps(ops);
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
