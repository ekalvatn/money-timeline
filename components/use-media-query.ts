"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Matches on the client only; false through server render and hydration, which
 * is the right default here — the wide layout is the one the markup describes.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}

export const NARROW_QUERY = "(max-width: 640px)";
