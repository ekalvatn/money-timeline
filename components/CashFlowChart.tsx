"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ChartPalette } from "@/lib/palette";
import type { PlanResult } from "@/lib/types";
import type { CurrencyCode } from "@/lib/format";
import { formatCompact, formatCompactNumber, formatCurrency } from "@/lib/format";
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
 * The schedule you built, as signed cash flow around a zero line: money in
 * above it, money out below. Polarity is the job here, so this is the one place
 * the diverging pair is used — never the scenario hues.
 */
export function CashFlowChart({
  plan,
  palette,
  currency,
  basis,
  timeline,
}: {
  plan: PlanResult;
  palette: ChartPalette;
  currency: CurrencyCode;
  basis: MoneyBasis;
  timeline: TimelineBasis;
}) {
  const narrow = useMediaQuery(NARROW_QUERY);
  const inKey = basis === "real" ? "paidInReal" : "paidIn";
  const outKey = basis === "real" ? "takenOutReal" : "takenOut";
  // Year 0 is "today" and carries no yearly flow; starting at year 1 keeps the
  // bars aligned with the years the money actually moves.
  const data = plan.chartRows.filter((row) => row.year > 0);

  const renderTooltip = (model: TooltipModel) => {
    if (!model.active || !model.payload?.length) return null;
    const year = model.label ?? 0;
    const byKey = new Map(
      model.payload.map((entry) => [String(entry.dataKey), entry.value ?? 0]),
    );
    const paidIn = byKey.get(inKey) ?? 0;
    const takenOut = Math.abs(byKey.get(outKey) ?? 0);
    return (
      <TooltipCard
        palette={palette}
        title={timelineTitle(year, timeline, plan.currentAge)}
        rows={[
          {
            key: "in",
            label: "Paid in",
            color: palette.flowIn,
            value: formatCurrency(paidIn, currency),
          },
          {
            key: "out",
            label: "Taken out",
            color: palette.flowOut,
            value: formatCurrency(takenOut, currency),
          },
          {
            key: "net",
            label: "Net",
            color: palette.axis,
            value: formatCurrency(paidIn - takenOut, currency),
          },
        ]}
        footnote={basis === "real" ? "Today's money" : "Future money"}
      />
    );
  };

  return (
    <div>
      <div className="h-[240px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 8, right: narrow ? 14 : 20, bottom: 26, left: 4 }}
          >
            <CartesianGrid stroke={palette.grid} strokeWidth={1} vertical={false} />
            <XAxis
              dataKey="year"
              {...axisProps(palette)}
              ticks={yearTicks(plan.years).filter((year) => year > 0)}
              interval={0}
              tickFormatter={(year: number) =>
                timelineTick(year, timeline, plan.currentAge)
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
              cursor={{ fill: palette.grid, fillOpacity: 0.5 }}
              content={(props) => renderTooltip(props as unknown as TooltipModel)}
            />
            {/* The neutral zero line is the midpoint of the diverging encoding. */}
            <ReferenceLine y={0} stroke={palette.axis} strokeWidth={1} />
            {plan.retirementYear !== null && (
              <ReferenceLine
                x={plan.retirementYear}
                stroke={palette.neutralStroke}
                strokeWidth={1}
                label={{
                  value: `Retires at ${plan.retirementAge}`,
                  position: "insideTopRight",
                  fill: palette.textSecondary,
                  fontSize: 11,
                }}
              />
            )}
            <Bar
              dataKey={inKey}
              name="Paid in"
              fill={palette.flowIn}
              radius={[3, 3, 0, 0]}
              isAnimationActive={false}
            />
            <Bar
              dataKey={outKey}
              name="Taken out"
              fill={palette.flowOut}
              radius={[0, 0, 3, 3]}
              isAnimationActive={false}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-3">
        <ChartLegend
          items={[
            { key: "in", label: "Paid in", color: palette.flowIn, shape: "area" },
            { key: "out", label: "Taken out", color: palette.flowOut, shape: "area" },
          ]}
        />
      </div>
    </div>
  );
}
