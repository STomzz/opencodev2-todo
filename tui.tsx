// TUI entry shell.
//
// The loader may resolve this package either through `exports["./tui"]` or by
// looking for a `tui.*` file in the package root. Keeping the entry at the root
// makes both resolution modes land on this exact file; everything else lives in
// `src/`.
export { default } from "./src/plugin.tsx"
