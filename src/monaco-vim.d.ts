declare module "monaco-vim" {
  export function initVimMode(editor: unknown, statusBar?: HTMLElement | null): { dispose: () => void };
}
