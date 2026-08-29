// Single source of truth for the box-up cost / profit maths — used by both the
// admin order detail (AdminOrders) and the dashboard box-up profit box
// (AdminDashboard). Edit COST_RATES here and both stay in sync.
import type { NestingSummary } from "@/lib/api";

export type CostItem = {
  name: string;
  total: number;
  options: { label: string; value: string }[];
  nestingSummary?: NestingSummary | null;
};

export type CostLine = {
  name: string;
  led: number | null;
  outline: number | null;
  depth: number | null;
  nesting: NestingSummary | null;
  sell: number;
};

// Material cost rates — edit these to change the cost/profit maths.
//  LED strip: RM/metre · 3D material: RM/kg of FILAMENT (350 m filament = 1 kg) ·
//  Surface acrylic & PVC foam: RM per full 4ft×8ft sheet · UV sticker: RM/sq.ft.
export const COST_RATES = {
  ledPerM: 1,
  materialPerKg: 40,
  filamentMetresPerKg: 350, // metres of FILAMENT per kg (what the cost is priced on)
  // Our "3D material" figure is the print-LINE (toolpath) length; the filament actually
  // consumed is much shorter (the round 1.75 mm filament is squished into a wide flat
  // bead). Calibrated to the slicer: Plate 1 = 729 m line → 116.22 m filament
  // (0.3 mm layer, 1.2 mm line width, 1.75 mm filament).
  filamentPerLineMetre: 116.22 / 729,
  acrylicPerSheet: 100,
  pvcPerSheet: 50,
  uvPerSqft: 2,
};

function optValue(options: { label: string; value: string }[], label: string): string | null {
  const o = options.find((x) => x.label.toLowerCase() === label.toLowerCase());
  return o ? o.value : null;
}
function metresOf(v: string | null): number | null {
  if (!v) return null;
  const m = /([\d.]+)/.exec(v);
  return m ? Number(m[1]) : null;
}
function boxupDepthCm(options: { label: string; value: string }[]): number | null {
  const m = /(\d+)\s*cm/i.exec(optValue(options, "Size") || "");
  return m ? Number(m[1]) : null;
}

/** Metres of 3D-print material for a line (= outline × depth ÷ 0.3 mm layer). */
export function material3dMetres(c: CostLine): number {
  if (c.outline == null || c.depth == null) return 0;
  return c.outline * (c.depth === 5 ? 500 / 3 : (c.depth * 10) / 0.3);
}

/** Turn an order item into a CostLine, or null if it carries no cost inputs. */
export function costLineFromItem(l: CostItem): CostLine | null {
  const led = metresOf(optValue(l.options, "LED Length"));
  const outline = metresOf(optValue(l.options, "3D Outline"));
  const nesting = l.nestingSummary ?? null;
  if (led == null && outline == null && !nesting) return null;
  return { name: l.name, led, outline, depth: boxupDepthCm(l.options), nesting, sell: l.total ?? 0 };
}

export function costLinesOf(lines: CostItem[]): CostLine[] {
  return lines.map(costLineFromItem).filter((c): c is CostLine => c !== null);
}

/** Per-material cost + profit for one cost line, using COST_RATES. */
export function costMoneyOf(c: CostLine) {
  const led = (c.led ?? 0) * COST_RATES.ledPerM;
  // 3D material is priced on FILAMENT length: line (toolpath) m → filament m → kg × RM/kg.
  const filamentM = material3dMetres(c) * COST_RATES.filamentPerLineMetre;
  const material = (filamentM / COST_RATES.filamentMetresPerKg) * COST_RATES.materialPerKg;
  const sheets = c.nesting?.cnc?.sheets.length ?? 0;
  const acrylic = sheets * COST_RATES.acrylicPerSheet;
  const pvc = sheets * COST_RATES.pvcPerSheet;
  const uv = c.nesting?.uv ? ((c.nesting.uv.boardWIn * c.nesting.uv.boardHIn) / 144) * COST_RATES.uvPerSqft : 0;
  const cost = led + material + acrylic + pvc + uv;
  return { led, filamentM, material, acrylic, pvc, uv, cost, sell: c.sell, profit: c.sell - cost };
}
