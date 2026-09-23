import assert from "node:assert/strict"
import { test } from "node:test"
import { DEFAULT_OPTIONS, resolveOptions } from "../src/options.ts"

test("defaults are unlimited and everything visible", () => {
  assert.deepEqual(resolveOptions(undefined), DEFAULT_OPTIONS)
  assert.equal(DEFAULT_OPTIONS.maxChars, 0)
  assert.equal(DEFAULT_OPTIONS.goalChars, 0)
  assert.equal(DEFAULT_OPTIONS.collapseChars, 56)
})

test("numeric options are parsed and clamped, 0 means unlimited", () => {
  const options = resolveOptions({ maxChars: "40", goalChars: 12, maxPlanItems: 999, collapseChars: 80 })
  assert.equal(options.maxChars, 40)
  assert.equal(options.goalChars, 12)
  assert.equal(options.maxPlanItems, 50)
  assert.equal(options.collapseChars, 80)

  assert.equal(resolveOptions({ maxChars: 0 }).maxChars, 0)
  assert.equal(resolveOptions({ maxChars: -5 }).maxChars, 0)
  assert.equal(resolveOptions({ maxChars: "abc" }).maxChars, 0)
  assert.equal(resolveOptions({ collapseChars: 0 }).collapseChars, 0)
})

test("section toggles only accept explicit false", () => {
  const options = resolveOptions({ showGoal: false, showAction: true, showPlan: "yes" })
  assert.equal(options.showGoal, false)
  assert.equal(options.showAction, true)
  assert.equal(options.showPlan, true)
})
