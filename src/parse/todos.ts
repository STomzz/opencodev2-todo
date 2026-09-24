/**
 * Real todo extraction from the model's own `todowrite` tool calls.
 *
 * The V2 build ships no todo tool, so this repository's server plugin
 * (`index.ts`) registers V1's `todowrite` again as a Code Mode catalog tool;
 * every call carries the full list with
 * `status: "pending" | "in_progress" | "completed" | "cancelled"`, and the
 * newest call in the message cache is the authoritative plan — no heuristics,
 * and the check marks actually move while the session works.
 *
 * Two recording shapes are read:
 * - a direct call is a tool part named `todowrite` (V1-era rows, non-Code-Mode
 *   sessions), with the list under `state.input`;
 * - a call nested in `execute` leaves no part of its own, but the executor
 *   copies each nested call's name, status and full input into the `execute`
 *   part's `state.metadata.toolCalls` (the documented channel for TUIs).
 *
 * Pure; unit tested.
 */

import type { ContentPart, MessageLike, Plan, PlanItem } from "../types.ts"

/** One entry of a `todowrite` call. */
export interface TodoEntry {
  readonly content: string
  readonly status: string
}

/** Reads the `{ todos: [...] }` input of a `todowrite` call; `undefined` when malformed. */
export function todosFromInput(input: unknown): readonly TodoEntry[] | undefined {
  if (!input || typeof input !== "object") return undefined
  const raw = (input as { todos?: unknown }).todos
  if (!Array.isArray(raw)) return undefined

  const entries: TodoEntry[] = []
  for (const value of raw) {
    if (!value || typeof value !== "object") continue
    const record = value as Record<string, unknown>
    const content = typeof record["content"] === "string" ? record["content"].trim() : ""
    if (content.length === 0) continue
    entries.push({ content, status: typeof record["status"] === "string" ? record["status"] : "pending" })
  }
  return entries.length > 0 ? entries : undefined
}

/** The step to highlight: the running one, else the first still open. */
function currentTodoIndex(todos: readonly TodoEntry[], visible: number): number {
  const limit = Math.min(todos.length, visible)
  for (let index = 0; index < limit; index++) {
    if (todos[index]?.status === "in_progress") return index
  }
  for (let index = 0; index < limit; index++) {
    const status = todos[index]?.status
    if (status !== "completed" && status !== "cancelled") return index
  }
  return -1
}

/** Reads the last `todowrite` entry of an `execute` part's nested-call metadata. */
function todosFromExecute(part: ContentPart): readonly TodoEntry[] | undefined {
  const metadata = part.state?.metadata
  if (!metadata || typeof metadata !== "object") return undefined
  const calls = (metadata as { toolCalls?: unknown }).toolCalls
  if (!Array.isArray(calls)) return undefined

  for (let index = calls.length - 1; index >= 0; index--) {
    const call = calls[index]
    if (!call || typeof call !== "object") continue
    const record = call as Record<string, unknown>
    if (record["tool"] !== "todowrite") continue
    const todos = todosFromInput(record["input"])
    if (todos) return todos
  }
  return undefined
}

/** The newest todo payload a message carries, either recording shape. */
function messageTodos(message: MessageLike): readonly TodoEntry[] | undefined {
  const parts = message.content ?? []
  for (let index = parts.length - 1; index >= 0; index--) {
    const part = parts[index]
    if (part?.type !== "tool") continue
    // v2 uses `name`, v1 rows use `tool`.
    if (part.name === "todowrite" || part.tool === "todowrite") {
      const todos = todosFromInput(part.state?.input)
      if (todos) return todos
      continue
    }
    if (part.name === "execute") {
      const todos = todosFromExecute(part)
      if (todos) return todos
    }
  }
  return undefined
}

/** Newest `todowrite` call across the message list, as a plan. */
export function extractTodos(messages: readonly MessageLike[], maxItems: number): Plan | undefined {
  let latestAssistantID: string | undefined
  for (let index = messages.length - 1; index >= 0; index--) {
    const message = messages[index]
    if (message?.type === "assistant") {
      latestAssistantID = message.id
      break
    }
  }

  for (let index = messages.length - 1; index >= 0; index--) {
    const message = messages[index]
    if (!message || message.type !== "assistant") continue
    const todos = messageTodos(message)
    if (!todos) continue

    const items = todos.slice(0, Math.max(1, maxItems)).map<PlanItem>((todo) => ({
      text: todo.content,
      done: todo.status === "completed",
      cancelled: todo.status === "cancelled",
    }))
    return {
      items,
      messageID: message.id,
      fromPlanAgent: message.agent === "plan",
      fromLatestAssistant: message.id === latestAssistantID,
      tracked: true,
      userMessagesAfter: 0,
      source: "todo",
      currentIndex: currentTodoIndex(todos, items.length),
    }
  }
  return undefined
}
