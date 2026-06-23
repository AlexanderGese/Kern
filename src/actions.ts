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
  // Apply trim-trailing-whitespace / insert-final-newline before reading.
  const ed = getEditor();
  if (ed) applyOnSaveFixups(ed, state.editor.trimWhitespace, state.editor.insertFinalNewline);
  // Pull the freshest text straight from the model in case onChange is mid-flight.
  const content = ed?.getModel()?.getValue() ?? tab.content;
  try {
    await fsApi.saveFile(tab.path, content);
    useStore.getState().updateContent(tab.path, content);
    useStore.getState().markSaved(tab.path);
    // Re-lint on the saved file (external linters need it on disk).
    import("./editor/format").then((m) => m.lintActive(tab.path, tab.monacoLang)).catch(() => {});
  } catch (e) {
    console.error("save failed", e);
  }
}

/** Trailing-whitespace trim + single final newline, applied via editor edits so
 *  undo and cursor survive. No-op when both are off. */
function applyOnSaveFixups(ed: ReturnType<typeof getEditor>, trim: boolean, finalNl: boolean) {
  const model = ed?.getModel();
  if (!model || (!trim && !finalNl)) return;
  const edits: { range: import("monaco-editor").IRange; text: string }[] = [];
  if (trim) {
    const lines = model.getLineCount();
    for (let i = 1; i <= lines; i++) {
      const text = model.getLineContent(i);
      const trimmed = text.replace(/[ \t]+$/, "");
      if (trimmed.length !== text.length) {
        edits.push({
          range: { startLineNumber: i, startColumn: trimmed.length + 1, endLineNumber: i, endColumn: text.length + 1 },
          text: "",
        });
      }
    }
  }
  if (finalNl) {
    const last = model.getLineCount();
    const lastText = model.getLineContent(last);
    if (lastText.length > 0) {
      edits.push({
        range: { startLineNumber: last, startColumn: lastText.length + 1, endLineNumber: last, endColumn: lastText.length + 1 },
        text: "\n",
      });
    }
  }
  if (edits.length) ed!.executeEdits("kern.onSave", edits.map((e) => ({ ...e, forceMoveMarkers: true })));
}

export function closeActive() {
  const { activePath, closeTab } = useStore.getState();
  if (activePath) closeTab(activePath);
}
