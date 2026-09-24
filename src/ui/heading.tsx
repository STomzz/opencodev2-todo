import type { Palette } from "../theme.ts"

/**
 * Header marker for panel sections, with one space on each side (` o 任务`).
 *
 * Plain labels blurred together with the content under them (the session title
 * sits right below "任务"), so every section header carries this marker. ASCII
 * only: fancy box glyphs can render as tofu in some terminal fonts.
 */
export const SECTION_MARK = " o "

export interface SectionHeadingProps {
  /** Section label without the marker, e.g. `任务`. */
  readonly label: string
  /** Optional muted suffix, e.g. the plan header's `[隐藏]`. */
  readonly suffix?: string
  readonly palette: Palette
  /** Makes the whole header clickable (used by the plan block). */
  readonly onMouseDown?: () => void
}

/** One header line: ` o 标签  [后缀]`. */
export function SectionHeading(props: SectionHeadingProps) {
  const text = () => `${SECTION_MARK}${props.label}${props.suffix ? `  ${props.suffix}` : ""}`
  return (
    <text fg={props.palette.muted} onMouseDown={props.onMouseDown}>
      {text()}
    </text>
  )
}
