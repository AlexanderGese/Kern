// src/components/BottomDock.tsx — bottom panel hosting the Terminal and the
// code-runner Output, switchable via tabs.
import { useEffect, useRef } from "react";
import { useStore, activeTab } from "../store/useStore";
import { Terminal } from "./Terminal";
import { DebugView } from "./DebugView";
import { runActiveFile, stopRun } from "../runner";
import { useDebug } from "../dap/store";
import { startDebug, stopDebug } from "../dap/client";

export function BottomDock() {
  const termOpen = useStore((s) => s.termOpen);
  const outputOpen = useStore((s) => s.outputOpen);
  const debugOpen = useStore((s) => s.debugOpen);
  const setTermOpen = useStore((s) => s.setTermOpen);
  const setOutputOpen = useStore((s) => s.setOutputOpen);
  const setDebugOpen = useStore((s) => s.setDebugOpen);
  const closeBottom = useStore((s) => s.closeBottom);

  if (!termOpen && !outputOpen && !debugOpen) return null;

  return (
    <div className="bottomdock">
      <div className="bottomdock__tabs">
        <button className={"bottomdock__tab" + (termOpen ? " is-active" : "")} onClick={() => setTermOpen(true)}>
          Terminal
        </button>
        <button className={"bottomdock__tab" + (outputOpen ? " is-active" : "")} onClick={() => setOutputOpen(true)}>
          Output
        </button>
        <button className={"bottomdock__tab" + (debugOpen ? " is-active" : "")} onClick={() => setDebugOpen(true)}>
          Debug
        </button>
        <span className="bottomdock__spacer" />
        {outputOpen && <OutputActions />}
        {debugOpen && <DebugActions />}
        <button className="bottomdock__act" title="Close" onClick={closeBottom}>×</button>
      </div>
      <div className="bottomdock__body">
        {termOpen ? <Terminal /> : outputOpen ? <OutputBody /> : <DebugView />}
      </div>
    </div>
  );
}

function OutputActions() {
  const running = useStore((s) => s.running);
  const clear = useStore((s) => s.clearOutput);
  return (
    <>
      <button className="bottomdock__act" title="Run again" onClick={() => void runActiveFile()}>▶</button>
      {running && <button className="bottomdock__act" title="Stop" onClick={() => void stopRun()}>■</button>}
      <button className="bottomdock__act" title="Clear" onClick={clear}>⌫</button>
    </>
  );
}

function DebugActions() {
  const session = useDebug((s) => s.session);
  const tab = useStore(activeTab);
  const idle = session === "idle";
  return idle ? (
    <button
      className="bottomdock__act bottomdock__act--go"
      title="Start debugging the active file (Python)"
      disabled={!tab}
      onClick={() => tab && void startDebug(tab.path, "python")}
    >
      ▶ Debug
    </button>
  ) : (
    <button className="bottomdock__act bottomdock__act--stop" title="Stop debugging" onClick={() => void stopDebug()}>
      ■ Stop
    </button>
  );
}

function OutputBody() {
  const output = useStore((s) => s.output);
  const bodyRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = bodyRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [output]);
  return (
    <div className="output__body" ref={bodyRef}>
      {output.length === 0 ? (
        <div className="output__empty">No output yet. Run a file (▶) to see results.</div>
      ) : (
        output.map((l, i) => (
          <div key={i} className={`output__line output__line--${l.stream}`}>{l.line || " "}</div>
        ))
      )}
    </div>
  );
}
