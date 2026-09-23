/**
 * Restores the live activity of a running session after a TUI restart by
 * looking at the currently streaming/running tool part of the newest assistant
 * message. Pure; unit tested.
 */

import type { ActivityState, ContentPart, MessageLike } from "../types.ts"
import { summarizeTool } from "../util/summarize.ts"

export function hydrateActivity(messages: readonly MessageLike[], at: number): ActivityState | undefined {
  for (let messageIndex = messages.length - 1; messageIndex >= 0; messageIndex--) {
    const message = messages[messageIndex]
    if (!message || message.type !== "assistant") continue

    const parts = (message.content ?? []) as readonly ContentPart[]
    for (let partIndex = parts.length - 1; partIndex >= 0; partIndex--) {
      const part = parts[partIndex]
      if (!part || part.type !== "tool") continue
      const status = part.state?.status
      if (status !== "running" && status !== "streaming") continue

      const name = part.name ?? part.tool ?? "tool"
      const detail = status === "running" ? summarizeTool(name, part.state?.input) : undefined
      const startedAt = part.time?.ran ?? part.time?.created ?? at
      const names: Record<string, string> = {}
      if (part.id) names[part.id] = name
      return {
        kind: "tool",
        toolName: name,
        detail,
        startedAt,
        updatedAt: at,
        step: partIndex + 1,
        names,
      }
    }
  }
  return undefined
}
