/** Server event -> internal activity event mapping. Pure. */

import type { EventLike } from "../types.ts"

export type ActivityEvent =
  | { readonly type: "execution.started" }
  | { readonly type: "execution.ended"; readonly ok: boolean }
  | { readonly type: "step.started" }
  | { readonly type: "reasoning.started" }
  | { readonly type: "reasoning.ended" }
  | { readonly type: "text.started" }
  | { readonly type: "text.ended" }
  | { readonly type: "tool.started"; readonly id: string; readonly name: string }
  | { readonly type: "tool.called"; readonly id: string; readonly input: unknown }
  | { readonly type: "tool.ended"; readonly id: string; readonly ok: boolean }
  | { readonly type: "idle" }

/** Session id carried by session events, if any. */
export function sessionIDOf(event: EventLike): string | undefined {
  const value = event.data?.["sessionID"]
  return typeof value === "string" ? value : undefined
}

function stringField(data: Record<string, unknown>, key: string): string | undefined {
  const value = data[key]
  return typeof value === "string" && value.length > 0 ? value : undefined
}

/** Maps a server event to an activity event; `undefined` when not relevant. */
export function toActivityEvent(event: EventLike): ActivityEvent | undefined {
  const data = event.data ?? {}
  switch (event.type) {
    case "session.execution.started":
      return { type: "execution.started" }
    case "session.execution.succeeded":
      return { type: "execution.ended", ok: true }
    case "session.execution.failed":
    case "session.execution.interrupted":
      return { type: "execution.ended", ok: false }
    case "session.step.started":
      return { type: "step.started" }
    case "session.reasoning.started":
      return { type: "reasoning.started" }
    case "session.reasoning.ended":
      return { type: "reasoning.ended" }
    case "session.text.started":
      return { type: "text.started" }
    case "session.text.ended":
      return { type: "text.ended" }
    case "session.tool.input.started": {
      const id = stringField(data, "id")
      if (!id) return undefined
      return { type: "tool.started", id, name: stringField(data, "name") ?? "tool" }
    }
    case "session.tool.called": {
      const id = stringField(data, "id")
      if (!id) return undefined
      return { type: "tool.called", id, input: data["input"] }
    }
    case "session.tool.success":
    case "session.tool.failed": {
      const id = stringField(data, "id")
      if (!id) return undefined
      return { type: "tool.ended", id, ok: event.type === "session.tool.success" }
    }
    case "session.idle":
      return { type: "idle" }
    default:
      return undefined
  }
}
