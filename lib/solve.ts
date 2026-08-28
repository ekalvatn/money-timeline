// Explicit extension: node --experimental-strip-types runs these modules
// directly for the tests, and a value import has to resolve without a bundler.
import { planYears, simulateScenario } from "./calc.ts";
import type { PlanInput, PlanPhase } from "./types";

/**
 * Solving scales every phase of the relevant direction by one factor rather
 * than rewriting a single amount. That keeps the shape of the plan you designed
 * — "pay in more while earnings peak" stays proportionally true — and answers
 * the question people actually have, which is how far short the whole plan is.
 */
const MAX_SCALE = 1_000;
const ITERATIONS = 60;

export type SolveStatus =
  | "solved"
  /** The target is met without scaling anything up. */
  | "already-met"
  /** Not reachable even at the cap. */
  | "unreachable"
  /** No phases of that direction carry an amount, so there is nothing to scale. */
  | "nothing-to-scale";

export interface SolveAdjustment {
  id: string;
  label: string;
  from: number;
  to: number;
}

export interface SolveResult {
  status: SolveStatus;
  /** The factor applied to the scaled phases. */
  scale: number;
  adjustments: SolveAdjustment[];
  /** The plan with the answer applied, ready to hand back to the app. */
  plan: PlanInput;
  /** What the answer achieves: the value at the target, or the ending balance. */
  achieved: number;
}

const paysIn = (phase: PlanPhase) => phase.monthlyAmount > 0;
const takesOut = (phase: PlanPhase) => phase.monthlyAmount < 0;

function scalePhases(
  input: PlanInput,
  match: (phase: PlanPhase) => boolean,
  scale: number,
): PlanInput {
  return {
    ...input,
    phases: input.phases.map((phase) =>
      match(phase) ? { ...phase, monthlyAmount: phase.monthlyAmount * scale } : phase,
    ),
  };
}

function adjustmentsFor(
  input: PlanInput,
  match: (phase: PlanPhase) => boolean,
  scale: number,
): SolveAdjustment[] {
  return input.phases.filter(match).map((phase) => ({
    id: phase.id,
    label: phase.label,
    from: phase.monthlyAmount,
    to: phase.monthlyAmount * scale,
  }));
}

/** Smallest scale where `reached` holds. Assumes it is monotone in scale. */
function smallestPassingScale(reached: (scale: number) => boolean): number | null {
  if (!reached(MAX_SCALE)) return null;
  if (reached(0)) return 0;
  let low = 0;
  let high = MAX_SCALE;
  for (let index = 0; index < ITERATIONS; index++) {
    const mid = (low + high) / 2;
    if (reached(mid)) high = mid;
    else low = mid;
  }
  return high;
}

/** Largest scale where `holds` still holds. Assumes it is monotone in scale. */
function largestPassingScale(holds: (scale: number) => boolean): number {
  if (holds(MAX_SCALE)) return MAX_SCALE;
  let low = 0;
  let high = MAX_SCALE;
  for (let index = 0; index < ITERATIONS; index++) {
    const mid = (low + high) / 2;
    if (holds(mid)) low = mid;
    else high = mid;
  }
  return low;
}

/**
 * How much would you have to pay in to be worth `target` by `byYear`? Scaling
 * contributions can only ever raise the balance, so the search is monotone.
 */
export function solveToReach(
  input: PlanInput,
  options: {
    returnPercent: number;
    target: number;
    byYear: number;
    /** Compare against the deflated balance when the reader is in today's money. */
    basis: "nominal" | "real";
  },
): SolveResult {
  const { returnPercent, target, basis } = options;
  const byYear = Math.max(0, Math.min(Math.round(options.byYear), planYears(input.phases)));

  const valueAt = (scale: number) => {
    const { rows } = simulateScenario(scalePhases(input, paysIn, scale), returnPercent);
    const row = rows[Math.min(byYear, rows.length - 1)];
    return basis === "real" ? row.realBalance : row.balance;
  };

  if (!input.phases.some((phase) => phase.monthlyAmount > 0)) {
    return {
      status: "nothing-to-scale",
      scale: 1,
      adjustments: [],
      plan: input,
      achieved: valueAt(1),
    };
  }

  const scale = smallestPassingScale((candidate) => valueAt(candidate) >= target);
  if (scale === null) {
    return {
      status: "unreachable",
      scale: MAX_SCALE,
      adjustments: adjustmentsFor(input, paysIn, MAX_SCALE),
      plan: scalePhases(input, paysIn, MAX_SCALE),
      achieved: valueAt(MAX_SCALE),
    };
  }

  return {
    status: scale === 0 ? "already-met" : "solved",
    scale,
    adjustments: adjustmentsFor(input, paysIn, scale),
    plan: scalePhases(input, paysIn, scale),
    achieved: valueAt(scale),
  };
}

/**
 * How much can you take out and still not run dry before the plan ends? Larger
 * withdrawals can only ever deplete sooner, so the search is monotone the other
 * way: find the largest scale that still survives.
 */
export function solveToSustain(
  input: PlanInput,
  options: { returnPercent: number },
): SolveResult {
  const { returnPercent } = options;

  const survives = (scale: number) =>
    simulateScenario(scalePhases(input, takesOut, scale), returnPercent)
      .depletedYear === null;

  const endBalance = (scale: number) => {
    const { rows } = simulateScenario(scalePhases(input, takesOut, scale), returnPercent);
    return rows[rows.length - 1].balance;
  };

  if (!input.phases.some((phase) => phase.monthlyAmount < 0)) {
    return {
      status: "nothing-to-scale",
      scale: 1,
      adjustments: [],
      plan: input,
      achieved: endBalance(1),
    };
  }

  const scale = largestPassingScale(survives);
  return {
    status: "solved",
    scale,
    adjustments: adjustmentsFor(input, takesOut, scale),
    plan: scalePhases(input, takesOut, scale),
    achieved: endBalance(scale),
  };
}
