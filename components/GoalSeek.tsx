"use client";

import { useState } from "react";
import { solveToReach, solveToSustain } from "@/lib/solve";
import type { SolveResult } from "@/lib/solve";
import type { PlanInput, PlanResult } from "@/lib/types";
import type { ChartPalette } from "@/lib/palette";
import type { CurrencyCode } from "@/lib/format";
import { formatCurrency, formatPercent } from "@/lib/format";
import type { MoneyBasis } from "./ProjectionChart";
import type { TimelineBasis } from "./chart-parts";
import { Button, NumberField, Segmented } from "./ui";

type Goal = "reach" | "sustain";

/** Applied amounts are rounded so the plan keeps human numbers in its fields. */
const roundAmount = (value: number) => {
  const magnitude = Math.abs(value);
  const step = magnitude >= 1_000 ? 10 : 1;
  return Math.round(value / step) * step;
};

/** The next 1-2-5 round number above a value, as an opening target. */
function nextRoundNumber(value: number): number {
  if (value <= 0) return 1_000_000;
  const exponent = Math.floor(Math.log10(value));
  for (const base of [1, 2, 5, 10]) {
    const candidate = base * Math.pow(10, exponent);
    if (candidate > value) return candidate;
  }
  return Math.pow(10, exponent + 1);
}

export function GoalSeek({
  plan,
  input,
  palette,
  currency,
  basis,
  timeline,
  selectedIndex,
  onApply,
}: {
  plan: PlanResult;
  input: PlanInput;
  palette: ChartPalette;
  currency: CurrencyCode;
  basis: MoneyBasis;
  timeline: TimelineBasis;
  selectedIndex: number;
  onApply: (plan: PlanInput) => void;
}) {
  const [goal, setGoal] = useState<Goal>("reach");
  const [target, setTarget] = useState(() =>
    nextRoundNumber(plan.scenarios[1]?.final.balance ?? 0),
  );
  const [byYear, setByYear] = useState(() => plan.retirementYear ?? plan.years);

  const cappedYear = Math.min(Math.max(1, byYear), plan.years);

  // Solved for every scenario, because the spread between them is the answer:
  // "somewhere between 3 900 and 12 400 a month, depending what markets do."
  const results: { result: SolveResult; color: string; label: string; returnPercent: number }[] =
    plan.scenarios.map((scenario, index) => ({
      label: scenario.label,
      returnPercent: scenario.returnPercent,
      color: palette.series[index],
      result:
        goal === "reach"
          ? solveToReach(input, {
              returnPercent: scenario.returnPercent,
              target,
              byYear: cappedYear,
              basis,
            })
          : solveToSustain(input, { returnPercent: scenario.returnPercent }),
    }));

  const selected = results[selectedIndex] ?? results[0];
  const status = selected?.result.status;

  const applyRounded = () => {
    const rounded: PlanInput = {
      ...selected.result.plan,
      phases: selected.result.plan.phases.map((phase) => ({
        ...phase,
        monthlyAmount: roundAmount(phase.monthlyAmount),
      })),
    };
    onApply(rounded);
  };

  /**
   * Phases run one after another, never at once, so there is no single "monthly
   * amount" to quote when a plan has several — summing them would name a figure
   * you never actually pay. Quote the range instead, and let the scale factor in
   * the sentence below carry the rest.
   */
  const monthlySummary = (result: SolveResult) => {
    const amounts = result.adjustments.map((entry) => Math.abs(entry.to));
    if (!amounts.length) return null;
    const low = roundAmount(Math.min(...amounts));
    const high = roundAmount(Math.max(...amounts));
    return low === high
      ? formatCurrency(low, currency)
      : `${formatCurrency(low, currency)} – ${formatCurrency(high, currency)}`;
  };

  /** Within half a percent of unchanged: the plan already lands here. */
  const unchanged = Math.abs(selected?.result.scale - 1) < 0.005;

  const endAge = plan.currentAge + plan.years;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Segmented
          label="What to solve for"
          value={goal}
          onChange={setGoal}
          options={[
            { value: "reach", label: "Reach an amount" },
            { value: "sustain", label: "Make it last" },
          ]}
        />
      </div>

      {goal === "reach" ? (
        <div className="grid gap-5 sm:grid-cols-2">
          <NumberField
            currency={currency}
            grouped
            label="Target amount"
            unit={`${currency}${basis === "real" ? ", today's money" : ""}`}
            value={target}
            onChange={setTarget}
            min={0}
            max={1e12}
          />
          <NumberField
            currency={currency}
            label={timeline === "age" ? "By age" : "By year"}
            unit={
              timeline === "age"
                ? `${plan.currentAge + 1}–${endAge}`
                : `1–${plan.years}`
            }
            value={timeline === "age" ? plan.currentAge + cappedYear : cappedYear}
            onChange={(value) =>
              setByYear(
                Math.round(timeline === "age" ? value - plan.currentAge : value),
              )
            }
            min={timeline === "age" ? plan.currentAge + 1 : 1}
            max={timeline === "age" ? endAge : plan.years}
            slider={{
              min: timeline === "age" ? plan.currentAge + 1 : 1,
              max: timeline === "age" ? endAge : plan.years,
              step: 1,
            }}
          />
        </div>
      ) : (
        <p className="text-sm text-ink-2">
          The most you could take out each month and still not run dry before the
          plan ends, at age {endAge}. Extend the draw-down phase to push that
          further out.
        </p>
      )}

      {status === "nothing-to-scale" ? (
        <p className="text-sm text-ink-2">
          {goal === "reach"
            ? "No phase pays anything in, so there is nothing to scale up. Add a paying-in phase first."
            : "No phase takes money out. Add a draw-down phase first, then come back."}
        </p>
      ) : status === "unreachable" ? (
        <p className="text-sm text-ink-2">
          Even at a thousand times the current contributions this plan does not
          reach {formatCurrency(target, currency)} by{" "}
          {timeline === "age"
            ? `age ${plan.currentAge + cappedYear}`
            : `year ${cappedYear}`}
          . Try a later date or a smaller target.
        </p>
      ) : (
        <>
          <dl className="space-y-0">
            {results.map(({ label, returnPercent, color, result }, index) => (
              <div
                key={label}
                className={`flex flex-wrap items-baseline gap-x-3 gap-y-1 py-2.5 ${
                  index > 0 ? "border-t border-hair" : ""
                }`}
              >
                <span
                  aria-hidden
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 2,
                    background: color,
                    display: "inline-block",
                  }}
                />
                <dt className="w-28 shrink-0 text-sm text-ink-2">{label}</dt>
                <dd className="tabular flex-1 text-sm font-medium text-ink">
                  {result.status === "already-met" ? (
                    <span className="font-normal text-ink-2">
                      already there without paying in more
                    </span>
                  ) : (
                    <>
                      {monthlySummary(result)}
                      <span className="font-normal text-ink-muted"> a month</span>
                    </>
                  )}
                </dd>
                <span className="tabular shrink-0 text-xs text-ink-muted">
                  at {formatPercent(returnPercent)}
                </span>
              </div>
            ))}
          </dl>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-hair pt-4">
            <p className="min-w-0 flex-1 text-sm text-ink-2">
              {goal === "reach" ? (
                <>
                  To reach{" "}
                  <strong className="font-medium text-ink">
                    {formatCurrency(target, currency)}
                  </strong>{" "}
                  by{" "}
                  {timeline === "age"
                    ? `age ${plan.currentAge + cappedYear}`
                    : `year ${cappedYear}`}
                  {basis === "real" && " in today's money"} on the{" "}
                  {selected.label.toLowerCase()} path,{" "}
                  {unchanged
                    ? "your plan already lands there — no change needed."
                    : `every paying-in phase scales by ×${selected.result.scale.toFixed(2)}.`}
                </>
              ) : (
                <>
                  On the {selected.label.toLowerCase()} path, every draw-down
                  phase scales by ×{selected.result.scale.toFixed(2)}. That is
                  the most the pot can carry: it empties almost exactly at age{" "}
                  {endAge}, so nothing is left over for a bad run of years.
                </>
              )}{" "}
              Scaling keeps the shape of your plan, so the phases stay in
              proportion to each other.
            </p>
            {selected.result.status === "solved" && (
              <Button variant="solid" onClick={applyRounded}>
                Apply to plan
              </Button>
            )}
          </div>

          {selected.result.adjustments.length > 1 && !unchanged && (
            <ul className="tabular flex flex-wrap gap-2">
              {selected.result.adjustments.map((entry) => (
                <li
                  key={entry.id}
                  className="rounded-md border border-hair px-2.5 py-1 text-xs text-ink-2"
                >
                  <span className="font-medium text-ink">{entry.label}</span>{" "}
                  {formatCurrency(Math.abs(entry.from), currency)} →{" "}
                  {formatCurrency(roundAmount(Math.abs(entry.to)), currency)}/mo
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
