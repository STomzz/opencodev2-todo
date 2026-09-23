/**
 * Theme access kept structural and total: any missing token falls back to
 * `text.base`, so the panel still renders on unknown or future themes.
 */

import type { RGBA } from "@opentui/core"

/** Whatever OpenTUI accepts for `fg`. */
export type ColorToken = string | RGBA

export interface Palette {
  readonly base: ColorToken | undefined
  readonly muted: ColorToken | undefined
  readonly accent: ColorToken | undefined
  readonly success: ColorToken | undefined
  readonly error: ColorToken | undefined
  readonly warning: ColorToken | undefined
}

interface FeedbackEntry {
  readonly base?: ColorToken
}

export function palette(theme: unknown): Palette {
  const t = (theme ?? {}) as {
    readonly text?: {
      readonly base?: unknown
      readonly muted?: unknown
      readonly feedback?: unknown
    }
    readonly hue?: { readonly accent?: unknown }
  }
  const base = t.text?.base as ColorToken | undefined
  const feedback = t.text?.feedback as Record<string, FeedbackEntry | undefined> | undefined
  const accent = (t.hue?.accent as Record<number, ColorToken | undefined> | undefined)?.[500] ?? base
  return {
    base,
    muted: (t.text?.muted as ColorToken | undefined) ?? base,
    accent,
    success: feedback?.["success"]?.base ?? base,
    error: feedback?.["error"]?.base ?? base,
    warning: feedback?.["warning"]?.base ?? base,
  }
}
