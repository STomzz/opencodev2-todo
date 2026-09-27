import assert from "node:assert/strict"
import { test } from "node:test"
import {
  CHECK_PATH,
  DOT_HEIGHT,
  DOT_LIT,
  DOT_TRAIL,
  DOT_WIDTH,
  INFINITY_PATH,
  doneRows,
  dotMatrixState,
  runningRows,
  trailIndices,
} from "../src/parse/dotmatrix.ts"

const cells = (rows: readonly string[]): string => rows.join("")
const count = (row: string, char: string): number => [...row].filter((value) => value === char).length

test("infinity path is a closed 16-dot loop inside its grid", () => {
  assert.equal(INFINITY_PATH.length, 16)
  assert.equal(new Set(INFINITY_PATH.map((cell) => `${cell.x},${cell.y}`)).size, 16)
  for (const cell of INFINITY_PATH) {
    assert.ok(cell.x >= 0 && cell.x <= 10, `x out of range: ${cell.x}`)
    assert.ok(cell.y >= 0 && cell.y < DOT_HEIGHT, `y out of range: ${cell.y}`)
  }
  // Neighbouring dots (including the wrap) stay within one diagonal hop.
  for (let index = 0; index < INFINITY_PATH.length; index++) {
    const current = INFINITY_PATH[index]
    const next = INFINITY_PATH[(index + 1) % INFINITY_PATH.length]
    const step = Math.abs(current.x - next.x) + Math.abs(current.y - next.y)
    assert.ok(step <= 3, `step ${index} jumps ${step}`)
  }
})

test("weaves cross like a pen: lower-left to upper-right and back", () => {
  const left = INFINITY_PATH.findIndex((cell) => cell.x === 3 && cell.y === 3)
  assert.deepEqual(INFINITY_PATH.slice(left + 1, left + 3), [
    { x: 5, y: 2 },
    { x: 6, y: 1 },
  ])
  const right = INFINITY_PATH.findIndex((cell) => cell.x === 7 && cell.y === 3)
  assert.deepEqual(INFINITY_PATH.slice(right + 1, right + 3), [
    { x: 6, y: 2 },
    { x: 5, y: 1 },
  ])
})

test("trailIndices wraps and keeps the trail behind the head", () => {
  assert.deepEqual(trailIndices(0), [0, 15, 14])
  assert.deepEqual(trailIndices(17), trailIndices(1))
  assert.equal(trailIndices(5).length, DOT_TRAIL)
})

test("runningRows draws four padded rows with a lit trail", () => {
  const rows = runningRows(0)
  assert.equal(rows.length, DOT_HEIGHT)
  for (const row of rows) assert.equal(row.length, DOT_WIDTH)

  const joined = cells(rows)
  assert.equal(count(joined, DOT_LIT), DOT_TRAIL)
  assert.equal(count(joined, "·"), INFINITY_PATH.length - DOT_TRAIL)

  // The glyph is centered inside the padded width (offset of two).
  const offset = Math.round((DOT_WIDTH - 11) / 2)
  for (const row of rows) {
    assert.equal(count(row.slice(0, offset), "·"), 0)
  }
})

test("runningRows advances with the tick", () => {
  assert.notDeepEqual(runningRows(0), runningRows(1))
  assert.deepEqual(runningRows(0), runningRows(INFINITY_PATH.length))
})

test("doneRows draws the bold check, all dots lit", () => {
  const rows = doneRows()
  assert.equal(rows.length, DOT_HEIGHT)
  for (const row of rows) assert.equal(row.length, DOT_WIDTH)
  assert.equal(count(cells(rows), DOT_LIT), CHECK_PATH.length)
  assert.equal(count(cells(rows), "·"), 0)
})

test("dotMatrixState hides, orbits, or checks based on the activity", () => {
  assert.equal(dotMatrixState(undefined, false), "hidden")
  assert.equal(dotMatrixState(undefined, true), "running")
  assert.equal(dotMatrixState("idle", true), "running")
  assert.equal(dotMatrixState("idle", false), "done")
  assert.equal(dotMatrixState("thinking", false), "running")
  assert.equal(dotMatrixState("writing", false), "running")
  assert.equal(dotMatrixState("tool", false), "running")
})
