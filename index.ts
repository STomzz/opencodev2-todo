/**
 * Server-side plugin: restores V1's `todowrite` tool on OpenCode V2.
 *
 * V2 ships no todo tool, so the model has nothing to record real progress with
 * (calls to `todowrite` fail with `No tool named "todowrite" is currently
 * available`). Registering the same tool name, description and parameters V1
 * used closes that gap for both the model and the activity panel.
 *
 * Registered as a **direct** tool (`codemode: false`). V2 splits plugin tools
 * into two disjoint sets: `codemode: false` tools reach the model like built-ins,
 * while everything else (`true` or unset) is only reachable from inside
 * `execute`'s Code Mode catalog. Models here call `todowrite` as an ordinary
 * tool call — the workspace AGENTS.md tells them to track multi-step work with
 * it — so a catalog-only registration made every one of those calls fail with
 * `No tool named "todowrite" is currently available` (24 recorded failures
 * 2026-09-22..2026-10-16, zero successful direct calls). As a direct tool it
 * appears in the model's tool list, the call is recorded as a top-level
 * `todowrite` part, and the panel reads the list from that part's `state.input`.
 *
 * Load it from `plugins` in `opencode.json(c)` (a server plugin, unlike the
 * panel which is a CLI plugin in `cli.json`):
 *
 *   { "plugins": [{ "package": "/path/to/opencode-activity-panel" }] }
 *
 * and allow the tool once so each call does not ask for permission:
 *
 *   { "permissions": [{ "action": "todowrite", "resource": "*", "effect": "allow" }] }
 */

import { Plugin } from "@opencode/plugin"
import { TODO_DESCRIPTION } from "./src/todo/description.ts"
import { TODO_INPUT_SCHEMA, formatTodos, normalizeTodos } from "./src/todo/tool.ts"

export default Plugin.define({
  id: "activity-panel.todo",
  async setup(ctx) {
    await ctx.tool.transform((editor) => {
      editor.add({
        name: "todowrite",
        description: TODO_DESCRIPTION,
        // A plain JSON Schema object; the runtime validates it and hands the
        // executor `unknown`, which `normalizeTodos` re-checks defensively.
        input: TODO_INPUT_SCHEMA as never,
        // Direct tool (see the header): catalog-only registration made every
        // native call fail with `No tool named "todowrite"`.
        // Trade-off: `await tools.todowrite(...)` inside `execute` is then not
        // available (that JS route is what the catalog-only setup served).
        options: { permission: "todowrite", codemode: false },
        execute: async (input) => {
          const parsed = normalizeTodos(input)
          if ("error" in parsed) throw new Error(parsed.error)
          return {
            content: formatTodos(parsed.todos),
            metadata: { todos: parsed.todos },
          }
        },
      })
    })
  },
})
