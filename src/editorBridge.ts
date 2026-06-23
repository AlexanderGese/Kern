// src/editorBridge.ts — module-level handles to the live Monaco + editor so
// non-React modules (git gutter, LSP, command palette actions) can reach them.
import type { editor as MEditor } from "monaco-editor";

type Monaco = typeof import("monaco-editor");

let monacoInstance: Monaco | null = null;
let editorInstance: MEditor.IStandaloneCodeEditor | null = null;

export function setMonaco(m: Monaco) {
  monacoInstance = m;
}
export function setEditor(e: MEditor.IStandaloneCodeEditor) {
  editorInstance = e;
}
export function getMonaco(): Monaco | null {
  return monacoInstance;
}
export function getEditor(): MEditor.IStandaloneCodeEditor | null {
  return editorInstance;
}
