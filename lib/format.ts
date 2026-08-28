export const CURRENCIES = [
  { code: "NOK", locale: "nb-NO", label: "kr — Norwegian krone" },
  { code: "SEK", locale: "sv-SE", label: "kr — Swedish krona" },
  { code: "DKK", locale: "da-DK", label: "kr — Danish krone" },
  { code: "EUR", locale: "de-DE", label: "€ — Euro" },
  { code: "USD", locale: "en-US", label: "$ — US dollar" },
  { code: "GBP", locale: "en-GB", label: "£ — Pound sterling" },
] as const;

export type CurrencyCode = (typeof CURRENCIES)[number]["code"];

const localeFor = (code: CurrencyCode) =>
  CURRENCIES.find((currency) => currency.code === code)?.locale ?? "en-US";

export function formatCurrency(value: number, code: CurrencyCode): string {
  if (!Number.isFinite(value)) return "–";
  return new Intl.NumberFormat(localeFor(code), {
    style: "currency",
    currency: code,
    maximumFractionDigits: 0,
  }).format(value);
}

/** Short form for axis ticks and dense table cells: 1.2M, 340k. */
export function formatCompact(value: number, code: CurrencyCode): string {
  if (!Number.isFinite(value)) return "–";
  return new Intl.NumberFormat(localeFor(code), {
    style: "currency",
    currency: code,
    notation: "compact",
    compactDisplay: "short",
  }).format(value);
}

/**
 * Compact with no currency symbol — for axis ticks on narrow screens, where the
 * symbol costs more width than it adds. The card, tooltip and table around it
 * all still name the currency.
 */
export function formatCompactNumber(value: number, code: CurrencyCode): string {
  if (!Number.isFinite(value)) return "–";
  return new Intl.NumberFormat(localeFor(code), {
    notation: "compact",
    compactDisplay: "short",
  }).format(value);
}

export function formatPercent(value: number, fractionDigits = 1): string {
  if (!Number.isFinite(value)) return "–";
  return `${value.toFixed(fractionDigits).replace(/\.0$/, "")} %`;
}

export function formatMultiple(value: number): string {
  if (!Number.isFinite(value)) return "–";
  return `${value.toFixed(2)}×`;
}
