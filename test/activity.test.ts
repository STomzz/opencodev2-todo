import assert from "node:assert/strict"
import { test } from "node:test"
import { initialActivity, reduceActivity, showUnknownHint, UNKNOWN_HINT_MS } from "../src/state/activity.ts"
import { hydrateActivity } from "../src/state/hydrate.ts"
import type { EventLike, MessageLike } from "../src/types.ts"
import { sessionIDOf, toActivityEvent } from "../src/util/events.ts"
import { summarizeTool } from "../src/util/summarize.ts"

function apply(state: ReturnType<typeof initialActivity>, event: EventLike, at: number) {
  const mapped = toActivityEvent(event)
  assert.ok(mapped, `event not mapped: ${event.type}`)
  return reduceActivity(state, mapped, at, summarizeTool)
}

test("sessionIDOf reads the session id", () => {
  assert.equal(sessionIDOf({ type: "session.idle", data: { sessionID: "s1" } }), "s1")
  assert.equal(sessionIDOf({ type: "session.idle", data: {} }), undefined)
})

test("tool lifecycle produces detail, ok flag and duration", () => {
  let state = initialActivity()
  state = apply(state, { type: "session.execution.started", data: { sessionID: "s1" } }, 1_000)
  assert.equal(state.kind, "thinking")

  state = apply(state, { type: "session.step.started", data: { sessionID: "s1" } }, 1_100)
  assert.equal(state.step, 1)

  state = apply(state, { type: "session.tool.input.started", data: { sessionID: "s1", id: "t1", name: "shell" } }, 1_200)
  assert.equal(state.kind, "tool")
  assert.equal(state.toolName, "shell")

  state = apply(
    state,
    { type: "session.tool.called", data: { sessionID: "s1", id: "t1", input: { command: "cd /tmp && ls" } } },
    1_300,
  )
  assert.equal(state.detail, "ls")

  state = apply(state, { type: "session.tool.success", data: { sessionID: "s1", id: "t1" } }, 3_300)
  assert.equal(state.lastTool?.name, "shell")
  assert.equal(state.lastTool?.detail, "ls")
  assert.equal(state.lastTool?.ok, true)
  // elapsed is measured from session.tool.input.started (1_200), matching the live timer
  assert.equal(state.lastTool?.durationMs, 2_100)
  assert.equal(state.kind, "thinking")
})

test("failed tools are marked as errors", () => {
  let state = initialActivity()
  state = apply(state, { type: "session.tool.input.started", data: { sessionID: "s1", id: "t9", name: "edit" } }, 10)
  state = apply(state, { type: "session.tool.called", data: { sessionID: "s1", id: "t9", input: { path: "a.ts" } } }, 20)
  state = apply(state, { type: "session.tool.failed", data: { sessionID: "s1", id: "t9" } }, 30)
  assert.equal(state.lastTool?.ok, false)
  assert.equal(state.lastTool?.detail, "a.ts")
})

test("text and idle events switch the current activity", () => {
  let state = initialActivity()
  state = apply(state, { type: "session.text.started", data: { sessionID: "s1" } }, 100)
  assert.equal(state.kind, "writing")
  state = apply(state, { type: "session.execution.succeeded", data: { sessionID: "s1" } }, 200)
  assert.equal(state.kind, "idle")
  assert.equal(state.startedAt, undefined)
})

test("session.idle maps to idle", () => {
  let state = apply(initialActivity(), { type: "session.execution.started", data: { sessionID: "s1" } }, 100)
  state = apply(state, { type: "session.idle", data: { sessionID: "s1" } }, 200)
  assert.equal(state.kind, "idle")
})

test("unrelated events are ignored", () => {
  assert.equal(toActivityEvent({ type: "session.usage.updated", data: { sessionID: "s1" } }), undefined)
  assert.equal(toActivityEvent({ type: "session.tool.called", data: { sessionID: "s1" } }), undefined)
})

test("hydrateActivity restores a running tool after a restart", () => {
  const messages: MessageLike[] = [
    {
      id: "m1",
      type: "assistant",
      content: [
        { type: "text", text: "working" },
        { type: "tool", text: undefined },
      ],
    },
  ]
  // Build a realistic tool part whose state is "running".
  const part = {
    type: "tool",
    id: "t1",
    name: "shell",
    state: { status: "running", input: { command: "npm test" } },
    time: { created: 5_000, ran: 6_000 },
  }
  const withTool = [
    {
      id: "m1",
      type: "assistant",
      content: [part],
    },
  ] as unknown as MessageLike[]
  assert.equal(hydrateActivity(messages, 9_000), undefined)

  const restored = hydrateActivity(withTool, 9_000)
  assert.equal(restored?.kind, "tool")
  assert.equal(restored?.toolName, "shell")
  assert.equal(restored?.detail, "npm test")
  assert.equal(restored?.startedAt, 6_000)
  assert.equal(restored?.step, 1)
})

test("hydrateActivity ignores completed tools", () => {
  const messages = [
    {
      id: "m1",
      type: "assistant",
      content: [{ type: "tool", id: "t1", name: "read", state: { status: "completed" } }],
    },
  ] as unknown as MessageLike[]
  assert.equal(hydrateActivity(messages, 1), undefined)
})

test("every recognized event refreshes updatedAt, including no-op ones", () => {
  const state = apply(initialActivity(), { type: "session.reasoning.ended", data: { sessionID: "s1" } }, 5_000)
  assert.equal(state.updatedAt, 5_000)
})

test("showUnknownHint only fires for running sessions without live activity", () => {
  const idle = apply(initialActivity(), { type: "session.idle", data: { sessionID: "s1" } }, 1_000)
  assert.equal(showUnknownHint(idle, true, 1_000), false)
  assert.equal(showUnknownHint(idle, true, 1_000 + UNKNOWN_HINT_MS), true)
  assert.equal(showUnknownHint(idle, false, 999_999), false)
  assert.equal(showUnknownHint(undefined, true, 0), true)

  const thinking = apply(initialActivity(), { type: "session.execution.started", data: { sessionID: "s1" } }, 10)
  assert.equal(showUnknownHint(thinking, true, 999_999), false)
})
