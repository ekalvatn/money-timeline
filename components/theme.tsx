"use client";

import { useMemo, useSyncExternalStore } from "react";
import type { Mode } from "@/lib/palette";

export type ThemePreference = "light" | "dark" | "system";

const STORAGE_KEY = "investment-plan:theme";

/**
 * Runs before paint so the first frame is already in the right theme. Kept in
 * sync with `writePreference` below.
 */
export const THEME_BOOTSTRAP = `(function(){try{var p=localStorage.getItem(${JSON.stringify(
  STORAGE_KEY,
)});if(p==="light"||p==="dark"){document.documentElement.dataset.theme=p}}catch(e){}})()`;

/* -- preference store ---------------------------------------------------- */

const listeners = new Set<() => void>();
let cached: ThemePreference | null = null;

function readPreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark" || stored === "system") {
      return stored;
    }
  } catch {
    // Storage blocked — fall through to the system default.
  }
  return "system";
}

function preferenceSnapshot(): ThemePreference {
  // useSyncExternalStore requires a stable snapshot, so the read is cached and
  // invalidated only when something actually writes.
  if (cached === null) cached = readPreference();
  return cached;
}

function subscribePreference(onChange: () => void) {
  listeners.add(onChange);
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) {
      cached = null;
      onChange();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}

function writePreference(next: ThemePreference) {
  cached = next;
  const root = document.documentElement;
  if (next === "system") {
    delete root.dataset.theme;
  } else {
    root.dataset.theme = next;
  }
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // Private browsing — the choice just won't survive a reload.
  }
  for (const listener of listeners) listener();
}

/* -- system-preference store --------------------------------------------- */

const DARK_QUERY = "(prefers-color-scheme: dark)";

function subscribeSystem(onChange: () => void) {
  const query = window.matchMedia(DARK_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

const systemSnapshot = (): Mode =>
  window.matchMedia(DARK_QUERY).matches ? "dark" : "light";

/* -- hooks ---------------------------------------------------------------- */

const noopSubscribe = () => () => {};

/**
 * False through server render and hydration, true immediately after. Lets
 * client-only values (stored plans, chart sizing) land without a post-mount
 * setState or a hydration mismatch.
 */
export function useIsHydrated(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

export function useTheme() {
  const preference = useSyncExternalStore(
    subscribePreference,
    preferenceSnapshot,
    () => "system" as const,
  );
  const systemMode = useSyncExternalStore(
    subscribeSystem,
    systemSnapshot,
    () => "light" as const,
  );

  return useMemo(
    () => ({
      preference,
      // Module-level and stable — no memoisation needed.
      setPreference: writePreference,
      /** The theme actually on screen — what the charts read their colours from. */
      mode: (preference === "system" ? systemMode : preference) as Mode,
    }),
    [preference, systemMode],
  );
}
