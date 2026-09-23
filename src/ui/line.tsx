import type { ColorToken } from "../theme.ts"
import { collapseInfo } from "../util/collapse.ts"

export interface CollapsibleLineProps {
  readonly text: string
  readonly color: ColorToken | undefined
  /** Longest text shown inline; longer text collapses to one clickable line. 0 = never collapse. */
  readonly collapseChars: number
  /** Hard cap applied even when expanded. 0 = unlimited. */
  readonly maxChars: number
  readonly expanded: boolean
  readonly onToggle: () => void
}

/**
 * One text line that collapses when it gets long.
 *
 * Collapsed: clipped to a single line (`height=1` + `overflow=hidden`) with an
 * ellipsis. Expanded: wraps to the container width. Either way the whole line
 * stays clickable so the same click expands and collapses it again.
 */
export function CollapsibleLine(props: CollapsibleLineProps) {
  const info = () => collapseInfo(props.text, props.collapseChars, props.maxChars, props.expanded)

  return (
    <text
      fg={props.color}
      wrapMode="word"
      height={info().collapsed ? 1 : "auto"}
      overflow={info().collapsed ? "hidden" : "visible"}
      onMouseDown={info().collapsible ? props.onToggle : undefined}
    >
      {info().body}
    </text>
  )
}
