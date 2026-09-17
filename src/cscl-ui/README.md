# cscl-ui (vendored)

Source copied in from `coresys-dev/cscl-ui` (CoreSys's internal shadcn-ui-style
component library — not an npm package, meant to be copied and owned per the
library's own README). Pulled in: theme tokens/motion, `cn`, window chrome
(`TitleBar`/`WindowControls`), navigation (`TabBar`), a handful of
primitives, `ShortcutRecorder`, `DropdownMenu`, `ConfirmDialog`,
`SidebarTabsDialog`.

Not modified from upstream except import paths. If cscl-ui gains something
this app needs later, re-copy the specific file from
`https://github.com/coresys-dev/cscl-ui` rather than reinventing it locally.
