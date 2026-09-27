import { For } from "solid-js"
import type { Palette } from "../theme.ts"
import { DOT_FAINT, DOT_LIT, doneRows, dotMatrixState, runningRows } from "../parse/dotmatrix.ts"

export interface DotMatrixProps {
  /** Activity kind of the session; `undefined` means it never ran in this TUI. */
  readonly kind: string | undefined
  readonly running: boolean
  /** Animation frame; only advances while a session is busy. */
  readonly tick: number
  readonly palette: Palette
  /** `.` / `o` instead of `·` / `●` for terminals that lack the glyphs. */
  readonly ascii: boolean
}

interface DotSegment {
  readonly text: string
  readonly lit: boolean
}

/** Splits a rendered row into runs so lit dots can take a brighter color. */
function segments(row: string, litChar: string): readonly DotSegment[] {
  const out: DotSegment[] = []
  for (const char of row) {
    const lit = char === litChar
    const last = out[out.length - 1]
    if (last && last.lit === lit) out[out.length - 1] = { text: last.text + char, lit }
    else out.push({ text: char, lit })
  }
  return out
}

/**
 * Four-line dot-matrix animation above the plan block: a lit trail orbits an
 * infinity while the session works, then the dots settle into a bold check.
 *
 * Read-only and text-only, like the rest of the panel: it renders activity the
 * plugin already has and never injects anything into the prompt.
 */
export function DotMatrix(props: DotMatrixProps) {
  const state = () => dotMatrixState(props.kind, props.running)
  const ascii = () => props.ascii
  const litChar = () => (ascii() ? "o" : DOT_LIT)
  const litColor = () => (state() === "done" ? props.palette.success : props.palette.accent)

  const rows = () => {
    const current = state()
    if (current === "hidden") return []
    const source = current === "running" ? runningRows(props.tick) : doneRows()
    if (!ascii()) return source
    return source.map((row) => row.replaceAll(DOT_FAINT, ".").replaceAll(DOT_LIT, "o"))
  }

  return (
    <box flexDirection="column" alignItems="center">
      <For each={rows()}>
        {(row) => (
          <box flexDirection="row">
            <For each={segments(row, litChar())}>
              {(segment) => <text fg={segment.lit ? litColor() : props.palette.muted}>{segment.text}</text>}
            </For>
          </box>
        )}
      </For>
    </box>
  )
}
