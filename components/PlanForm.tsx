"use client";

import type { ChartPalette } from "@/lib/palette";
import type { OneOffEvent, PlanInput, PlanPhase } from "@/lib/types";
import { CURRENCIES, formatCurrency } from "@/lib/format";
import type { CurrencyCode } from "@/lib/format";
import { EventEditor } from "./EventEditor";
import { PhaseEditor } from "./PhaseEditor";
import { Card, NumberField, Select } from "./ui";

export function PlanForm({
  plan,
  onChange,
  currency,
  onCurrencyChange,
  palette,
  years,
  feeDrag,
}: {
  plan: PlanInput;
  onChange: (patch: Partial<PlanInput>) => void;
  currency: CurrencyCode;
  onCurrencyChange: (currency: CurrencyCode) => void;
  palette: ChartPalette;
  /** Total horizon, derived from the phases rather than entered directly. */
  years: number;
  /** What the current cost setting takes, so the number moves as you drag it. */
  feeDrag: number;
}) {
  const retiresIn = plan.retirementAge - plan.currentAge;

  return (
    <div className="space-y-4">
      <Card
        title="About you"
        description="Sets the ages on the timeline. Retirement is a marker to read values at — the phases below decide when paying in actually stops."
      >
        <div className="space-y-5">
          <NumberField
            currency={currency}
            label="Age today"
            unit="years"
            value={plan.currentAge}
            onChange={(value) => onChange({ currentAge: Math.round(value) })}
            min={0}
            max={100}
            slider={{ min: 18, max: 90, step: 1 }}
          />
          <NumberField
            currency={currency}
            label="Retirement age"
            unit="years"
            value={plan.retirementAge}
            onChange={(value) => onChange({ retirementAge: Math.round(value) })}
            min={0}
            max={110}
            slider={{ min: 40, max: 90, step: 1 }}
            hint={
              retiresIn > 0
                ? retiresIn <= years
                  ? `${retiresIn} years from now — inside the plan, so it is marked on every chart.`
                  : `${retiresIn} years from now, past the end of the plan. Add phases to reach it.`
                : "Already at or past retirement, so nothing is marked."
            }
          />
        </div>
      </Card>

      <Card title="Starting point">
        <NumberField
          currency={currency}
          grouped
          label="Already invested"
          unit={currency}
          value={plan.initialAmount}
          onChange={(value) => onChange({ initialAmount: value })}
          min={0}
          max={1e12}
          hint="What is in the pot today, before any of the phases below."
        />
      </Card>

      <Card
        title="Phases"
        description={`Stretches of the plan, back to back from today. They add up to ${years} year${
          years === 1 ? "" : "s"
        }.`}
      >
        <PhaseEditor
          phases={plan.phases}
          onChange={(phases: PlanPhase[]) => onChange({ phases })}
          currency={currency}
          inflationPercent={plan.inflationPercent}
        />
      </Card>

      <Card
        title="One-off amounts"
        description="Lump sums that land on a single year, in or out."
      >
        <EventEditor
          events={plan.events}
          onChange={(events: OneOffEvent[]) => onChange({ events })}
          currency={currency}
          years={years}
        />
      </Card>

      <Card title="Assumptions">
        <div className="space-y-5">
          <NumberField
            currency={currency}
            label="Inflation"
            unit="% per year"
            value={plan.inflationPercent}
            onChange={(value) => onChange({ inflationPercent: value })}
            min={0}
            max={25}
            slider={{ min: 0, max: 10, step: 0.1 }}
            hint="Used to convert future money into today's purchasing power."
          />
          <NumberField
            currency={currency}
            label="Yearly cost"
            unit="% of assets"
            value={plan.annualFeePercent}
            onChange={(value) => onChange({ annualFeePercent: value })}
            min={0}
            max={5}
            slider={{ min: 0, max: 3, step: 0.05 }}
            hint={`Charged on the whole balance every year. At ${
              plan.annualFeePercent
            } %, that is ${formatCurrency(feeDrag, currency)} over ${years} years.`}
          />
          <Select
            label="Currency"
            value={currency}
            options={CURRENCIES.map((entry) => ({
              value: entry.code,
              label: `${entry.code} · ${entry.label}`,
            }))}
            onChange={onCurrencyChange}
          />
        </div>
      </Card>

      <Card
        title="Return scenarios"
        description="Gross yearly return before costs. Long-run global equities have averaged roughly 7 % nominal."
      >
        <div className="space-y-5">
          {plan.scenarios.map((scenario, index) => (
            <div key={scenario.id} className="flex items-start gap-3">
              <span
                aria-hidden
                className="mt-2.5 shrink-0"
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 3,
                  background: palette.series[index],
                  display: "inline-block",
                }}
              />
              <div className="flex-1">
                <NumberField
                  currency={currency}
                  label={scenario.label}
                  unit="% per year"
                  value={scenario.returnPercent}
                  onChange={(value) =>
                    onChange({
                      scenarios: plan.scenarios.map((entry) =>
                        entry.id === scenario.id
                          ? { ...entry, returnPercent: value }
                          : entry,
                      ),
                    })
                  }
                  min={-20}
                  max={40}
                  slider={{ min: -5, max: 20, step: 0.25 }}
                />
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
