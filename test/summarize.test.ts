import assert from "node:assert/strict"
import { test } from "node:test"
import { summarizeTool, toolLabel } from "../src/util/summarize.ts"
import { clamp, firstLine, formatDuration, oneLine, singleLine } from "../src/util/text.ts"

test("shell detail strips a leading cd", () => {
  assert.equal(summarizeTool("shell", { command: "cd /tmp/opencode && npm test" }), "npm test")
  assert.equal(summarizeTool("shell", { command: "ls -la" }), "ls -la")
})

test("file tools show the path", () => {
  assert.equal(summarizeTool("read", { path: "src/app.ts" }), "src/app.ts")
  assert.equal(summarizeTool("edit", { filePath: "src/app.ts" }), "src/app.ts")
})

test("search tools combine pattern and path", () => {
  assert.equal(summarizeTool("grep", { pattern: "sidebar", path: "src" }), "sidebar · src")
  assert.equal(summarizeTool("glob", { pattern: "**/*.tsx" }), "**/*.tsx")
})

test("webfetch strips the protocol", () => {
  assert.equal(summarizeTool("webfetch", { url: "https://opencode.ai/v2/docs/plugins" }), "opencode.ai/v2/docs/plugins")
})

test("subagent shows agent and description", () => {
  assert.equal(summarizeTool("subagent", { agent: "explore", description: "find plugin docs" }), "explore: find plugin docs")
})

test("execute falls back to its description or first code line", () => {
  assert.equal(summarizeTool("execute", { description: "批量读取文件" }), "批量读取文件")
  assert.equal(summarizeTool("execute", { code: "\n// 注释\nconst files = await tools.read({})\n" }), "const files = await tools.read({})")
  assert.equal(summarizeTool("execute", { code: "\n// only comments\n" }), undefined)
})

test("unknown tools fall back to a known string field", () => {
  assert.equal(summarizeTool("mystery", { description: "do something" }), "do something")
  assert.equal(summarizeTool("mystery", { nothing: 1 }), undefined)
  assert.equal(summarizeTool("shell", undefined), undefined)
})

test("tool labels fall back to the raw name", () => {
  assert.equal(toolLabel("shell"), "运行")
  assert.equal(toolLabel("mystery"), "mystery")
})

test("clamp collapses whitespace and truncates", () => {
  assert.equal(clamp("a   b\nc", 20), "a b c")
  assert.equal(clamp("abcdefghij", 5), "abcd…")
  assert.equal(clamp("abc", 0), "")
})

test("oneLine truncates only when max is positive", () => {
  assert.equal(oneLine("a   b\nc", 20), "a b c")
  assert.equal(oneLine("abcdefghij", 0), "abcdefghij")
  assert.equal(oneLine("abcdefghij", 5), "abcd…")
  assert.equal(oneLine("abcdefghij", 1), "…")
})

test("firstLine and singleLine", () => {
  assert.equal(firstLine("\n\n  hello world  \nsecond"), "hello world")
  assert.equal(singleLine("  a\t b  "), "a b")
  assert.equal(firstLine("   "), "")
})

test("formatDuration renders readable durations", () => {
  assert.equal(formatDuration(0), "<1s")
  assert.equal(formatDuration(42_000), "42s")
  assert.equal(formatDuration(185_000), "3m05s")
  assert.equal(formatDuration(3_720_000), "1h02m")
  assert.equal(formatDuration(Number.NaN), "")
})
