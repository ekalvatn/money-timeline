import type {
  ChartRow,
  OneOffEvent,
  PhaseSpan,
  PlanInput,
  PlanPhase,
  PlanResult,
  ScenarioId,
  ScenarioResult,
  YearRow,
} from "./types";

const MONTHS_PER_YEAR = 12;
export const MAX_YEARS = 60;

const clamp = (value: number, min: number, max: number) =>
  Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : min;

/** Total horizon: phases run back to back from today. */
export function planYears(phases: PlanPhase[]): number {
  const total = phases.reduce(
    (sum, phase) => sum + Math.max(0, Math.round(phase.years)),
    0,
  );
  return clamp(total, 1, MAX_YEARS);
}

export function phaseSpans(phases: PlanPhase[]): PhaseSpan[] {
  const spans: PhaseSpan[] = [];
  let startYear = 0;
  for (const phase of phases) {
    const length = Math.max(0, Math.round(phase.years));
    if (length === 0) continue;
    const endYear = Math.min(MAX_YEARS, startYear + length);
    if (startYear >= endYear) break;
    spans.push({
      id: phase.id,
      label: phase.label,
      startYear,
      endYear,
      monthlyAmount: phase.monthlyAmount,
    });
    startYear = endYear;
    if (startYear >= MAX_YEARS) break;
  }
  return spans;
}

/**
 * The monthly cash flow in the given year of a phase. Escalation restarts at
 * each phase's own starting amount, so "back off to 2 000 for the last ten
 * years" means exactly that, whatever the phase before it ended on.
 */
export function monthlyFlowForPhaseYear(
  phase: PlanPhase,
  yearIndexInPhase: number,
  inflationPercent: number,
): number {
  const base = phase.monthlyAmount;
  const sign = base < 0 ? -1 : 1;
  const magnitude = Math.abs(base);
  switch (phase.growthMode) {
    case "percent":
      return sign * magnitude * Math.pow(1 + phase.growthValue / 100, yearIndexInPhase);
    case "inflation":
      return sign * magnitude * Math.pow(1 + inflationPercent / 100, yearIndexInPhase);
    case "fixed":
      // Escalation never flips the direction of the flow.
      return sign * Math.max(0, magnitude + phase.growthValue * yearIndexInPhase);
    case "none":
    default:
      return base;
  }
}

/**
 * Net-of-cost return. The yearly cost is charged on assets, so it scales the
 * whole portfolio rather than just the gain: (1 + r) × (1 − fee) − 1.
 */
export function netAnnualReturn(
  grossPercent: number,
  feePercent: number,
): number {
  const gross = grossPercent / 100;
  const fee = clamp(feePercent / 100, 0, 1);
  return (1 + gross) * (1 - fee) - 1;
}

/** The nominal size of a one-off, inflated to its year if stated in today's money. */
function eventAmount(event: OneOffEvent, inflation: number): number {
  return event.inTodaysMoney
    ? event.amount * Math.pow(1 + inflation, event.year)
    : event.amount;
}

/**
 * Month-by-month simulation. Growth is applied first, then the month's cash
 * flow — i.e. payments are made at the end of each month, which is the
 * conservative reading and matches how a monthly transfer behaves. Withdrawals
 * can never take out more than is there; the shortfall marks the plan depleted.
 */
export function simulateScenario(
  input: PlanInput,
  grossReturnPercent: number,
): { rows: YearRow[]; depletedYear: number | null } {
  const years = planYears(input.phases);
  const spans = phaseSpans(input.phases);
  const inflation = input.inflationPercent / 100;
  const net = netAnnualReturn(grossReturnPercent, input.annualFeePercent);
  // Guard the fractional power: a total loss or worse has no real 12th root.
  const monthlyRate =
    1 + net > 0 ? Math.pow(1 + net, 1 / MONTHS_PER_YEAR) - 1 : -1;

  const phaseById = new Map(input.phases.map((phase) => [phase.id, phase]));
  const eventsByYear = new Map<number, OneOffEvent[]>();
  for (const event of input.events) {
    const year = Math.round(event.year);
    if (year < 1 || year > years) continue;
    eventsByYear.set(year, [...(eventsByYear.get(year) ?? []), event]);
  }

  let balance = Math.max(0, input.initialAmount);
  let contributed = balance;
  let withdrawn = 0;
  let netInvestedReal = balance;
  let monthsElapsed = 0;
  let depletedYear: number | null = null;

  const rows: YearRow[] = [
    {
      year: 0,
      contributionThisYear: 0,
      withdrawalThisYear: 0,
      totalContributed: contributed,
      totalWithdrawn: 0,
      netInvested: contributed,
      netInvestedReal,
      balance,
      growth: 0,
      realBalance: balance,
    },
  ];

  for (let yearIndex = 0; yearIndex < years; yearIndex++) {
    const span = spans.find(
      (candidate) =>
        yearIndex >= candidate.startYear && yearIndex < candidate.endYear,
    );
    const phase = span ? phaseById.get(span.id) : undefined;
    const monthly = phase
      ? monthlyFlowForPhaseYear(
          phase,
          yearIndex - (span?.startYear ?? 0),
          input.inflationPercent,
        )
      : 0;

    let paidInThisYear = 0;
    let takenOutThisYear = 0;

    const applyFlow = (amount: number, atYearFraction: number) => {
      if (amount > 0) {
        balance += amount;
        contributed += amount;
        paidInThisYear += amount;
        netInvestedReal += amount / Math.pow(1 + inflation, atYearFraction);
      } else if (amount < 0) {
        const taken = Math.min(-amount, balance);
        balance -= taken;
        withdrawn += taken;
        takenOutThisYear += taken;
        netInvestedReal -= taken / Math.pow(1 + inflation, atYearFraction);
        if (taken < -amount && depletedYear === null) {
          depletedYear = yearIndex + 1;
        }
      }
    };

    for (let month = 0; month < MONTHS_PER_YEAR; month++) {
      monthsElapsed++;
      balance *= 1 + monthlyRate;
      applyFlow(monthly, monthsElapsed / MONTHS_PER_YEAR);
    }

    const year = yearIndex + 1;
    for (const event of eventsByYear.get(year) ?? []) {
      applyFlow(eventAmount(event, inflation), year);
    }

    const netInvested = contributed - withdrawn;
    rows.push({
      year,
      contributionThisYear: paidInThisYear,
      withdrawalThisYear: takenOutThisYear,
      totalContributed: contributed,
      totalWithdrawn: withdrawn,
      netInvested,
      netInvestedReal,
      balance,
      growth: balance - netInvested,
      realBalance: balance / Math.pow(1 + inflation, year),
    });
  }

  return { rows, depletedYear };
}

export function buildPlan(input: PlanInput): PlanResult {
  const scenarios: ScenarioResult[] = input.scenarios.map((scenario) => {
    const { rows, depletedYear } = simulateScenario(input, scenario.returnPercent);
    const final = rows[rows.length - 1];
    return {
      ...scenario,
      netReturnPercent:
        netAnnualReturn(scenario.returnPercent, input.annualFeePercent) * 100,
      rows,
      final,
      // Counts money already taken out, so a draw-down plan is not scored as a
      // failure just because the pot is smaller at the end.
      growthMultiple:
        final.totalContributed > 0
          ? (final.balance + final.totalWithdrawn) / final.totalContributed
          : 0,
      inflationLoss: final.balance - final.realBalance,
      depletedYear,
    };
  });

  // Cash flow is identical across scenarios until a withdrawal runs short, so
  // the schedule shown to the reader comes from the expected case.
  const reference = scenarios[1] ?? scenarios[0];
  const rowCount = reference?.rows.length ?? 0;
  const inflation = input.inflationPercent / 100;

  const chartRows: ChartRow[] = Array.from({ length: rowCount }, (_, index) => {
    const nominal = {} as Record<ScenarioId, number>;
    const real = {} as Record<ScenarioId, number>;
    for (const scenario of scenarios) {
      nominal[scenario.id] = scenario.rows[index].balance;
      real[scenario.id] = scenario.rows[index].realBalance;
    }
    const row = reference.rows[index];
    const deflator = Math.pow(1 + inflation, row.year);
    return {
      year: row.year,
      invested: row.netInvested,
      investedReal: row.netInvestedReal,
      paidIn: row.contributionThisYear,
      takenOut: -row.withdrawalThisYear,
      paidInReal: row.contributionThisYear / deflator,
      takenOutReal: -row.withdrawalThisYear / deflator,
      nominal,
      real,
    };
  });

  return {
    years: planYears(input.phases),
    scenarios,
    chartRows,
    spans: phaseSpans(input.phases),
  };
}
