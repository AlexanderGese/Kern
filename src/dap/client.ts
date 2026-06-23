// src/dap/client.ts — minimal Debug Adapter Protocol client. Connects to the
// Rust DAP bridge over a WebSocket and drives a Python (debugpy) launch session:
// breakpoints, stop events, call stack, variables, stepping.
import { invoke } from "@tauri-apps/api/core";
import { useDebug } from "./store";
import { useStore } from "../store/useStore";
import { openAt } from "../actions";

interface Pending {
  resolve: (body: any) => void;
  reject: (e: any) => void;
}

let ws: WebSocket | null = null;
let seq = 1;
const pending = new Map<number, Pending>();
let curThread: number | null = null;
let launchFile = "";

function send(command: string, args?: any): Promise<any> {
  return new Promise((resolve, reject) => {
    if (!ws || ws.readyState !== ws.OPEN) return reject(new Error("not connected"));
    const s = seq++;
    pending.set(s, { resolve, reject });
    ws.send(JSON.stringify({ seq: s, type: "request", command, arguments: args ?? {} }));
  });
}

function bpArgsFor(path: string) {
  const lines = useDebug.getState().bpFor(path);
  return {
    source: { path, name: path.split(/[\\/]/).pop() },
    breakpoints: lines.map((line) => ({ line })),
    lines,
  };
}

async function onStopped(threadId: number) {
  curThread = threadId;
  const d = useDebug.getState();
  d.setSession("stopped");
  try {
    const st = await send("stackTrace", { threadId, levels: 20 });
    const frames = (st.stackFrames ?? []).map((f: any) => ({
      id: f.id,
      name: f.name,
      path: f.source?.path ?? "",
      line: f.line,
    }));
    d.setStack(frames);
    if (frames[0]) {
      d.setStoppedAt({ path: frames[0].path, line: frames[0].line });
      if (frames[0].path) void openAt(frames[0].path, frames[0].line);
      const scopes = await send("scopes", { frameId: frames[0].id });
      const ref = scopes.scopes?.[0]?.variablesReference;
      if (ref) {
        const vars = await send("variables", { variablesReference: ref });
        d.setVars((vars.variables ?? []).map((v: any) => ({ name: v.name, value: v.value })));
      }
    }
  } catch {
    /* ignore */
  }
}

function handleEvent(msg: any) {
  const d = useDebug.getState();
  switch (msg.event) {
    case "initialized":
      // Now configuration: register breakpoints for files that have them, then done.
      (async () => {
        const bps = useDebug.getState().breakpoints;
        for (const path of Object.keys(bps)) {
          if (bps[path].length) await send("setBreakpoints", bpArgsFor(path)).catch(() => {});
        }
        await send("configurationDone").catch(() => {});
      })();
      break;
    case "stopped":
      void onStopped(msg.body.threadId);
      break;
    case "continued":
      d.setSession("running");
      d.setStoppedAt(null);
      break;
    case "output":
      d.log(String(msg.body?.output ?? "").replace(/\n$/, ""));
      break;
    case "terminated":
    case "exited":
      d.log("— debuggee terminated —");
      d.reset();
      teardown();
      break;
  }
}

function teardown() {
  ws?.close();
  ws = null;
  pending.clear();
  curThread = null;
}

export async function startDebug(file: string, kind = "python") {
  const app = useStore.getState();
  const d = useDebug.getState();
  if (ws) teardown();
  d.reset();
  d.setSession("starting");
  app.setDebugOpen(true);
  launchFile = file;
  let port: number;
  try {
    port = await invoke<number>("dap_start", { kind });
  } catch (e) {
    app.toast("error", `No debug adapter: ${String(e).slice(0, 80)}`);
    d.setSession("idle");
    return;
  }
  ws = new WebSocket(`ws://127.0.0.1:${port}`);
  ws.onmessage = (ev) => {
    let msg: any;
    try {
      msg = JSON.parse(ev.data);
    } catch {
      return;
    }
    if (msg.type === "response") {
      const p = pending.get(msg.request_seq);
      if (p) {
        pending.delete(msg.request_seq);
        msg.success ? p.resolve(msg.body ?? {}) : p.reject(new Error(msg.message));
      }
    } else if (msg.type === "event") {
      handleEvent(msg);
    }
  };
  ws.onclose = () => {
    if (useDebug.getState().session !== "idle") useDebug.getState().reset();
  };
  ws.onopen = async () => {
    try {
      await send("initialize", {
        clientID: "kern",
        adapterID: kind,
        linesStartAt1: true,
        columnsStartAt1: true,
        pathFormat: "path",
        supportsRunInTerminalRequest: false,
      });
      const cwd = app.folder ?? file.replace(/[\\/][^\\/]*$/, "");
      await send("launch", {
        request: "launch",
        type: kind,
        name: "Kern Debug",
        program: file,
        console: "internalConsole",
        cwd,
        stopOnEntry: false,
        justMyCode: true,
        python: "python3",
      });
      d.setSession("running");
      d.log(`▸ debugging ${file.split(/[\\/]/).pop()}`);
    } catch (e) {
      app.toast("error", `Debug launch failed: ${String(e).slice(0, 100)}`);
      d.reset();
      teardown();
    }
  };
}

const ctl = (command: string) => async () => {
  if (curThread != null) await send(command, { threadId: curThread }).catch(() => {});
};
export const dbgContinue = ctl("continue");
export const dbgNext = ctl("next");
export const dbgStepIn = ctl("stepIn");
export const dbgStepOut = ctl("stepOut");
export const dbgPause = ctl("pause");

export async function stopDebug() {
  try {
    await send("disconnect", { terminateDebuggee: true });
  } catch {
    /* ignore */
  }
  useDebug.getState().reset();
  teardown();
}

/** Push breakpoint changes for a file to a live session. */
export async function syncBreakpoints(path: string) {
  if (ws && ws.readyState === ws.OPEN) await send("setBreakpoints", bpArgsFor(path)).catch(() => {});
}

export function debugTargetFile(): string {
  return launchFile;
}
