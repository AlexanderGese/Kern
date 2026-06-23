// src/editorCommands.ts — editor-level commands that drive Monaco's built-in
// actions (which are powered by the LSP providers registered in lsp/client.ts).
import { getEditor } from "./editorBridge";
import { useStore } from "./store/useStore";
import { hasExternalFormatter, formatExternal } from "./editor/format";

export async function formatDocument() {
  const ed = getEditor();
  if (!ed) return;
  const s = useStore.getState();
  const lang = ed.getModel()?.getLanguageId() ?? "";
  // Prefer the language server's formatter when one is connected.
  if (s.lsp.connected && s.lsp.language) {
    try {
      await ed.getAction("editor.action.formatDocument")?.run();
      return;
    } catch {
      /* fall through to external */
    }
  }
  // Otherwise use an external CLI formatter (prettier/black/rustfmt/…).
  if (hasExternalFormatter(lang)) {
    if (await formatExternal()) return;
  }
  // Last resort: Monaco's built-in formatter (a few languages ship one).
  try {
    await ed.getAction("editor.action.formatDocument")?.run();
  } catch {
    s.toast("info", "No formatter available for this file");
  }
}

export async function goToSymbol() {
  const ed = getEditor();
  // Monaco's quick outline uses the registered documentSymbolProvider.
  await ed?.getAction("editor.action.quickOutline")?.run();
}
