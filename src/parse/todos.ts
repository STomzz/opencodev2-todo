/**
 * Real todo extraction from the model's own `todowrite` tool calls.
 *
 * OpenCode V2 exposes a global `todowrite` tool; every call carries the full
 * list with `status: "pending" | "in_progress" | "completed"`, so the newest
 * call in the message cache is the authoritative plan — no heuristics, and the
 * check marks actually move while the session works.
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
    if (todos[index]?.status !== "completed") return index
  }
  return -1
}

function todoPart(message: MessageLike): ContentPart | undefined {
  const parts = message.content ?? []
  for (let index = parts.length - 1; index >= 0; index--) {
    const part = parts[index]
    if (part?.type !== "tool") continue
    // v2 uses `name`, v1 rows use `tool`.
    if (part.name === "todowrite" || part.tool === "todowrite") return part
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
    const part = todoPart(message)
    if (!part) continue
    const todos = todosFromInput(part.state?.input)
    if (!todos) continue

    const items = todos.slice(0, Math.max(1, maxItems)).map<PlanItem>((todo) => ({
      text: todo.content,
      done: todo.status === "completed",
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
