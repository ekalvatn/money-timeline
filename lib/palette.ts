export type Mode = "light" | "dark";

/**
 * Slots 1–3 of the validated categorical palette, held to the all-pairs gate in
 * both modes (worst CVD ΔE 9.2 light / 9.4 dark, normal-vision 24.0 / 20.9).
 * Series order is fixed — pessimistic always takes slot 1 — so filtering or
 * reordering never repaints a series.
 *
 * Light aqua sits at 2.74:1 against the light surface, below the 3:1 bar, so the
 * relief rule applies: every chart using it ships direct end-labels and a table
 * view of the same numbers.
 */
export interface ChartPalette {
  surface: string;
  grid: string;
  axis: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  border: string;
  /** Recessive fill for "money you paid in" — never a categorical hue. */
  neutralFill: string;
  neutralStroke: string;
  series: [string, string, string];
  /**
   * The diverging pair for signed cash flow, poles either side of a neutral
   * zero line: warm out, cool in. Validated all-pairs in both modes (CVD ΔE
   * 21.6 light / 19.2 dark). Never used for scenario identity.
   */
  flowIn: string;
  flowOut: string;
  /** Fixed status step, identical in both modes, never a series colour. */
  critical: string;
}

export const PALETTES: Record<Mode, ChartPalette> = {
  light: {
    surface: "#fcfcfb",
    grid: "#e1e0d9",
    axis: "#c3c2b7",
    textPrimary: "#0b0b0b",
    textSecondary: "#52514e",
    textMuted: "#898781",
    border: "rgba(11,11,11,0.10)",
    neutralFill: "#d9d8d0",
    neutralStroke: "#a8a69c",
    series: ["#2a78d6", "#eb6834", "#1baf7a"],
    flowIn: "#2a78d6",
    flowOut: "#e34948",
    critical: "#d03b3b",
  },
  dark: {
    surface: "#1a1a19",
    grid: "#2c2c2a",
    axis: "#383835",
    textPrimary: "#ffffff",
    textSecondary: "#c3c2b7",
    textMuted: "#898781",
    border: "rgba(255,255,255,0.10)",
    neutralFill: "#454440",
    neutralStroke: "#6b6a63",
    series: ["#3987e5", "#d95926", "#199e70"],
    flowIn: "#3987e5",
    flowOut: "#e66767",
    critical: "#d03b3b",
  },
};
