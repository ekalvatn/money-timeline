import assert from "node:assert/strict";
import { test } from "node:test";
import { simulateScenario } from "./calc.ts";
import { solveToReach, solveToSustain } from "./solve.ts";
import type { PlanInput, PlanPhase } from "./types.ts";

const phase = (overrides: Partial<PlanPhase> = {}): PlanPhase => ({
  id: "p1",
  label: "Phase",
  years: 20,
  monthlyAmount: 5_000,
  growthMode: "none",
  growthValue: 0,
  ...overrides,
});

const base: PlanInput = {
  currentAge: 35,
  retirementAge: 67,
  initialAmount: 0,
  phases: [phase()],
  events: [],
  inflationPercent: 2.5,
  annualFeePercent: 0,
  scenarios: [{ id: "normal", label: "Expected", returnPercent: 7 }],
};

const finalBalance = (plan: PlanInput, returnPercent = 7) => {
  const { rows } = simulateScenario(plan, returnPercent);
  return rows[rows.length - 1].balance;
};

test("solves the monthly amount that reaches a target", () => {
  const target = 5_000_000;
  const result = solveToReach(base, {
    returnPercent: 7,
    target,
    byYear: 20,
    basis: "nominal",
  });
  assert.equal(result.status, "solved");
  // The answer lands on the target rather than merely past it.
  assert.ok(Math.abs(result.achieved - target) < 1);
  assert.ok(Math.abs(finalBalance(result.plan) - target) < 1);
  // And it is a real change to the plan.
  assert.equal(result.adjustments.length, 1);
  assert.equal(result.adjustments[0].from, 5_000);
  assert.ok(Math.abs(result.adjustments[0].to - 5_000 * result.scale) < 1e-9);
});

test("scales every paying-in phase by one factor, keeping the plan's shape", () => {
  const shaped: PlanInput = {
    ...base,
    phases: [
      phase({ id: "a", years: 10, monthlyAmount: 4_000 }),
      phase({ id: "b", years: 10, monthlyAmount: 12_000 }),
    ],
  };
  const result = solveToReach(shaped, {
    returnPercent: 7,
    target: 6_000_000,
    byYear: 20,
    basis: "nominal",
  });
  assert.equal(result.status, "solved");
  assert.equal(result.adjustments.length, 2);
  // The 1:3 ratio between the two phases survives the solve.
  const [first, second] = result.adjustments;
  assert.ok(Math.abs(second.to / first.to - 3) < 1e-9);
});

test("leaves withdrawal phases alone when solving contributions", () => {
  const mixed: PlanInput = {
    ...base,
    phases: [
      phase({ id: "in", years: 20, monthlyAmount: 5_000 }),
      phase({ id: "out", years: 10, monthlyAmount: -20_000 }),
    ],
  };
  const result = solveToReach(mixed, {
    returnPercent: 7,
    target: 4_000_000,
    byYear: 20,
    basis: "nominal",
  });
  assert.deepEqual(
    result.adjustments.map((a) => a.id),
    ["in"],
  );
  assert.equal(
    result.plan.phases.find((p) => p.id === "out")?.monthlyAmount,
    -20_000,
  );
});

test("reports a target already met without paying anything in", () => {
  const funded = { ...base, initialAmount: 5_000_000 };
  const result = solveToReach(funded, {
    returnPercent: 7,
    target: 1_000_000,
    byYear: 20,
    basis: "nominal",
  });
  assert.equal(result.status, "already-met");
  assert.equal(result.scale, 0);
});

test("reports an unreachable target rather than returning a wrong answer", () => {
  const result = solveToReach(base, {
    returnPercent: 7,
    target: 1e15,
    byYear: 20,
    basis: "nominal",
  });
  assert.equal(result.status, "unreachable");
  assert.ok(result.achieved < 1e15);
});

test("has nothing to scale when no phase pays in", () => {
  const idle: PlanInput = {
    ...base,
    initialAmount: 100_000,
    phases: [phase({ monthlyAmount: 0 })],
  };
  const result = solveToReach(idle, {
    returnPercent: 7,
    target: 1_000_000,
    byYear: 20,
    basis: "nominal",
  });
  assert.equal(result.status, "nothing-to-scale");
  assert.deepEqual(result.plan, idle);
});

test("solves against today's money when that is the basis", () => {
  const target = 2_000_000;
  const real = solveToReach(base, {
    returnPercent: 7,
    target,
    byYear: 20,
    basis: "real",
  });
  const nominal = solveToReach(base, {
    returnPercent: 7,
    target,
    byYear: 20,
    basis: "nominal",
  });
  // Hitting a target in today's money takes more nominal kroner, so it costs
  // more per month than the same figure in future money.
  assert.ok(real.scale > nominal.scale);
  const { rows } = simulateScenario(real.plan, 7);
  assert.ok(Math.abs(rows[20].realBalance - target) < 1);
});

test("solves the largest withdrawal the plan still survives", () => {
  const drawdown: PlanInput = {
    ...base,
    phases: [
      phase({ id: "in", years: 25, monthlyAmount: 8_000 }),
      phase({ id: "out", years: 20, monthlyAmount: -10_000 }),
    ],
  };
  const result = solveToSustain(drawdown, { returnPercent: 7 });
  assert.equal(result.status, "solved");
  assert.deepEqual(
    result.adjustments.map((a) => a.id),
    ["out"],
  );

  // The answer survives...
  assert.equal(simulateScenario(result.plan, 7).depletedYear, null);
  // ...and a hair more does not, so it really is the largest.
  const greedier = {
    ...result.plan,
    phases: result.plan.phases.map((p) =>
      p.id === "out" ? { ...p, monthlyAmount: p.monthlyAmount * 1.02 } : p,
    ),
  };
  assert.notEqual(simulateScenario(greedier, 7).depletedYear, null);
});

test("a worse return supports a smaller withdrawal", () => {
  const drawdown: PlanInput = {
    ...base,
    phases: [
      phase({ id: "in", years: 25, monthlyAmount: 8_000 }),
      phase({ id: "out", years: 20, monthlyAmount: -10_000 }),
    ],
  };
  const good = solveToSustain(drawdown, { returnPercent: 9 });
  const poor = solveToSustain(drawdown, { returnPercent: 4 });
  assert.ok(Math.abs(poor.adjustments[0].to) < Math.abs(good.adjustments[0].to));
});

test("has nothing to scale when no phase takes money out", () => {
  const result = solveToSustain(base, { returnPercent: 7 });
  assert.equal(result.status, "nothing-to-scale");
  assert.deepEqual(result.plan, base);
});
