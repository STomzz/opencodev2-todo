import assert from "node:assert/strict"
import { test } from "node:test"
import { TODO_DESCRIPTION } from "../src/todo/description.ts"
import {
  TODO_INPUT_SCHEMA,
  TODO_PRIORITIES,
  TODO_STATUSES,
  formatTodos,
  normalizeTodos,
} from "../src/todo/tool.ts"

const todo = (content: string, status = "pending", priority = "high") => ({ content, status, priority })

test("input schema mirrors V1's parameters", () => {
  const schema = TODO_INPUT_SCHEMA as {
    properties: { todos: { items: { properties: Record<string, { enum?: string[] }>; required: string[] } } }
    required: string[]
  }
  assert.deepEqual(schema.required, ["todos"])
  assert.deepEqual(schema.properties.todos.items.required, ["content", "status", "priority"])
  assert.deepEqual(schema.properties.todos.items.properties["status"]?.enum, [...TODO_STATUSES])
  assert.deepEqual(schema.properties.todos.items.properties["priority"]?.enum, [...TODO_PRIORITIES])
})

test("normalizeTodos accepts a V1 payload and trims content", () => {
  const result = normalizeTodos({
    todos: [todo("  写骨架  ", "in_progress"), todo("接线", "completed", "medium")],
  })
  assert.ok("todos" in result)
  assert.deepEqual(
    result.todos.map((entry) => [entry.content, entry.status, entry.priority]),
    [
      ["写骨架", "in_progress", "high"],
      ["接线", "completed", "medium"],
    ],
  )
})

test("normalizeTodos accepts an empty list (clears the todo list)", () => {
  const result = normalizeTodos({ todos: [] })
  assert.ok("todos" in result)
  assert.equal(result.todos.length, 0)
})

test("normalizeTodos reports each malformed shape", () => {
  const errors = [
    normalizeTodos(undefined),
    normalizeTodos({}),
    normalizeTodos({ todos: "nope" }),
    normalizeTodos({ todos: ["x"] }),
    normalizeTodos({ todos: [{ content: "  ", status: "pending", priority: "high" }] }),
    normalizeTodos({ todos: [{ content: "a", status: "done", priority: "high" }] }),
    normalizeTodos({ todos: [{ content: "a", status: "pending", priority: "urgent" }] }),
  ]
  for (const result of errors) {
    assert.ok("error" in result, JSON.stringify(result))
  }
})

test("formatTodos matches V1's pretty JSON output", () => {
  assert.equal(
    formatTodos([{ content: "a", status: "pending", priority: "high" }]),
    '[\n  {\n    "content": "a",\n    "status": "pending",\n    "priority": "high"\n  }\n]',
  )
})

test("description keeps V1's wording and states", () => {
  assert.match(TODO_DESCRIPTION, /## When to use/)
  assert.match(TODO_DESCRIPTION, /## When NOT to use/)
  for (const status of TODO_STATUSES) assert.match(TODO_DESCRIPTION, new RegExp(`\`${status}\``))
  assert.match(TODO_DESCRIPTION, /exactly ONE at a time/)
})
