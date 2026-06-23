// src/editorCommands.ts — editor-level commands that drive Monaco's built-in
// actions (which are powered by the LSP providers registered in lsp/client.ts).
import { getEditor } from "./editorBridge";
import { useStore } from "./store/useStore";

export async function formatDocument() {
  const ed = getEditor();
  const action = ed?.getAction("editor.action.formatDocument");
  if (!action) return;
  try {
    await action.run();
  } catch {
    useStore.getState().toast("info", "No formatter available for this file");
  }
}

export async function goToSymbol() {
  const ed = getEditor();
  // Monaco's quick outline uses the registered documentSymbolProvider.
  await ed?.getAction("editor.action.quickOutline")?.run();
}
