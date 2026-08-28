"use client";

import type { ChartPalette } from "@/lib/palette";
import type { PlanResult } from "@/lib/types";
import type { CurrencyCode } from "@/lib/format";
import { formatCurrency } from "@/lib/format";
import type { MoneyBasis } from "./ProjectionChart";

/**
 * The table view every chart on this page needs: the same numbers, readable
 * without colour, and the relief for the light-mode series that sits under 3:1.
 */
export function YearTable({
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
  return (
    <div className="max-h-[26rem] overflow-auto rounded-lg border border-hair">
      <table className="tabular w-full min-w-[44rem] border-collapse text-sm">
        <caption className="sr-only">
          Year-by-year projection, {basis === "real" ? "in today's money" : "in future money"}
        </caption>
        <thead className="sticky top-0 z-10 bg-sunken text-left">
          <tr>
            <th scope="col" className="px-3 py-2 font-medium text-ink-2">
              Year
            </th>
            <th scope="col" className="px-3 py-2 font-medium text-ink-2">
              Age
            </th>
            <th scope="col" className="px-3 py-2 text-right font-medium text-ink-2">
              Paid in
            </th>
            <th scope="col" className="px-3 py-2 text-right font-medium text-ink-2">
              Taken out
            </th>
            <th scope="col" className="px-3 py-2 text-right font-medium text-ink-2">
              Paid in, less taken out
            </th>
            {plan.scenarios.map((scenario, index) => (
              <th
                key={scenario.id}
                scope="col"
                className="px-3 py-2 text-right font-medium text-ink-2"
              >
                <span className="flex items-center justify-end gap-1.5">
                  <span
                    aria-hidden
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 2,
                      background: palette.series[index],
                      display: "inline-block",
                    }}
                  />
                  {scenario.label}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {plan.scenarios[0]?.rows.map((row, index) => (
            <tr key={row.year} className="border-t border-hair">
              <th scope="row" className="px-3 py-1.5 text-left font-normal text-ink-2">
                {row.year === 0 ? "Now" : row.year}
              </th>
              <td className="px-3 py-1.5 text-left text-ink-2">
                {plan.currentAge + row.year}
                {row.year === plan.retirementYear && (
                  <span className="ml-1.5 text-[11px] text-ink-muted">
                    retires
                  </span>
                )}
              </td>
              <td className="px-3 py-1.5 text-right text-ink-2">
                {formatCurrency(row.contributionThisYear, currency)}
              </td>
              <td className="px-3 py-1.5 text-right text-ink-2">
                {row.withdrawalThisYear > 0
                  ? `−${formatCurrency(row.withdrawalThisYear, currency)}`
                  : "—"}
              </td>
              <td className="px-3 py-1.5 text-right text-ink-2">
                {formatCurrency(
                  basis === "real" ? row.netInvestedReal : row.netInvested,
                  currency,
                )}
              </td>
              {plan.scenarios.map((scenario) => (
                <td key={scenario.id} className="px-3 py-1.5 text-right text-ink">
                  {formatCurrency(
                    basis === "real"
                      ? scenario.rows[index].realBalance
                      : scenario.rows[index].balance,
                    currency,
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function planToCsv(plan: PlanResult): string {
  const header = [
    "year",
    "age",
    "paid_in_this_year",
    "taken_out_this_year",
    "own_money_in_pot",
    "own_money_in_pot_todays_money",
    ...plan.scenarios.flatMap((scenario) => [
      `${scenario.id}_future_money`,
      `${scenario.id}_todays_money`,
    ]),
  ];
  const rows = (plan.scenarios[0]?.rows ?? []).map((row, index) => [
    row.year,
    plan.currentAge + row.year,
    Math.round(row.contributionThisYear),
    Math.round(row.withdrawalThisYear),
    Math.round(row.netInvested),
    Math.round(row.netInvestedReal),
    ...plan.scenarios.flatMap((scenario) => [
      Math.round(scenario.rows[index].balance),
      Math.round(scenario.rows[index].realBalance),
    ]),
  ]);
  return [header, ...rows].map((row) => row.join(",")).join("\n");
}
