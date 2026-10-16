/**
 * Dot-matrix animation shown between the action block and the plan block.
 *
 * Three states:
 * - this session works -> a trail of lit dots orbits one infinity glyph;
 * - this session idles while the rest of its session family still runs (a
 *   subagent / delegated task) -> two infinitities, half a loop out of step;
 * - the whole family stopped -> the dots settle into a bold check.
 *
 * Geometry and frame selection are pure and unit tested; the Solid component
 * only colors rows. Rows are returned at full width (padded, never trimmed) so
 * centering a block cannot misalign it.
 */

/** Grid height of every glyph: the block occupies exactly four lines. */
export const DOT_HEIGHT = 4
/** Grid width of the single-infinity glyph and of the check. */
export const DOT_WIDTH = 14
/** Grid width of the two-infinity glyph (11 + 2 gap + 11). */
export const DOT_WIDTH_DOUBLE = 24
/** Empty columns between the two infinitities of the delegated glyph. */
const GLYPH_GAP = 2
/** Number of lit dots orbiting each infinity path. */
export const DOT_TRAIL = 3
/** Faint dot of a running glyph. */
export const DOT_FAINT = "·"
/** Lit dot (orbit trail and the finished check). */
export const DOT_LIT = "●"

export interface DotCell {
  readonly x: number
  readonly y: number
}

/**
 * Infinity path in pen order, 16 dots (11 wide):
 * left loop counterclockwise (top -> left -> bottom), a diagonal weave up to
 * the right loop's top, right loop clockwise (top -> right -> bottom), then the
 * mirrored weave back. The weaves cross like a real pen stroke, so the trail
 * goes lower-left -> upper-right and lower-right -> upper-left.
 */
export const INFINITY_PATH: readonly DotCell[] = [
  { x: 3, y: 0 },
  { x: 2, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: 2 },
  { x: 2, y: 3 },
  { x: 3, y: 3 },
  { x: 5, y: 2 },
  { x: 6, y: 1 },
  { x: 7, y: 0 },
  { x: 8, y: 0 },
  { x: 10, y: 1 },
  { x: 10, y: 2 },
  { x: 8, y: 3 },
  { x: 7, y: 3 },
  { x: 6, y: 2 },
  { x: 5, y: 1 },
]

/** Bold check, two strokes with double thickness, 16 dots (14 wide). */
export const CHECK_PATH: readonly DotCell[] = [
  { x: 1, y: 0 },
  { x: 2, y: 0 },
  { x: 2, y: 1 },
  { x: 3, y: 1 },
  { x: 3, y: 2 },
  { x: 4, y: 2 },
  { x: 4, y: 3 },
  { x: 5, y: 3 },
  { x: 6, y: 3 },
  { x: 7, y: 2 },
  { x: 8, y: 2 },
  { x: 9, y: 1 },
  { x: 10, y: 1 },
  { x: 11, y: 0 },
  { x: 12, y: 0 },
  { x: 13, y: 0 },
]

/**
 * Path indices lit at `tick`: the head plus the dots trailing behind it.
 * Wraps around the loop, so any integer tick is valid.
 */
export function trailIndices(tick: number, length = INFINITY_PATH.length, trail = DOT_TRAIL): readonly number[] {
  const indices: number[] = []
  for (let step = 0; step < trail; step++) {
    indices.push((((tick - step) % length) + length) % length)
  }
  return indices
}

/** The glyph at its natural width, no padding: `[y][x]` of markers. */
function glyphGrid(cells: readonly DotCell[], lit: ReadonlySet<number>): string[][] {
  const width = Math.max(...cells.map((cell) => cell.x)) + 1
  const grid: string[][] = Array.from({ length: DOT_HEIGHT }, () => Array.from({ length: width }, () => " "))
  for (let index = 0; index < cells.length; index++) {
    const cell = cells[index]
    if (cell.x < 0 || cell.x >= width || cell.y < 0 || cell.y >= DOT_HEIGHT) continue
    grid[cell.y][cell.x] = lit.has(index) ? DOT_LIT : DOT_FAINT
  }
  return grid
}

/** Glues one or two grids side by side, `gap` blank columns apart. */
function stitch(grids: readonly string[][][], gap: number): string[] {
  const rows = Math.max(...grids.map((grid) => grid.length))
  return Array.from({ length: rows }, (_, index) => {
    const spacer = Array.from({ length: gap }, () => " ")
    return grids
      .map((grid, position) => (position === 0 ? [] : spacer).concat(grid[index] ?? []))
      .reduce((all, cells) => all.concat(cells), [] as string[])
      .join("")
  })
}

/**
 * Centers rows inside `width`, padding both sides and never trimming. Keeping
 * every row of a frame the same width is what lets the renderer center the
 * block without shearing the glyph.
 */
function centerRows(rows: readonly string[], width: number): readonly string[] {
  const content = rows.reduce((max, row) => Math.max(max, row.length), 0)
  if (content >= width) return rows.map((row) => row.slice(0, width).padEnd(width, " "))
  const padding = " ".repeat(Math.round((width - content) / 2))
  return rows.map((row) => (padding + row).padEnd(width, " "))
}

function infinityGrid(tick: number): string[][] {
  return glyphGrid(INFINITY_PATH, new Set(trailIndices(tick)))
}

/** Four rows of the running glyph: faint infinity plus the lit orbit trail. */
export function runningRows(tick: number, width = DOT_WIDTH): readonly string[] {
  return centerRows(stitch([infinityGrid(tick)], GLYPH_GAP), width)
}

/**
 * Four rows for a session that is idle while its family still works: two
 * infinitities half a loop apart, so they read as two separate workers rather
 * than one glyph redrawn.
 */
export function waitingRows(tick: number, width = DOT_WIDTH_DOUBLE): readonly string[] {
  const half = Math.floor(INFINITY_PATH.length / 2)
  return centerRows(stitch([infinityGrid(tick), infinityGrid(tick + half)], GLYPH_GAP), width)
}

/** Four rows of the finished glyph: the bold check, every dot lit. */
export function doneRows(width = DOT_WIDTH): readonly string[] {
  return centerRows(stitch([glyphGrid(CHECK_PATH, new Set(CHECK_PATH.map((_, index) => index)))], GLYPH_GAP), width)
}

export type DotMatrixState = "running" | "waiting" | "done" | "hidden"

/**
 * Which glyph a session shows.
 *
 * - this session is running, or its activity is not `idle` -> `running`;
 * - otherwise, if anything else in its session family is still running (a
 *   delegated subagent), the turn is not over -> `waiting`;
 * - an undefined activity means the session never ran in this TUI generation,
 *   so hide rather than claim anything;
 * - an `idle` activity that exists has finished -> `done`.
 *
 * `familyBusy` defaults to `running`, which reproduces the single-session
 * behaviour when the caller has no family information.
 */
export function dotMatrixState(
  kind: string | undefined,
  running: boolean,
  familyBusy: boolean = running,
): DotMatrixState {
  if (running || (kind !== undefined && kind !== "idle")) return "running"
  if (familyBusy) return "waiting"
  if (kind === undefined) return "hidden"
  return "done"
}
