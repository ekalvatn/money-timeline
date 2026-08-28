"use client";

import { MAX_PHASES, newDrawdownPhase, newPhase } from "@/lib/defaults";
import { monthlyFlowForPhaseYear, phaseSpans } from "@/lib/calc";
import type { PhaseGrowthMode, PlanPhase } from "@/lib/types";
import type { CurrencyCode } from "@/lib/format";
import { formatCurrency } from "@/lib/format";
import { Button, NumberField, Segmented, Select } from "./ui";

const GROWTH_OPTIONS: { value: PhaseGrowthMode; label: string }[] = [
  { value: "none", label: "Stays the same" },
  { value: "inflation", label: "Rises with inflation" },
  { value: "percent", label: "Rises by a percentage" },
  { value: "fixed", label: "Rises by a fixed amount" },
];

/**
 * The plan as a sequence of stretches rather than one flat number: pay in hard
 * early, ease off later, draw down at the end. Phases run back to back from
 * today, so the horizon is however long they add up to.
 */
export function PhaseEditor({
  phases,
  onChange,
  currency,
  inflationPercent,
}: {
  phases: PlanPhase[];
  onChange: (phases: PlanPhase[]) => void;
  currency: CurrencyCode;
  inflationPercent: number;
}) {
  const spans = phaseSpans(phases);
  const spanFor = (id: string) => spans.find((span) => span.id === id);

  const update = (id: string, patch: Partial<PlanPhase>) =>
    onChange(
      phases.map((phase) => (phase.id === id ? { ...phase, ...patch } : phase)),
    );

  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= phases.length) return;
    const next = [...phases];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  return (
    <div className="space-y-4">
      {phases.map((phase, index) => {
        const span = spanFor(phase.id);
        const takingOut = phase.monthlyAmount < 0;
        const magnitude = Math.abs(phase.monthlyAmount);

        return (
          <div
            key={phase.id}
            className="rounded-lg border border-hair-strong bg-sunken p-4"
          >
            <div className="flex items-center gap-2">
              <input
                aria-label={`Phase ${index + 1} name`}
                value={phase.label}
                onChange={(event) => update(phase.id, { label: event.target.value })}
                className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-1 py-0.5 text-sm font-semibold text-ink hover:border-hair"
              />
              <span className="tabular shrink-0 text-xs text-ink-muted">
                {span
                  ? span.startYear === span.endYear - 1
                    ? `Year ${span.endYear}`
                    : `Years ${span.startYear + 1}–${span.endYear}`
                  : "—"}
              </span>
              <button
                type="button"
                aria-label={`Move ${phase.label} earlier`}
                disabled={index === 0}
                onClick={() => move(index, -1)}
                className="rounded px-1 text-ink-muted hover:text-ink disabled:opacity-30"
              >
                ↑
              </button>
              <button
                type="button"
                aria-label={`Move ${phase.label} later`}
                disabled={index === phases.length - 1}
                onClick={() => move(index, 1)}
                className="rounded px-1 text-ink-muted hover:text-ink disabled:opacity-30"
              >
                ↓
              </button>
              <button
                type="button"
                aria-label={`Remove ${phase.label}`}
                disabled={phases.length === 1}
                onClick={() =>
                  onChange(phases.filter((entry) => entry.id !== phase.id))
                }
                className="rounded px-1 text-ink-muted hover:text-ink disabled:opacity-30"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <NumberField
                currency={currency}
                label="Lasts"
                unit="years"
                value={phase.years}
                onChange={(value) => update(phase.id, { years: Math.round(value) })}
                min={1}
                max={60}
                slider={{ min: 1, max: 30, step: 1 }}
              />

              <div>
                <span className="text-sm font-medium text-ink">Every month</span>
                <div className="mt-1.5">
                  <Segmented
                    label={`${phase.label} direction`}
                    size="sm"
                    value={takingOut ? "out" : "in"}
                    onChange={(direction) =>
                      update(phase.id, {
                        monthlyAmount:
                          direction === "out" ? -magnitude : magnitude,
                      })
                    }
                    options={[
                      { value: "in", label: "Pay in" },
                      { value: "out", label: "Take out" },
                    ]}
                  />
                </div>
                <div className="mt-3">
                  <NumberField
                    currency={currency}
                    grouped
                    label={takingOut ? "Amount taken out" : "Amount paid in"}
                    unit={`${currency} / month`}
                    value={magnitude}
                    onChange={(value) =>
                      update(phase.id, {
                        monthlyAmount: takingOut ? -Math.abs(value) : Math.abs(value),
                      })
                    }
                    min={0}
                    max={1e9}
                    slider={{ min: 0, max: 40000, step: 500 }}
                  />
                </div>
              </div>

              <Select
                label="Over the phase, that amount"
                value={phase.growthMode}
                options={GROWTH_OPTIONS}
                onChange={(value) => update(phase.id, { growthMode: value })}
              />
              {phase.growthMode === "percent" && (
                <NumberField
                  currency={currency}
                  label="Yearly change"
                  unit="% per year"
                  value={phase.growthValue}
                  onChange={(value) => update(phase.id, { growthValue: value })}
                  min={-50}
                  max={50}
                  slider={{ min: -10, max: 15, step: 0.5 }}
                />
              )}
              {phase.growthMode === "fixed" && (
                <NumberField
                  currency={currency}
                  grouped
                  label="Yearly change"
                  unit={`${currency} / month, each year`}
                  value={phase.growthValue}
                  onChange={(value) => update(phase.id, { growthValue: value })}
                  min={-1e7}
                  max={1e7}
                  slider={{ min: -5000, max: 5000, step: 100 }}
                />
              )}
              {phase.growthMode === "inflation" && (
                <p className="text-xs text-ink-muted">
                  Rises {inflationPercent} % a year, holding the same purchasing
                  power for the whole phase.
                </p>
              )}
              {phase.growthMode !== "none" && span && (
                <p className="tabular text-xs text-ink-muted">
                  By year {span.endYear}:{" "}
                  {formatCurrency(
                    Math.abs(
                      monthlyFlowForPhaseYear(
                        phase,
                        span.endYear - span.startYear - 1,
                        inflationPercent,
                      ),
                    ),
                    currency,
                  )}{" "}
                  a month.
                </p>
              )}
            </div>
          </div>
        );
      })}

      <div className="flex flex-wrap gap-2">
        <Button
          onClick={() => onChange([...phases, newPhase()])}
        >
          + Add phase
        </Button>
        <Button onClick={() => onChange([...phases, newDrawdownPhase()])}>
          + Add draw-down
        </Button>
      </div>
      {phases.length >= MAX_PHASES && (
        <p className="text-xs text-ink-muted">
          That is the most phases a plan can hold.
        </p>
      )}
    </div>
  );
}
