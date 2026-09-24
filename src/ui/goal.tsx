import type { Palette } from "../theme.ts"
import { CollapsibleLine } from "./line.tsx"
import { SectionHeading } from "./heading.tsx"

export interface GoalSectionProps {
  readonly title?: string
  readonly request?: string
  readonly palette: Palette
  readonly maxChars: number
  readonly collapseChars: number
  readonly keyPrefix: string
  readonly isExpanded: (key: string) => boolean
  readonly toggleExpanded: (key: string) => void
}

/** "任务" block: session title plus the newest user request. */
export function GoalSection(props: GoalSectionProps) {
  const heading = () => {
    const title = props.title?.trim()
    if (title) return title
    return props.request ?? "（新会话）"
  }
  const request = () => {
    const value = props.request
    if (!value) return undefined
    return value === heading() ? undefined : value
  }
  const key = (suffix: string) => `${props.keyPrefix}:${suffix}`
  return (
    <box flexDirection="column">
      <SectionHeading label="任务" palette={props.palette} />
      <CollapsibleLine
        text={heading()}
        color={props.palette.base}
        collapseChars={props.collapseChars}
        maxChars={props.maxChars}
        expanded={props.isExpanded(key("title"))}
        onToggle={() => props.toggleExpanded(key("title"))}
      />
      {request() ? (
        <CollapsibleLine
          text={request() ?? ""}
          color={props.palette.muted}
          collapseChars={props.collapseChars}
          maxChars={props.maxChars}
          expanded={props.isExpanded(key("request"))}
          onToggle={() => props.toggleExpanded(key("request"))}
        />
      ) : null}
    </box>
  )
}
