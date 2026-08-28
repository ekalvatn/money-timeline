import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildPlan,
  monthlyFlowForPhaseYear,
  netAnnualReturn,
  phaseSpans,
  milestonesFor,
  planYears,
  retirementYearFor,
  simulateScenario,
} from "./calc.ts";
import type { PlanInput, PlanPhase } from "./types.ts";

const phase = (overrides: Partial<PlanPhase> = {}): PlanPhase => ({
  id: "p1",
  label: "Phase",
  years: 10,
  monthlyAmount: 5_000,
  growthMode: "none",
  growthValue: 0,
  ...overrides,
});

const base: PlanInput = {
  currentAge: 40,
  retirementAge: 65,
  initialAmount: 100_000,
  phases: [phase()],
  events: [],
  inflationPercent: 2.5,
  annualFeePercent: 0,
  scenarios: [{ id: "normal", label: "Expected", returnPercent: 7 }],
};

const { rows } = simulateScenario(base, 7);
const last = rows[rows.length - 1];

test("matches the closed-form annuity formula", () => {
  // End-of-month annuity plus a compounded lump sum.
  const n = 120;
  const i = Math.pow(1.07, 1 / 12) - 1;
  const expected =
    100_000 * Math.pow(1 + i, n) + 5_000 * ((Math.pow(1 + i, n) - 1) / i);
  assert.ok(
    Math.abs(last.balance - expected) < 1e-6,
    `annuity mismatch: ${last.balance} vs ${expected}`,
  );
});

test("counts every payment plus the starting amount", () => {
  assert.equal(last.totalContributed, 100_000 + 5_000 * 120);
  assert.equal(last.totalWithdrawn, 0);
  assert.equal(last.netInvested, last.totalContributed);
  assert.equal(rows.length, 11); // year 0 through year 10
  assert.equal(rows[0].balance, 100_000);
});

test("with no return and no inflation, value equals what was paid in", () => {
  const { rows: flat } = simulateScenario({ ...base, inflationPercent: 0 }, 0);
  const final = flat[flat.length - 1];
  assert.ok(Math.abs(final.balance - final.netInvested) < 1e-9);
  assert.ok(Math.abs(final.realBalance - final.balance) < 1e-9);
  assert.ok(Math.abs(final.growth) < 1e-9);
});

test("charges the yearly cost on the whole balance", () => {
  assert.ok(Math.abs(netAnnualReturn(7, 1) - (1.07 * 0.99 - 1)) < 1e-12);
  const { rows: withFee } = simulateScenario({ ...base, annualFeePercent: 1 }, 7);
  assert.ok(withFee[withFee.length - 1].balance < last.balance);
});

test("deflates the balance by exactly (1 + inflation)^years", () => {
  assert.ok(
    Math.abs(last.realBalance - last.balance / Math.pow(1.025, 10)) < 1e-6,
  );
});

test("the horizon is the phases added up, and spans run back to back", () => {
  const phases = [
    phase({ id: "a", years: 10 }),
    phase({ id: "b", years: 15 }),
    phase({ id: "c", years: 5 }),
  ];
  assert.equal(planYears(phases), 30);
  assert.deepEqual(
    phaseSpans(phases).map((span) => [span.startYear, span.endYear]),
    [
      [0, 10],
      [10, 25],
      [25, 30],
    ],
  );
  // A phase of zero years is skipped rather than producing an empty span.
  assert.equal(phaseSpans([phase({ years: 0 }), phase({ id: "b", years: 3 })]).length, 1);
});

test("escalation restarts at each phase's own starting amount", () => {
  const plan: PlanInput = {
    ...base,
    phases: [
      phase({ id: "a", years: 2, monthlyAmount: 1_000, growthMode: "percent", growthValue: 100 }),
      phase({ id: "b", years: 2, monthlyAmount: 500, growthMode: "percent", growthValue: 100 }),
    ],
  };
  const { rows: r } = simulateScenario(plan, 0);
  assert.ok(Math.abs(r[1].contributionThisYear - 1_000 * 12) < 1e-9);
  assert.ok(Math.abs(r[2].contributionThisYear - 2_000 * 12) < 1e-9);
  // Phase two starts from its own 500, not from where phase one ended.
  assert.ok(Math.abs(r[3].contributionThisYear - 500 * 12) < 1e-9);
  assert.ok(Math.abs(r[4].contributionThisYear - 1_000 * 12) < 1e-9);
});

test("each escalation mode moves the monthly amount the way its label promises", () => {
  const flat = phase({ growthMode: "none" });
  assert.equal(monthlyFlowForPhaseYear(flat, 5, 2.5), 5_000);

  const infl = phase({ growthMode: "inflation" });
  assert.ok(Math.abs(monthlyFlowForPhaseYear(infl, 2, 2.5) - 5_000 * 1.025 ** 2) < 1e-9);

  const pct = phase({ growthMode: "percent", growthValue: 10 });
  assert.ok(Math.abs(monthlyFlowForPhaseYear(pct, 3, 2.5) - 5_000 * 1.1 ** 3) < 1e-9);

  const fixed = phase({ growthMode: "fixed", growthValue: 500 });
  assert.equal(monthlyFlowForPhaseYear(fixed, 4, 2.5), 5_000 + 2_000);

  // Escalation never flips a withdrawal into a contribution.
  const shrinking = phase({ monthlyAmount: -1_000, growthMode: "fixed", growthValue: -400 });
  assert.equal(monthlyFlowForPhaseYear(shrinking, 10, 2.5), -0);
  assert.ok(monthlyFlowForPhaseYear(shrinking, 1, 2.5) < 0);
});

test("a draw-down phase takes money out and reduces the balance", () => {
  const plan: PlanInput = {
    ...base,
    initialAmount: 0,
    phases: [
      phase({ id: "in", years: 10, monthlyAmount: 5_000 }),
      phase({ id: "out", years: 5, monthlyAmount: -10_000 }),
    ],
  };
  const { rows: r, depletedYear } = simulateScenario(plan, 7);
  assert.equal(r[10].totalWithdrawn, 0);
  assert.ok(Math.abs(r[11].withdrawalThisYear - 10_000 * 12) < 1e-6);
  assert.ok(r[15].balance < r[10].balance);
  assert.equal(r[15].totalWithdrawn, 10_000 * 12 * 5);
  assert.equal(r[15].netInvested, r[15].totalContributed - r[15].totalWithdrawn);
  assert.ok(Math.abs(r[15].growth - (r[15].balance - r[15].netInvested)) < 1e-6);
  assert.equal(depletedYear, null);
});

test("a withdrawal can never take out more than is there", () => {
  const plan: PlanInput = {
    ...base,
    initialAmount: 10_000,
    phases: [phase({ years: 5, monthlyAmount: -5_000 })],
  };
  const { rows: r, depletedYear } = simulateScenario(plan, 0);
  assert.ok(r.every((row) => row.balance >= -1e-9));
  assert.equal(r[r.length - 1].balance, 0);
  assert.equal(r[r.length - 1].totalWithdrawn, 10_000);
  assert.equal(depletedYear, 1);
});

test("a one-off lands in its year, inflated when stated in today's money", () => {
  const nominal = simulateScenario(
    {
      ...base,
      initialAmount: 1_000_000,
      phases: [phase({ years: 10, monthlyAmount: 0 })],
      events: [
        { id: "e", label: "Car", year: 5, amount: -100_000, inTodaysMoney: false },
      ],
    },
    0,
  ).rows;
  assert.equal(nominal[4].withdrawalThisYear, 0);
  assert.equal(nominal[5].withdrawalThisYear, 100_000);

  const todaysMoney = simulateScenario(
    {
      ...base,
      initialAmount: 1_000_000,
      phases: [phase({ years: 10, monthlyAmount: 0 })],
      events: [
        { id: "e", label: "Car", year: 5, amount: -100_000, inTodaysMoney: true },
      ],
    },
    0,
  ).rows;
  // Same purchasing power costs more nominal kroner five years out.
  assert.ok(
    Math.abs(todaysMoney[5].withdrawalThisYear - 100_000 * 1.025 ** 5) < 1e-6,
  );

  // An event outside the horizon is ignored rather than clamped into range.
  const outside = simulateScenario(
    {
      ...base,
      events: [{ id: "e", label: "Late", year: 99, amount: -1_000, inTodaysMoney: false }],
    },
    0,
  ).rows;
  assert.equal(outside[outside.length - 1].totalWithdrawn, 0);
});

test("values flows at the purchasing power of the date they happened", () => {
  const { rows: noInfl } = simulateScenario({ ...base, inflationPercent: 0 }, 0);
  const final = noInfl[noInfl.length - 1];
  assert.ok(Math.abs(final.netInvestedReal - final.netInvested) < 1e-9);
  assert.ok(last.netInvestedReal < last.netInvested);
});

test("survives a total loss and a total fee without producing NaN", () => {
  for (const { rows: wiped } of [
    simulateScenario(base, -100),
    simulateScenario({ ...base, annualFeePercent: 100 }, 7),
  ]) {
    assert.ok(wiped.every((row) => Number.isFinite(row.balance)));
    assert.ok(wiped.every((row) => Number.isFinite(row.realBalance)));
    assert.ok(wiped.every((row) => Number.isFinite(row.netInvestedReal)));
  }
});

test("keeps scenario order and lines chart rows up with yearly rows", () => {
  const plan = buildPlan({
    ...base,
    scenarios: [
      { id: "pessimistic", label: "Pessimistic", returnPercent: 4 },
      { id: "normal", label: "Expected", returnPercent: 7 },
      { id: "optimistic", label: "Optimistic", returnPercent: 10 },
    ],
  });
  // Order drives colour assignment, so it must survive buildPlan untouched.
  assert.deepEqual(
    plan.scenarios.map((scenario) => scenario.id),
    ["pessimistic", "normal", "optimistic"],
  );
  assert.equal(plan.years, 10);
  assert.equal(plan.chartRows.length, 11);
  assert.equal(plan.chartRows[10].nominal.normal, plan.scenarios[1].final.balance);
  assert.equal(plan.chartRows[10].invested, plan.scenarios[1].final.netInvested);
  assert.ok(plan.scenarios[0].final.balance < plan.scenarios[2].final.balance);
  // Cash-flow bars: money in is positive, money out plots below the axis.
  assert.ok(plan.chartRows[1].paidIn > 0);
  assert.ok(plan.chartRows[1].takenOut <= 0);
});

test("the per-krone multiple counts money already taken out", () => {
  const plan = buildPlan({
    ...base,
    initialAmount: 0,
    phases: [
      phase({ id: "in", years: 10, monthlyAmount: 5_000 }),
      phase({ id: "out", years: 5, monthlyAmount: -10_000 }),
    ],
  });
  const result = plan.scenarios[0];
  const expected =
    (result.final.balance + result.final.totalWithdrawn) /
    result.final.totalContributed;
  assert.ok(Math.abs(result.growthMultiple - expected) < 1e-12);
  // Withdrawing does not make the plan look worse than never withdrawing would.
  const noWithdrawal = buildPlan({
    ...base,
    initialAmount: 0,
    phases: [phase({ id: "in", years: 10, monthlyAmount: 5_000 }),
             phase({ id: "idle", years: 5, monthlyAmount: 0 })],
  }).scenarios[0];
  assert.ok(result.growthMultiple < noWithdrawal.growthMultiple);
  assert.ok(result.growthMultiple > 1);
});

test("retirement is an offset from today, and only when it lands in range", () => {
  // 25 years away but the plan only runs 10 — nothing to mark.
  assert.equal(retirementYearFor(base), null);
  assert.equal(buildPlan(base).retirementYear, null);
  assert.equal(buildPlan(base).scenarios[0].atRetirement, null);

  const inRange = { ...base, currentAge: 40, retirementAge: 47 };
  assert.equal(retirementYearFor(inRange), 7);
  const plan = buildPlan(inRange);
  assert.equal(plan.retirementYear, 7);
  assert.equal(plan.scenarios[0].atRetirement, plan.scenarios[0].rows[7]);
  assert.equal(plan.scenarios[0].atRetirement?.year, 7);

  // Already retired, or retiring today, marks nothing.
  assert.equal(retirementYearFor({ ...base, currentAge: 70, retirementAge: 65 }), null);
  assert.equal(retirementYearFor({ ...base, currentAge: 65, retirementAge: 65 }), null);

  // The very last year of the plan still counts as in range.
  assert.equal(retirementYearFor({ ...base, currentAge: 40, retirementAge: 50 }), 10);
});

test("prices the yearly cost by re-running the plan without it", () => {
  const free = buildPlan({ ...base, annualFeePercent: 0 }).scenarios[0];
  assert.equal(free.feeDrag, 0);

  const charged = buildPlan({ ...base, annualFeePercent: 1 }).scenarios[0];
  assert.ok(charged.feeDrag > 0);
  // With no withdrawals the drag is exactly the gap in final balance.
  assert.ok(
    Math.abs(charged.feeDrag - (free.final.balance - charged.final.balance)) < 1e-6,
  );
  // A costlier plan loses more, and a longer one loses more again.
  assert.ok(buildPlan({ ...base, annualFeePercent: 2 }).scenarios[0].feeDrag > charged.feeDrag);
  assert.ok(
    buildPlan({
      ...base,
      annualFeePercent: 1,
      phases: [phase({ years: 30 })],
    }).scenarios[0].feeDrag > charged.feeDrag,
  );
});

test("counts the cost of withdrawals a depleted plan could not pay", () => {
  // Measured on value delivered, so truncated withdrawals don't flatter the
  // fee-charging run into looking cheap.
  const drawdown = {
    ...base,
    initialAmount: 500_000,
    annualFeePercent: 3,
    phases: [phase({ years: 10, monthlyAmount: -5_000 })],
  };
  const result = buildPlan(drawdown).scenarios[0];
  assert.ok(result.feeDrag > 0);
  const delivered = result.final.balance + result.final.totalWithdrawn;
  const free = buildPlan({ ...drawdown, annualFeePercent: 0 }).scenarios[0];
  const deliveredFree = free.final.balance + free.final.totalWithdrawn;
  assert.ok(Math.abs(result.feeDrag - (deliveredFree - delivered)) < 1e-6);
});

test("names the round numbers a plan passes, largest few first reached", () => {
  const balances = [0, 15_000, 60_000, 120_000, 260_000, 520_000, 1_100_000];
  const invested = balances.map(() => 1);
  const found = milestonesFor(balances, invested).filter((m) => m.kind === "amount");
  assert.deepEqual(
    found.map((m) => [m.threshold, m.year]),
    [
      [100_000, 3],
      [200_000, 4],
      [500_000, 5],
      [1_000_000, 6],
    ],
  );
  // Milestones come back in the order they happen.
  assert.deepEqual(
    found.map((m) => m.year),
    [...found.map((m) => m.year)].sort((a, b) => a - b),
  );
});

test("starting above a round number is not a milestone", () => {
  // Year 0 is the opening balance; being there already is not an event.
  const found = milestonesFor([250_000, 260_000], [1, 1]);
  assert.ok(found.every((m) => m.year > 0));
  assert.ok(!found.some((m) => m.threshold === 100_000));
});

test("takes milestone thresholds off the peak, not the final value", () => {
  // A draw-down plan passes its high-water mark long before it ends.
  const balances = [0, 400_000, 1_200_000, 600_000, 50_000];
  const found = milestonesFor(balances, balances.map(() => 1));
  assert.ok(found.some((m) => m.threshold === 1_000_000));
});

test("finds the crossover where growth overtakes what was paid in", () => {
  //                    y0   y1   y2   y3    y4
  const balances = [0, 100, 250, 700, 1_000];
  const invested = [0, 100, 200, 300, 400];
  const found = milestonesFor(balances, invested).find((m) => m.kind === "crossover");
  // Year 3 is the first where growth (700 − 300) exceeds the 300 paid in.
  assert.equal(found?.year, 3);
  assert.equal(found?.value, 700);

  // No crossover while contributions still dominate.
  const slow = milestonesFor([0, 100, 200], [0, 100, 200]);
  assert.equal(slow.find((m) => m.kind === "crossover"), undefined);
});

test("milestones cope with an empty or flat plan", () => {
  assert.deepEqual(milestonesFor([], []), []);
  assert.deepEqual(milestonesFor([0, 0, 0], [0, 0, 0]), []);
});
