// src/keybindings.ts — data-driven keybinding registry. The keymap matcher and
// the Keybindings editor both read this; user overrides live in store.keymap.
import { useStore } from "./store/useStore";
import { saveActive, closeActive } from "./actions";
import { runActiveFile } from "./runner";
import { formatDocument, goToSymbol } from "./editorCommands";
import { windowApi } from "./ipc";

export interface KeyBindingDef {
  id: string;
  label: string;
  default: string; // e.g. "mod+shift+p"
  run: () => void;
}

const s = () => useStore.getState();

export const KEYBINDINGS: KeyBindingDef[] = [
  { id: "file.save", label: "Save File", default: "mod+s", run: () => void saveActive() },
  { id: "palette.commands", label: "Command Palette", default: "mod+shift+p", run: () => s().openPalette("commands") },
  { id: "palette.files", label: "Go to File", default: "mod+p", run: () => s().openPalette("files") },
  { id: "view.sidebar", label: "Toggle File Tree", default: "mod+b", run: () => s().toggleSidebar() },
  { id: "tab.close", label: "Close Tab", default: "mod+w", run: () => closeActive() },
  { id: "tab.next", label: "Next Tab", default: "mod+alt+arrowright", run: () => s().nextTab(1) },
  { id: "tab.prev", label: "Previous Tab", default: "mod+alt+arrowleft", run: () => s().nextTab(-1) },
  { id: "search.project", label: "Find in Files", default: "mod+shift+f", run: () => s().togglePanel("search") },
  { id: "panel.extensions", label: "Extensions", default: "mod+shift+e", run: () => s().togglePanel("extensions") },
  { id: "panel.git", label: "Source Control", default: "mod+shift+g", run: () => s().togglePanel("git") },
  { id: "panel.addons", label: "Addons", default: "mod+shift+x", run: () => s().togglePanel("addons") },
  { id: "panel.settings", label: "Settings", default: "mod+,", run: () => s().openPanel("settings") },
  { id: "panel.problems", label: "Problems", default: "mod+shift+m", run: () => s().togglePanel("problems") },
  { id: "view.terminal", label: "Toggle Terminal", default: "mod+`", run: () => s().toggleTerm() },
  { id: "view.split", label: "Toggle Split Editor", default: "mod+\\", run: () => s().setSplit(s().splitPath ? null : s().activePath) },
  { id: "view.zen", label: "Toggle Zen Mode", default: "", run: () => s().toggleZen() },
  { id: "window.new", label: "New Window", default: "mod+shift+n", run: () => void windowApi.newWindow() },
  { id: "run.file", label: "Run File", default: "mod+shift+r", run: () => void runActiveFile() },
  { id: "format.doc", label: "Format Document", default: "mod+shift+i", run: () => void formatDocument() },
  { id: "symbol.goto", label: "Go to Symbol", default: "mod+shift+o", run: () => void goToSymbol() },
  { id: "editor.font-bigger", label: "Increase Font Size", default: "mod+=", run: () => s().setEditorSetting("fontSize", Math.min(32, s().editor.fontSize + 1)) },
  { id: "editor.font-smaller", label: "Decrease Font Size", default: "mod+-", run: () => s().setEditorSetting("fontSize", Math.max(8, s().editor.fontSize - 1)) },
  { id: "theme.cycle", label: "Cycle Theme", default: "", run: () => s().cycleTheme() },
];

/** Build a normalized combo string from a keyboard event. */
export function comboFromEvent(e: KeyboardEvent): string {
  const parts: string[] = [];
  if (e.metaKey || e.ctrlKey) parts.push("mod");
  if (e.altKey) parts.push("alt");
  if (e.shiftKey) parts.push("shift");
  let key = e.key.toLowerCase();
  if (key === " ") key = "space";
  // Ignore bare modifier presses.
  if (["control", "meta", "shift", "alt"].includes(key)) return "";
  parts.push(key);
  return parts.join("+");
}

/** The effective combo for a binding id (override or default). */
export function effectiveCombo(id: string, def: string): string {
  const override = useStore.getState().keymap[id];
  return override !== undefined ? override : def;
}

/** Pretty display, e.g. "mod+shift+p" -> "⌘ ⇧ P". */
export function prettyCombo(combo: string): string {
  if (!combo) return "—";
  const mac = navigator.platform.toLowerCase().includes("mac");
  return combo
    .split("+")
    .map((p) => {
      switch (p) {
        case "mod": return mac ? "⌘" : "Ctrl";
        case "shift": return "⇧";
        case "alt": return mac ? "⌥" : "Alt";
        case "arrowright": return "→";
        case "arrowleft": return "←";
        case "arrowup": return "↑";
        case "arrowdown": return "↓";
        case "`": return "`";
        case "space": return "Space";
        default: return p.length === 1 ? p.toUpperCase() : p;
      }
    })
    .join(" ");
}
