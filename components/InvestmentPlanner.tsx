"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { buildPlan } from "@/lib/calc";
import { DEFAULT_CURRENCY, DEFAULT_PLAN } from "@/lib/defaults";
import { formatCurrency, formatPercent } from "@/lib/format";
import { PALETTES } from "@/lib/palette";
import { decodeState, encodeState, sanitizeState } from "@/lib/share";
import type { AppState } from "@/lib/share";
import type { PlanInput, ScenarioId } from "@/lib/types";
import { CashFlowChart } from "./CashFlowChart";
import { CompositionChart } from "./CompositionChart";
import { Milestones } from "./Milestones";
import { ValueBreakdown } from "./ValueBreakdown";
import { PlanForm } from "./PlanForm";
import { ProjectionChart } from "./ProjectionChart";
import type { MoneyBasis } from "./ProjectionChart";
import type { TimelineBasis } from "./chart-parts";
import { ScenarioCards } from "./ScenarioCards";
import { YearTable, planToCsv } from "./YearTable";
import { useIsHydrated, useTheme } from "./theme";
import { Button, Card, Segmented } from "./ui";

const STORAGE_KEY = "money-timeline:state";

const INITIAL_STATE: AppState = {
  plan: DEFAULT_PLAN,
  currency: DEFAULT_CURRENCY,
};

/**
 * A link in the URL wins over the last local session — someone opening a shared
 * plan should see that plan, not their own.
 */
function loadState(): AppState {
  const fromUrl = new URLSearchParams(window.location.hash.slice(1)).get("p");
  const shared = fromUrl ? decodeState(fromUrl) : null;
  if (shared) return shared;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return sanitizeState(JSON.parse(stored));
  } catch {
    // Corrupt or unavailable storage — fall back to the defaults.
  }
  return INITIAL_STATE;
}

export function InvestmentPlanner() {
  const hydrated = useIsHydrated();
  // A saved or shared plan is only readable on the client. Rendering the
  // defaults through hydration and then remounting with the restored plan keeps
  // the server and first client render identical, with no post-mount setState.
  return hydrated ? (
    <Planner key="restored" initialState={loadState()} persist />
  ) : (
    <Planner key="initial" initialState={INITIAL_STATE} persist={false} />
  );
}

function Planner({
  initialState,
  persist,
}: {
  initialState: AppState;
  /** False for the pre-hydration render, so it can't overwrite a saved plan. */
  persist: boolean;
}) {
  const { mode, preference, setPreference } = useTheme();
  const palette = PALETTES[mode];

  const [state, setState] = useState<AppState>(initialState);
  const [basis, setBasis] = useState<MoneyBasis>("nominal");
  const [timeline, setTimeline] = useState<TimelineBasis>("age");
  const [selectedId, setSelectedId] = useState<ScenarioId>("normal");
  const [shareLabel, setShareLabel] = useState("Copy link");

  useEffect(() => {
    if (!persist) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Private browsing — the plan just won't survive a reload.
    }
  }, [persist, state]);

  const updatePlan = useCallback((patch: Partial<PlanInput>) => {
    setState((current) => ({ ...current, plan: { ...current.plan, ...patch } }));
  }, []);

  const plan = useMemo(() => buildPlan(state.plan), [state.plan]);
  const selected =
    plan.scenarios.find((scenario) => scenario.id === selectedId) ??
    plan.scenarios[1] ??
    plan.scenarios[0];
  const selectedIndex = plan.scenarios.indexOf(selected);

  const growthShare =
    selected.final.balance > 0
      ? (selected.final.growth / selected.final.balance) * 100
      : 0;

  const copyLink = async () => {
    const url = `${window.location.origin}${window.location.pathname}#p=${encodeState(state)}`;
    try {
      await navigator.clipboard.writeText(url);
      setShareLabel("Link copied");
    } catch {
      window.location.hash = `p=${encodeState(state)}`;
      setShareLabel("Link in address bar");
    }
    setTimeout(() => setShareLabel("Copy link"), 2500);
  };

  const downloadCsv = () => {
    const blob = new Blob([planToCsv(plan)], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `money-timeline-${plan.years}y.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const basisOptions = [
    { value: "nominal" as const, label: "Future money" },
    { value: "real" as const, label: "Today's money" },
  ];
  const timelineOptions = [
    { value: "age" as const, label: "Your age" },
    { value: "years" as const, label: "Years from now" },
  ];

  return (
    <div className="mx-auto w-full max-w-[88rem] px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            Money Timeline
          </h1>
          <p className="mt-1 max-w-prose text-sm text-ink-2">
            {plan.years} years of paying in and drawing back out, from age{" "}
            {plan.currentAge} to {plan.currentAge + plan.years} — across three
            return scenarios, in future money and in today&rsquo;s purchasing
            power.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Segmented
            label="Colour theme"
            size="sm"
            value={preference}
            onChange={setPreference}
            options={[
              { value: "light", label: "Light" },
              { value: "system", label: "Auto" },
              { value: "dark", label: "Dark" },
            ]}
          />
          <Button onClick={copyLink}>{shareLabel}</Button>
          <Button onClick={downloadCsv}>Download CSV</Button>
          <Button
            onClick={() => setState(INITIAL_STATE)}
          >
            Reset
          </Button>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[22rem_minmax(0,1fr)]">
        {/* The form is taller than a viewport once a few phases exist, so it
            scrolls inside its own sticky column rather than stranding its lower
            half off-screen. */}
        <div className="lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:self-start lg:overflow-y-auto lg:pr-2">
          {/* One filter surface for the whole page — every chart, card and row
              below re-renders against this same plan. */}
          <PlanForm
            plan={state.plan}
            onChange={updatePlan}
            currency={state.currency}
            onCurrencyChange={(currency) =>
              setState((current) => ({ ...current, currency }))
            }
            palette={palette}
            years={plan.years}
            feeDrag={selected.feeDrag}
          />
        </div>

        <div className="min-w-0 space-y-6">
          <ScenarioCards
            scenarios={plan.scenarios}
            palette={palette}
            currency={state.currency}
            selectedId={selected.id}
            onSelect={setSelectedId}
            retirementAge={plan.retirementAge}
            taxEnabled={state.plan.tax.enabled}
          />

          {/* One control row for everything below it — both charts and the
              table read the same money basis, so they can never disagree. */}
          <div className="rounded-xl border border-hair bg-surface px-5 py-3">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-sm font-medium text-ink">
                  Show amounts in
                </span>
                <Segmented
                  label="Money basis"
                  size="sm"
                  value={basis}
                  onChange={setBasis}
                  options={basisOptions}
                />
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-sm font-medium text-ink">Timeline</span>
                <Segmented
                  label="Timeline basis"
                  size="sm"
                  value={timeline}
                  onChange={setTimeline}
                  options={timelineOptions}
                />
              </div>
            </div>
            <p className="mt-2 text-xs text-ink-muted">
              {basis === "real"
                ? `What each amount would buy today, at ${state.plan.inflationPercent} % inflation.`
                : "Amounts as they would appear on a future statement."}
            </p>
          </div>

          <Card title="Projected value over time">
            {persist ? (
              <ProjectionChart
                plan={plan}
                palette={palette}
                currency={state.currency}
                basis={basis}
                timeline={timeline}
              />
            ) : (
              <ChartPlaceholder height={340} />
            )}
          </Card>

          <Card
            title="Milestones"
            description={`On the ${selected.label.toLowerCase()} path, ${
              basis === "real" ? "in today's money" : "in future money"
            }.`}
          >
            <Milestones
              scenario={selected}
              seriesColor={palette.series[selectedIndex]}
              currency={state.currency}
              basis={basis}
              timeline={timeline}
              currentAge={plan.currentAge}
            />
          </Card>

          <Card
            title="Your cash flow, year by year"
            description="The phases you built, as money in above the line and money out below it."
          >
            {persist ? (
              <CashFlowChart
                plan={plan}
                palette={palette}
                currency={state.currency}
                basis={basis}
                timeline={timeline}
              />
            ) : (
              <ChartPlaceholder height={240} />
            )}
            <ul className="mt-4 flex flex-wrap gap-2 border-t border-hair pt-4">
              {plan.spans.map((span, index) => (
                <li
                  key={span.id}
                  className="tabular rounded-md border border-hair px-2.5 py-1 text-xs text-ink-2"
                >
                  <span className="font-medium text-ink">
                    {index + 1}. {span.label}
                  </span>{" "}
                  ·{" "}
                  {timeline === "age"
                    ? `ages ${plan.currentAge + span.startYear}–${plan.currentAge + span.endYear}`
                    : `years ${span.startYear + 1}–${span.endYear}`}{" "}
                  ·{" "}
                  <span style={{ color: span.monthlyAmount < 0 ? palette.flowOut : undefined }}>
                    {span.monthlyAmount < 0 ? "−" : "+"}
                    {formatCurrency(Math.abs(span.monthlyAmount), state.currency)}/mo
                  </span>
                </li>
              ))}
            </ul>
          </Card>

          <Card
            title="Where the money comes from"
            description="The band on top is growth the market added — everything below it you paid in yourself."
            action={
              <Segmented
                label="Scenario"
                size="sm"
                value={selected.id}
                onChange={setSelectedId}
                options={plan.scenarios.map((scenario) => ({
                  value: scenario.id,
                  label: scenario.label,
                }))}
              />
            }
          >
            {persist ? (
              <CompositionChart
                scenario={selected}
                seriesColor={palette.series[selectedIndex]}
                palette={palette}
                currency={state.currency}
                basis={basis}
                timeline={timeline}
                currentAge={plan.currentAge}
                retirementYear={plan.retirementYear}
                retirementAge={plan.retirementAge}
              />
            ) : (
              <ChartPlaceholder height={300} />
            )}
            <p className="mt-4 border-t border-hair pt-4 text-sm text-ink-2">
              {selected.final.totalWithdrawn > 0 ? (
                <>
                  Under{" "}
                  <strong className="font-medium text-ink">{selected.label}</strong>{" "}
                  you pay in{" "}
                  {formatCurrency(selected.final.totalContributed, state.currency)},
                  take out{" "}
                  {formatCurrency(selected.final.totalWithdrawn, state.currency)}{" "}
                  along the way, and finish with{" "}
                  {formatCurrency(selected.final.balance, state.currency)}.
                  {selected.depletedYear !== null && (
                    <> The pot runs dry in year {selected.depletedYear}.</>
                  )}
                </>
              ) : (
                <>
                  Under{" "}
                  <strong className="font-medium text-ink">{selected.label}</strong>,{" "}
                  {formatPercent(growthShare)} of the final{" "}
                  {formatCurrency(selected.final.balance, state.currency)} is growth
                  rather than money you paid in.
                </>
              )}
            </p>
          </Card>

          <Card
            title="Growth, fees and inflation"
            description={`What the ${selected.label.toLowerCase()} path gains over ${plan.years} years, and what comes off it.`}
          >
            <ValueBreakdown
              scenario={selected}
              currency={state.currency}
              annualFeePercent={state.plan.annualFeePercent}
              inflationPercent={state.plan.inflationPercent}
              years={plan.years}
              taxEnabled={state.plan.tax.enabled}
            />
          </Card>

          <Card
            title="Year by year"
            description="The same numbers the charts draw, readable without colour."
          >
            <YearTable
              plan={plan}
              palette={palette}
              currency={state.currency}
              basis={basis}
              taxEnabled={state.plan.tax.enabled}
            />
          </Card>

          <p className="pb-4 text-xs text-ink-muted">
            A projection, not a forecast. Returns are assumed to be smooth and
            constant; real markets are not, and the order in which good and bad
            years arrive changes the outcome — which matters most once you are
            drawing money out. Tax follows a simplified deferred model with
            Norwegian defaults; it is not advice about your own situation.
          </p>
        </div>
      </div>
    </div>
  );
}

function ChartPlaceholder({ height }: { height: number }) {
  return (
    <div
      className="w-full animate-pulse rounded-lg bg-sunken"
      style={{ height }}
      aria-hidden
    />
  );
}
