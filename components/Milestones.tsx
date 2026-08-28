"use client";

import { milestonesFor } from "@/lib/calc";
import type { ScenarioResult } from "@/lib/types";
import type { CurrencyCode } from "@/lib/format";
import { formatCurrency } from "@/lib/format";
import type { MoneyBasis } from "./ProjectionChart";
import type { TimelineBasis } from "./chart-parts";

/**
 * The moments on the trajectory worth naming. No chart: these are a handful of
 * dates, and a list reads them better than any plot would.
 */
export function Milestones({
  scenario,
  seriesColor,
  currency,
  basis,
  timeline,
  currentAge,
}: {
  scenario: ScenarioResult;
  seriesColor: string;
  currency: CurrencyCode;
  basis: MoneyBasis;
  timeline: TimelineBasis;
  currentAge: number;
}) {
  const balances = scenario.rows.map((row) =>
    basis === "real" ? row.realBalance : row.balance,
  );
  const invested = scenario.rows.map((row) =>
    basis === "real" ? row.netInvestedReal : row.netInvested,
  );
  const milestones = milestonesFor(balances, invested);

  if (!milestones.length) {
    return (
      <p className="text-sm text-ink-2">
        This plan doesn&rsquo;t pass any round numbers worth calling out. Try a
        longer horizon or a larger monthly amount.
      </p>
    );
  }

  const when = (year: number) =>
    timeline === "age" ? `age ${currentAge + year}` : `year ${year}`;

  return (
    <ol className="space-y-0">
      {milestones.map((milestone, index) => (
        <li
          key={`${milestone.kind}-${milestone.threshold ?? "crossover"}`}
          className={`flex flex-wrap items-baseline gap-x-3 gap-y-1 py-3 ${
            index > 0 ? "border-t border-hair" : ""
          }`}
        >
          <span
            aria-hidden
            className="mt-1.5 shrink-0"
            style={{
              width: 8,
              height: 8,
              borderRadius: 999,
              background: seriesColor,
              display: "inline-block",
            }}
          />
          <span className="tabular w-24 shrink-0 text-sm font-medium capitalize text-ink">
            {when(milestone.year)}
          </span>
          <span className="min-w-0 flex-1 text-sm text-ink-2">
            {milestone.kind === "crossover" ? (
              <>
                Growth overtakes what you have paid in — from here the market is
                contributing more than you are.
              </>
            ) : (
              <>
                Passes{" "}
                <strong className="font-medium text-ink">
                  {formatCurrency(milestone.threshold ?? 0, currency)}
                </strong>
              </>
            )}
          </span>
          <span className="tabular shrink-0 text-sm text-ink-muted">
            {formatCurrency(milestone.value, currency)}
          </span>
        </li>
      ))}
    </ol>
  );
}
