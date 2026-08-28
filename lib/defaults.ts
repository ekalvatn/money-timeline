import type { OneOffEvent, PlanInput, PlanPhase } from "./types";
import type { CurrencyCode } from "./format";

export const DEFAULT_PLAN: PlanInput = {
  currentAge: 32,
  retirementAge: 67,
  initialAmount: 50_000,
  phases: [
    {
      id: "phase-build",
      label: "Building up",
      years: 10,
      monthlyAmount: 5_000,
      growthMode: "inflation",
      growthValue: 0,
    },
    {
      id: "phase-steady",
      label: "Peak earning",
      years: 15,
      monthlyAmount: 9_000,
      growthMode: "inflation",
      growthValue: 0,
    },
  ],
  events: [],
  inflationPercent: 2.5,
  annualFeePercent: 0.4,
  scenarios: [
    { id: "pessimistic", label: "Pessimistic", returnPercent: 4 },
    { id: "normal", label: "Expected", returnPercent: 7 },
    { id: "optimistic", label: "Optimistic", returnPercent: 10 },
  ],
};

export const DEFAULT_CURRENCY: CurrencyCode = "NOK";

export const MAX_PHASES = 10;
export const MAX_EVENTS = 20;

// Ids only need to be unique within a plan and stable across re-renders; they
// are never persisted anywhere but the plan itself.
let nextId = 0;
const makeId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${nextId++}`;

export function newPhase(overrides: Partial<PlanPhase> = {}): PlanPhase {
  return {
    id: makeId("phase"),
    label: "New phase",
    years: 5,
    monthlyAmount: 5_000,
    growthMode: "inflation",
    growthValue: 0,
    ...overrides,
  };
}

export function newDrawdownPhase(): PlanPhase {
  return newPhase({
    label: "Drawing down",
    years: 10,
    monthlyAmount: -15_000,
    growthMode: "inflation",
  });
}

export function newEvent(year: number, overrides: Partial<OneOffEvent> = {}): OneOffEvent {
  return {
    id: makeId("event"),
    label: "One-off",
    year,
    amount: -250_000,
    inTodaysMoney: true,
    ...overrides,
  };
}
