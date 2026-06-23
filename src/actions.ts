// src/actions.ts — shared imperative operations invoked from the tree, command
// palette, and keymap. Kept out of components so any surface can trigger them.
import { fsApi } from "./ipc";
import { useStore, activeTab } from "./store/useStore";
import { getEditor } from "./editorBridge";

export async function openPath(path: string) {
  const store = useStore.getState();
  const existing = store.tabs.find((t) => t.path === path);
  if (existing) {
    store.setActive(path);
    return;
  }
  try {
    const file = await fsApi.openFile(path);
    store.addTab(file.path, file.content);
  } catch (e) {
    console.error("open failed", e);
  }
}

export async function openAt(path: string, line: number, col = 1) {
  await openPath(path);
  // Let the model mount, then reveal + place the cursor.
  setTimeout(() => {
    const ed = getEditor();
    if (!ed) return;
    ed.revealLineInCenter(line);
    ed.setPosition({ lineNumber: line, column: col });
    ed.focus();
  }, 80);
}

export async function openFolderDialog() {
  const picked = await fsApi.pickFolder();
  if (picked) useStore.getState().setFolder(picked);
}

export async function saveActive() {
  const state = useStore.getState();
  const tab = activeTab(state);
  if (!tab) return;
  // Format-on-save: apply the formatter (edits the model) before reading.
  if (state.editor.formatOnSave) {
    const { formatDocument } = await import("./editorCommands");
    await formatDocument();
  }
  // Pull the freshest text straight from the model in case onChange is mid-flight.
  const ed = getEditor();
  const content = ed?.getModel()?.getValue() ?? tab.content;
  try {
    await fsApi.saveFile(tab.path, content);
    useStore.getState().updateContent(tab.path, content);
    useStore.getState().markSaved(tab.path);
  } catch (e) {
    console.error("save failed", e);
  }
}

export function closeActive() {
  const { activePath, closeTab } = useStore.getState();
  if (activePath) closeTab(activePath);
}
