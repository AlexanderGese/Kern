// src/components/ProblemsPanel.tsx — aggregated diagnostics from all open
// models (Monaco markers), grouped by file, click to jump.
import { useEffect, useState } from "react";
import { useStore } from "../store/useStore";
import { getMonaco } from "../editorBridge";
import { openAt } from "../actions";
import { basename } from "../lang";

interface Problem {
  path: string;
  line: number;
  col: number;
  message: string;
  severity: number; // 8 error, 4 warning, 2 info, 1 hint
  source?: string;
}

export function ProblemsPanel() {
  const close = useStore((s) => s.closePanel);
  const [problems, setProblems] = useState<Problem[]>([]);

  useEffect(() => {
    const monaco = getMonaco();
    if (!monaco) return;
    const refresh = () => {
      const markers = monaco.editor.getModelMarkers({});
      setProblems(
        markers.map((m) => ({
          path: m.resource.path,
          line: m.startLineNumber,
          col: m.startColumn,
          message: m.message,
          severity: m.severity,
          source: m.source,
        })),
      );
    };
    refresh();
    const sub = monaco.editor.onDidChangeMarkers(refresh);
    return () => sub.dispose();
  }, []);

  const grouped = groupBy(problems, (p) => p.path);

  return (
    <div className="modal-overlay" onMouseDown={close}>
      <div className="modal modal--wide" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <span className="modal__title">
            Problems <span className="problems__count">{problems.length}</span>
          </span>
          <span className="modal__close" onClick={close}>×</span>
        </div>
        <div className="modal__body">
          {problems.length === 0 ? (
            <div className="panel__empty">No problems detected in open files.</div>
          ) : (
            grouped.map(([path, items]) => (
              <div className="problems__group" key={path}>
                <div className="problems__file">{basename(path)} <span className="problems__filecount">{items.length}</span></div>
                {items.map((p, i) => (
                  <div className="problems__row" key={i} onClick={() => { openAt(p.path, p.line, p.col); close(); }}>
                    <span className={"problems__sev sev-" + sevClass(p.severity)} />
                    <span className="problems__msg">{p.message}</span>
                    <span className="problems__loc">{p.source ? p.source + " · " : ""}{p.line}:{p.col}</span>
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function sevClass(s: number): string {
  if (s >= 8) return "error";
  if (s >= 4) return "warn";
  return "info";
}
function groupBy<T>(arr: T[], key: (t: T) => string): [string, T[]][] {
  const m = new Map<string, T[]>();
  for (const x of arr) {
    const k = key(x);
    if (!m.has(k)) m.set(k, []);
    m.get(k)!.push(x);
  }
  return [...m.entries()];
}
