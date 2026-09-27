/**
 * Dot-matrix animation shown between the action block and the plan block.
 *
 * While the session works, a trail of lit dots orbits an infinity glyph; once
 * the turn has finished, the dots settle into a bold check. Geometry and frame
 * selection are pure and unit tested; the Solid component only colors rows.
 *
 * Both glyphs are drawn in a 14x4 character grid. Rows are returned at full
 * width (padded, never trimmed) so centering the block cannot misalign them.
 */

/** Grid height of both glyphs: the block occupies exactly four lines. */
export const DOT_HEIGHT = 4
/** Grid width rows are padded to; both glyphs are centered inside it. */
export const DOT_WIDTH = 14
/** Number of lit dots orbiting the infinity path. */
export const DOT_TRAIL = 3
/** Faint dot of the running glyph. */
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

function renderGlyph(cells: readonly DotCell[], lit: ReadonlySet<number>, width: number): readonly string[] {
  const glyphWidth = Math.max(...cells.map((cell) => cell.x)) + 1
  const offset = Math.max(0, Math.round((width - glyphWidth) / 2))
  const grid: string[][] = Array.from({ length: DOT_HEIGHT }, () => Array.from({ length: width }, () => " "))

  for (let index = 0; index < cells.length; index++) {
    const cell = cells[index]
    const x = cell.x + offset
    if (x < 0 || x >= width || cell.y < 0 || cell.y >= DOT_HEIGHT) continue
    grid[cell.y][x] = lit.has(index) ? DOT_LIT : DOT_FAINT
  }
  return grid.map((row) => row.join(""))
}

/** Four rows of the running glyph: faint infinity plus the lit orbit trail. */
export function runningRows(tick: number, width = DOT_WIDTH): readonly string[] {
  return renderGlyph(INFINITY_PATH, new Set(trailIndices(tick)), width)
}

/** Four rows of the finished glyph: the bold check, every dot lit. */
export function doneRows(width = DOT_WIDTH): readonly string[] {
  return renderGlyph(CHECK_PATH, new Set(CHECK_PATH.map((_, index) => index)), width)
}

export type DotMatrixState = "running" | "done" | "hidden"

/**
 * Which glyph a session shows.
 *
 * An undefined activity means the session never ran in this TUI generation
 * (hide rather than claim anything). A running session, or one whose activity
 * is not `idle`, is working; an `idle` activity that exists has finished.
 */
export function dotMatrixState(kind: string | undefined, sessionRunning: boolean): DotMatrixState {
  if (kind === undefined) return sessionRunning ? "running" : "hidden"
  if (sessionRunning || kind !== "idle") return "running"
  return "done"
}
