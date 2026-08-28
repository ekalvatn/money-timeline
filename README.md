# Investment plan

A projection tool for regular investing: put in a horizon, a monthly amount and
a few assumptions, and see what compounding does to it — across three return
scenarios, in future money and in today's purchasing power.

Everything runs in the browser. There is no backend, no account and no data
leaves the machine; a plan is kept in `localStorage` and can be shared as a
link that carries the whole plan in the URL fragment.

## Running it

Node 22 (see `.nvmrc`).

```bash
npm install
npm run dev      # http://localhost:3000
npm test         # the projection maths
npm run build
npm run lint
```

## What it models

A plan is a sequence of **phases** rather than one flat monthly number. Each
phase has its own length, its own monthly cash flow, and its own escalation, and
they run back to back from today — so "pay in 5 000 for ten years, 12 000 while
earnings peak, then draw 45 000 a month out for a decade" is a plan you can
actually express. The horizon is however long the phases add up to, capped at 60
years.

| Input | Notes |
|---|---|
| Already invested | A lump sum in the pot today |
| Phase length | 1–60 years; phases run consecutively |
| Phase monthly amount | Pay in, or take out — a negative flow is a draw-down |
| Phase escalation | Flat, rising with inflation, by a percentage, or by a fixed amount each year. Escalation restarts at each phase's own starting amount |
| One-off amounts | Lump sums landing on a single year, in or out, optionally stated in today's money so they inflate to that year |
| Inflation | Converts every future amount into today's purchasing power |
| Yearly cost | Fund and platform fees, charged on the whole balance |
| Return scenarios | Three editable gross yearly returns — pessimistic, expected, optimistic |

The simulation in `lib/calc.ts` steps month by month. Growth is applied first
and the month's cash flow lands after it, so payments are treated as
end-of-month — the conservative reading, and how a standing transfer actually
behaves. Costs scale the whole portfolio rather than just the gain:
`net = (1 + r) × (1 − fee) − 1`. Flows are discounted from the month each one
happened, so the "today's money" view compares like with like on both sides.

**Withdrawals can never take out more than is there.** When one falls short the
plan is marked depleted from that year, and the year is called out on the
scenario card and marked on the projection chart. Because a scenario can run dry
while a more optimistic one does not, depletion is tracked per scenario.

`lib/calc.test.mts` checks the engine against the closed-form annuity formula
and pins down phase sequencing, each escalation mode, draw-downs, depletion,
one-off timing and inflation-stated amounts, the fee treatment, and the
degenerate cases.

Not modelled: tax, sequence-of-returns risk, and any variance at all. Returns
are assumed smooth and constant, which no market has ever been — which matters
most for draw-down phases, where the order of good and bad years changes how
long the money lasts. It is a projection, not a forecast.

## Money inputs

Amount fields group as you type, in the selected currency's own convention —
`1 234 567` in `nb-NO`, `1.234.567` in `de-DE`, `1,234,567` in `en-US`. Two
details make that safe rather than annoying:

- Group separators are stripped **before** the decimal point is located. A comma
  groups in `en-US` and separates decimals in `nb-NO`, so `1,234` is 1234 in one
  and 1.234 in the other. Where the locale's decimal separator is a comma, a
  full stop is accepted too — both keys are on the keyboard.
- The caret is restored by counting digits, not string index, so inserting a
  digit mid-number doesn't drag the cursor backwards every time a separator
  appears. A half-typed fraction (`5 000,`) survives long enough to be finished.

Changing currency re-renders every amount in the new locale, so a value can
never be re-read under the wrong separator rules. `lib/format.test.mts` covers
the round-trips.

Not modelled: tax, sequence-of-returns risk, and any variance at all. Returns
are assumed smooth and constant, which no market has ever been — which matters
most for draw-down phases, where the order of good and bad years changes how
long the money lasts. It is a projection, not a forecast.

## Layout

```
app/            route, metadata, design tokens in globals.css
components/     planner shell, phase/event editors, charts, table, theme store
lib/            projection engine, formatting, palette, share encoding
```

## Charts

Colours come from a validated categorical palette (`lib/palette.ts`), held to
the all-pairs colour-vision gate in both light and dark mode. Series order is
fixed, so a scenario keeps its colour no matter what else is on screen. Light
mode's aqua sits just under 3:1 against the surface, so every chart that uses it
also ships direct end-labels and the year-by-year table carrying the same
numbers.

Signed cash flow is the one place a diverging pair is used — money in above the
zero line, money out below it — kept deliberately distinct from the scenario
hues so a colour never means both "optimistic" and "withdrawal".
