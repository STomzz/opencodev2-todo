import { Plugin } from "@opencode/plugin/tui"
import { resolveOptions } from "./options.ts"
import type { ActivityState, EventLike, MessageLike } from "./types.ts"
import { reduceActivity } from "./state/activity.ts"
import { hydrateActivity } from "./state/hydrate.ts"
import { summarizeTool } from "./util/summarize.ts"
import { sessionIDOf, toActivityEvent } from "./util/events.ts"
import { memoryStore, writeStore } from "./storage.ts"
import { Panel } from "./ui/panel.tsx"

/**
 * Sidebar activity panel.
 *
 * CLI-only plugin with zero prompt impact: it never registers tools, hooks or
 * system-prompt injections. It only reads the server event stream, the cached
 * session messages, and renders into `sidebar.content`.
 */
export default Plugin.define({
  id: "activity-panel",
  setup(context) {
    const options = resolveOptions(context.options)
    if (context.options["debug"] === true) {
      context.ui.toast.show({
        title: "activity-panel",
        message: "已加载，见右侧栏「任务 / 当前动作 / 计划」",
        variant: "success",
      })
    }

    // Storage keys must match ^[a-zA-Z0-9][a-zA-Z0-9._-]*$ (no colons), and a
    // rejected key would fail setup; every store is therefore created through a
    // guarded helper so a storage problem can never take the panel down.
    const [activities, updateActivities] = memoryStore(context, "activity-state", {} as Record<string, ActivityState>)
    const [clock, updateClock] = memoryStore(context, "activity-clock", { now: Date.now() })
    const [expanded, updateExpanded] = memoryStore(context, "activity-expanded", {} as Record<string, boolean>)
    const [dismissed, updateDismissed] = memoryStore(context, "activity-dismissed", {} as Record<string, string>)

    const dismissPlan = (sessionID: string, messageID: string) => {
      writeStore([dismissed, updateDismissed], (draft) => {
        draft[sessionID] = messageID
      })
    }

    const ticker = setInterval(() => {
      updateClock((draft) => {
        draft.now = Date.now()
      })
    }, 1_000)

    const stopEvents = context.data.listen(({ details }) => {
      try {
        const event = details as unknown as EventLike
        const sessionID = sessionIDOf(event)
        if (!sessionID) return
        const activityEvent = toActivityEvent(event)
        if (!activityEvent) return
        const previous = activities[sessionID] as ActivityState | undefined
        const next = reduceActivity(previous, activityEvent, Date.now(), summarizeTool)
        updateActivities((draft) => {
          draft[sessionID] = next
        })
      } catch {
        // Never break the host event loop because of a panel bug.
      }
    })

    // After a TUI restart, restore the tool call that is still running.
    const settled = new Set<string>()
    const syncing = new Set<string>()
    const ensure = (sessionID: string) => {
      if (!sessionID || settled.has(sessionID) || syncing.has(sessionID)) return
      syncing.add(sessionID)
      void context.data.session.message
        .sync(sessionID)
        .then(() => {
          const current = activities[sessionID] as ActivityState | undefined
          if (current) return
          const messages = context.data.session.message.list(sessionID) as unknown as MessageLike[]
          const restored = hydrateActivity(messages, Date.now())
          if (!restored) return
          updateActivities((draft) => {
            draft[sessionID] = restored
          })
        })
        .catch(() => undefined)
        .finally(() => {
          syncing.delete(sessionID)
          settled.add(sessionID)
        })
    }

    const stopSlot = context.ui.slot({
      append: "sidebar.content",
      render: (input) => (
        <Panel
          sessionID={input.sessionID}
          options={options}
          theme={context.theme}
          activity={(sessionID) => activities[sessionID] as ActivityState | undefined}
          messages={(sessionID) => context.data.session.message.list(sessionID) as unknown as MessageLike[]}
          title={(sessionID) => context.data.session.get(sessionID)?.title}
          running={(sessionID) => context.data.session.status(sessionID) === "running"}
          now={() => clock.now}
          dismissed={(sessionID) => dismissed[sessionID]}
          dismiss={dismissPlan}
          ensure={ensure}
          isExpanded={(key) => expanded[key] === true}
          toggleExpanded={(key) =>
            updateExpanded((draft) => {
              draft[key] = !(draft[key] === true)
            })
          }
        />
      ),
    })

    return () => {
      stopSlot()
      stopEvents()
      clearInterval(ticker)
    }
  },
})
