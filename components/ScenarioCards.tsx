"use client";

import type { ChartPalette } from "@/lib/palette";
import type { ScenarioResult } from "@/lib/types";
import type { CurrencyCode } from "@/lib/format";
import {
  formatCurrency,
  formatMultiple,
  formatPercent,
} from "@/lib/format";

/**
 * The headline answer for each scenario. A hero figure beats a chart when the
 * story is one number — the charts next to these carry the shape over time.
 */
export function ScenarioCards({
  scenarios,
  palette,
  currency,
  selectedId,
  onSelect,
  retirementAge,
}: {
  scenarios: ScenarioResult[];
  palette: ChartPalette;
  currency: CurrencyCode;
  selectedId: string;
  onSelect: (id: ScenarioResult["id"]) => void;
  retirementAge: number;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {scenarios.map((scenario, index) => {
        const color = palette.series[index];
        const selected = scenario.id === selectedId;
        return (
          <button
            key={scenario.id}
            type="button"
            aria-pressed={selected}
            onClick={() => onSelect(scenario.id)}
            className={`overflow-hidden rounded-xl border bg-surface p-5 text-left transition-colors ${
              selected ? "border-hair-strong" : "border-hair hover:border-hair-strong"
            }`}
          >
            <span className="flex items-center gap-2">
              <span
                aria-hidden
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 3,
                  background: color,
                  display: "inline-block",
                }}
              />
              <span className="text-sm font-semibold text-ink">
                {scenario.label}
              </span>
              <span className="tabular ml-auto text-xs text-ink-muted">
                {formatPercent(scenario.returnPercent)} / yr
              </span>
            </span>

            <p className="mt-4 text-[11px] font-medium uppercase tracking-wide text-ink-muted">
              Value in {scenario.rows.length - 1} years
            </p>
            <p className="mt-0.5 text-2xl font-semibold leading-tight text-ink">
              {formatCurrency(scenario.final.balance, currency)}
            </p>
            <p className="mt-1 text-sm text-ink-2">
              {formatCurrency(scenario.final.realBalance, currency)}{" "}
              <span className="text-ink-muted">in today&rsquo;s money</span>
            </p>

            {scenario.depletedYear !== null && (
              <p
                className="mt-3 flex items-start gap-1.5 text-xs font-medium"
                style={{ color: palette.critical }}
              >
                <span aria-hidden>⚠</span>
                <span>Runs out in year {scenario.depletedYear}</span>
              </p>
            )}

            <dl className="tabular mt-4 space-y-1.5 border-t border-hair pt-3 text-xs">
              {scenario.atRetirement && (
                <div className="flex justify-between gap-3">
                  <dt className="text-ink-muted">At age {retirementAge}</dt>
                  <dd className="font-medium text-ink">
                    {formatCurrency(scenario.atRetirement.balance, currency)}
                  </dd>
                </div>
              )}
              <div className="flex justify-between gap-3">
                <dt className="text-ink-muted">Paid in</dt>
                <dd className="text-ink-2">
                  {formatCurrency(scenario.final.totalContributed, currency)}
                </dd>
              </div>
              {scenario.final.totalWithdrawn > 0 && (
                <div className="flex justify-between gap-3">
                  <dt className="text-ink-muted">Taken out</dt>
                  <dd className="text-ink-2">
                    {formatCurrency(scenario.final.totalWithdrawn, currency)}
                  </dd>
                </div>
              )}
              <div className="flex justify-between gap-3">
                <dt className="text-ink-muted">Growth</dt>
                <dd className="text-ink-2">
                  {formatCurrency(scenario.final.growth, currency)}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-muted">Per krone paid in</dt>
                <dd className="text-ink-2">
                  {formatMultiple(scenario.growthMultiple)}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-muted">Return after costs</dt>
                <dd className="text-ink-2">
                  {formatPercent(scenario.netReturnPercent, 2)}
                </dd>
              </div>
            </dl>
          </button>
        );
      })}
    </div>
  );
}
