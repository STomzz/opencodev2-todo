/** Per-session activity state machine. Pure reducer, unit tested. */

import type { ActivityState, FinishedTool } from "../types.ts"
import type { ActivityEvent } from "../util/events.ts"

export type Summarizer = (name: string, input: unknown) => string | undefined

/** How long a running session may sit in `idle` before we suspect a lost event stream. */
export const UNKNOWN_HINT_MS = 8_000

export function initialActivity(at = 0): ActivityState {
  return { kind: "idle", step: 0, updatedAt: at, names: {} }
}

export function reduceActivity(
  previous: ActivityState | undefined,
  event: ActivityEvent,
  at: number,
  summarize: Summarizer,
): ActivityState {
  const state = previous ?? initialActivity(at)
  // Every recognized event refreshes `updatedAt`, which feeds the liveness hint.
  const base: ActivityState = { ...state, updatedAt: at }

  switch (event.type) {
    case "execution.started":
      return { kind: "thinking", step: 0, startedAt: at, updatedAt: at, names: {} }
    case "step.started":
      return {
        ...base,
        kind: "thinking",
        step: state.step + 1,
        startedAt: at,
        toolName: undefined,
        detail: undefined,
      }
    case "reasoning.started":
      return { ...base, kind: "thinking", startedAt: at }
    case "reasoning.ended":
      return base
    case "text.started":
      return { ...base, kind: "writing", startedAt: at }
    case "text.ended":
      return base
    case "tool.started":
      return {
        ...base,
        kind: "tool",
        toolName: event.name,
        detail: undefined,
        startedAt: at,
        names: { ...state.names, [event.id]: event.name },
      }
    case "tool.called": {
      const name = state.names[event.id] ?? state.toolName ?? "tool"
      const startedAt = state.kind === "tool" && state.startedAt !== undefined ? state.startedAt : at
      return { ...base, kind: "tool", toolName: name, detail: summarize(name, event.input), startedAt }
    }
    case "tool.ended": {
      const name = state.names[event.id] ?? state.toolName ?? "tool"
      const sameTool = state.kind === "tool" && state.toolName === name
      const lastTool: FinishedTool = {
        name,
        detail: sameTool ? state.detail : undefined,
        ok: event.ok,
        durationMs: sameTool && state.startedAt !== undefined ? Math.max(0, at - state.startedAt) : undefined,
      }
      return {
        ...base,
        kind: "thinking",
        toolName: undefined,
        detail: undefined,
        startedAt: at,
        lastTool,
      }
    }
    case "execution.ended":
    case "idle":
      return { ...base, kind: "idle", toolName: undefined, detail: undefined, startedAt: undefined }
    default:
      return base
  }
}

/**
 * True when the session claims to be running but we have no live activity for it,
 * which in practice means an OpenCode upgrade changed the event names or payloads.
 */
export function showUnknownHint(activity: ActivityState | undefined, running: boolean, now: number): boolean {
  if (!running) return false
  if (!activity) return true
  if (activity.kind !== "idle") return false
  return now - activity.updatedAt >= UNKNOWN_HINT_MS
}
