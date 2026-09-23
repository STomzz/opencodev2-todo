/**
 * Best-effort plan extraction from assistant text.
 *
 * Heuristics (documented so failures are predictable):
 * - fenced code blocks are ignored
 * - numbered (`1.` / `1)`) and checkbox (`- [x]`) items are strong signals
 * - plain bullets count only when a run has at least three items
 * - a run needs at least two items; the longest run in the message wins
 * - a newer message from the `plan` agent wins over any other message
 * - `tracked` is true when the plan uses check-off syntax, which is the only
 *   case where "current step" is a claim we are allowed to make
 *
 * All pure; unit tested.
 */

import type { MessageLike, Plan, PlanItem } from "../types.ts"

const FENCE = /^\s*(```|~~~)/
const CHECKBOX = /^\s*[-*+]\s+\[([ xX])\]\s+(.+)$/
const NUMBERED = /^\s*\d{1,2}[.)、]\s+(.+)$/
const BULLET = /^\s*[-*+•]\s+(.+)$/
const DONE_MARK = /^(?:✅|☑|✔|✓)\s*(.+)$/
const TODO_MARK = /^(?:⏳|🔄|▶|☐|⬜)\s*(.+)$/

type ItemKind = "checkbox" | "done" | "todo" | "numbered" | "bullet"

interface RawItem extends PlanItem {
  readonly kind: ItemKind
}

/** A parsed list plus whether it uses check-off syntax. */
export interface ParsedList {
  readonly items: readonly PlanItem[]
  readonly tracked: boolean
}

/** Kinds that mean the author intends to keep progress up to date. */
const TRACKED_KINDS: ReadonlySet<ItemKind> = new Set(["checkbox", "done", "todo"])

function matchItem(line: string): RawItem | undefined {
  const checkbox = CHECKBOX.exec(line)
  if (checkbox) {
    return { text: checkbox[2]!.trim(), done: checkbox[1]!.toLowerCase() === "x", kind: "checkbox" }
  }

  const trimmed = line.trim()
  const done = DONE_MARK.exec(trimmed)
  if (done) return { text: done[1]!.trim(), done: true, kind: "done" }

  const todo = TODO_MARK.exec(trimmed)
  if (todo) return { text: todo[1]!.trim(), done: false, kind: "todo" }

  const numbered = NUMBERED.exec(line)
  if (numbered) return { text: numbered[1]!.trim(), done: false, kind: "numbered" }

  const bullet = BULLET.exec(line)
  if (bullet) return { text: bullet[1]!.trim(), done: false, kind: "bullet" }

  return undefined
}

/** Parses the best plan-like list out of one message text. */
export function parsePlanList(text: string, maxItems: number): ParsedList | undefined {
  const runs: RawItem[][] = []
  let run: RawItem[] | undefined
  let inFence = false

  for (const raw of text.split(/\r?\n/)) {
    if (FENCE.test(raw)) {
      inFence = !inFence
      continue
    }
    if (inFence) continue
    if (raw.trim().length === 0) continue

    const item = matchItem(raw)
    if (item) {
      if (!run) {
        run = []
        runs.push(run)
      }
      run.push(item)
      continue
    }

    // Indented continuation of the previous item (e.g. wrapped description).
    if (run && run.length > 0 && /^\s{2,}\S/.test(raw)) {
      const last = run[run.length - 1]!
      run[run.length - 1] = { ...last, text: `${last.text} ${raw.trim()}` }
      continue
    }

    run = undefined
  }

  let best: RawItem[] | undefined
  for (const candidate of runs) {
    if (candidate.length < 2) continue
    const hasStrong = candidate.some((item) => item.kind !== "bullet")
    if (!hasStrong && candidate.length < 3) continue
    if (!best || candidate.length > best.length) best = candidate
  }
  if (!best) return undefined

  return {
    items: best.slice(0, Math.max(1, maxItems)).map(({ text: itemText, done }) => ({ text: itemText, done })),
    tracked: best.some((item) => TRACKED_KINDS.has(item.kind)),
  }
}

function messageText(message: MessageLike): string {
  const parts = message.content ?? []
  return parts
    .filter((part) => part.type === "text" && typeof part.text === "string")
    .map((part) => part.text ?? "")
    .join("\n")
}

function hash(value: string): number {
  let result = 5381
  for (let index = 0; index < value.length; index++) {
    result = ((result << 5) + result + value.charCodeAt(index)) | 0
  }
  return result
}

interface CacheEntry {
  readonly length: number
  readonly digest: number
  readonly parsed?: ParsedList
}

const cache = new Map<string, CacheEntry>()
const CACHE_LIMIT = 256

function listFor(message: MessageLike, maxItems: number): ParsedList | undefined {
  const text = messageText(message)
  const key = `${message.id}:${maxItems}`
  const length = text.length
  const digest = hash(text)
  const cached = cache.get(key)
  if (cached && cached.length === length && cached.digest === digest) return cached.parsed

  const parsed = parsePlanList(text, maxItems)
  if (cache.size >= CACHE_LIMIT) cache.clear()
  cache.set(key, { length, digest, parsed })
  return parsed
}

/** Finds the most relevant plan across the message list (newest first). */
export function extractPlan(messages: readonly MessageLike[], maxItems: number): Plan | undefined {
  let latestAssistantID: string | undefined
  for (let index = messages.length - 1; index >= 0; index--) {
    const message = messages[index]
    if (message?.type === "assistant") {
      latestAssistantID = message.id
      break
    }
  }

  for (let pass = 0; pass < 2; pass++) {
    for (let index = messages.length - 1; index >= 0; index--) {
      const message = messages[index]
      if (!message || message.type !== "assistant") continue
      const fromPlanAgent = message.agent === "plan"
      if (pass === 0 && !fromPlanAgent) continue
      const parsed = listFor(message, maxItems)
      if (!parsed) continue
      let userMessagesAfter = 0
      for (let next = index + 1; next < messages.length; next++) {
        if (messages[next]?.type === "user") userMessagesAfter++
      }
      const items = parsed.items
      const currentIndex = parsed.tracked ? items.findIndex((item) => !item.done) : -1
      return {
        items,
        messageID: message.id,
        fromPlanAgent,
        fromLatestAssistant: message.id === latestAssistantID,
        tracked: parsed.tracked,
        userMessagesAfter,
        source: "text",
        currentIndex,
      }
    }
  }
  return undefined
}

/** How many newer user messages mean the plan belongs to an older task. */
export const SUPERSEDED_USER_MESSAGES = 2

/**
 * A plain list (no check-off syntax) stops being "the current plan" once the
 * user has moved on to other requests. Tracked plans — including real
 * `todowrite` todos, which the model keeps up to date — always stay.
 */
export function isSuperseded(plan: Plan): boolean {
  return !plan.tracked && plan.userMessagesAfter >= SUPERSEDED_USER_MESSAGES
}

/** Whether the section should render at all: not superseded, not dismissed by hand. */
export function planVisible(plan: Plan, dismissedID: string | undefined): boolean {
  return !isSuperseded(plan) && plan.messageID !== dismissedID
}

/** Progress of a tracked plan; `complete` means there is nothing left to list. */
export function planProgress(plan: Plan): { done: number; total: number; complete: boolean } {
  const done = plan.items.filter((item) => item.done).length
  return { done, total: plan.items.length, complete: plan.tracked && done === plan.items.length }
}

/** Section header: says where the plan came from and how far along it is. */
export function planTitle(plan: Plan): string {
  if (plan.tracked) {
    const { done, total } = planProgress(plan)
    return plan.source === "todo" ? `待办 ${done}/${total}` : `计划 ${done}/${total}`
  }
  if (!plan.fromLatestAssistant) return "计划（可能过时）"
  return "计划"
}

/** Newest user message text, single-line and truncated. */
export function lastUserText(messages: readonly MessageLike[], maxChars: number): string | undefined {
  for (let index = messages.length - 1; index >= 0; index--) {
    const message = messages[index]
    if (!message || message.type !== "user") continue
    const text = (message.text ?? "").replace(/\s+/g, " ").trim()
    if (text.length === 0) continue
    if (maxChars <= 0) return text
    return text.length <= maxChars ? text : `${text.slice(0, maxChars - 1).trimEnd()}…`
  }
  return undefined
}
