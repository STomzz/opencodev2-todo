import type { PanelOptions } from "./types.ts"

export const DEFAULT_OPTIONS: PanelOptions = {
  // 0 = unlimited: text wraps to the sidebar width instead of being truncated.
  maxChars: 0,
  goalChars: 0,
  maxPlanItems: 12,
  // Longer lines collapse to one clickable line (click to expand).
  collapseChars: 56,
  showGoal: true,
  showAction: true,
  showPlan: true,
}

function intOption(value: unknown, fallback: number, min: number, max: number): number {
  const parsed =
    typeof value === "number" ? value : Number.parseInt(typeof value === "string" ? value : "", 10)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(max, Math.max(min, Math.trunc(parsed)))
}

/** Reads plugin options (from cli.json / opencode.json) with safe defaults. */
export function resolveOptions(raw: Readonly<Record<string, unknown>> | undefined): PanelOptions {
  const source = raw ?? {}
  return {
    maxChars: intOption(source["maxChars"], DEFAULT_OPTIONS.maxChars, 0, 500),
    goalChars: intOption(source["goalChars"], DEFAULT_OPTIONS.goalChars, 0, 2_000),
    maxPlanItems: intOption(source["maxPlanItems"], DEFAULT_OPTIONS.maxPlanItems, 1, 50),
    collapseChars: intOption(source["collapseChars"], DEFAULT_OPTIONS.collapseChars, 0, 500),
    showGoal: source["showGoal"] !== false,
    showAction: source["showAction"] !== false,
    showPlan: source["showPlan"] !== false,
  }
}
