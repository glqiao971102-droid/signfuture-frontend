// Python-compatible numeric helpers so the TS port matches the original
// byte-for-byte (Python uses round-half-to-even and specific str formatting).

/** Python's round(): round half to even ("banker's rounding"). */
export function pyRound(value: number): number {
  const floor = Math.floor(value);
  const diff = value - floor;
  if (diff < 0.5) return floor;
  if (diff > 0.5) return floor + 1;
  // Exactly .5 → round to even.
  return floor % 2 === 0 ? floor : floor + 1;
}

/** Python f-string "{v:g}" — general format, strips trailing zeros. */
export function pyG(value: number): string {
  if (!isFinite(value)) return String(value);
  if (value === 0) return "0";
  // %g uses 6 significant digits by default, then trims.
  let s = value.toPrecision(6);
  if (s.indexOf("e") === -1 && s.indexOf(".") !== -1) {
    s = s.replace(/\.?0+$/, "");
  }
  // Normalize "-0" → "0".
  if (s === "-0") s = "0";
  return s;
}

/** Python "{v:.2f}" / JS toFixed(2). Kept as a helper for intent clarity. */
export function fixed2(value: number): string {
  return (Math.round(value * 100) / 100).toFixed(2);
}

/** Python "{v:.0f}" — integer with rounding. */
export function fixed0(value: number): string {
  return String(pyRound(value));
}
