import type { Plan } from "../types.ts"
import type { Palette } from "../theme.ts"
import { currentStepIndex, planTitle } from "../parse/plan.ts"
import { CollapsibleLine } from "./line.tsx"

export interface PlanSectionProps {
  readonly plan: Plan | undefined
  /** The plan came from the durable snapshot, not from the current message cache. */
  readonly fromSnapshot: boolean
  readonly palette: Palette
  /** Hard cap applied even when expanded. 0 = unlimited. */
  readonly maxChars: number
  readonly collapseChars: number
  readonly keyPrefix: string
  readonly isExpanded: (key: string) => boolean
  readonly toggleExpanded: (key: string) => void
}

/**
 * "计划" block: parsed checklist with ASCII markers (`[ ]` / `[>]` / `[✓]`).
 *
 * A current-step marker is only shown for tracked plans (checkbox / ✅ style):
 * for a plain numbered list the model never reports progress, so claiming a
 * current step would be wrong most of the time.
 */
export function PlanSection(props: PlanSectionProps) {
  const items = () => props.plan?.items ?? []
  const currentIndex = () => (props.plan ? currentStepIndex(props.plan) : -1)

  return (
    <box flexDirection="column">
      {props.plan && items().length > 0 ? (
        <box flexDirection="column">
          <text fg={props.palette.muted}>{planTitle(props.plan, props.fromSnapshot)}</text>
          {items().map((item, index) => {
            const current = !item.done && index === currentIndex()
            const marker = item.done ? "[✓]" : current ? "[>]" : "[ ]"
            const color = item.done ? props.palette.muted : current ? props.palette.accent : props.palette.base
            const key = `${props.keyPrefix}:item:${index}`
            return (
              <CollapsibleLine
                text={`${marker} ${index + 1}. ${item.text}`}
                color={color}
                collapseChars={props.collapseChars}
                maxChars={props.maxChars}
                expanded={props.isExpanded(key)}
                onToggle={() => props.toggleExpanded(key)}
              />
            )
          })}
        </box>
      ) : null}
    </box>
  )
}
