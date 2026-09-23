import assert from "node:assert/strict"
import { test } from "node:test"
import {
  currentStepIndex,
  extractPlan,
  lastUserText,
  parsePlanList,
  planTitle,
  resolvePlan,
} from "../src/parse/plan.ts"
import type { MessageLike, Plan, PlanSnapshot } from "../src/types.ts"

const texts = (text: string, max = 10) => parsePlanList(text, max)?.items.map((item) => item.text)

test("parses a numbered list after a preamble", () => {
  const parsed = parsePlanList("好的，计划如下：\n1. 勘察现有结构\n2. 创建插件骨架\n3. 接线渲染\n", 10)
  assert.deepEqual(
    parsed?.items.map((item) => item.text),
    ["勘察现有结构", "创建插件骨架", "接线渲染"],
  )
  assert.ok(parsed?.items.every((item) => !item.done))
  assert.equal(parsed?.tracked, false)
})

test("parses checkboxes and marks the list as tracked", () => {
  const parsed = parsePlanList("- [x] 第一步\n- [ ] 第二步\n- [ ] 第三步\n", 10)
  assert.deepEqual(
    parsed?.items.map((item) => [item.text, item.done]),
    [
      ["第一步", true],
      ["第二步", false],
      ["第三步", false],
    ],
  )
  assert.equal(parsed?.tracked, true)
})

test("done and todo glyphs count as tracked", () => {
  assert.equal(parsePlanList("✅ 已完成\n⏳ 进行中\n", 10)?.tracked, true)
  assert.equal(parsePlanList("1. 编号一\n2. 编号二\n", 10)?.tracked, false)
  assert.equal(parsePlanList("- 甲\n- 乙\n- 丙\n", 10)?.tracked, false)
})

test("ignores fenced code blocks", () => {
  const text = "计划：\n1. real one\n2. real two\n\n```\n1. fake one\n2. fake two\n```\n"
  assert.deepEqual(texts(text), ["real one", "real two"])
})

test("requires at least two items", () => {
  assert.equal(parsePlanList("1. 只有一个步骤\n", 10), undefined)
})

test("plain bullet runs require three items", () => {
  assert.equal(parsePlanList("- a\n- b\n", 10), undefined)
  assert.deepEqual(texts("- a\n- b\n- c\n"), ["a", "b", "c"])
})

test("picks the longest run and respects maxItems", () => {
  const text = "1. a\n2. b\n\n中间说明\n\n1. x\n2. y\n3. z\n4. w\n"
  assert.deepEqual(texts(text, 2), ["x", "y"])
})

test("joins indented continuation lines", () => {
  assert.deepEqual(texts("1. first step\n   with more detail\n2. second step\n"), [
    "first step with more detail",
    "second step",
  ])
})

function assistant(id: string, text: string, agent = "build"): MessageLike {
  return { id, type: "assistant", agent, content: [{ type: "text", text }] }
}

test("extractPlan prefers the plan agent over newer build messages", () => {
  const messages: MessageLike[] = [
    assistant("m1", "1. plan one\n2. plan two", "plan"),
    assistant("m2", "1. build one\n2. build two", "build"),
  ]
  const plan = extractPlan(messages, 10)
  assert.equal(plan?.messageID, "m1")
  assert.equal(plan?.fromPlanAgent, true)
  assert.equal(plan?.fromLatestAssistant, false)
})

test("extractPlan marks a plan from the newest assistant message", () => {
  const messages: MessageLike[] = [assistant("m1", "1. old one\n2. old two"), assistant("m2", "1. new one\n2. new two")]
  const plan = extractPlan(messages, 10)
  assert.equal(plan?.messageID, "m2")
  assert.equal(plan?.fromLatestAssistant, true)
})

test("extractPlan cache invalidates when the message text changes", () => {
  assert.deepEqual(texts("1. alpha\n2. beta"), ["alpha", "beta"])
  const first: MessageLike[] = [assistant("m1", "1. alpha\n2. beta")]
  assert.deepEqual(
    extractPlan(first, 10)?.items.map((item) => item.text),
    ["alpha", "beta"],
  )
  const second: MessageLike[] = [assistant("m1", "1. alpha\n2. beta\n3. gamma")]
  assert.deepEqual(
    extractPlan(second, 10)?.items.map((item) => item.text),
    ["alpha", "beta", "gamma"],
  )
})

const plan = (overrides: Partial<Plan> = {}): Plan => ({
  items: [
    { text: "a", done: true },
    { text: "b", done: false },
    { text: "c", done: false },
  ],
  messageID: "m1",
  fromPlanAgent: false,
  fromLatestAssistant: true,
  tracked: true,
  ...overrides,
})

const snapshot = (overrides: Partial<PlanSnapshot> = {}): PlanSnapshot => ({
  messageID: "old",
  items: [{ text: "x", done: false }],
  fromPlanAgent: false,
  tracked: false,
  savedAt: 1,
  ...overrides,
})

test("resolvePlan prefers the fresh plan and falls back to the snapshot", () => {
  const fresh = plan()
  const first = resolvePlan(fresh, snapshot())
  assert.equal(first.fromSnapshot, false)
  assert.equal(first.plan?.messageID, "m1")

  const second = resolvePlan(undefined, snapshot())
  assert.equal(second.fromSnapshot, true)
  assert.equal(second.plan?.messageID, "old")
  assert.equal(second.plan?.fromLatestAssistant, false)

  const third = resolvePlan(undefined, undefined)
  assert.equal(third.plan, undefined)
  assert.equal(third.fromSnapshot, false)
})

test("planTitle reports source and progress honestly", () => {
  assert.equal(planTitle(plan(), false), "计划 1/3")
  assert.equal(planTitle(plan({ tracked: false, fromLatestAssistant: true }), false), "计划")
  assert.equal(planTitle(plan({ tracked: false, fromLatestAssistant: false }), false), "计划（可能过时）")
  assert.equal(planTitle(plan({ tracked: false }), true), "计划（上次）")
  assert.equal(planTitle(plan(), true), "计划（上次）")
})

test("currentStepIndex only claims a step for tracked plans", () => {
  assert.equal(currentStepIndex(plan()), 1)
  assert.equal(currentStepIndex(plan({ tracked: false })), -1)
  assert.equal(
    currentStepIndex(plan({ items: [{ text: "a", done: true }, { text: "b", done: true }] })),
    -1,
  )
})

test("lastUserText returns the newest user message, truncated", () => {
  const messages: MessageLike[] = [
    { id: "u1", type: "user", text: "first request" },
    assistant("m1", "1. a\n2. b"),
    { id: "u2", type: "user", text: "a much longer second request" },
  ]
  assert.equal(lastUserText(messages, 100), "a much longer second request")
  assert.equal(lastUserText(messages, 10), "a much lo…")
  assert.equal(lastUserText([assistant("m1", "x")], 10), undefined)
})
