"use client";

import { useId, useState } from "react";
import {
  formatGrouped,
  groupDigitsWhileTyping,
  numberSeparators,
  parseLocaleNumber,
} from "@/lib/format";
import type { CurrencyCode } from "@/lib/format";

/**
 * Re-grouping moves characters around, so the caret is restored by counting
 * digits rather than by string index — otherwise inserting a separator drags
 * the cursor a place backwards on every fourth keystroke.
 */
function caretAfterDigits(
  text: string,
  digitCount: number,
  afterDecimal: boolean,
  decimal: string,
): number {
  if (digitCount === 0) return text.startsWith("-") ? 1 : 0;
  let seen = 0;
  for (let index = 0; index < text.length; index++) {
    if (text[index] >= "0" && text[index] <= "9") {
      seen++;
      if (seen === digitCount) {
        const position = index + 1;
        return afterDecimal && text[position] === decimal ? position + 1 : position;
      }
    }
  }
  return text.length;
}

export function Card({
  title,
  description,
  action,
  children,
  className = "",
}: {
  title?: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-xl border border-hair bg-surface p-5 sm:p-6 ${className}`}
    >
      {(title || action) && (
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            {title && (
              <h2 className="text-base font-semibold text-ink">{title}</h2>
            )}
            {description && (
              <p className="mt-1 max-w-prose text-sm text-ink-2">
                {description}
              </p>
            )}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function NumberField({
  label,
  value,
  onChange,
  currency,
  grouped = false,
  min = 0,
  max = Number.MAX_SAFE_INTEGER,
  unit,
  hint,
  slider,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  /** Drives the locale: which character groups, and which one is the decimal. */
  currency: CurrencyCode;
  /** Money amounts are grouped as you type; years and percentages are not. */
  grouped?: boolean;
  min?: number;
  max?: number;
  unit?: string;
  hint?: string;
  /** Range bounds for the companion slider; omit for a bare number input. */
  slider?: { min: number; max: number; step: number };
}) {
  const id = useId();
  const display = (amount: number) =>
    grouped ? formatGrouped(amount, currency) : String(amount);

  const [text, setText] = useState(() => display(value));
  const [lastValue, setLastValue] = useState(value);
  const [lastCurrency, setLastCurrency] = useState(currency);

  // Keep the field in step with programmatic changes (presets, reset, slider)
  // without stamping over what the user is mid-way through typing. Adjusting
  // during render rather than in an effect avoids a second render pass.
  if (currency !== lastCurrency) {
    // A new locale means new separators: "5 000,25" would otherwise be re-read
    // as 500025 the moment the reader touched the field again.
    setLastCurrency(currency);
    setLastValue(value);
    setText(display(value));
  } else if (value !== lastValue) {
    setLastValue(value);
    if (parseLocaleNumber(text, currency) !== value) setText(display(value));
  }

  const commit = (event: React.ChangeEvent<HTMLInputElement>) => {
    const element = event.currentTarget;
    const raw = element.value;
    const next = grouped ? groupDigitsWhileTyping(raw, currency) : raw;

    if (next !== raw) {
      const caret = element.selectionStart ?? raw.length;
      const before = raw.slice(0, caret);
      const { decimal } = numberSeparators(currency);
      const position = caretAfterDigits(
        next,
        (before.match(/\d/g) ?? []).length,
        before.endsWith(decimal) || before.endsWith("."),
        decimal,
      );
      // Write the value and caret straight to the DOM: React renders the same
      // string a moment later, so this never fights the controlled value.
      element.value = next;
      element.setSelectionRange(position, position);
    }

    setText(next);
    const parsed = parseLocaleNumber(next, currency);
    if (parsed !== null) onChange(Math.min(max, Math.max(min, parsed)));
  };

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm font-medium text-ink">
          {label}
        </label>
        {unit && <span className="text-xs text-ink-muted">{unit}</span>}
      </div>
      <input
        id={id}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={text}
        onChange={commit}
        onBlur={() => setText(display(value))}
        className="tabular mt-1.5 w-full rounded-lg border border-hair-strong bg-sunken px-3 py-2 text-sm text-ink"
      />
      {slider && (
        <input
          type="range"
          aria-label={`${label} slider`}
          min={slider.min}
          max={slider.max}
          step={slider.step}
          value={Math.min(slider.max, Math.max(slider.min, value))}
          onChange={(event) => onChange(Number(event.target.value))}
          className="mt-2"
        />
      )}
      {hint && <p className="mt-1 text-xs text-ink-muted">{hint}</p>}
    </div>
  );
}

export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  size = "md",
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  size?: "sm" | "md";
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="inline-flex rounded-lg border border-hair bg-sunken p-0.5"
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={`rounded-md font-medium transition-colors ${
              size === "sm" ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-sm"
            } ${
              selected
                ? "bg-surface text-ink shadow-sm"
                : "text-ink-2 hover:text-ink"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function Select<T extends string>({
  label,
  value,
  options,
  onChange,
  hint,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  hint?: string;
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
        className="mt-1.5 w-full rounded-lg border border-hair-strong bg-sunken px-3 py-2 text-sm text-ink"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {hint && <p className="mt-1 text-xs text-ink-muted">{hint}</p>}
    </div>
  );
}

export function Button({
  children,
  onClick,
  variant = "ghost",
  type = "button",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "ghost" | "solid";
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
        variant === "solid"
          ? "bg-accent text-accent-ink hover:opacity-90"
          : "border border-hair-strong text-ink-2 hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}
