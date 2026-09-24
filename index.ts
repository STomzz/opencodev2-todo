/**
 * Server-side plugin: restores V1's `todowrite` tool on OpenCode V2.
 *
 * V2 ships no todo tool, so the model has nothing to record real progress with
 * (calls to `todowrite` fail with `No tool named "todowrite" is currently
 * available`). Registering the same tool name, description and parameters V1
 * used closes that gap for both the model and the activity panel, which already
 * reads `todowrite` calls for its `待办 x/y` block — no CLI-side change needed.
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
        // A direct tool, not a Code Mode catalog tool: the model must call
        // `todowrite` itself so the call is recorded as its own tool part
        // (nested catalog calls only leave an `execute` wrapper behind, which
        // the activity panel cannot read).
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
