// src/commands.ts — the command registry behind the palette (§6.5) and keymap.
import { useStore, FONT_CHOICES, DEFAULT_EDITOR_SETTINGS } from "./store/useStore";
import { openFolderDialog, saveActive, closeActive } from "./actions";
import { git } from "./git/actions";
import { runActiveFile, stopRun } from "./runner";
import { gotoDefinition, findReferences, renameSymbol } from "./lsp/client";
import { formatDocument, goToSymbol } from "./editorCommands";
import { createProjectFromFolder, openProject } from "./projects";
import { windowApi } from "./ipc";
import { getEditor, getMonaco } from "./editorBridge";
import { THEME_NAMES, type ThemeName } from "./themes/monaco-themes";

function lspNav(fn: (m: any, e: any) => void) {
  const m = getMonaco();
  const e = getEditor();
  if (m && e) fn(m, e);
}

export interface Command {
  id: string;
  title: string;
  hint?: string;
  /** Extra search terms (not shown) so e.g. "load" finds "Open Project". */
  keywords?: string;
  run: () => void;
}

export function allCommands(): Command[] {
  const s = useStore.getState();
  const e = s.editor;
  const themes: ThemeName[] = THEME_NAMES;
  const setFont = (f: string) => s.setEditorSetting("fontFamily", f);
  const curFontIdx = FONT_CHOICES.indexOf(e.fontFamily);

  return [
    // ── git ──
    { id: "git.panel", title: "Git: Source Control", hint: "⌘⇧G", run: () => s.togglePanel("git") },
    { id: "git.history", title: "Git: Commit History", run: () => s.openPanel("history") },
    { id: "git.commit", title: "Git: Commit Staged…", run: () => s.openPanel("git") },
    { id: "git.push", title: "Git: Push", run: () => void git.push() },
    { id: "git.pull", title: "Git: Pull", run: () => void git.pull() },
    { id: "git.fetch", title: "Git: Fetch", run: () => void git.fetch() },
    { id: "git.stageall", title: "Git: Stage All", run: () => void git.stageAll() },
    // ── lsp navigation ──
    { id: "lsp.def", title: "Go to Definition", hint: "F12", run: () => lspNav(gotoDefinition) },
    { id: "lsp.refs", title: "Find References", hint: "⇧F12", run: () => lspNav(findReferences) },
    { id: "lsp.rename", title: "Rename Symbol", hint: "F2", run: () => lspNav(renameSymbol) },
    // ── search ──
    { id: "search.project", title: "Search: Find in Files", hint: "⌘⇧F", run: () => s.togglePanel("search") },
    // ── extensions / runner ──
    { id: "ext.open", title: "Extensions", hint: "⌘⇧E", run: () => s.togglePanel("extensions") },
    { id: "run.file", title: "Run: Run File", run: () => void runActiveFile() },
    { id: "run.stop", title: "Run: Stop", run: () => void stopRun() },
    { id: "run.output", title: "Run: Toggle Output Panel", run: () => s.toggleOutput() },
    { id: "run.config", title: "Code Runner: Configure", run: () => s.openPanel("runner") },
    // ── terminal / view ──
    { id: "view.terminal", title: "Terminal: Toggle", hint: "⌘`", run: () => s.toggleTerm() },
    { id: "view.split", title: "View: Toggle Split Editor", hint: "⌘\\", run: () => s.setSplit(s.splitPath ? null : s.activePath) },

    // ── files / tabs ──
    { id: "file.save", title: "File: Save", hint: "⌘S", run: () => void saveActive() },
    { id: "file.open-folder", title: "File: Open Folder…", run: () => void openFolderDialog() },
    { id: "file.goto", title: "Go to File…", hint: "⌘P", run: () => s.openPalette("files") },
    { id: "tab.close", title: "Tab: Close", hint: "⌘W", run: () => closeActive() },
    { id: "tab.next", title: "Tab: Next", run: () => s.nextTab(1) },
    { id: "tab.prev", title: "Tab: Previous", run: () => s.nextTab(-1) },

    // ── projects ──
    { id: "project.new", title: "Project: Save Current Folder as Project…", keywords: "create new save", run: () => void createProjectFromFolder() },
    ...s.projects.map((p) => ({
      id: `project.open.${p.id}`,
      title: `Open Project: ${p.name}`,
      hint: p.description ? p.description.slice(0, 28) : undefined,
      keywords: `load open switch project ${p.path}`,
      run: () => void openProject(p),
    })),
    // ── editor commands ──
    { id: "format.doc", title: "Format Document", hint: "⌘⇧I", run: () => void formatDocument() },
    { id: "symbol.goto", title: "Go to Symbol in File", hint: "⌘⇧O", run: () => void goToSymbol() },
    { id: "panel.settings", title: "Settings", hint: "⌘,", run: () => s.openPanel("settings") },
    { id: "panel.problems", title: "Problems", hint: "⌘⇧M", run: () => s.togglePanel("problems") },
    // ── view / panels ──
    { id: "view.sidebar", title: "View: Toggle File Tree", hint: "⌘B", run: () => s.toggleSidebar() },
    { id: "view.zen", title: "View: Toggle Zen Mode", run: () => s.toggleZen() },
    { id: "window.new", title: "New Window", hint: "⌘⇧N", keywords: "open window split", run: () => void windowApi.newWindow() },
    { id: "panel.git", title: "Source Control", hint: "⌘⇧G", run: () => s.togglePanel("git") },
    { id: "panel.addons", title: "Addons", hint: "⌘⇧X", run: () => s.togglePanel("addons") },
    { id: "panel.about", title: "About Kern", keywords: "version credits", run: () => s.openPanel("about") },
    { id: "help.tour", title: "Help: Tour (Onboarding)", keywords: "welcome onboarding tutorial help guide", run: () => s.openOnboarding() },

    // ── theme ──
    { id: "theme.cycle", title: "Theme: Cycle", hint: "⌘K T", run: () => s.cycleTheme() },
    ...themes.map((t) => ({
      id: `theme.${t}`,
      title: `Theme: ${t[0].toUpperCase()}${t.slice(1)}`,
      run: () => s.setTheme(t),
    })),

    // ── editor settings ──
    {
      id: "editor.font-bigger",
      title: "Editor: Increase Font Size",
      hint: "⌘+",
      run: () => s.setEditorSetting("fontSize", Math.min(32, e.fontSize + 1)),
    },
    {
      id: "editor.font-smaller",
      title: "Editor: Decrease Font Size",
      hint: "⌘-",
      run: () => s.setEditorSetting("fontSize", Math.max(8, e.fontSize - 1)),
    },
    {
      id: "editor.font-reset",
      title: "Editor: Reset Font Size",
      run: () => s.setEditorSetting("fontSize", DEFAULT_EDITOR_SETTINGS.fontSize),
    },
    {
      id: "editor.font-next",
      title: `Editor: Font Family → ${FONT_CHOICES[(curFontIdx + 1) % FONT_CHOICES.length]}`,
      run: () => setFont(FONT_CHOICES[(curFontIdx + 1) % FONT_CHOICES.length]),
    },
    ...FONT_CHOICES.map((f) => ({
      id: `editor.font.${f}`,
      title: `Editor: Font → ${f}`,
      run: () => setFont(f),
    })),
    {
      id: "editor.line-taller",
      title: "Editor: Increase Line Height",
      run: () => s.setEditorSetting("lineHeight", Math.min(2.4, +(e.lineHeight + 0.05).toFixed(2))),
    },
    {
      id: "editor.line-shorter",
      title: "Editor: Decrease Line Height",
      run: () => s.setEditorSetting("lineHeight", Math.max(1.1, +(e.lineHeight - 0.05).toFixed(2))),
    },
    ...[2, 4, 8].map((n) => ({
      id: `editor.tab.${n}`,
      title: `Editor: Tab Size ${n}`,
      run: () => s.setEditorSetting("tabSize", n),
    })),
    {
      id: "editor.minimap",
      title: `Editor: ${e.minimap ? "Hide" : "Show"} Minimap`,
      run: () => s.setEditorSetting("minimap", !e.minimap),
    },
    {
      id: "editor.wrap",
      title: `Editor: ${e.wordWrap ? "Disable" : "Enable"} Word Wrap`,
      run: () => s.setEditorSetting("wordWrap", !e.wordWrap),
    },
    {
      id: "editor.ligatures",
      title: `Editor: ${e.ligatures ? "Disable" : "Enable"} Ligatures`,
      run: () => s.setEditorSetting("ligatures", !e.ligatures),
    },
    {
      id: "editor.relnum",
      title: `Editor: ${e.relativeLineNumbers ? "Absolute" : "Relative"} Line Numbers`,
      run: () => s.setEditorSetting("relativeLineNumbers", !e.relativeLineNumbers),
    },
    {
      id: "editor.blink",
      title: `Editor: ${e.cursorBlink ? "Disable" : "Enable"} Cursor Blink`,
      run: () => s.setEditorSetting("cursorBlink", !e.cursorBlink),
    },
  ];
}

/** Tiny subsequence fuzzy scorer — higher is better, -1 = no match. */
export function fuzzyScore(query: string, text: string): number {
  if (!query) return 0;
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  let qi = 0;
  let score = 0;
  let streak = 0;
  let lastIdx = -1;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      streak += 1;
      score += streak * 2;
      if (lastIdx === -1 || ti === 0 || /[\\/._\- ]/.test(t[ti - 1])) score += 6;
      lastIdx = ti;
      qi++;
    } else {
      streak = 0;
    }
  }
  return qi === q.length ? score - t.length * 0.05 : -1;
}
