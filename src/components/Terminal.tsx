// src/components/Terminal.tsx — xterm.js front-end for the PTY backend.
import { useEffect, useRef } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { listen } from "@tauri-apps/api/event";
import "@xterm/xterm/css/xterm.css";
import { useStore } from "../store/useStore";
import { termApi } from "../ipc";

const THEME = {
  background: "#151414",
  foreground: "#ece9e3",
  cursor: "#ece9e3",
  selectionBackground: "#ffffff22",
  black: "#1a1918",
  brightBlack: "#5b554e",
  white: "#9a948b",
  brightWhite: "#ece9e3",
};

export function Terminal() {
  const folder = useStore((s) => s.folder);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const term = new XTerm({
      fontFamily: "JetBrains Mono, ui-monospace, monospace",
      fontSize: 13,
      lineHeight: 1.2,
      theme: THEME,
      cursorBlink: true,
      allowProposedApi: true,
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(el);
    fit.fit();

    let disposed = false;
    let unlistenOut: (() => void) | undefined;
    let unlistenExit: (() => void) | undefined;

    listen<number[]>("term:output", (e) => {
      term.write(new Uint8Array(e.payload));
    }).then((u) => (unlistenOut = u));
    listen("term:exit", () => {
      term.write("\r\n\x1b[2m[process exited]\x1b[0m\r\n");
    }).then((u) => (unlistenExit = u));

    term.onData((d) => void termApi.write(d));

    termApi
      .open(folder ?? "", term.cols, term.rows)
      .catch((err) => term.write(`failed to start shell: ${err}\r\n`));

    const onResize = () => {
      if (disposed) return;
      fit.fit();
      void termApi.resize(term.cols, term.rows);
    };
    const ro = new ResizeObserver(onResize);
    ro.observe(el);
    term.focus();

    return () => {
      disposed = true;
      ro.disconnect();
      unlistenOut?.();
      unlistenExit?.();
      void termApi.close();
      term.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div className="terminal" ref={containerRef} />;
}
