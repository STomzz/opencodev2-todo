/**
 * Server-side plugin: restores V1's `todowrite` tool on OpenCode V2.
 *
 * V2 ships no todo tool, so the model has nothing to record real progress with
 * (calls to `todowrite` fail with `No tool named "todowrite" is currently
 * available`). Registering the same tool name, description and parameters V1
 * used closes that gap for both the model and the activity panel.
 *
 * Registered as a Code Mode catalog tool (`codemode: true`): Code Mode sessions
 * can only reach tools that appear in the `execute` catalog, so a direct tool
 * (`codemode: false`) is invisible there — measured 2026-09-24, `tools.todowrite`
 * answered `Unknown tool`. Nested calls keep their full input in the `execute`
 * part's `metadata.toolCalls`, and the activity panel reads the todos from
 * there; sessions that call the tool directly still record a plain `todowrite`
 * tool part, which the panel understands too.
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
        // Code Mode catalog tool (see the header); `pinned` keeps it listed in
        // the catalog instead of being hidden by catalog budgeting.
        options: { permission: "todowrite", codemode: true, pinned: true },
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
