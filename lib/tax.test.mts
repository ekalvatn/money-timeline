import assert from "node:assert/strict";
import { test } from "node:test";
import { buildPlan, simulateScenario } from "./calc.ts";
import { DEFAULT_TAX } from "./defaults.ts";
import type { PlanInput, PlanPhase, TaxSettings } from "./types.ts";

const phase = (overrides: Partial<PlanPhase> = {}): PlanPhase => ({
  id: "p1",
  label: "Phase",
  years: 1,
  monthlyAmount: 0,
  growthMode: "none",
  growthValue: 0,
  ...overrides,
});

/** Gains only, no shielding, no wealth tax — one rule at a time. */
const gainsOnly: TaxSettings = {
  ...DEFAULT_TAX,
  enabled: true,
  gainsRatePercent: 40,
  shieldingRatePercent: 0,
  wealthTaxEnabled: false,
};

const plan = (overrides: Partial<PlanInput> = {}): PlanInput => ({
  currentAge: 40,
  retirementAge: 67,
  initialAmount: 100_000,
  phases: [phase()],
  events: [],
  inflationPercent: 0,
  annualFeePercent: 0,
  tax: gainsOnly,
  scenarios: [{ id: "normal", label: "Expected", returnPercent: 100 }],
  ...overrides,
});

// A 100 % yearly return doubles the pot in exactly twelve compounding months,
// which makes the tax arithmetic checkable by hand.
const DOUBLING = 100;

test("defers tax entirely while the money just compounds", () => {
  const { rows } = simulateScenario(plan(), DOUBLING);
  const final = rows[1];
  assert.ok(Math.abs(final.balance - 200_000) < 1e-6);
  assert.equal(final.totalTaxPaid, 0);
  assert.equal(final.taxPaidThisYear, 0);
  assert.equal(final.costBasis, 100_000);
  // Nothing is paid, but the liability is real and reported.
  assert.ok(Math.abs(final.latentTax - 40_000) < 1e-6);
  assert.ok(Math.abs(final.afterTaxBalance - 160_000) < 1e-6);
});

test("withdrawals take tax-free deposits before they touch gains", () => {
  const { rows } = simulateScenario(
    plan({
      phases: [
        phase({ id: "grow", years: 1 }),
        phase({ id: "draw", years: 1, monthlyAmount: -5_000 }),
      ],
    }),
    DOUBLING,
  );
  const drawYear = rows[2];
  assert.ok(Math.abs(drawYear.withdrawalThisYear - 60_000) < 1e-6);
  // All 60 000 came out of the 100 000 of deposits, so nothing is taxable.
  assert.ok(Math.abs(drawYear.costBasis - 40_000) < 1e-6);
  assert.equal(drawYear.taxPaidThisYear, 0);
});

test("taxes the gain once the deposits are used up", () => {
  const { rows } = simulateScenario(
    plan({
      phases: [
        phase({ id: "grow", years: 1 }),
        phase({ id: "draw", years: 1, monthlyAmount: -200_000 / 12 }),
      ],
    }),
    DOUBLING,
  );
  const drawYear = rows[2];
  assert.ok(Math.abs(drawYear.costBasis) < 1e-6, "deposits should be exhausted");
  const gain = drawYear.withdrawalThisYear - 100_000;
  assert.ok(Math.abs(drawYear.taxPaidThisYear - gain * 0.4) < 1e-6);
});

test("shielding accumulates yearly and shelters gains when they are realised", () => {
  const shielded = { ...gainsOnly, shieldingRatePercent: 10 };
  const { rows } = simulateScenario(
    plan({
      tax: shielded,
      phases: [
        phase({ id: "grow", years: 1 }),
        phase({ id: "draw", years: 1, monthlyAmount: -200_000 / 12 }),
      ],
    }),
    DOUBLING,
  );
  // Year 1 accrues 10 % of the 100 000 basis; year 2 accrues 10 % of basis plus
  // the unused 10 000, so 21 000 is available by the time gains are realised.
  assert.ok(Math.abs(rows[1].shieldingCarry - 10_000) < 1e-6);

  const drawYear = rows[2];
  const gain = drawYear.withdrawalThisYear - 100_000;
  const expected = (gain - 21_000) * 0.4;
  assert.ok(
    Math.abs(drawYear.taxPaidThisYear - expected) < 1e-6,
    `${drawYear.taxPaidThisYear} vs ${expected}`,
  );
  // The allowance is consumed, not reusable.
  assert.ok(drawYear.shieldingCarry < 1e-6);
});

test("shielding also reduces the tax owed on gains never realised", () => {
  const shielded = { ...gainsOnly, shieldingRatePercent: 10 };
  const withShield = simulateScenario(plan({ tax: shielded }), DOUBLING).rows[1];
  const without = simulateScenario(plan(), DOUBLING).rows[1];
  // 10 000 of the 100 000 gain is sheltered, so 4 000 less is owed.
  assert.ok(Math.abs(without.latentTax - withShield.latentTax - 4_000) < 1e-6);
});

test("wealth tax is charged on the discounted value above the threshold", () => {
  const wealth: TaxSettings = {
    ...DEFAULT_TAX,
    enabled: true,
    gainsRatePercent: 0,
    shieldingRatePercent: 0,
    wealthTaxEnabled: true,
    wealthValuationPercent: 80,
    wealthThreshold: 1_760_000,
    wealthRatePercent: 1,
  };
  const { rows } = simulateScenario(
    plan({ initialAmount: 10_000_000, tax: wealth }),
    0,
  );
  // 10m valued at 80 % is 8m; 6.24m of that is above the threshold, at 1 %.
  assert.ok(Math.abs(rows[1].taxPaidThisYear - 62_400) < 1e-6);
  assert.ok(Math.abs(rows[1].balance - (10_000_000 - 62_400)) < 1e-6);
});

test("wealth tax leaves a portfolio under the threshold alone", () => {
  const wealth = { ...DEFAULT_TAX, enabled: true, gainsRatePercent: 0, shieldingRatePercent: 0 };
  const { rows } = simulateScenario(
    plan({ initialAmount: 1_000_000, tax: wealth }),
    0,
  );
  assert.equal(rows[1].taxPaidThisYear, 0);
});

test("switching tax off leaves every figure untouched", () => {
  const off = simulateScenario(
    plan({ tax: { ...DEFAULT_TAX, enabled: false } }),
    DOUBLING,
  ).rows[1];
  assert.equal(off.totalTaxPaid, 0);
  assert.equal(off.latentTax, 0);
  assert.equal(off.afterTaxBalance, off.balance);
  assert.ok(Math.abs(off.balance - 200_000) < 1e-6);
});

test("a tax bill bigger than the pot depletes it rather than going negative", () => {
  const brutal: TaxSettings = {
    ...DEFAULT_TAX,
    enabled: true,
    gainsRatePercent: 0,
    shieldingRatePercent: 0,
    wealthTaxEnabled: true,
    wealthValuationPercent: 100,
    wealthThreshold: 0,
    wealthRatePercent: 100,
  };
  const { rows, depletedYear } = simulateScenario(
    plan({ initialAmount: 50_000, tax: brutal, phases: [phase({ years: 3 })] }),
    0,
  );
  assert.ok(rows.every((row) => row.balance >= -1e-9));
  assert.equal(rows[1].balance, 0);
  assert.equal(depletedYear, 1);
});

test("reports the whole cost of tax: paid along the way plus owed at the end", () => {
  const result = buildPlan(
    plan({
      phases: [
        phase({ id: "grow", years: 1 }),
        phase({ id: "draw", years: 1, monthlyAmount: -100_000 / 12 }),
      ],
    }),
  ).scenarios[0];
  assert.ok(result.final.totalTaxPaid >= 0);
  assert.ok(result.final.latentTax > 0);
  assert.ok(
    Math.abs(
      result.totalTaxCost - (result.final.totalTaxPaid + result.final.latentTax),
    ) < 1e-9,
  );
});

test("states the after-tax value in today's money too", () => {
  const { rows } = simulateScenario(plan({ inflationPercent: 5 }), DOUBLING);
  const final = rows[1];
  assert.ok(
    Math.abs(final.afterTaxRealBalance - final.afterTaxBalance / 1.05) < 1e-6,
  );
});
