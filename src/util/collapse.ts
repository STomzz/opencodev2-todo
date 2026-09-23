/**
 * Collapse decision for one line of panel text. Pure and unit tested, so the
 * click-to-expand behaviour does not depend on renderer internals.
 */

import { oneLine } from "./text.ts"

export interface CollapseInfo {
  /** Whitespace-collapsed text. */
  readonly full: string
  /** True when the text is long enough to offer expand/collapse. */
  readonly collapsible: boolean
  /** True while showing the one-line preview. */
  readonly collapsed: boolean
  /** Text to render right now. */
  readonly body: string
}

function preview(text: string, cap: number): string {
  if (cap <= 0 || text.length <= cap) return text
  if (cap === 1) return "…"
  return `${text.slice(0, cap - 1).trimEnd()}…`
}

/**
 * @param collapseChars length above which the line collapses (0 = never)
 * @param maxChars    hard cap applied even when expanded (0 = unlimited)
 * @param expanded    current click state
 */
export function collapseInfo(text: string, collapseChars: number, maxChars: number, expanded: boolean): CollapseInfo {
  const full = oneLine(text, 0)
  const cap = collapseChars > 0 ? collapseChars : maxChars
  const collapsible = cap > 0 && full.length > cap
  const collapsed = collapsible && !expanded
  return {
    full,
    collapsible,
    collapsed,
    body: collapsed ? preview(full, cap) : oneLine(full, maxChars),
  }
}
