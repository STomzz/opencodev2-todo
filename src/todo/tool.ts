/**
 * The V2 port of V1's `todowrite` tool: parameters, validation and formatting.
 *
 * OpenCode V2 ships no todo tool, so the model has nothing to write real
 * progress to and the activity panel can never show a live `待办 x/y` list.
 * A server plugin (see `index.ts`) registers this tool under the same name,
 * description and parameters V1 used; the panel already understands those
 * calls, so nothing in the CLI plugin had to change.
 *
 * Pure; unit tested.
 */

export const TODO_STATUSES = ["pending", "in_progress", "completed", "cancelled"] as const
export type TodoStatus = (typeof TODO_STATUSES)[number]

export const TODO_PRIORITIES = ["high", "medium", "low"] as const
export type TodoPriority = (typeof TODO_PRIORITIES)[number]

export interface Todo {
  readonly content: string
  readonly status: TodoStatus
  readonly priority: TodoPriority
}

/** JSON Schema for the tool input; mirrors V1's zod parameters. */
export const TODO_INPUT_SCHEMA = {
  type: "object",
  properties: {
    todos: {
      type: "array",
      description: "The updated todo list",
      items: {
        type: "object",
        properties: {
          content: { type: "string", minLength: 1, description: "Brief description of the task" },
          status: { type: "string", enum: [...TODO_STATUSES], description: "Current status of the task" },
          priority: { type: "string", enum: [...TODO_PRIORITIES], description: "Priority level of the task" },
        },
        required: ["content", "status", "priority"],
        additionalProperties: false,
      },
    },
  },
  required: ["todos"],
  additionalProperties: false,
}

export type NormalizedTodos = { readonly todos: readonly Todo[] } | { readonly error: string }

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined
}

/**
 * Defensive validation on top of the schema (the runtime validates first, but
 * executors must never trust their input). Returns the trimmed list or the
 * first problem found, mirroring what V1's zod parameters rejected.
 */
export function normalizeTodos(input: unknown): NormalizedTodos {
  const root = asRecord(input)
  if (!root) return { error: "input must be an object with a todos array" }
  const raw = root["todos"]
  if (!Array.isArray(raw)) return { error: "todos must be an array" }

  const todos: Todo[] = []
  for (let index = 0; index < raw.length; index++) {
    const record = asRecord(raw[index])
    if (!record) return { error: `todos[${index}] must be an object` }

    const content = typeof record["content"] === "string" ? record["content"].trim() : ""
    if (content.length === 0) return { error: `todos[${index}].content must be a non-empty string` }

    const status = record["status"]
    if (typeof status !== "string" || !TODO_STATUSES.includes(status as TodoStatus)) {
      return { error: `todos[${index}].status must be one of ${TODO_STATUSES.join(", ")}` }
    }

    const priority = record["priority"]
    if (typeof priority !== "string" || !TODO_PRIORITIES.includes(priority as TodoPriority)) {
      return { error: `todos[${index}].priority must be one of ${TODO_PRIORITIES.join(", ")}` }
    }

    todos.push({ content, status: status as TodoStatus, priority: priority as TodoPriority })
  }
  return { todos }
}

/** V1 answered with the full list as pretty JSON; the model reads it back as state. */
export function formatTodos(todos: readonly Todo[]): string {
  return JSON.stringify(todos, null, 2)
}
