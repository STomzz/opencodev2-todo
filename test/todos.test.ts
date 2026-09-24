import assert from "node:assert/strict"
import { test } from "node:test"
import { extractTodos, todosFromInput } from "../src/parse/todos.ts"
import { planMarker, planProgress, planTitle } from "../src/parse/plan.ts"
import type { MessageLike } from "../src/types.ts"

const message = (id: string, todos: unknown, agent = "build"): MessageLike => ({
  id,
  type: "assistant",
  agent,
  content: [{ type: "tool", id: `call-${id}`, name: "todowrite", state: { status: "completed", input: { todos } } }],
})

const todo = (content: string, status: string) => ({ content, status, priority: "high" })

test("todosFromInput reads a todowrite payload", () => {
  const todos = todosFromInput({ todos: [todo("a", "completed"), todo("b", "in_progress")] })
  assert.deepEqual(todos?.map((entry) => [entry.content, entry.status]), [
    ["a", "completed"],
    ["b", "in_progress"],
  ])
})

test("todosFromInput rejects malformed payloads", () => {
  assert.equal(todosFromInput(undefined), undefined)
  assert.equal(todosFromInput({}), undefined)
  assert.equal(todosFromInput({ todos: "nope" }), undefined)
  assert.equal(todosFromInput({ todos: [] }), undefined)
  assert.equal(todosFromInput({ todos: [{ status: "pending" }] }), undefined)
  assert.deepEqual(todosFromInput({ todos: [{ content: "  trimmed  " }] }), [{ content: "trimmed", status: "pending" }])
})

test("extractTodos maps statuses and marks the running step", () => {
  const messages: MessageLike[] = [
    message("m1", [todo("first", "completed"), todo("second", "in_progress"), todo("third", "pending")]),
  ]
  const plan = extractTodos(messages, 10)
  assert.equal(plan?.source, "todo")
  assert.equal(plan?.tracked, true)
  assert.equal(plan?.messageID, "m1")
  assert.equal(plan?.currentIndex, 1)
  assert.deepEqual(plan?.items.map((item) => [item.text, item.done]), [
    ["first", true],
    ["second", false],
    ["third", false],
  ])
  assert.equal(plan ? planTitle(plan) : "", "待办 1/3")
})

test("extractTodos prefers the newest call (progress moves)", () => {
  const messages: MessageLike[] = [
    message("m1", [todo("a", "pending"), todo("b", "pending")]),
    message("m2", [todo("a", "completed"), todo("b", "completed")]),
  ]
  const plan = extractTodos(messages, 10)
  assert.equal(plan?.messageID, "m2")
  assert.equal(plan?.currentIndex, -1)
  assert.equal(plan ? planProgress(plan).complete : false, true)
})

test("extractTodos falls back to the first open item without in_progress", () => {
  const plan = extractTodos([message("m1", [todo("a", "completed"), todo("b", "pending")])], 10)
  assert.equal(plan?.currentIndex, 1)
})

test("extractTodos respects maxItems and ignores other tool parts", () => {
  const plan = extractTodos([message("m1", [todo("a", "pending"), todo("b", "pending"), todo("c", "pending")])], 2)
  assert.deepEqual(plan?.items.map((item) => item.text), ["a", "b"])
  assert.equal(plan?.items.length, 2)

  const other: MessageLike[] = [
    { id: "m1", type: "assistant", content: [{ type: "tool", name: "bash", state: { input: { command: "ls" } } }] },
  ]
  assert.equal(extractTodos(other, 10), undefined)
})

test("extractTodos accepts the v1 `tool` field name too", () => {
  const v1: MessageLike[] = [
    {
      id: "m1",
      type: "assistant",
      content: [{ type: "tool", id: "c1", tool: "todowrite", state: { status: "completed", input: { todos: [todo("a", "in_progress")] } } }],
    },
  ]
  assert.equal(extractTodos(v1, 10)?.items[0]?.text, "a")
})

test("extractTodos ignores user messages and empty caches", () => {
  assert.equal(extractTodos([], 10), undefined)
  assert.equal(extractTodos([{ id: "u1", type: "user", text: "1. a\n2. b" }], 10), undefined)
})

test("cancelled todos render as [-], never as the current step", () => {
  const plan = extractTodos([message("m1", [todo("dropped", "cancelled"), todo("next", "pending")])], 10)
  assert.equal(plan?.items[0]?.cancelled, true)
  assert.equal(plan?.items[0]?.done, false)
  assert.equal(plan?.currentIndex, 1)
  assert.equal(plan ? planMarker(plan.items[0], true) : "?", "[-]")
  assert.equal(plan ? planMarker(plan.items[1], true) : "?", "[>]")

  // A cancelled tail does not count as completed (V1 counted non-completed too).
  const tail = extractTodos([message("m1", [todo("done", "completed"), todo("dropped", "cancelled")])], 10)
  assert.equal(tail?.currentIndex, -1)
  assert.equal(tail ? planProgress(tail).complete : true, false)
})
