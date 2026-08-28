"use client";

import { useId, useState } from "react";

export function parseNumber(raw: string): number | null {
  // Accept "1 234,5" and "1234.5" alike — thousands spaces and a comma decimal
  // are what people actually type in the Nordics.
  const cleaned = raw.replace(/[\s\u00A0]/g, "").replace(",", ".");
  if (cleaned === "" || cleaned === "-") return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
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
  min = 0,
  max = Number.MAX_SAFE_INTEGER,
  unit,
  hint,
  slider,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  unit?: string;
  hint?: string;
  /** Range bounds for the companion slider; omit for a bare number input. */
  slider?: { min: number; max: number; step: number };
}) {
  const id = useId();
  const [text, setText] = useState(() => String(value));
  const [lastValue, setLastValue] = useState(value);

  // Keep the field in step with programmatic changes (presets, reset, slider)
  // without stamping over what the user is mid-way through typing. Adjusting
  // during render rather than in an effect avoids a second render pass.
  if (value !== lastValue) {
    setLastValue(value);
    if (parseNumber(text) !== value) setText(String(value));
  }

  const commit = (raw: string) => {
    setText(raw);
    const parsed = parseNumber(raw);
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
        value={text}
        onChange={(event) => commit(event.target.value)}
        onBlur={() => setText(String(value))}
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
