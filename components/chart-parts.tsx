"use client";

import type { ChartPalette } from "@/lib/palette";

export interface LegendItem {
  key: string;
  label: string;
  color: string;
  /** Filled swatch for areas, line swatch for lines. */
  shape: "area" | "line";
}

/**
 * Always present for two or more series, so identity never rests on colour
 * alone. Text stays in ink; the swatch beside it carries the colour.
 */
export function ChartLegend({ items }: { items: LegendItem[] }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-5 gap-y-2">
      {items.map((item) => (
        <li key={item.key} className="flex items-center gap-2">
          <span
            aria-hidden
            className="inline-block"
            style={
              item.shape === "area"
                ? {
                    width: 12,
                    height: 12,
                    borderRadius: 3,
                    background: item.color,
                  }
                : {
                    width: 14,
                    height: 2,
                    borderRadius: 999,
                    background: item.color,
                  }
            }
          />
          <span className="text-xs text-ink-2">{item.label}</span>
        </li>
      ))}
    </ul>
  );
}

export interface TooltipRow {
  key: string;
  label: string;
  color: string;
  value: string;
}

export function TooltipCard({
  title,
  rows,
  palette,
  footnote,
}: {
  title: string;
  rows: TooltipRow[];
  palette: ChartPalette;
  footnote?: string;
}) {
  return (
    <div
      className="rounded-lg px-3 py-2 text-xs shadow-lg"
      style={{
        background: palette.surface,
        border: `1px solid ${palette.border}`,
        color: palette.textPrimary,
      }}
    >
      <p className="mb-1.5 font-semibold">{title}</p>
      <table className="tabular w-full border-separate border-spacing-x-3 border-spacing-y-0.5">
        <tbody>
          {rows.map((row) => (
            <tr key={row.key}>
              <td className="pr-0">
                <span className="flex items-center gap-2">
                  <span
                    aria-hidden
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 2,
                      background: row.color,
                      display: "inline-block",
                    }}
                  />
                  <span style={{ color: palette.textSecondary }}>
                    {row.label}
                  </span>
                </span>
              </td>
              <td className="text-right font-medium">{row.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {footnote && (
        <p className="mt-1.5" style={{ color: palette.textMuted }}>
          {footnote}
        </p>
      )}
    </div>
  );
}

export type TimelineBasis = "years" | "age";

/** Axis ticks stay on year indices; only their labels change. */
export function timelineTick(
  year: number,
  basis: TimelineBasis,
  currentAge: number,
): string {
  return basis === "age" ? String(currentAge + year) : String(year);
}

export function timelineAxisLabel(basis: TimelineBasis): string {
  return basis === "age" ? "Your age" : "Years from now";
}

/** Tooltip headings name both readings, so neither view loses the other. */
export function timelineTitle(
  year: number,
  basis: TimelineBasis,
  currentAge: number,
): string {
  if (basis === "age") {
    return year === 0 ? `Age ${currentAge}, today` : `Age ${currentAge + year}`;
  }
  if (year === 0) return "Today";
  return `After ${year} year${year === 1 ? "" : "s"}`;
}

/**
 * Evenly spaced year ticks that always include both ends. Left to recharts,
 * `preserveStartEnd` crowds the tail into an irregular run (…8, 11, 13, 15…).
 */
export function yearTicks(years: number): number[] {
  const step = [1, 2, 5, 10, 20].find((candidate) => years / candidate <= 10) ?? 25;
  const ticks: number[] = [];
  for (let year = 0; year <= years; year += step) ticks.push(year);
  const last = ticks[ticks.length - 1];
  if (last !== years) {
    // Move the final tick to the end rather than let it sit half a step short.
    if (years - last < step / 2) ticks[ticks.length - 1] = years;
    else ticks.push(years);
  }
  return ticks;
}

/** Shared axis/grid chrome — solid hairlines, recessive, never dashed. */
export function axisProps(palette: ChartPalette) {
  return {
    stroke: palette.axis,
    tick: { fill: palette.textMuted, fontSize: 11 },
    tickLine: false,
    axisLine: { stroke: palette.axis },
  } as const;
}
