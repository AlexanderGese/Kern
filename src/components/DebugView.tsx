// src/components/DebugView.tsx — the debugger UI inside the bottom dock:
// controls, call stack, variables, and a debug console.
import { useEffect, useRef } from "react";
import { useDebug } from "../dap/store";
import { dbgContinue, dbgNext, dbgStepIn, dbgStepOut, dbgPause, stopDebug, startDebug } from "../dap/client";
import { useStore, activeTab } from "../store/useStore";
import { openAt } from "../actions";

export function DebugView() {
  const session = useDebug((s) => s.session);
  const stack = useDebug((s) => s.stack);
  const vars = useDebug((s) => s.vars);
  const log = useDebug((s) => s.console);
  const tab = useStore(activeTab);
  const consoleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = consoleRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [log]);

  const stopped = session === "stopped";
  const active = session !== "idle";

  return (
    <div className="debug">
      <div className="debug__bar">
        {!active ? (
          <button
            className="debug__btn debug__btn--go"
            title="Start debugging the active file (Python)"
            disabled={!tab}
            onClick={() => tab && void startDebug(tab.path, "python")}
          >
            ▶ Start
          </button>
        ) : (
          <>
            <button className="debug__btn" title="Continue" disabled={!stopped} onClick={() => void dbgContinue()}>▶</button>
            <button className="debug__btn" title="Pause" disabled={stopped} onClick={() => void dbgPause()}>⏸</button>
            <button className="debug__btn" title="Step over" disabled={!stopped} onClick={() => void dbgNext()}>⤵</button>
            <button className="debug__btn" title="Step into" disabled={!stopped} onClick={() => void dbgStepIn()}>↳</button>
            <button className="debug__btn" title="Step out" disabled={!stopped} onClick={() => void dbgStepOut()}>↰</button>
            <button className="debug__btn debug__btn--stop" title="Stop" onClick={() => void stopDebug()}>■</button>
          </>
        )}
        <span className="debug__state">{session}</span>
      </div>

      <div className="debug__panes">
        <div className="debug__pane">
          <div className="debug__h">Call stack</div>
          {stack.length === 0 && <div className="debug__empty">—</div>}
          {stack.map((f) => (
            <div key={f.id} className="debug__frame" onClick={() => f.path && void openAt(f.path, f.line)}>
              <span className="debug__frame-name">{f.name}</span>
              <span className="debug__frame-loc">{f.path.split(/[\\/]/).pop()}:{f.line}</span>
            </div>
          ))}
        </div>
        <div className="debug__pane">
          <div className="debug__h">Variables</div>
          {vars.length === 0 && <div className="debug__empty">—</div>}
          {vars.map((v, i) => (
            <div key={i} className="debug__var">
              <span className="debug__var-k">{v.name}</span>
              <span className="debug__var-v">{v.value}</span>
            </div>
          ))}
        </div>
        <div className="debug__pane debug__pane--console">
          <div className="debug__h">Debug console</div>
          <div className="debug__console" ref={consoleRef}>
            {log.map((l, i) => (
              <div key={i} className="debug__log">{l || " "}</div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
