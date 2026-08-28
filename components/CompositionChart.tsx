"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ChartPalette } from "@/lib/palette";
import type { ScenarioResult } from "@/lib/types";
import type { CurrencyCode } from "@/lib/format";
import {
  formatCompact,
  formatCompactNumber,
  formatCurrency,
} from "@/lib/format";
import {
  ChartLegend,
  TooltipCard,
  axisProps,
  timelineAxisLabel,
  timelineTick,
  timelineTitle,
  yearTicks,
} from "./chart-parts";
import type { TimelineBasis } from "./chart-parts";
import type { MoneyBasis } from "./ProjectionChart";
import { NARROW_QUERY, useMediaQuery } from "./use-media-query";

interface TooltipModel {
  active?: boolean;
  label?: number;
  payload?: readonly { dataKey?: string | number; value?: number }[];
}

/**
 * The same final number, split into its two sources: your own money still in
 * the pot (what you paid in, less anything taken out), and what the market
 * added on top. On the "today's money" basis both halves are
 * deflated — contributions to the purchasing power of the month they were made,
 * growth to whatever is left over. Growth can go negative there, and the chart
 * shows it: a return below inflation genuinely loses ground.
 */
export function CompositionChart({
  scenario,
  seriesColor,
  palette,
  currency,
  basis,
  timeline,
  currentAge,
  retirementYear,
  retirementAge,
}: {
  scenario: ScenarioResult;
  seriesColor: string;
  palette: ChartPalette;
  currency: CurrencyCode;
  basis: MoneyBasis;
  timeline: TimelineBasis;
  currentAge: number;
  retirementYear: number | null;
  retirementAge: number;
}) {
  const narrow = useMediaQuery(NARROW_QUERY);
  const data = scenario.rows.map((row) => {
    const invested = basis === "real" ? row.netInvestedReal : row.netInvested;
    const total = basis === "real" ? row.realBalance : row.balance;
    return { year: row.year, invested, growth: total - invested };
  });

  const renderTooltip = (model: TooltipModel) => {
    if (!model.active || !model.payload?.length) return null;
    const year = model.label ?? 0;
    const byKey = new Map(
      model.payload.map((entry) => [String(entry.dataKey), entry.value ?? 0]),
    );
    const invested = byKey.get("invested") ?? 0;
    const growth = byKey.get("growth") ?? 0;
    return (
      <TooltipCard
        palette={palette}
        title={timelineTitle(year, timeline, currentAge)}
        rows={[
          {
            key: "invested",
            label: "Paid in, less taken out",
            color: palette.neutralFill,
            value: formatCurrency(invested, currency),
          },
          {
            key: "growth",
            label: "Growth",
            color: seriesColor,
            value: formatCurrency(growth, currency),
          },
          {
            key: "total",
            label: "Total",
            color: palette.axis,
            value: formatCurrency(invested + growth, currency),
          },
        ]}
        footnote={`${scenario.label} · ${scenario.returnPercent}% return · ${
          basis === "real" ? "today's money" : "future money"
        }`}
      />
    );
  };

  return (
    <div>
      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data}
            margin={{ top: 12, right: 12, bottom: 26, left: 4 }}
          >
            <CartesianGrid
              stroke={palette.grid}
              strokeWidth={1}
              vertical={false}
            />
            <XAxis
              dataKey="year"
              {...axisProps(palette)}
              ticks={yearTicks(scenario.rows.length - 1)}
              interval={0}
              tickFormatter={(year: number) =>
                timelineTick(year, timeline, currentAge)
              }
              label={{
                value: timelineAxisLabel(timeline),
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
            <ReferenceLine y={0} stroke={palette.axis} strokeWidth={1} />
            {retirementYear !== null && (
              <ReferenceLine
                x={retirementYear}
                stroke={palette.neutralStroke}
                strokeWidth={1}
                label={{
                  value: `Retires at ${retirementAge}`,
                  position: "insideTopRight",
                  fill: palette.textSecondary,
                  fontSize: 11,
                }}
              />
            )}
            {/*
              The lower band's stroke is painted in the surface colour, which
              reads as the 2px gap between stacked fills rather than a border.
            */}
            <Area
              type="monotone"
              stackId="value"
              dataKey="invested"
              name="Paid in, less taken out"
              fill={palette.neutralFill}
              fillOpacity={1}
              stroke={palette.surface}
              strokeWidth={2}
              isAnimationActive={false}
            />
            <Area
              type="monotone"
              stackId="value"
              dataKey="growth"
              name="Growth"
              fill={seriesColor}
              fillOpacity={0.85}
              stroke={seriesColor}
              strokeWidth={2}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-3">
        <ChartLegend
          items={[
            {
              key: "invested",
              label: "Paid in, less taken out",
              color: palette.neutralFill,
              shape: "area",
            },
            { key: "growth", label: "Growth", color: seriesColor, shape: "area" },
          ]}
        />
      </div>
    </div>
  );
}
