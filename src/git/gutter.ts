// src/git/gutter.ts — per-line git change markers in the editor gutter (§6.6).
// We ask Rust for the diff hunks of the active file vs HEAD and translate them
// into thin Monaco gutter decorations colored by the active theme (via CSS).
import type { editor as MEditor } from "monaco-editor";
import { getEditor } from "../editorBridge";
import { gitApi } from "../ipc";
import { useStore } from "../store/useStore";

let decorations: MEditor.IEditorDecorationsCollection | null = null;

export async function refreshLineDiff(path: string) {
  const ed = getEditor();
  const folder = useStore.getState().folder;
  if (!ed || !folder) {
    decorations?.clear();
    return;
  }
  let hunks;
  try {
    hunks = await gitApi.lineDiff(folder, path);
  } catch {
    // Not a git repo / not tracked — clear and move on.
    decorations?.clear();
    return;
  }
  // The active file may have changed while we awaited.
  if (useStore.getState().activePath !== path) return;

  const newDecos: MEditor.IModelDeltaDecoration[] = hunks.map((h) => {
    const cls =
      h.kind === "added"
        ? "kern-gutter-added"
        : h.kind === "deleted"
          ? "kern-gutter-deleted"
          : "kern-gutter-modified";
    return {
      range: { startLineNumber: h.start, startColumn: 1, endLineNumber: h.end, endColumn: 1 },
      options: {
        isWholeLine: false,
        linesDecorationsClassName: cls,
      },
    };
  });
  if (!decorations) decorations = ed.createDecorationsCollection(newDecos);
  else decorations.set(newDecos);
}

export function clearLineDiff() {
  decorations?.clear();
}
