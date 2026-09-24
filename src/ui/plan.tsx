import type { Plan } from "../types.ts"
import type { Palette } from "../theme.ts"
import { planMarker, planProgress, planTitle } from "../parse/plan.ts"
import { CollapsibleLine } from "./line.tsx"
import { SectionHeading } from "./heading.tsx"

export interface PlanSectionProps {
  readonly plan: Plan | undefined
  /** Hides this plan (by message id) until a newer plan appears. */
  readonly onDismiss: () => void
  readonly palette: Palette
  /** Hard cap applied even when expanded. 0 = unlimited. */
  readonly maxChars: number
  readonly collapseChars: number
  readonly keyPrefix: string
  readonly isExpanded: (key: string) => boolean
  readonly toggleExpanded: (key: string) => void
}

/**
 * "计划" block: parsed checklist with ASCII markers (`[ ]` / `[>]` / `[✓]` / `[-]`).
 *
 * - `待办 x/y` is the model's own `todowrite` list: real statuses that move
 *   while it works
 * - `[-]` marks a cancelled todo: it keeps its place but is never "current"
 * - `计划 x/y` is a text heuristic with check-off syntax; a current-step marker
 *   is only shown for tracked plans, because a plain numbered list never
 *   reports progress and claiming a current step would usually be wrong
 * - fully checked plans keep the header only (nothing left to list)
 * - clicking the header hides the plan until a newer one appears
 */
export function PlanSection(props: PlanSectionProps) {
  const items = () => props.plan?.items ?? []
  const currentIndex = () => props.plan?.currentIndex ?? -1
  const complete = () => (props.plan ? planProgress(props.plan).complete : false)

  return (
    <box flexDirection="column">
      {props.plan && items().length > 0 ? (
        <box flexDirection="column">
          <SectionHeading
            label={planTitle(props.plan)}
            suffix="[隐藏]"
            palette={props.palette}
            onMouseDown={() => props.onDismiss()}
          />
          {complete()
            ? null
            : items().map((item, index) => {
                const current = !item.done && !item.cancelled && index === currentIndex()
                const marker = planMarker(item, current)
                const color =
                  item.done || item.cancelled
                    ? props.palette.muted
                    : current
                      ? props.palette.accent
                      : props.palette.base
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
