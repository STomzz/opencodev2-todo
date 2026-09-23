import type { ActivityState } from "../types.ts"
import type { Palette } from "../theme.ts"
import { toolLabel } from "../util/summarize.ts"
import { formatDuration, oneLine } from "../util/text.ts"
import { CollapsibleLine } from "./line.tsx"

export interface ActionSectionProps {
  readonly activity: ActivityState | undefined
  readonly now: number
  /** Session status is `running` while we have no live activity for it. */
  readonly unknownHint: boolean
  readonly palette: Palette
  /** Hard cap applied even when expanded. 0 = unlimited. */
  readonly maxChars: number
  readonly collapseChars: number
  readonly keyPrefix: string
  readonly isExpanded: (key: string) => boolean
  readonly toggleExpanded: (key: string) => void
}

/** "当前动作" block: what the session is doing right now, plus the last tool. */
export function ActionSection(props: ActionSectionProps) {
  const line = () => {
    const activity = props.activity
    if (!activity || activity.kind === "idle") return undefined
    const label =
      activity.kind === "thinking"
        ? "思考中"
        : activity.kind === "writing"
          ? "生成回复"
          : toolLabel(activity.toolName ?? "tool")
    const detail = activity.detail ? `: ${activity.detail}` : ""
    const step = activity.step > 0 ? `第${activity.step}步 ` : ""
    return `▶ ${step}${label}${detail}`
  }

  const elapsed = () => {
    const activity = props.activity
    if (!activity || activity.kind === "idle" || activity.startedAt === undefined) return ""
    return formatDuration(props.now - activity.startedAt)
  }

  const current = () => {
    const text = line()
    if (!text) return undefined
    const time = elapsed()
    if (!time) return text
    return `${text} · ${time}`
  }

  const last = () => {
    const tool = props.activity?.lastTool
    if (!tool) return undefined
    const detail = tool.detail ? `: ${tool.detail}` : ""
    const duration = tool.durationMs !== undefined ? formatDuration(tool.durationMs) : ""
    const suffix = duration ? ` · ${duration}` : ""
    const icon = tool.ok ? "✓" : "✗"
    return `${icon} ${toolLabel(tool.name)}${detail}${suffix}`
  }

  const key = (suffix: string) => `${props.keyPrefix}:${suffix}`

  return (
    <box flexDirection="column">
      <text fg={props.palette.muted}>当前动作</text>
      {props.unknownHint ? (
        <text fg={props.palette.warning} wrapMode="word">
          ? 运行中（未识别事件）
        </text>
      ) : current() ? (
        <CollapsibleLine
          text={current() ?? ""}
          color={props.palette.accent}
          collapseChars={props.collapseChars}
          maxChars={props.maxChars}
          expanded={props.isExpanded(key("current"))}
          onToggle={() => props.toggleExpanded(key("current"))}
        />
      ) : (
        <text fg={props.palette.muted} wrapMode="word">
          {oneLine("空闲", props.maxChars)}
        </text>
      )}
      {last() ? (
        <CollapsibleLine
          text={last() ?? ""}
          color={props.activity?.lastTool?.ok ? props.palette.success : props.palette.error}
          collapseChars={props.collapseChars}
          maxChars={props.maxChars}
          expanded={props.isExpanded(key("last"))}
          onToggle={() => props.toggleExpanded(key("last"))}
        />
      ) : null}
    </box>
  )
}
