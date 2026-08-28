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

/** Whitespace people and Intl both use inside numbers, including the thin and
 * non-breaking spaces `nb-NO` and `sv-SE` group with. */
const NUMERIC_WHITESPACE = /[\s\u00A0\u202F]/g;

export function numberSeparators(code: CurrencyCode): {
  group: string;
  decimal: string;
} {
  const parts = new Intl.NumberFormat(localeFor(code), {
    useGrouping: true,
  }).formatToParts(12345.6);
  return {
    group: parts.find((part) => part.type === "group")?.value ?? ",",
    decimal: parts.find((part) => part.type === "decimal")?.value ?? ".",
  };
}

interface NumericParts {
  negative: boolean;
  intDigits: string;
  /** Null when the reader has not typed a decimal separator at all. */
  fracDigits: string | null;
}

/**
 * Pulls a typed string apart into sign, integer digits and fraction digits.
 * Group separators are removed *before* looking for the decimal point — in
 * `en-US` the comma groups and in `nb-NO` it separates decimals, so the order
 * matters: strip first, then split.
 */
export function splitNumericInput(raw: string, code: CurrencyCode): NumericParts {
  const { group, decimal } = numberSeparators(code);
  let rest = raw.replace(NUMERIC_WHITESPACE, "");
  const negative = rest.startsWith("-");
  if (negative) rest = rest.slice(1);
  if (group !== decimal) rest = rest.split(group).join("");

  // Where the decimal separator is a comma, accept a full stop too: both keys
  // are on the keyboard and people use whichever is nearer.
  const separatorIndex = rest.search(decimal === "." ? /\./ : /[.,]/);
  const head = separatorIndex === -1 ? rest : rest.slice(0, separatorIndex);
  const tail = separatorIndex === -1 ? null : rest.slice(separatorIndex + 1);
  return {
    negative,
    intDigits: head.replace(/\D/g, ""),
    fracDigits: tail === null ? null : tail.replace(/\D/g, ""),
  };
}

export function parseLocaleNumber(raw: string, code: CurrencyCode): number | null {
  const { negative, intDigits, fracDigits } = splitNumericInput(raw, code);
  if (!intDigits && !fracDigits) return null;
  const value = Number(`${intDigits || "0"}.${fracDigits || "0"}`);
  return Number.isFinite(value) ? (negative ? -value : value) : null;
}

/**
 * Groups the integer digits of a half-typed string, leaving whatever the reader
 * has typed after the decimal separator alone — so "5 000," survives long
 * enough to become "5 000,25". Grouping is done on the digit string rather than
 * through Intl so a very long entry can't lose precision on the way.
 */
export function groupDigitsWhileTyping(raw: string, code: CurrencyCode): string {
  const { group, decimal } = numberSeparators(code);
  const { negative, intDigits, fracDigits } = splitNumericInput(raw, code);
  if (!intDigits && fracDigits === null) return negative ? "-" : "";
  const grouped = intDigits.replace(/\B(?=(\d{3})+(?!\d))/g, group);
  return (
    (negative ? "-" : "") +
    grouped +
    (fracDigits === null ? "" : decimal + fracDigits)
  );
}

/** A settled value, grouped for display in an input. */
export function formatGrouped(
  value: number,
  code: CurrencyCode,
  maximumFractionDigits = 2,
): string {
  if (!Number.isFinite(value)) return "";
  return new Intl.NumberFormat(localeFor(code), {
    useGrouping: true,
    maximumFractionDigits,
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
