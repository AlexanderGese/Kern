# Kern

A calm, minimalist desktop code editor — in the spirit of Zed, but quieter.
A fixed warm-graphite canvas, all-monospace chrome, and three syntax-only
themes (**Arctic**, **Grape**, **Amber**) that recolor code without ever
touching the canvas.

Built with **Tauri 2** (Rust) + **React 19 / TypeScript / Vite** + **Monaco**.

## Features

- Zed-style chrome: integrated title bar with custom window controls, nav arrows,
  a file-path breadcrumb, and a **minimap**. File tree docks right.
- Open a folder; lazy, expandable file tree
- Tabs with dirty indicators; open tabs persist across restarts
- Monaco editor: ~50 languages highlighted, ligatures, generous line height
- Three themes applied to **both** the CSS chrome and Monaco, kept in sync
- Command palette (`⌘⇧P`) + Go-to-File (`⌘P`) with fuzzy matching
- **Settings via the palette**: font family/size, line height, tab size, minimap,
  word wrap, ligatures, relative line numbers, cursor blink — all persisted
- **Addons page** (`⌘⇧X`): toggle editor features, switch themes, see which
  language servers are installed (with install commands)
- **Source Control** (`⌘⇧G`): branch + changed files, click to open
- Git signal: current branch in the status bar + per-line gutter change markers
- LSP completion + diagnostics via real language servers (Pyright, tsserver,
  rust-analyzer, gopls, clangd) when the binaries are on `PATH`
- About & Settings panel (`⌘,`), Zen mode, reduced-motion aware

## Develop

```bash
pnpm install
pnpm tauri dev      # launches the desktop app with HMR
```

## Build

```bash
pnpm tauri build              # produces a native bundle
pnpm tauri build --debug --no-bundle   # fast standalone debug binary
```

> **Note (Linux/WebKitGTK):** `pnpm tauri dev` can occasionally render a blank
> window on first load — a WebKitGTK bug under Vite's native-ESM dev server
> (`internallyFailedLoadTimerFired`). Just reload/relaunch, or run a built binary
> (`pnpm tauri build --debug --no-bundle` → `src-tauri/target/debug/kern`), which
> serves a single bundle and is unaffected.

## Keyboard shortcuts

| Action            | Shortcut          |
| ----------------- | ----------------- |
| Save              | ⌘/Ctrl S          |
| Command palette   | ⌘/Ctrl ⇧ P        |
| Go to file        | ⌘/Ctrl P          |
| Toggle sidebar    | ⌘/Ctrl B          |
| Close tab         | ⌘/Ctrl W          |
| Next / prev tab   | ⌘/Ctrl ⌥ → / ←    |
| Source control    | ⌘/Ctrl ⇧ G        |
| Addons            | ⌘/Ctrl ⇧ X        |
| About & settings  | ⌘/Ctrl ,          |
| Increase / decrease font | ⌘/Ctrl + / −  |
| Cycle theme       | ⌘/Ctrl K, then T  |

## Language servers (optional)

LSP features light up automatically when the relevant server is installed and
on `PATH`:

| Language   | Server                          |
| ---------- | ------------------------------- |
| Python     | `pyright-langserver` (or `basedpyright-langserver`) |
| TypeScript | `typescript-language-server`    |
| Rust       | `rust-analyzer`                 |
| Go         | `gopls`                         |
| C / C++    | `clangd`                        |

## Architecture

- **React UI** — layout, theming, command palette, Monaco, the LSP bridge.
- **Rust backend** — filesystem (read/write/watch), directory walking, git
  status via `git2`, and spawning language servers (bridged stdio ↔ WebSocket).
- Frontend ↔ Rust over Tauri IPC (`invoke` commands + `emit` events).

See `CODE_EDITOR_SPEC.md` for the full design system and build spec.

## Notes

- Settings persist on disk via `tauri-plugin-store` (not `localStorage`).
- Fonts: JetBrains Mono (SIL OFL), bundled under `public/fonts`.
