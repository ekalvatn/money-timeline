export type ScenarioId = "pessimistic" | "normal" | "optimistic";

export interface Scenario {
  id: ScenarioId;
  label: string;
  /** Gross nominal annual return, in percent. */
  returnPercent: number;
}

/** How the monthly amount moves from one year to the next inside a phase. */
export type PhaseGrowthMode = "none" | "inflation" | "percent" | "fixed";

/**
 * A stretch of the plan with its own monthly cash flow. Phases run back to back
 * from today, so a plan is "5 years paying in hard, 20 years steady, 10 years
 * drawing down" rather than one flat number.
 */
export interface PlanPhase {
  id: string;
  label: string;
  /** Length in whole years. */
  years: number;
  /** Monthly cash flow at the start of the phase. Negative means money out. */
  monthlyAmount: number;
  growthMode: PhaseGrowthMode;
  /**
   * Yearly change within the phase: percent for "percent", an absolute amount
   * added to the monthly figure for "fixed", ignored otherwise. Escalation
   * restarts at each phase's own starting amount.
   */
  growthValue: number;
}

/** A single lump sum in or out — a bonus paid in, a house deposit taken out. */
export interface OneOffEvent {
  id: string;
  label: string;
  /** Whole year the money moves, applied after that year's last month. */
  year: number;
  /** Positive pays in, negative takes out. */
  amount: number;
  /**
   * When true the amount is stated in today's money and is inflated to the year
   * it happens — "500 000 of today's purchasing power", not 500 000 nominal.
   */
  inTodaysMoney: boolean;
}

export interface PlanInput {
  /** Age today. The timeline can be read in ages instead of years from now. */
  currentAge: number;
  /**
   * Age you plan to retire. A marker on the timeline and a milestone to read
   * values at — the phases, not this, decide when paying in stops.
   */
  retirementAge: number;
  /** Lump sum already invested today. */
  initialAmount: number;
  phases: PlanPhase[];
  events: OneOffEvent[];
  /** Expected yearly inflation, in percent. */
  inflationPercent: number;
  /** Yearly fund/platform cost, in percent of assets. */
  annualFeePercent: number;
  scenarios: Scenario[];
}

export interface YearRow {
  /** 0 = today, 1 = end of first year, … */
  year: number;
  /** Paid in during this year alone, including one-off deposits. */
  contributionThisYear: number;
  /** Taken out during this year alone, including one-off withdrawals. */
  withdrawalThisYear: number;
  /** Everything paid in so far, including the starting amount. */
  totalContributed: number;
  /** Everything taken out so far. */
  totalWithdrawn: number;
  /** totalContributed − totalWithdrawn: your own money still in the pot. */
  netInvested: number;
  /**
   * The same flows valued in today's money — each discounted from the month it
   * happened. Without this, a "today's money" chart would compare a deflated
   * balance against undeflated contributions.
   */
  netInvestedReal: number;
  /** Portfolio value in future money. */
  balance: number;
  /** balance − netInvested: what the market added, net of what you took out. */
  growth: number;
  /** Portfolio value expressed in today's purchasing power. */
  realBalance: number;
}

export interface ScenarioResult extends Scenario {
  /** Return after the yearly cost is deducted, in percent. */
  netReturnPercent: number;
  rows: YearRow[];
  final: YearRow;
  /** (final balance + everything withdrawn) ÷ everything paid in. */
  growthMultiple: number;
  /** How much of the final value inflation eats: balance − realBalance. */
  inflationLoss: number;
  /**
   * The first year a withdrawal could not be paid in full, or null if the money
   * lasts. The clearest single signal that a draw-down plan is too aggressive.
   */
  depletedYear: number | null;
  /** The year retirement lands on, or null when it falls outside the horizon. */
  atRetirement: YearRow | null;
}

export interface ChartRow {
  year: number;
  /** Your own money still in the pot, future money. */
  invested: number;
  /** The same, in today's money. */
  investedReal: number;
  /** Paid in during this year (positive), future money. */
  paidIn: number;
  /** Taken out during this year (negative, so it plots below the axis). */
  takenOut: number;
  paidInReal: number;
  takenOutReal: number;
  /** Nominal balance per scenario id. */
  nominal: Record<ScenarioId, number>;
  /** Inflation-adjusted balance per scenario id. */
  real: Record<ScenarioId, number>;
}

export interface PhaseSpan {
  id: string;
  label: string;
  /** Inclusive start year (0 = today) and exclusive end year. */
  startYear: number;
  endYear: number;
  monthlyAmount: number;
}

export interface PlanResult {
  years: number;
  /** Age today, so a chart can label its axis in ages. */
  currentAge: number;
  /** Years from now that retirement lands, or null if outside the horizon. */
  retirementYear: number | null;
  retirementAge: number;
  scenarios: ScenarioResult[];
  chartRows: ChartRow[];
  /** Where each phase sits on the timeline, for chart annotations. */
  spans: PhaseSpan[];
}
