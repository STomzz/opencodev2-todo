import assert from "node:assert/strict"
import { test } from "node:test"
import { collapseInfo } from "../src/util/collapse.ts"

test("short text is never collapsible", () => {
  const info = collapseInfo("短文本", 10, 0, false)
  assert.equal(info.collapsible, false)
  assert.equal(info.collapsed, false)
  assert.equal(info.body, "短文本")
})

test("long text collapses to one line with an ellipsis", () => {
  const text = "0123456789abcdefghij"
  const info = collapseInfo(text, 10, 0, false)
  assert.equal(info.collapsible, true)
  assert.equal(info.collapsed, true)
  assert.equal(info.body, "012345678…")
})

test("expanded long text stays collapsible so it can collapse again", () => {
  const text = "0123456789abcdefghij"
  const info = collapseInfo(text, 10, 0, true)
  assert.equal(info.collapsible, true)
  assert.equal(info.collapsed, false)
  assert.equal(info.body, text)
})

test("collapsed text is clipped at collapseChars, expanded text is not", () => {
  const text = "a".repeat(200)
  assert.equal(collapseInfo(text, 56, 0, false).body.length, 56)
  assert.equal(collapseInfo(text, 56, 0, true).body.length, 200)
})

test("maxChars acts as the cap when collapseChars is 0", () => {
  const text = "0123456789abcdefghij"
  const collapsed = collapseInfo(text, 0, 10, false)
  assert.equal(collapsed.collapsible, true)
  assert.equal(collapsed.body, "012345678…")

  const expanded = collapseInfo(text, 0, 10, true)
  assert.equal(expanded.collapsed, false)
  assert.equal(expanded.body, "012345678…")
})

test("everything unlimited never collapses", () => {
  const info = collapseInfo("x".repeat(1_000), 0, 0, false)
  assert.equal(info.collapsible, false)
  assert.equal(info.body.length, 1_000)
})
