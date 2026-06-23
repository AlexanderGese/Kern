// src/dap/store.ts — a small dedicated store for the debugger (breakpoints,
// session state, call stack, variables, console), kept separate from the main
// app store so the debugger stays self-contained.
import { create } from "zustand";

export interface Frame {
  id: number;
  name: string;
  path: string;
  line: number;
}
export interface Var {
  name: string;
  value: string;
}

export type Session = "idle" | "starting" | "running" | "stopped";

interface DebugStore {
  breakpoints: Record<string, number[]>;
  session: Session;
  stack: Frame[];
  vars: Var[];
  stoppedAt: { path: string; line: number } | null;
  console: string[];
  toggleBreakpoint: (path: string, line: number) => void;
  bpFor: (path: string) => number[];
  setSession: (s: Session) => void;
  setStack: (f: Frame[]) => void;
  setVars: (v: Var[]) => void;
  setStoppedAt: (s: { path: string; line: number } | null) => void;
  log: (line: string) => void;
  reset: () => void;
}

export const useDebug = create<DebugStore>((set, get) => ({
  breakpoints: {},
  session: "idle",
  stack: [],
  vars: [],
  stoppedAt: null,
  console: [],
  toggleBreakpoint: (path, line) => {
    const cur = get().breakpoints[path] ?? [];
    const next = cur.includes(line) ? cur.filter((l) => l !== line) : [...cur, line].sort((a, b) => a - b);
    set({ breakpoints: { ...get().breakpoints, [path]: next } });
  },
  bpFor: (path) => get().breakpoints[path] ?? [],
  setSession: (session) => set({ session }),
  setStack: (stack) => set({ stack }),
  setVars: (vars) => set({ vars }),
  setStoppedAt: (stoppedAt) => set({ stoppedAt }),
  log: (line) => set({ console: [...get().console, line].slice(-500) }),
  reset: () => set({ session: "idle", stack: [], vars: [], stoppedAt: null }),
}));
