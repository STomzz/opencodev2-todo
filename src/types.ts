/** Shared types for the activity panel. Pure data, no runtime dependencies. */

/** What the session is doing right now. */
export type ActivityKind = "idle" | "thinking" | "writing" | "tool"

/** A tool call that already finished, shown as "last action". */
export interface FinishedTool {
  readonly name: string
  readonly detail?: string
  readonly ok: boolean
  readonly durationMs?: number
}

/** Live activity of one session. */
export interface ActivityState {
  readonly kind: ActivityKind
  readonly toolName?: string
  readonly detail?: string
  /** Epoch milliseconds when the current activity started (survives TUI restarts). */
  readonly startedAt?: number
  /** Epoch milliseconds of the last recognized event; used to detect silent breakage. */
  readonly updatedAt: number
  /** Step number inside the current execution, 0 when unknown. */
  readonly step: number
  /** Last finished tool call. */
  readonly lastTool?: FinishedTool
  /** Tool names by call id, for correlating called/finished events. */
  readonly names: Readonly<Record<string, string>>
}

/** One parsed plan step. */
export interface PlanItem {
  readonly text: string
  readonly done: boolean
}

/** A plan parsed from an assistant message. */
export interface Plan {
  readonly items: readonly PlanItem[]
  readonly messageID: string
  readonly fromPlanAgent: boolean
  /** The source message is the newest assistant message. */
  readonly fromLatestAssistant: boolean
  /** The plan uses check-off syntax (checkbox / ✅ / ☑), so a "current step" is meaningful. */
  readonly tracked: boolean
  /** User messages sent after the plan; a rising count means the plan belongs to an older task. */
  readonly userMessagesAfter: number
}

/** Resolved plugin options. */
export interface PanelOptions {
  /** Hard cap applied even when expanded. 0 = unlimited. */
  readonly maxChars: number
  readonly goalChars: number
  readonly maxPlanItems: number
  /** Text longer than this collapses to one clickable line. 0 = never collapse. */
  readonly collapseChars: number
  readonly showGoal: boolean
  readonly showAction: boolean
  readonly showPlan: boolean
}

/**
 * Structural view of a session message.
 *
 * Kept independent from `@opencode/client` so the parsing/state modules stay
 * pure and runnable under `node --test`.
 */
export interface ContentPart {
  readonly type: string
  readonly text?: string
}

export interface MessageLike {
  readonly id: string
  readonly type: string
  readonly agent?: string
  readonly text?: string
  readonly content?: readonly ContentPart[]
}

/** Structural view of a server event (only the fields this plugin reads). */
export interface EventLike {
  readonly type: string
  readonly created?: number
  readonly data?: Record<string, unknown>
}
