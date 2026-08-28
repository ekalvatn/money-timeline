"use client";

import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ChartPalette } from "@/lib/palette";
import type { PlanResult } from "@/lib/types";
import type { CurrencyCode } from "@/lib/format";
import {
  formatCompact,
  formatCompactNumber,
  formatCurrency,
} from "@/lib/format";
import { ChartLegend, TooltipCard, axisProps, yearTicks } from "./chart-parts";
import { NARROW_QUERY, useMediaQuery } from "./use-media-query";
import type { LegendItem } from "./chart-parts";

export type MoneyBasis = "nominal" | "real";

interface TooltipModel {
  active?: boolean;
  label?: number;
  payload?: readonly { dataKey?: string | number; value?: number }[];
}

/**
 * Value over time: the three return scenarios as lines above a recessive area
 * showing what was actually paid in. One y-axis, always — the scenarios and the
 * contributions are the same measure in the same currency.
 */
export function ProjectionChart({
  plan,
  palette,
  currency,
  basis,
}: {
  plan: PlanResult;
  palette: ChartPalette;
  currency: CurrencyCode;
  basis: MoneyBasis;
}) {
  const investedKey = basis === "real" ? "investedReal" : "invested";
  const lastIndex = plan.chartRows.length - 1;
  // On a phone the axis gutter and the end-label column would leave the plot a
  // sliver, so both shrink and the labels step aside. The legend and the
  // year-by-year table still carry identity and every value.
  const narrow = useMediaQuery(NARROW_QUERY);
  // Internal phase boundaries only — a line at year 0 or at the end is just the
  // axis again.
  const boundaries = plan.spans
    .map((span) => span.endYear)
    .filter((year) => year > 0 && year < plan.years);
  const depleted = plan.scenarios
    .map((scenario) => scenario.depletedYear)
    .filter((year): year is number => year !== null);
  const firstDepleted = depleted.length ? Math.min(...depleted) : null;

  const legend: LegendItem[] = [
    ...plan.scenarios.map((scenario, index) => ({
      key: scenario.id,
      label: `${scenario.label} · ${scenario.returnPercent}%`,
      color: palette.series[index],
      shape: "line" as const,
    })),
    {
      key: "invested",
      label: "Paid in, less taken out",
      color: palette.neutralFill,
      shape: "area" as const,
    },
  ];

  const renderTooltip = (model: TooltipModel) => {
    if (!model.active || !model.payload?.length) return null;
    const year = model.label ?? 0;
    const byKey = new Map(
      model.payload.map((entry) => [String(entry.dataKey), entry.value ?? 0]),
    );
    return (
      <TooltipCard
        palette={palette}
        title={year === 0 ? "Today" : `After ${year} year${year === 1 ? "" : "s"}`}
        rows={[
          ...plan.scenarios.map((scenario, index) => ({
            key: scenario.id,
            label: scenario.label,
            color: palette.series[index],
            value: formatCurrency(byKey.get(`${basis}.${scenario.id}`) ?? 0, currency),
          })),
          {
            key: "invested",
            label: "Paid in, less taken out",
            color: palette.neutralFill,
            value: formatCurrency(byKey.get(investedKey) ?? 0, currency),
          },
        ]}
        footnote={
          basis === "real"
            ? "Today's purchasing power"
            : "Future money, not adjusted for inflation"
        }
      />
    );
  };

  /**
   * Direct end-labels satisfy the relief rule for the light-mode aqua series,
   * which sits below 3:1 on the light surface. The value is in ink; the dot
   * beside it carries the series identity.
   */
  const EndLabel = (color: string) =>
    function LineEndLabel(raw: unknown) {
      // Recharts types this callback loosely; narrow to the three fields the
      // label actually needs. Non-final points render nothing.
      const { x, y, index, value } = raw as {
        x?: number;
        y?: number;
        index?: number;
        value?: number;
      };
      if (index !== lastIndex || x === undefined || y === undefined) {
        return <g />;
      }
      return (
        <g>
          <circle cx={x + 9} cy={y} r={3.5} fill={color} />
          <text
            x={x + 17}
            y={y}
            dy={4}
            fontSize={11}
            fontWeight={600}
            fill={palette.textPrimary}
          >
            {formatCompact(value ?? 0, currency)}
          </text>
        </g>
      );
    };

  return (
    <div>
      <div className="h-[340px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={plan.chartRows}
            margin={{ top: 12, right: narrow ? 14 : 108, bottom: 26, left: 4 }}
          >
            <CartesianGrid
              stroke={palette.grid}
              strokeWidth={1}
              vertical={false}
            />
            <XAxis
              dataKey="year"
              {...axisProps(palette)}
              ticks={yearTicks(plan.years)}
              interval={0}
              label={{
                value: "Years from now",
                position: "insideBottom",
                offset: -14,
                fill: palette.textMuted,
                fontSize: 11,
              }}
            />
            <YAxis
              {...axisProps(palette)}
              width={narrow ? 58 : 88}
              tickFormatter={(value: number) =>
                narrow
                  ? formatCompactNumber(value, currency)
                  : formatCompact(value, currency)
              }
            />
            <Tooltip
              cursor={{ stroke: palette.axis, strokeWidth: 1 }}
              content={(props) => renderTooltip(props as unknown as TooltipModel)}
            />
            {/* Explicit zero rule: a draw-down plan can push "paid in, less
                taken out" below the axis, and the sign change should be read at
                a glance. */}
            <ReferenceLine y={0} stroke={palette.axis} strokeWidth={1} />
            {boundaries.map((year) => (
              <ReferenceLine
                key={`phase-${year}`}
                x={year}
                stroke={palette.grid}
                strokeWidth={1}
              />
            ))}
            {firstDepleted !== null && (
              <ReferenceLine
                x={firstDepleted}
                stroke={palette.critical}
                strokeWidth={1}
                label={{
                  value: "runs out",
                  position: "insideTopLeft",
                  fill: palette.critical,
                  fontSize: 11,
                }}
              />
            )}
            <Area
              type="monotone"
              dataKey={investedKey}
              name="Paid in"
              fill={palette.neutralFill}
              fillOpacity={1}
              stroke={palette.neutralStroke}
              strokeWidth={1.5}
              isAnimationActive={false}
            />
            {plan.scenarios.map((scenario, index) => (
              <Line
                key={scenario.id}
                type="monotone"
                dataKey={`${basis}.${scenario.id}`}
                name={scenario.label}
                stroke={palette.series[index]}
                strokeWidth={2}
                dot={false}
                activeDot={{
                  r: 4,
                  strokeWidth: 2,
                  stroke: palette.surface,
                }}
                label={narrow ? undefined : EndLabel(palette.series[index])}
                isAnimationActive={false}
              />
            ))}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-3">
        <ChartLegend items={legend} />
      </div>
    </div>
  );
}
