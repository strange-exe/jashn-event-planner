// Rupee formatting and parsing of the ways people write amounts in India
// ("5 lakh", "2.5L", "1 crore", "80k", "4,50,000").

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const plain = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

export function formatINR(amount: number): string {
  return inr.format(Math.round(amount));
}

export function formatNumber(n: number): string {
  return plain.format(Math.round(n));
}

const UNITS: Record<string, number> = {
  k: 1e3,
  thousand: 1e3,
  l: 1e5,
  lac: 1e5,
  lacs: 1e5,
  lakh: 1e5,
  lakhs: 1e5,
  cr: 1e7,
  crore: 1e7,
  crores: 1e7,
};

/**
 * Parses an amount like "5 lakh", "2.5L", "Rs 80k" or "4,50,000".
 * Returns null when the text has no recognisable amount.
 */
export function parseAmount(text: string): number | null {
  const m = /(\d[\d,]*(?:\.\d+)?)\s*(k|thousand|lakhs?|lacs?|l|crores?|cr)?\b/i.exec(text);
  if (!m) return null;
  const [, digits = "", suffix] = m;
  const n = Number(digits.replace(/,/g, ""));
  if (!Number.isFinite(n)) return null;
  const unit = suffix ? (UNITS[suffix.toLowerCase()] ?? 1) : 1;
  return Math.round(n * unit);
}
