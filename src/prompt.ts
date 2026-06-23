// src/prompt.ts — a promise-based input dialog (Tauri's webview blocks
// window.prompt). askInput() shows the PromptModal and resolves with the text
// (or null if cancelled).
import { useStore, type PromptReq } from "./store/useStore";

let resolver: ((v: string | null) => void) | null = null;

export function askInput(req: PromptReq): Promise<string | null> {
  // Resolve any dangling prompt first.
  resolver?.(null);
  useStore.getState().setPrompt(req);
  return new Promise((res) => {
    resolver = res;
  });
}

export function submitPrompt(value: string | null) {
  const r = resolver;
  resolver = null;
  useStore.getState().setPrompt(null);
  r?.(value);
}
