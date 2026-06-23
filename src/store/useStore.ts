// src/store/useStore.ts — single Zustand store for runtime session state.
// Settings persistence is on-disk via tauri-plugin-store (§7.2, §13.3); NEVER
// localStorage. Runtime/session state lives here in memory.
import { create } from "zustand";
import { load, type Store } from "@tauri-apps/plugin-store";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { basename, detectLang } from "../lang";
import type { GitStatusKind, Task } from "../ipc";
import { tasksApi } from "../ipc";
import { THEME_NAMES, type ThemeName } from "../themes/monaco-themes";

export interface Tab {
  path: string;
  name: string;
  content: string;
  /** Last saved content — drives the dirty indicator. */
  saved: string;
  monacoLang: string;
  lspLang?: string;
}

export interface LspState {
  language: string | null;
  serverName: string | null;
  connected: boolean;
}

/** User-tunable editor settings (driven by the palette + Addons page). */
export interface EditorSettings {
  fontFamily: string;
  fontSize: number;
  lineHeight: number; // multiplier
  wordWrap: boolean;
  minimap: boolean;
  ligatures: boolean;
  relativeLineNumbers: boolean;
  tabSize: number;
  cursorBlink: boolean;
  autoSave: boolean;
  /** Debounce (ms) before auto-save fires after the last edit. */
  autoSaveDelay: number;
  formatOnSave: boolean;
  stickyScroll: boolean;
  bracketColors: boolean;
  indentGuides: boolean;
  /** error-lens: render diagnostics inline at end of line. */
  inlineErrors: boolean;
  trimWhitespace: boolean;
  insertFinalNewline: boolean;
  /** Render file-tree icons in a single muted tone instead of per-type colors. */
  monoIcons: boolean;
}

export const DEFAULT_EDITOR_SETTINGS: EditorSettings = {
  fontFamily: "JetBrains Mono",
  fontSize: 15,
  lineHeight: 1.73,
  wordWrap: true,
  minimap: true,
  ligatures: true,
  relativeLineNumbers: false,
  tabSize: 4,
  cursorBlink: true,
  autoSave: false,
  autoSaveDelay: 800,
  formatOnSave: false,
  stickyScroll: true,
  bracketColors: true,
  indentGuides: true,
  inlineErrors: true,
  trimWhitespace: true,
  insertFinalNewline: true,
  monoIcons: false,
};

/** Code-runner command templates per Monaco language id. Placeholders:
 *  $file (abs path), $dir, $fileBasename, $fileBasenameNoExt. */
export const DEFAULT_RUNNER: Record<string, string> = {
  python: 'python3 "$file"',
  javascript: 'node "$file"',
  typescript: 'npx --yes tsx "$file"',
  rust: "cargo run",
  go: 'go run "$file"',
  c: 'cc "$file" -o /tmp/kern_run && /tmp/kern_run',
  cpp: 'c++ "$file" -o /tmp/kern_run && /tmp/kern_run',
  java: 'java "$file"',
  shell: 'sh "$file"',
  ruby: 'ruby "$file"',
  php: 'php "$file"',
  lua: 'lua "$file"',
};

export interface OutputLine {
  line: string;
  stream: "stdout" | "stderr" | "meta";
}

// Fonts that actually render on this system (verified via fc-list) + the
// bundled JetBrains Mono, so switching is always visible.
export const FONT_CHOICES = [
  "JetBrains Mono",
  "Fira Code",
  "Hack",
  "DejaVu Sans Mono",
  "Liberation Mono",
  "Noto Mono",
  "Courier New",
  "monospace",
];

export type PanelKind =
  | "none"
  | "git"
  | "addons"
  | "about"
  | "search"
  | "history"
  | "extensions"
  | "runner"
  | "settings"
  | "problems"
  | "database";

/** A saved project: a folder plus metadata for fast re-opening. */
export interface Project {
  id: string;
  name: string;
  path: string;
  description: string;
  color: string;
  lastOpened: number;
  openPaths: string[];
}

/** A user-curated extension entry (the "dev window" lets you add these). */
export interface ExtItem {
  id: string;
  name: string;
  description: string;
  category: string;
  /** Optional shell hint shown to install the underlying package/server. */
  install?: string;
  custom?: boolean;
}

export interface Toast {
  id: number;
  kind: "info" | "error" | "success";
  msg: string;
}

export interface PromptReq {
  title: string;
  placeholder?: string;
  initial?: string;
}

interface PersistShape {
  theme: ThemeName;
  folder: string | null;
  openPaths: string[];
  activePath: string | null;
  sidebarVisible: boolean;
  editor: Partial<EditorSettings>;
  addons: string[];
  runner: Record<string, string>;
  extEnabled: string[];
  extCustom: ExtItem[];
  projects?: Project[];
  keymap?: Record<string, string>;
  onboarded?: boolean;
}

interface AppState {
  // ── persisted-ish ──
  theme: ThemeName;
  folder: string | null;
  sidebarVisible: boolean;
  zen: boolean;
  editor: EditorSettings;
  addons: Set<string>; // enabled addon ids
  runner: Record<string, string>; // lang -> command template
  extEnabled: Set<string>; // enabled extension ids
  extCustom: ExtItem[]; // user-added catalog entries
  projects: Project[];
  keymap: Record<string, string>; // keybinding id -> combo override

  // ── runner session ──
  output: OutputLine[];
  running: boolean;
  outputOpen: boolean;
  termOpen: boolean;
  mdPreview: boolean;
  /** Right-pane file path for split editing, or null. */
  splitPath: string | null;

  // ── session ──
  tabs: Tab[];
  activePath: string | null;
  expanded: Set<string>;
  branch: string | null;
  gitStatuses: Map<string, GitStatusKind>;
  lsp: LspState;
  cursor: { line: number; col: number };
  paletteOpen: boolean;
  paletteMode: "commands" | "files";
  panel: PanelKind;
  /** Open file shown in a diff view (HEAD vs working), or null for normal edit. */
  diffPath: string | null;
  gitRev: number; // bump to force git re-reads
  treeRev: number; // bump to force file-tree re-reads
  toasts: Toast[];
  prompt: PromptReq | null;
  onboardingOpen: boolean; // first-launch tour
  ready: boolean;

  // ── actions ──
  setTheme: (t: ThemeName) => void;
  cycleTheme: () => void;
  setFolder: (path: string | null) => void;
  tasks: Task[];
  loadTasks: () => void;
  toggleExpand: (path: string) => void;
  setExpanded: (path: string, open: boolean) => void;

  addTab: (path: string, content: string) => void;
  closeTab: (path: string) => void;
  setActive: (path: string) => void;
  updateContent: (path: string, content: string) => void;
  markSaved: (path: string) => void;
  nextTab: (dir: 1 | -1) => void;

  toggleSidebar: () => void;
  toggleZen: () => void;
  setBranch: (b: string | null) => void;
  setGitStatuses: (s: Map<string, GitStatusKind>) => void;
  setLsp: (s: Partial<LspState>) => void;
  setCursor: (line: number, col: number) => void;
  openPalette: (mode: "commands" | "files") => void;
  closePalette: () => void;
  openPanel: (p: PanelKind) => void;
  togglePanel: (p: PanelKind) => void;
  closePanel: () => void;
  openDiff: (path: string | null) => void;
  bumpGit: () => void;
  bumpTree: () => void;
  toast: (kind: Toast["kind"], msg: string) => void;
  dismissToast: (id: number) => void;
  setPrompt: (p: PromptReq | null) => void;
  finishOnboarding: () => void;
  openOnboarding: () => void;

  setEditorSetting: <K extends keyof EditorSettings>(k: K, v: EditorSettings[K]) => void;
  toggleAddon: (id: string) => void;
  isAddonOn: (id: string) => boolean;
  toggleExt: (id: string) => void;
  addCustomExt: (e: ExtItem) => void;
  removeCustomExt: (id: string) => void;
  setKeybinding: (id: string, combo: string) => void;
  resetKeybinding: (id: string) => void;
  resetAllKeybindings: () => void;
  saveProject: (p: Project) => void;
  removeProject: (id: string) => void;
  touchProject: (path: string, openPaths: string[]) => void;
  exportConfig: () => string;
  importConfig: (json: string) => boolean;
  setRunnerCmd: (lang: string, cmd: string) => void;
  appendOutput: (l: OutputLine) => void;
  clearOutput: () => void;
  setRunning: (b: boolean) => void;
  toggleOutput: () => void;
  setOutputOpen: (b: boolean) => void;
  toggleTerm: () => void;
  setTermOpen: (b: boolean) => void;
  closeBottom: () => void;
  toggleMdPreview: () => void;
  setSplit: (path: string | null) => void;

  hydrate: () => Promise<{ folder: string | null; openPaths: string[]; activePath: string | null }>;
}

const THEMES: ThemeName[] = THEME_NAMES;

let storePromise: Promise<Store> | null = null;
function settingsStore(): Promise<Store> {
  if (!storePromise)
    storePromise = load("settings.json", { autoSave: false, defaults: {} });
  return storePromise;
}

function applyThemeAttr(theme: ThemeName) {
  document.documentElement.dataset.theme = theme;
}

let onboardedFlag = false;

// Only the primary ("main") window owns the persisted session, so additional
// windows can hold their own folder/tabs without clobbering it.
let isMainWindow = true;
try {
  isMainWindow = getCurrentWindow().label === "main";
} catch {
  isMainWindow = true;
}

async function persist(get: () => AppState) {
  if (!isMainWindow) return;
  const s = get();
  const shape: PersistShape = {
    theme: s.theme,
    folder: s.folder,
    openPaths: s.tabs.map((t) => t.path),
    activePath: s.activePath,
    sidebarVisible: s.sidebarVisible,
    editor: s.editor,
    addons: [...s.addons],
    runner: s.runner,
    extEnabled: [...s.extEnabled],
    extCustom: s.extCustom,
    projects: s.projects,
    keymap: s.keymap,
    onboarded: onboardedFlag,
  };
  try {
    const store = await settingsStore();
    await store.set("app", shape);
    await store.save();
  } catch (e) {
    console.error("persist failed", e);
  }
}

export const useStore = create<AppState>((set, get) => {
  const schedulePersist = () => void persist(get);

  return {
    theme: "arctic",
    folder: null,
    sidebarVisible: true,
    zen: false,
    editor: { ...DEFAULT_EDITOR_SETTINGS },
    addons: new Set<string>(),
    runner: { ...DEFAULT_RUNNER },
    extEnabled: new Set<string>(),
    extCustom: [],
    projects: [],
    keymap: {},
    output: [],
    running: false,
    outputOpen: false,
    termOpen: false,
    mdPreview: false,
    splitPath: null,

    tabs: [],
    activePath: null,
    expanded: new Set<string>(),
    branch: null,
    gitStatuses: new Map(),
    lsp: { language: null, serverName: null, connected: false },
    cursor: { line: 1, col: 1 },
    paletteOpen: false,
    paletteMode: "commands",
    panel: "none",
    diffPath: null,
    gitRev: 0,
    treeRev: 0,
    toasts: [],
    prompt: null,
    onboardingOpen: false,
    ready: false,

    setTheme: (t) => {
      applyThemeAttr(t);
      set({ theme: t });
      schedulePersist();
    },
    cycleTheme: () => {
      const cur = get().theme;
      const next = THEMES[(THEMES.indexOf(cur) + 1) % THEMES.length];
      get().setTheme(next);
    },
    setFolder: (path) => {
      set({ folder: path, expanded: new Set() });
      get().loadTasks();
      schedulePersist();
    },
    tasks: [],
    loadTasks: async () => {
      const f = get().folder;
      if (!f) return set({ tasks: [] });
      try {
        set({ tasks: await tasksApi.detect(f) });
      } catch {
        set({ tasks: [] });
      }
    },
    toggleExpand: (path) => {
      const ex = new Set(get().expanded);
      ex.has(path) ? ex.delete(path) : ex.add(path);
      set({ expanded: ex });
    },
    setExpanded: (path, open) => {
      const ex = new Set(get().expanded);
      open ? ex.add(path) : ex.delete(path);
      set({ expanded: ex });
    },

    addTab: (path, content) => {
      const existing = get().tabs.find((t) => t.path === path);
      if (existing) {
        set({ activePath: path });
        schedulePersist();
        return;
      }
      const lang = detectLang(path);
      const tab: Tab = {
        path,
        name: basename(path),
        content,
        saved: content,
        monacoLang: lang.monaco,
        lspLang: lang.lsp,
      };
      set({ tabs: [...get().tabs, tab], activePath: path });
      schedulePersist();
    },
    closeTab: (path) => {
      const { tabs, activePath } = get();
      const idx = tabs.findIndex((t) => t.path === path);
      if (idx === -1) return;
      const next = tabs.filter((t) => t.path !== path);
      let nextActive = activePath;
      if (activePath === path) {
        nextActive = next.length ? next[Math.min(idx, next.length - 1)].path : null;
      }
      set({ tabs: next, activePath: nextActive });
      schedulePersist();
    },
    setActive: (path) => {
      set({ activePath: path, diffPath: null });
      schedulePersist();
    },
    updateContent: (path, content) => {
      set({
        tabs: get().tabs.map((t) => (t.path === path ? { ...t, content } : t)),
      });
    },
    markSaved: (path) => {
      set({
        tabs: get().tabs.map((t) =>
          t.path === path ? { ...t, saved: t.content } : t,
        ),
      });
    },
    nextTab: (dir) => {
      const { tabs, activePath } = get();
      if (tabs.length < 2) return;
      const idx = tabs.findIndex((t) => t.path === activePath);
      const next = (idx + dir + tabs.length) % tabs.length;
      get().setActive(tabs[next].path);
    },

    toggleSidebar: () => {
      set({ sidebarVisible: !get().sidebarVisible });
      schedulePersist();
    },
    toggleZen: () => set({ zen: !get().zen }),
    setBranch: (b) => set({ branch: b }),
    setGitStatuses: (s) => set({ gitStatuses: s }),
    setLsp: (s) => set({ lsp: { ...get().lsp, ...s } }),
    setCursor: (line, col) => set({ cursor: { line, col } }),
    openPalette: (mode) => set({ paletteOpen: true, paletteMode: mode }),
    closePalette: () => set({ paletteOpen: false }),
    openPanel: (p) => set({ panel: p }),
    togglePanel: (p) => set({ panel: get().panel === p ? "none" : p }),
    closePanel: () => set({ panel: "none" }),
    openDiff: (path) => set({ diffPath: path }),
    bumpGit: () => set({ gitRev: get().gitRev + 1 }),
    bumpTree: () => set({ treeRev: get().treeRev + 1 }),
    toast: (kind, msg) => {
      const id = get().gitRev * 1000 + get().toasts.length + Math.floor(performance.now());
      const t: Toast = { id, kind, msg };
      set({ toasts: [...get().toasts, t] });
      window.setTimeout(() => {
        set({ toasts: get().toasts.filter((x) => x.id !== id) });
      }, kind === "error" ? 7000 : 3500);
    },
    dismissToast: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
    setPrompt: (p) => set({ prompt: p }),
    finishOnboarding: () => {
      onboardedFlag = true;
      set({ onboardingOpen: false });
      schedulePersist();
    },
    openOnboarding: () => set({ onboardingOpen: true }),

    setEditorSetting: (k, v) => {
      set({ editor: { ...get().editor, [k]: v } });
      schedulePersist();
    },
    toggleAddon: (id) => {
      const next = new Set(get().addons);
      next.has(id) ? next.delete(id) : next.add(id);
      set({ addons: next });
      schedulePersist();
    },
    isAddonOn: (id) => get().addons.has(id),
    toggleExt: (id) => {
      const next = new Set(get().extEnabled);
      next.has(id) ? next.delete(id) : next.add(id);
      set({ extEnabled: next });
      schedulePersist();
    },
    addCustomExt: (e) => {
      if (get().extCustom.some((x) => x.id === e.id)) return;
      set({ extCustom: [...get().extCustom, { ...e, custom: true }] });
      schedulePersist();
    },
    removeCustomExt: (id) => {
      const next = new Set(get().extEnabled);
      next.delete(id);
      set({ extCustom: get().extCustom.filter((x) => x.id !== id), extEnabled: next });
      schedulePersist();
    },
    setKeybinding: (id, combo) => {
      set({ keymap: { ...get().keymap, [id]: combo } });
      schedulePersist();
    },
    resetKeybinding: (id) => {
      const next = { ...get().keymap };
      delete next[id];
      set({ keymap: next });
      schedulePersist();
    },
    resetAllKeybindings: () => {
      set({ keymap: {} });
      schedulePersist();
    },
    saveProject: (p) => {
      const others = get().projects.filter((x) => x.id !== p.id);
      set({ projects: [...others, p].sort((a, b) => b.lastOpened - a.lastOpened) });
      schedulePersist();
    },
    removeProject: (id) => {
      set({ projects: get().projects.filter((p) => p.id !== id) });
      schedulePersist();
    },
    touchProject: (path, openPaths) => {
      const projects = get().projects.map((p) =>
        p.path === path ? { ...p, lastOpened: Date.now(), openPaths } : p,
      );
      set({ projects: projects.sort((a, b) => b.lastOpened - a.lastOpened) });
      schedulePersist();
    },
    exportConfig: () => {
      const s = get();
      return JSON.stringify(
        {
          version: 1,
          theme: s.theme,
          editor: s.editor,
          addons: [...s.addons],
          runner: s.runner,
          extEnabled: [...s.extEnabled],
          extCustom: s.extCustom,
          keymap: s.keymap,
          projects: s.projects,
        },
        null,
        2,
      );
    },
    importConfig: (json) => {
      try {
        const c = JSON.parse(json);
        if (c.theme) get().setTheme(c.theme);
        set({
          editor: { ...DEFAULT_EDITOR_SETTINGS, ...(c.editor ?? {}) },
          addons: new Set(c.addons ?? []),
          runner: { ...DEFAULT_RUNNER, ...(c.runner ?? {}) },
          extEnabled: new Set(c.extEnabled ?? []),
          extCustom: c.extCustom ?? [],
          keymap: c.keymap ?? {},
          projects: c.projects ?? get().projects,
        });
        schedulePersist();
        return true;
      } catch {
        return false;
      }
    },
    setRunnerCmd: (lang, cmd) => {
      set({ runner: { ...get().runner, [lang]: cmd } });
      schedulePersist();
    },
    appendOutput: (l) => {
      const out = get().output;
      // cap to last 2000 lines
      set({ output: out.length > 2000 ? [...out.slice(-1800), l] : [...out, l] });
    },
    clearOutput: () => set({ output: [] }),
    setRunning: (b) => set({ running: b }),
    toggleOutput: () => set({ outputOpen: !get().outputOpen, termOpen: false }),
    setOutputOpen: (b) => set({ outputOpen: b, ...(b ? { termOpen: false } : {}) }),
    toggleTerm: () => set({ termOpen: !get().termOpen, outputOpen: false }),
    setTermOpen: (b) => set({ termOpen: b, ...(b ? { outputOpen: false } : {}) }),
    closeBottom: () => set({ outputOpen: false, termOpen: false }),
    toggleMdPreview: () => set({ mdPreview: !get().mdPreview }),
    setSplit: (path) => set({ splitPath: path }),

    hydrate: async () => {
      let shape: PersistShape | null = null;
      try {
        const store = await settingsStore();
        shape = (await store.get<PersistShape>("app")) ?? null;
      } catch (e) {
        console.error("hydrate failed", e);
      }
      const theme = shape?.theme ?? "arctic";
      onboardedFlag = shape?.onboarded ?? false;
      applyThemeAttr(theme);
      set({
        theme,
        folder: shape?.folder ?? null,
        sidebarVisible: shape?.sidebarVisible ?? true,
        editor: { ...DEFAULT_EDITOR_SETTINGS, ...(shape?.editor ?? {}) },
        addons: new Set(shape?.addons ?? []),
        runner: { ...DEFAULT_RUNNER, ...(shape?.runner ?? {}) },
        extEnabled: new Set(shape?.extEnabled ?? []),
        extCustom: shape?.extCustom ?? [],
        projects: shape?.projects ?? [],
        keymap: shape?.keymap ?? {},
        onboardingOpen: !(shape?.onboarded ?? false),
        ready: true,
      });
      if (shape?.folder) get().loadTasks();
      return {
        folder: shape?.folder ?? null,
        openPaths: shape?.openPaths ?? [],
        activePath: shape?.activePath ?? null,
      };
    },
  };
});

export function activeTab(s: AppState): Tab | null {
  return s.tabs.find((t) => t.path === s.activePath) ?? null;
}

export function isDirty(t: Tab): boolean {
  return t.content !== t.saved;
}
