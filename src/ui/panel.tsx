import { createEffect } from "solid-js"
import type { ActivityState, MessageLike, PanelOptions } from "../types.ts"
import { extractPlan, lastUserText, planVisible } from "../parse/plan.ts"
import { showUnknownHint } from "../state/activity.ts"
import { palette } from "../theme.ts"
import { GoalSection } from "./goal.tsx"
import { ActionSection } from "./action.tsx"
import { PlanSection } from "./plan.tsx"

export interface PanelProps {
  readonly sessionID: string
  readonly options: PanelOptions
  readonly theme: unknown
  readonly activity: (sessionID: string) => ActivityState | undefined
  readonly messages: (sessionID: string) => readonly MessageLike[] | undefined
  readonly title: (sessionID: string) => string | undefined
  readonly running: (sessionID: string) => boolean
  readonly now: () => number
  /** Message id of the plan this session hid by hand, if any. */
  readonly dismissed: (sessionID: string) => string | undefined
  readonly dismiss: (sessionID: string, messageID: string) => void
  /** Idempotent: syncs messages and restores a running activity once per session. */
  readonly ensure: (sessionID: string) => void
  readonly isExpanded: (key: string) => boolean
  readonly toggleExpanded: (key: string) => void
}

/** Sidebar root: 任务 / 当前动作 / 计划. Reads are reactive, never injected into prompts. */
export function Panel(props: PanelProps) {
  createEffect(() => {
    const sessionID = props.sessionID
    if (sessionID) props.ensure(sessionID)
  })

  const messages = () => props.messages(props.sessionID) ?? []
  const plan = () => extractPlan(messages(), props.options.maxPlanItems)
  const visiblePlan = () => {
    const parsed = plan()
    return parsed && planVisible(parsed, props.dismissed(props.sessionID)) ? parsed : undefined
  }
  const request = () => lastUserText(messages(), props.options.goalChars)
  const sessionTitle = () => props.title(props.sessionID)
  const colors = () => palette(props.theme)

  return (
    <box flexDirection="column" gap={0}>
      {props.options.showGoal ? (
        <GoalSection
          title={sessionTitle()}
          request={request()}
          palette={colors()}
          maxChars={props.options.maxChars}
          collapseChars={props.options.collapseChars}
          keyPrefix={`${props.sessionID}:goal`}
          isExpanded={props.isExpanded}
          toggleExpanded={props.toggleExpanded}
        />
      ) : null}
      {props.options.showAction ? (
        <ActionSection
          activity={props.activity(props.sessionID)}
          now={props.now()}
          unknownHint={showUnknownHint(props.activity(props.sessionID), props.running(props.sessionID), props.now())}
          palette={colors()}
          maxChars={props.options.maxChars}
          collapseChars={props.options.collapseChars}
          keyPrefix={`${props.sessionID}:action`}
          isExpanded={props.isExpanded}
          toggleExpanded={props.toggleExpanded}
        />
      ) : null}
      {props.options.showPlan ? (
        <PlanSection
          plan={visiblePlan()}
          onDismiss={() => {
            const parsed = plan()
            if (parsed) props.dismiss(props.sessionID, parsed.messageID)
          }}
          palette={colors()}
          maxChars={props.options.maxChars}
          collapseChars={props.options.collapseChars}
          keyPrefix={`${props.sessionID}:plan:${visiblePlan()?.messageID ?? "none"}`}
          isExpanded={props.isExpanded}
          toggleExpanded={props.toggleExpanded}
        />
      ) : null}
    </box>
  )
}
