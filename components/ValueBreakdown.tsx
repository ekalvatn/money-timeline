"use client";

import type { ScenarioResult } from "@/lib/types";
import type { CurrencyCode } from "@/lib/format";
import { formatCurrency, formatPercent } from "@/lib/format";

/**
 * Three numbers, three tiles. Growth, fees and inflation each answer one
 * question, and a stat tile beats a chart when the story is a single figure.
 * They are kept in ink rather than status colours: a fee is not an incident.
 */
export function ValueBreakdown({
  scenario,
  currency,
  annualFeePercent,
  inflationPercent,
  years,
}: {
  scenario: ScenarioResult;
  currency: CurrencyCode;
  annualFeePercent: number;
  inflationPercent: number;
  years: number;
}) {
  const tiles = [
    {
      key: "growth",
      label: "Growth adds",
      sign: "+",
      value: scenario.final.growth,
      note: `at ${formatPercent(scenario.returnPercent)} a year before costs`,
    },
    {
      key: "fees",
      label: "Fees take",
      sign: "−",
      value: scenario.feeDrag,
      note: `${formatPercent(annualFeePercent, 2)} a year, compounded over ${years} years`,
    },
    {
      key: "inflation",
      label: "Inflation takes",
      sign: "−",
      value: scenario.inflationLoss,
      note: `${formatPercent(inflationPercent)} a year erodes what it buys`,
    },
  ];

  return (
    <div>
      <dl className="grid gap-4 sm:grid-cols-3">
        {tiles.map((tile) => (
          <div key={tile.key} className="rounded-lg border border-hair p-4">
            <dt className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">
              {tile.label}
            </dt>
            <dd className="mt-1 text-xl font-semibold leading-tight text-ink">
              {tile.sign}
              {formatCurrency(tile.value, currency)}
            </dd>
            <p className="mt-1.5 text-xs text-ink-muted">{tile.note}</p>
          </div>
        ))}
      </dl>
      <p className="mt-4 border-t border-hair pt-4 text-sm text-ink-2">
        At {formatPercent(annualFeePercent, 2)} a year, costs take{" "}
        <strong className="font-medium text-ink">
          {formatCurrency(scenario.feeDrag, currency)}
        </strong>{" "}
        out of this plan — money that would otherwise have compounded alongside
        the rest. Inflation then takes another{" "}
        {formatCurrency(scenario.inflationLoss, currency)} of what is left, so
        the plan&rsquo;s {formatCurrency(scenario.final.balance, currency)} final
        value is worth{" "}
        {formatCurrency(scenario.final.realBalance, currency)} in today&rsquo;s
        money.
      </p>
    </div>
  );
}
