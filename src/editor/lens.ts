// src/editor/lens.ts — inline diagnostics ("error-lens") + TODO/FIXME highlight.
// Both attach to a Monaco editor and return a disposer. Kept out of Editor.tsx
// so the component stays readable.
import type { editor as MEditor, IDisposable } from "monaco-editor";

type Monaco = typeof import("monaco-editor");

const SEV: Record<number, string> = { 8: "error", 4: "warning", 2: "info", 1: "hint" };

/** Render the worst diagnostic per line at the end of the line, error-lens style. */
export function attachErrorLens(monaco: Monaco, ed: MEditor.IStandaloneCodeEditor): IDisposable {
  const col = ed.createDecorationsCollection([]);
  const paint = () => {
    const model = ed.getModel();
    if (!model) return col.clear();
    const markers = monaco.editor.getModelMarkers({ resource: model.uri });
    const worst = new Map<number, MEditor.IMarker>();
    for (const m of markers) {
      if (m.severity < 4) continue; // only warnings + errors inline
      const cur = worst.get(m.startLineNumber);
      if (!cur || m.severity > cur.severity) worst.set(m.startLineNumber, m);
    }
    const decos: MEditor.IModelDeltaDecoration[] = [];
    for (const [line, m] of worst) {
      const sev = SEV[m.severity] ?? "info";
      const endCol = model.getLineMaxColumn(line);
      decos.push({
        range: new monaco.Range(line, endCol, line, endCol),
        options: {
          isWholeLine: true,
          className: `kern-lens-line kern-lens-line--${sev}`,
          after: {
            content: `      ${m.message.replace(/\s+/g, " ").slice(0, 160)}`,
            inlineClassName: `kern-lens kern-lens--${sev}`,
          },
        },
      });
    }
    col.set(decos);
  };
  const d1 = monaco.editor.onDidChangeMarkers(() => paint());
  const d2 = ed.onDidChangeModel(() => paint());
  paint();
  return { dispose: () => { d1.dispose(); d2.dispose(); col.clear(); } };
}

const TODO_RE = /\b(TODO|FIXME|HACK|XXX|BUG|NOTE)\b/g;

/** Highlight TODO/FIXME/… keywords anywhere in the file. */
export function attachTodos(monaco: Monaco, ed: MEditor.IStandaloneCodeEditor): IDisposable {
  const col = ed.createDecorationsCollection([]);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const paint = () => {
    const model = ed.getModel();
    if (!model) return col.clear();
    const decos: MEditor.IModelDeltaDecoration[] = [];
    const total = model.getLineCount();
    for (let i = 1; i <= total; i++) {
      const text = model.getLineContent(i);
      TODO_RE.lastIndex = 0;
      let mm: RegExpExecArray | null;
      while ((mm = TODO_RE.exec(text))) {
        const kind = mm[1].toLowerCase();
        decos.push({
          range: new monaco.Range(i, mm.index + 1, i, mm.index + 1 + mm[1].length),
          options: { inlineClassName: `kern-todo kern-todo--${kind}` },
        });
      }
    }
    col.set(decos);
  };
  const schedule = () => { clearTimeout(timer); timer = setTimeout(paint, 250); };
  const d1 = ed.onDidChangeModelContent(schedule);
  const d2 = ed.onDidChangeModel(() => paint());
  paint();
  return { dispose: () => { clearTimeout(timer); d1.dispose(); d2.dispose(); col.clear(); } };
}
