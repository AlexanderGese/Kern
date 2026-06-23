# Code Editor — Build Spec (for Claude Code)

> A single source of truth for generating a minimalist desktop code editor.
> Read this top to bottom, then build in the phases defined in §11. Honor the
> design system in §5 exactly — the look is the product. Working name below is a
> placeholder; ask the user for a real name before finalizing branding (§12).

---

## 1. Vision

A fast, **minimalist** desktop code editor in the spirit of Zed, but quieter and
more restrained. The defining qualities:

- **Calm by default.** A fixed, warm-neutral dark canvas. The UI is small,
  monospace, and recedes; the code is the focus.
- **Three built-in themes** — Arctic, Grape, Amber — that recolor only the
  *syntax*, never the canvas. Switchable instantly.
- **Real editing power underneath** the minimal surface: file tree, tabs,
  command palette, multi-language syntax + LSP intelligence, git signal.
- **No clutter.** No emoji icons, no heavy borders, no always-on chrome that
  isn't earning its space.

Non-goals for v1: plugins/extensions marketplace, real-time collaboration,
remote dev. Architect so these *can* be added later, but do not build them now.

---

## 2. Tech Stack (and why)

| Layer | Choice | Why |
|---|---|---|
| Shell | **Tauri 2.x** (Rust) | Tiny binaries, fast startup, native file/process access, permissive license (MIT/Apache) |
| UI | **React 18 + TypeScript + Vite** | Component model, type safety, fast HMR |
| Editor core | **Monaco Editor** (`@monaco-editor/react`) | Mature, ships built-in highlighting for ~50 languages, MIT |
| Intelligence | **monaco-languageclient** + external LSP servers | Real completion/diagnostics via the same servers VS Code uses, MIT |
| State | **Zustand** | Minimal, no boilerplate |
| Settings persistence | **`tauri-plugin-store`** | A real on-disk JSON store; do NOT use localStorage for app settings |

All dependencies above are permissive (MIT/Apache). **Do not** vendor or fork any
GPL code (notably Zed's editor source) — it would force the whole app open-source.
GPUI is Apache-2.0 and *would* be usable, but we are not using it here.

---

## 3. Architecture

```
┌────────────────────────────────────────────┐
│  React UI (TypeScript)                       │
│  • layout, theming, command palette          │
│  • Monaco instance(s)                         │
│  • monaco-languageclient (LSP bridge)         │
└───────────────┬──────────────────────────────┘
                │  Tauri IPC (commands + events)
┌───────────────┴──────────────────────────────┐
│  Rust backend                                 │
│  • filesystem (read/write/watch)              │
│  • directory walking                          │
│  • git status (git2)                          │
│  • spawn + proxy LSP servers                  │
│  • settings store                             │
└───────────────────────────────────────────────┘
```

- Frontend calls Rust via `invoke('command', args)`.
- Rust pushes async updates (file changed on disk, LSP output) via `emit`/events.
- Heavy/native work lives in Rust; the UI stays declarative.

---

## 4. Project Structure

```
myeditor/
├── src-tauri/
│   ├── src/
│   │   ├── main.rs          # app bootstrap, command registry
│   │   ├── fs.rs            # open/save/create/delete, list_dir
│   │   ├── watch.rs         # filesystem watcher → events
│   │   ├── git.rs           # branch + per-file status
│   │   ├── lsp.rs           # spawn language servers, stdio↔ws proxy
│   │   └── settings.rs      # load/save settings
│   ├── Cargo.toml
│   └── tauri.conf.json
├── src/
│   ├── main.tsx
│   ├── App.tsx              # root layout
│   ├── components/
│   │   ├── TitleBar.tsx     # breadcrumb
│   │   ├── Sidebar.tsx      # file tree
│   │   ├── TabBar.tsx
│   │   ├── Editor.tsx       # Monaco wrapper
│   │   ├── StatusBar.tsx
│   │   └── CommandPalette.tsx
│   ├── themes/
│   │   ├── tokens.css       # fixed canvas vars + per-theme syntax vars
│   │   └── monaco-themes.ts # Monaco theme definitions (see §7.3)
│   ├── store/
│   │   └── useStore.ts      # Zustand: open files, active file, theme, layout
│   ├── lsp/
│   │   └── client.ts        # monaco-languageclient setup
│   └── styles/
│       └── global.css
└── package.json
```

---

## 5. Design System  ← THE HEART. Match this exactly.

### 5.1 Principles (non-negotiable)

1. **Fixed canvas, themed syntax.** The background, panels, and UI greys are the
   same in every theme. Switching a theme recolors **only** code tokens + the
   accent. (Implementation note in §7 — get the CSS variable scope right.)
2. **All-mono chrome.** The entire UI — sidebar, tabs, breadcrumb, status bar — is
   the monospace font at small sizes (10–12px), faint. This is the signature.
3. **Light, not borders.** Separate regions with ~3–4% luminance shifts and a
   single 5%-opacity hairline, not hard 1px borders everywhere.
4. **Whitespace is the luxury.** Editor `line-height: 1.7`. Generous padding.
   Never cramped.
5. **One accent, used sparingly.** Active-file bar, active-tab underline, caret,
   active line number, selection, the LSP status dot. Nowhere else.
6. **Hide UI until needed.** Tab close buttons appear on hover; scrollbars fade.
7. **No emoji icons.** Use one faint monochrome glyph (e.g. `›` for folders) or a
   single thin line-icon set (Lucide), or nothing. Never a rainbow of emoji.
8. **Readable contrast.** Plain code text must be bright (`--fg`), not defaulting
   to dark. Greys for punctuation/comments must stay legible (see values).
9. **Respect `prefers-reduced-motion`** — disable cursor blink + the LSP pulse.

### 5.2 Typography

- Mono (code + all UI chrome): bundle a variable OFL font — **JetBrains Mono**
  (recommended) or Lilex/Iosevka. Stack: `'<YourMono>', ui-monospace, "SF Mono", Menlo, Consolas, monospace`.
- Enable ligatures in the editor (`fontLigatures: true`).
- Editor size 13–14px; chrome 10–12px.
- Fonts are SIL OFL — fine to bundle/ship; if you rename a font, strip its
  reserved name from the metadata.

### 5.3 Spacing / shape

- Radius: `6px` general, `4px` small (chips/pills), `8–10px` window.
- Hairline: `rgba(255,255,255,0.05)`.
- Transitions: 120–150ms for hovers; 250ms color fade when switching themes.

### 5.4 The fixed canvas (shared by all themes)

```css
--bg-window:   #1a1918;   /* editor canvas (warm graphite) */
--bg-panel:    #151414;   /* sidebar / tabs / status shell */
--bg-elevated: #222120;   /* hover + active surfaces */
--bg-behind:   #0c0c0b;   /* window's outer backdrop */
--line:        rgba(255,255,255,0.05);
--fg:          #ece9e3;   /* primary text + plain identifiers */
--fg-dim:      #9a948b;   /* punctuation, inactive UI text */
--fg-faint:    #5b554e;   /* line numbers, separators, gutters */
--syn-comment: #756f65;   /* italic, fixed across themes */
--syn-punct:   var(--fg-dim);
```

### 5.5 The three themes

Each theme overrides **only** these seven syntax colors (+ the UI accent). They're
anchored on a single main hue (analogous within the family) so each reads as one
color, distinguished by lightness rather than contrasting hues.

**Arctic** — glacier teal family
```
accent/keyword #5dc9c2   function #79cfe0   type #58c79a
string         #9bd9b9   number   #6bbcd6   constant #b0e6df   operator #6aa9bf
accent-soft    rgba(93,201,194,0.13)
```

**Grape** — violet/orchid family
```
accent/keyword #b58ad6   function #c9a6e8   type #d7a2d2
string         #c994c0   number   #c47fb8   constant #bd8fe2   operator #a98cc4
accent-soft    rgba(181,138,214,0.14)
```

**Amber** — honey/gold family
```
accent/keyword #d9a85f   function #e6c074   type #d4b483
string         #b3aa6a   number   #e0975c   constant #e8b84f   operator #c2a079
accent-soft    rgba(217,168,95,0.13)
```

Default theme on first launch: **Arctic**.

### 5.6 UI anatomy (top → bottom)

- **Title bar (34px):** a breadcrumb of the cursor's location, e.g.
  `src › theme.rs › resolve`. Mono, faint; last crumb slightly brighter. No
  traffic-light dots.
- **Sidebar (≈188px):** file tree. Mono, faint rows. Folders get one faint `›`
  chevron; files get nothing but indentation. Active file: `--bg-elevated` row +
  a 2px `--accent` left bar. Hover → `--bg-elevated`.
- **Tab bar (34px):** mono tabs. Active tab = `--bg-window` + 2px `--accent`
  bottom underline. Close `×` appears on hover only. Unsaved = small `--fg-dim` dot.
- **Editor:** gutter with faint line numbers; the **active line number glows in
  `--accent`**. `line-height: 1.7`. Selection uses `--accent-soft`. Caret =
  `--accent`, blinking (respect reduced-motion).
- **Status bar (27px):** mono, faint, hoverable segments (each lifts to a subtle
  pill on hover). Left: a branch dot (in the theme's *string* color) + branch name.
  Right: a **pulsing `--accent` dot + active LSP name**, then `· spaces: 4 ·
  utf-8 · ln/col`. Separators are faint middots.

A reference HTML mockup of this exact UI + the three themes exists; treat it as
the visual spec. If unavailable, the values above fully define it.

---

## 6. Feature Requirements

### 6.1 Files
- Open file (read), save (Ctrl/Cmd+S), create, delete, rename.
- Sidebar tree of the opened folder (lazy/expandable). Open folder via dialog.
- Watch open files on disk; if changed externally, prompt or reload.

### 6.2 Tabs
- One tab per open file; click to switch, hover-`×` to close, middle-click closes.
- Dirty indicator. Persist open tabs + active tab across restarts (settings store).

### 6.3 Editor (Monaco)
- Syntax highlighting via Monaco's built-ins for: rust, ts, tsx, js, jsx, py, go,
  c, cpp, java, json, yaml, toml, html, css, md (extend freely).
- Detect language from file extension.
- Options: `minimap.enabled: false`, `lineNumbers: 'on'`, `wordWrap: 'on'`,
  `fontLigatures: true`, `renderWhitespace: 'selection'`, `scrollBeyondLastLine:
  false`, `cursorBlinking: 'smooth'`, `smoothScrolling: true`, tab size 4.

### 6.4 Themes
- Apply the active theme to **both** the CSS UI (via `data-theme` on a root
  element) **and** Monaco (via `monaco.editor.setTheme`). They must stay in sync.
- Switch from the command palette and/or a small switcher. Persist choice.

### 6.5 Command palette (Ctrl/Cmd+Shift+P)
- Fuzzy list of commands (switch theme, open folder, toggle sidebar, save, close
  tab, …) and a "Go to File" mode. Keyboard nav, Esc to close, overlay style.

### 6.6 Git signal
- Show current branch in the status bar.
- Show per-line change markers in the editor gutter (added/modified/deleted).
- Blame-on-hover is a nice-to-have, not required for v1. No separate SCM sidebar.

### 6.7 LSP intelligence (can land in a later phase)
- Spawn the relevant language server per language; pipe to Monaco via
  monaco-languageclient. Show the active server name + a live pulse in the status
  bar. Start with **one** language working end-to-end (Python/Pyright is easiest),
  then generalize.

### 6.8 Layout extras
- Toggle sidebar (Ctrl/Cmd+B).
- Optional: a "Zen" toggle that hides sidebar+tabs+status and centers the code
  column (the calm default taken to its extreme). Nice-to-have.

---

## 7. Theme Implementation Details

### 7.1 CSS variables — CRITICAL scoping rule

Define the **fixed canvas** vars on `:root`. Define each theme's syntax vars
**inside the theme selector itself**, e.g. `[data-theme="arctic"] { … }`, and set
the final `--syn-*` values *there*.

> ⚠️ Do NOT declare `--syn-keyword: var(--accent)` on `:root` while `--accent` is
> defined on `[data-theme]`. CSS resolves the `var()` at `:root`, where `--accent`
> doesn't exist yet, so every token silently falls back to plain text and you get
> **zero syntax color**. (This bug bit us during design.) Either set `--syn-*`
> directly with hex in each theme block, or keep the `var(--accent)` indirection
> *inside* the same `[data-theme]` block so it resolves in scope.

```css
:root{
  --bg-window:#1a1918; --bg-panel:#151414; --bg-elevated:#222120;
  --bg-behind:#0c0c0b; --line:rgba(255,255,255,.05);
  --fg:#ece9e3; --fg-dim:#9a948b; --fg-faint:#5b554e;
  --syn-comment:#756f65; --syn-punct:var(--fg-dim);
}
[data-theme="arctic"]{
  --accent:#5dc9c2; --accent-soft:rgba(93,201,194,.13);
  --syn-keyword:var(--accent); --syn-func:#79cfe0; --syn-type:#58c79a;
  --syn-string:#9bd9b9; --syn-number:#6bbcd6; --syn-constant:#b0e6df; --syn-operator:#6aa9bf;
}
[data-theme="grape"]{
  --accent:#b58ad6; --accent-soft:rgba(181,138,214,.14);
  --syn-keyword:var(--accent); --syn-func:#c9a6e8; --syn-type:#d7a2d2;
  --syn-string:#c994c0; --syn-number:#c47fb8; --syn-constant:#bd8fe2; --syn-operator:#a98cc4;
}
[data-theme="amber"]{
  --accent:#d9a85f; --accent-soft:rgba(217,168,95,.13);
  --syn-keyword:var(--accent); --syn-func:#e6c074; --syn-type:#d4b483;
  --syn-string:#b3aa6a; --syn-number:#e0975c; --syn-constant:#e8b84f; --syn-operator:#c2a079;
}
```

(The CSS `--syn-*` vars style the app chrome's faux-code if any; Monaco itself is
themed separately — see §7.3.)

### 7.2 Browser-storage rule
Monaco/web storage caveat: persist settings through `tauri-plugin-store`
(on-disk), not localStorage. Keep editor/session state in Zustand at runtime.

### 7.3 Monaco theme definitions

Monaco is **not** styled by the CSS variables; it needs its own theme objects.
Use one factory + three palettes so the two systems can never drift. Register all
three at startup, then `monaco.editor.setTheme(name)` when the user switches
(keep it in sync with the `data-theme` attribute).

```ts
// src/themes/monaco-themes.ts
import type { editor } from 'monaco-editor';

const CANVAS = {
  bg: '#1a1918', fg: '#ece9e3', line: '#5b554e',
  comment: '756f65', lineHi: '#ffffff06', panel: '#151414', border: '#ffffff0d',
};

type Palette = {
  keyword: string; func: string; type: string; string: string;
  number: string; constant: string; operator: string;
};

export const PALETTES: Record<'arctic' | 'grape' | 'amber', Palette> = {
  arctic: { keyword:'5dc9c2', func:'79cfe0', type:'58c79a', string:'9bd9b9', number:'6bbcd6', constant:'b0e6df', operator:'6aa9bf' },
  grape:  { keyword:'b58ad6', func:'c9a6e8', type:'d7a2d2', string:'c994c0', number:'c47fb8', constant:'bd8fe2', operator:'a98cc4' },
  amber:  { keyword:'d9a85f', func:'e6c074', type:'d4b483', string:'b3aa6a', number:'e0975c', constant:'e8b84f', operator:'c2a079' },
};

function makeTheme(p: Palette): editor.IStandaloneThemeData {
  return {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: '',                        foreground: CANVAS.fg.slice(1) },
      { token: 'keyword',                 foreground: p.keyword },
      { token: 'storage',                 foreground: p.keyword }, // fn, let, const, pub, mut
      { token: 'storage.type',            foreground: p.keyword },
      { token: 'keyword.operator',        foreground: p.operator },
      { token: 'operator',                foreground: p.operator },
      { token: 'entity.name.function',    foreground: p.func },
      { token: 'support.function',        foreground: p.func },
      { token: 'meta.function-call',      foreground: p.func },
      { token: 'entity.name.type',        foreground: p.type },
      { token: 'entity.name.class',       foreground: p.type },
      { token: 'support.type',            foreground: p.type },
      { token: 'support.class',           foreground: p.type },
      { token: 'type',                    foreground: p.type },
      { token: 'string',                  foreground: p.string },
      { token: 'constant.numeric',        foreground: p.number },
      { token: 'number',                  foreground: p.number },
      { token: 'constant.language',       foreground: p.constant }, // true/false/null
      { token: 'constant.character',      foreground: p.constant },
      { token: 'variable.other.constant', foreground: p.constant },
      { token: 'entity.name.constant',    foreground: p.constant },
      { token: 'comment',                 foreground: CANVAS.comment, fontStyle: 'italic' },
      { token: 'variable',                foreground: CANVAS.fg.slice(1) },
    ],
    colors: {
      'editor.background':                CANVAS.bg,
      'editor.foreground':                CANVAS.fg,
      'editorLineNumber.foreground':      CANVAS.line,
      'editorLineNumber.activeForeground':'#' + p.keyword,
      'editorCursor.foreground':          '#' + p.keyword,
      'editor.selectionBackground':       '#' + p.keyword + '24',
      'editor.lineHighlightBackground':   CANVAS.lineHi,
      'editorGutter.background':          CANVAS.bg,
      'editorWidget.background':          CANVAS.panel,
      'editorWidget.border':              CANVAS.border,
      'editorIndentGuide.background1':    '#ffffff08',
    },
  };
}

export function registerThemes(monaco: typeof import('monaco-editor')) {
  (Object.keys(PALETTES) as Array<keyof typeof PALETTES>)
    .forEach((name) => monaco.editor.defineTheme(name, makeTheme(PALETTES[name])));
}
```

Token scope names above are TextMate-style and cover Monaco's built-in
tokenizers reasonably; verify against a few languages and add scopes as needed.
Switching themes: call `monaco.editor.setTheme(name)` AND set
`document.documentElement.dataset.theme = name` together, then persist.

---

## 8. Backend (Rust) — command surface

Implement these Tauri commands (names indicative). Return typed structs via serde.

```
fs::open_file(path) -> { path, content }
fs::save_file(path, content) -> ()
fs::create_file(path) -> ()
fs::delete_path(path) -> ()
fs::rename_path(from, to) -> ()
fs::list_dir(path, depth) -> FileEntry { path, name, is_dir, children? }
fs::pick_folder() -> Option<path>            // native dialog

watch::watch_path(path) -> () ; emits "fs:changed" { path } events
git::branch(repo) -> Option<String>
git::file_statuses(repo) -> Vec<{ path, status }>
settings::load() -> Settings
settings::save(Settings) -> ()
lsp::start_server(language) -> u16           // returns ws port (see §9)
```

Crates: `tauri`, `serde`, `tokio`, `notify` (watch), `git2` (git),
`walkdir` (tree), `tokio-tungstenite` (LSP ws proxy). Handle errors as
`Result<T, String>` and surface them to the UI.

---

## 9. LSP integration (phase 5 — isolate it)

The fiddliest part; build it last and incrementally.

1. Rust spawns the language server as a child process (stdio). Examples:
   `rust-analyzer`, `pyright-langserver --stdio`, `typescript-language-server
   --stdio`, `gopls`, `clangd`.
2. Rust bridges the child's stdin/stdout to a localhost WebSocket on an ephemeral
   port (use `tokio-tungstenite`), returns the port to the UI.
3. UI connects monaco-languageclient to `ws://127.0.0.1:<port>` via
   `vscode-ws-jsonrpc` (`toSocket`, `WebSocketMessageReader/Writer`), starts the
   client with a `documentSelector` for that language.
4. Status bar: show the server name + the pulsing accent dot while connected.

> Get ONE language fully working (Pyright) before adding a match-arm of servers.
> monaco-languageclient + `@codingame/monaco-vscode-api` versions must be aligned
> — start from an official example, don't hand-assemble versions.

---

## 10. Keyboard shortcuts

| Action | Shortcut |
|---|---|
| Save | Ctrl/Cmd+S |
| Command palette | Ctrl/Cmd+Shift+P |
| Go to file | Ctrl/Cmd+P |
| Toggle sidebar | Ctrl/Cmd+B |
| Close tab | Ctrl/Cmd+W |
| Next/prev tab | Ctrl/Cmd+Alt+→ / ← |
| Cycle theme | (assign one, e.g. Ctrl/Cmd+K then T) |

---

## 11. Build Plan (phases + definition of done)

Build in order. Each phase must satisfy its acceptance criteria before the next.

**Phase 0 — Scaffold**
`create-tauri-app` (React+TS), add deps, app boots to an empty window with the
fixed-canvas background and the mono font loading. ✅ Done when the blank shell
launches via `cargo tauri dev`.

**Phase 1 — Editor + open/save**
Monaco mounted full-window; `fs::open_file`/`save_file` wired; Ctrl+S saves;
language detected by extension. ✅ Done when you can open a file, edit, save, and
see correct built-in highlighting.

**Phase 2 — Themes**
`tokens.css` + `monaco-themes.ts`; apply theme to CSS (`data-theme`) and Monaco
together; switch + persist. ✅ Done when all three themes render in the editor and
chrome, switch instantly, the canvas stays fixed, and the choice survives restart.
(Sanity-check the §7.1 scope warning — confirm syntax colors actually appear.)

**Phase 3 — Shell (sidebar, tabs, breadcrumb, status)**
Build the UI anatomy in §5.6 against the design system. File tree from
`fs::list_dir`; tabs; breadcrumb; status bar (static LSP/git placeholders for now).
✅ Done when the editor looks like the visual spec, opens files from the tree into
tabs, and all chrome honors §5.

**Phase 4 — Command palette + git signal + shortcuts**
Palette (commands + go-to-file), keymap in §10, git branch in status bar, gutter
change markers via `git::file_statuses`. ✅ Done when the palette switches themes
and opens files, shortcuts work, and the gutter shows real git changes.

**Phase 5 — LSP (one language)**
Per §9, Pyright end-to-end: completion + diagnostics in a `.py` file, live status
dot. ✅ Done when typing in Python yields real completions and inline errors.

**Phase 6 — Generalize + polish**
Add more LSP servers behind a language→server map; file watcher; Zen toggle;
reduced-motion; rename; empty/loading states. ✅ Done when 3+ languages have LSP
and the rough edges are smoothed.

---

## 12. Branding (do at the end, with the user)

- Get a real product name from the user; set `productName`, `identifier`,
  `version` in `tauri.conf.json`.
- App icon → `.ico`/`.icns`/`.png` for Tauri.
- Bundle chosen OFL font(s); rename if desired (strip reserved font names).
- About screen + bundled `THIRD_PARTY_LICENSES` (MIT/Apache require attribution).
  Generate with `cargo about` (Rust) and `license-checker` (npm).

---

## 13. Gotchas (learned the hard way — don't repeat)

1. **CSS var indirection scope** (§7.1): `--syn-x: var(--accent)` only resolves
   where `--accent` is in scope. Wrong scope ⇒ all syntax goes monochrome. This is
   the #1 trap.
2. **Monaco ignores CSS variables.** It must be themed via `defineTheme`. Keep the
   CSS palette and Monaco palette in sync from one source (§7.3).
3. **No localStorage for settings** in the Tauri webview model — use the store
   plugin. (Also, browser storage doesn't work at all inside sandboxed previews.)
4. **monaco-languageclient version alignment** is brittle; start from an official
   example and pin compatible versions.
5. **Set the editor base text color explicitly.** Don't let plain identifiers fall
   back to the UA default (near-black on dark = invisible). Monaco's theme
   `editor.foreground` handles this; in any hand-rolled HTML, set it yourself.
6. **Keep greys legible.** Punctuation `--fg-dim #9a948b` and comments `#756f65`
   are intentionally calm but must stay readable — don't darken them further.
7. **No emoji file icons.** They break the minimal aesthetic instantly.
8. **Honor `prefers-reduced-motion`** for the caret blink and the LSP pulse.

---

## 14. Definition of done (v1)

A signed, named desktop app that: opens a folder, edits and saves files with
correct highlighting, ships Arctic/Grape/Amber (syntax-only, fixed canvas,
persisted), has a working command palette + keymap, shows git branch + gutter
changes, provides LSP completion/diagnostics for at least Python, and looks like
the design system in §5 — calm, mono-chromed UI, one accent, generous space.
