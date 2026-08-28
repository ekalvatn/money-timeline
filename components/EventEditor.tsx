"use client";

import { MAX_EVENTS, newEvent } from "@/lib/defaults";
import type { OneOffEvent } from "@/lib/types";
import type { CurrencyCode } from "@/lib/format";
import { Button, NumberField, Segmented } from "./ui";

/**
 * Lump sums that land on a single year — a bonus paid in, a house deposit taken
 * out. Separate from phases because they are events, not rates.
 */
export function EventEditor({
  events,
  onChange,
  currency,
  years,
}: {
  events: OneOffEvent[];
  onChange: (events: OneOffEvent[]) => void;
  currency: CurrencyCode;
  years: number;
}) {
  const update = (id: string, patch: Partial<OneOffEvent>) =>
    onChange(
      events.map((event) => (event.id === id ? { ...event, ...patch } : event)),
    );

  return (
    <div className="space-y-4">
      {events.length === 0 && (
        <p className="text-sm text-ink-2">
          Nothing scheduled. Add one to see what a house deposit, a new car or a
          bonus does to the rest of the plan.
        </p>
      )}

      {events.map((event, index) => {
        const takingOut = event.amount < 0;
        const magnitude = Math.abs(event.amount);
        return (
          <div
            key={event.id}
            className="rounded-lg border border-hair-strong bg-sunken p-4"
          >
            <div className="flex items-center gap-2">
              <input
                aria-label={`One-off ${index + 1} name`}
                value={event.label}
                onChange={(change) => update(event.id, { label: change.target.value })}
                className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-1 py-0.5 text-sm font-semibold text-ink hover:border-hair"
              />
              <button
                type="button"
                aria-label={`Remove ${event.label}`}
                onClick={() => onChange(events.filter((entry) => entry.id !== event.id))}
                className="rounded px-1 text-ink-muted hover:text-ink"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <NumberField
                label="Happens in year"
                unit={`1–${years}`}
                value={event.year}
                onChange={(value) => update(event.id, { year: Math.round(value) })}
                min={1}
                max={years}
                slider={{ min: 1, max: Math.max(1, years), step: 1 }}
              />

              <div>
                <Segmented
                  label={`${event.label} direction`}
                  size="sm"
                  value={takingOut ? "out" : "in"}
                  onChange={(direction) =>
                    update(event.id, {
                      amount: direction === "out" ? -magnitude : magnitude,
                    })
                  }
                  options={[
                    { value: "in", label: "Pay in" },
                    { value: "out", label: "Take out" },
                  ]}
                />
                <NumberField
                  label="Amount"
                  unit={currency}
                  value={magnitude}
                  onChange={(value) =>
                    update(event.id, {
                      amount: takingOut ? -Math.abs(value) : Math.abs(value),
                    })
                  }
                  min={0}
                  max={1e12}
                />
              </div>

              <label className="flex items-start gap-2 text-xs text-ink-2">
                <input
                  type="checkbox"
                  checked={event.inTodaysMoney}
                  onChange={(change) =>
                    update(event.id, { inTodaysMoney: change.target.checked })
                  }
                  className="mt-0.5"
                />
                <span>
                  That amount is in today&rsquo;s money — grow it with inflation
                  so it still buys the same thing in year {event.year}.
                </span>
              </label>
            </div>
          </div>
        );
      })}

      {events.length < MAX_EVENTS && (
        <Button
          onClick={() =>
            onChange([...events, newEvent(Math.max(1, Math.round(years / 2)))])
          }
        >
          + Add a one-off
        </Button>
      )}
    </div>
  );
}
