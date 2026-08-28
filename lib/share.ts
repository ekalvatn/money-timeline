import { MAX_YEARS } from "./calc";
import { DEFAULT_CURRENCY, DEFAULT_PLAN, MAX_EVENTS, MAX_PHASES } from "./defaults";
import { CURRENCIES } from "./format";
import type { CurrencyCode } from "./format";
import type {
  OneOffEvent,
  PhaseGrowthMode,
  PlanInput,
  PlanPhase,
  ScenarioId,
} from "./types";

export interface AppState {
  plan: PlanInput;
  currency: CurrencyCode;
}

const GROWTH_MODES: PhaseGrowthMode[] = ["none", "inflation", "percent", "fixed"];

const num = (value: unknown, fallback: number, min: number, max: number) => {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
};

const text = (value: unknown, fallback: string, maxLength = 40) =>
  typeof value === "string" && value.trim() ? value.slice(0, maxLength) : fallback;

function sanitizePhase(raw: unknown, index: number): PlanPhase {
  const phase = (raw ?? {}) as Partial<PlanPhase>;
  return {
    id: text(phase.id, `phase-${index}`, 64),
    label: text(phase.label, `Phase ${index + 1}`),
    years: Math.round(num(phase.years, 5, 1, MAX_YEARS)),
    monthlyAmount: num(phase.monthlyAmount, 5_000, -1e9, 1e9),
    growthMode: GROWTH_MODES.includes(phase.growthMode as PhaseGrowthMode)
      ? (phase.growthMode as PhaseGrowthMode)
      : "none",
    growthValue: num(phase.growthValue, 0, -1e7, 1e7),
  };
}

function sanitizeEvent(raw: unknown, index: number, years: number): OneOffEvent {
  const event = (raw ?? {}) as Partial<OneOffEvent>;
  return {
    id: text(event.id, `event-${index}`, 64),
    label: text(event.label, "One-off"),
    year: Math.round(num(event.year, 1, 1, years)),
    amount: num(event.amount, 0, -1e12, 1e12),
    inTodaysMoney: event.inTodaysMoney !== false,
  };
}

/**
 * Anything reaching this came from a URL or localStorage, so treat every field
 * as hostile: coerce, clamp, and fall back to the default rather than trusting
 * the shape.
 */
export function sanitizeState(raw: unknown): AppState {
  const source = (raw ?? {}) as Partial<AppState>;
  const plan = (source.plan ?? {}) as Partial<PlanInput>;

  const rawPhases = Array.isArray(plan.phases) ? plan.phases : [];
  const phases = rawPhases.slice(0, MAX_PHASES).map(sanitizePhase);
  // A plan with no phases has no horizon and nothing to draw.
  const safePhases = phases.length ? phases : DEFAULT_PLAN.phases;
  const years = Math.min(
    MAX_YEARS,
    safePhases.reduce((sum, phase) => sum + phase.years, 0),
  );

  const rawEvents = Array.isArray(plan.events) ? plan.events : [];

  return {
    currency: CURRENCIES.some((entry) => entry.code === source.currency)
      ? (source.currency as CurrencyCode)
      : DEFAULT_CURRENCY,
    plan: {
      initialAmount: num(plan.initialAmount, DEFAULT_PLAN.initialAmount, 0, 1e12),
      phases: safePhases,
      events: rawEvents
        .slice(0, MAX_EVENTS)
        .map((event, index) => sanitizeEvent(event, index, years)),
      inflationPercent: num(
        plan.inflationPercent,
        DEFAULT_PLAN.inflationPercent,
        0,
        25,
      ),
      annualFeePercent: num(
        plan.annualFeePercent,
        DEFAULT_PLAN.annualFeePercent,
        0,
        5,
      ),
      // Scenario identity and order are fixed — they drive colour assignment,
      // so only the return number is taken from untrusted input.
      scenarios: DEFAULT_PLAN.scenarios.map((fallback) => {
        const scenarios = Array.isArray(plan.scenarios) ? plan.scenarios : [];
        const match = scenarios.find(
          (entry) => (entry as { id?: ScenarioId })?.id === fallback.id,
        );
        return {
          ...fallback,
          returnPercent: num(
            (match as { returnPercent?: number })?.returnPercent,
            fallback.returnPercent,
            -20,
            40,
          ),
        };
      }),
    },
  };
}

export function encodeState(state: AppState): string {
  const bytes = new TextEncoder().encode(JSON.stringify(state));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodeState(encoded: string): AppState | null {
  try {
    const base64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
    const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="));
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return sanitizeState(JSON.parse(new TextDecoder().decode(bytes)));
  } catch {
    return null;
  }
}
