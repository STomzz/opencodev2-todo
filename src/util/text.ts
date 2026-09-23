/** Small text helpers: single-line, truncate, durations. All pure. */

export function singleLine(value: string): string {
  return value.replace(/\s+/g, " ").trim()
}

/** Collapses whitespace and truncates to `max` characters (with an ellipsis). */
export function clamp(value: string, max: number): string {
  const text = singleLine(value)
  if (max <= 0) return ""
  if (text.length <= max) return text
  if (max === 1) return "…"
  return `${text.slice(0, max - 1).trimEnd()}…`
}

/** First non-empty line of a multi-line string, whitespace-collapsed. */
export function firstLine(value: string): string {
  const lines = value.split(/\r?\n/)
  for (const line of lines) {
    if (line.trim().length > 0) return singleLine(line)
  }
  return ""
}

/** Single-line, whitespace-collapsed, optionally truncated (`max = 0` = no limit). */
export function oneLine(value: string, max: number): string {
  const text = singleLine(value)
  if (max <= 0 || text.length <= max) return text
  if (max === 1) return "…"
  return `${text.slice(0, max - 1).trimEnd()}…`
}

/** Human duration: `<1s`, `42s`, `3m05s`, `1h02m`. */
export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return ""
  const seconds = Math.floor(ms / 1000)
  if (seconds < 1) return "<1s"
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) {
    const rest = seconds % 60
    return rest === 0 ? `${minutes}m` : `${minutes}m${String(rest).padStart(2, "0")}s`
  }
  const hours = Math.floor(minutes / 60)
  const restMinutes = minutes % 60
  return restMinutes === 0 ? `${hours}h` : `${hours}h${String(restMinutes).padStart(2, "0")}m`
}
