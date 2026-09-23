/**
 * Guarded host-storage helpers.
 *
 * Host rules learned the hard way (opencode 2.0.11):
 * - storage keys must match `^[a-zA-Z0-9][a-zA-Z0-9._-]*$` (colons are rejected)
 * - a rejected key throws during plugin `setup`, which would disable the panel
 *
 * These wrappers keep `setup` alive no matter what storage does; the worst case
 * is that snapshot/expanded state stops updating.
 */

import type { Context } from "@opencode/plugin/tui/context"
import type { Store } from "solid-js/store"

export type WritableStore<Value extends object> = readonly [Store<Value>, (mutation: (draft: Value) => void) => unknown]

/** Ephemeral store; falls back to an inert store if the host rejects it. */
export function memoryStore<Value extends object>(context: Context, key: string, initial: Value): WritableStore<Value> {
  try {
    return context.storage.memory(key, { initial })
  } catch {
    return inert(initial)
  }
}

/** Durable store; falls back to memory, then to an inert store. */
export function durableStore<Value extends object>(context: Context, key: string, initial: Value): WritableStore<Value> {
  try {
    return context.storage.store(key, { initial })
  } catch {
    return memoryStore(context, key, initial)
  }
}

/** Applies a mutation, swallowing sync throws and async rejections. */
export function writeStore<Value extends object>(
  store: WritableStore<Value>,
  mutation: (draft: Value) => void,
): void {
  try {
    void Promise.resolve(store[1](mutation)).catch(() => undefined)
  } catch {
    // Best effort only.
  }
}

/** Last resort: values are readable but mutations do nothing. */
function inert<Value extends object>(initial: Value): WritableStore<Value> {
  return [initial as Store<Value>, () => undefined]
}
