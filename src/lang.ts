// src/lang.ts — map file extension → Monaco language id and LSP server key.
// Monaco ships built-in highlighting for these; the LSP key (when present)
// selects a server in the Rust lsp module (§6.3, §6.7).

interface LangDef {
  monaco: string;
  /** Key passed to lsp_start_server; undefined → no language server. */
  lsp?: string;
}

const BY_EXT: Record<string, LangDef> = {
  rs: { monaco: "rust", lsp: "rust" },
  ts: { monaco: "typescript", lsp: "typescript" },
  tsx: { monaco: "typescript", lsp: "typescript" },
  mts: { monaco: "typescript", lsp: "typescript" },
  cts: { monaco: "typescript", lsp: "typescript" },
  js: { monaco: "javascript", lsp: "typescript" },
  jsx: { monaco: "javascript", lsp: "typescript" },
  mjs: { monaco: "javascript", lsp: "typescript" },
  cjs: { monaco: "javascript", lsp: "typescript" },
  py: { monaco: "python", lsp: "python" },
  pyi: { monaco: "python", lsp: "python" },
  go: { monaco: "go", lsp: "go" },
  c: { monaco: "c", lsp: "c" },
  h: { monaco: "c", lsp: "c" },
  cpp: { monaco: "cpp", lsp: "cpp" },
  cc: { monaco: "cpp", lsp: "cpp" },
  cxx: { monaco: "cpp", lsp: "cpp" },
  hpp: { monaco: "cpp", lsp: "cpp" },
  java: { monaco: "java" },
  json: { monaco: "json" },
  jsonc: { monaco: "json" },
  yaml: { monaco: "yaml" },
  yml: { monaco: "yaml" },
  toml: { monaco: "toml" },
  html: { monaco: "html" },
  htm: { monaco: "html" },
  css: { monaco: "css" },
  scss: { monaco: "scss" },
  md: { monaco: "markdown" },
  markdown: { monaco: "markdown" },
  sh: { monaco: "shell" },
  bash: { monaco: "shell" },
  sql: { monaco: "sql" },
  xml: { monaco: "xml" },
};

const BY_NAME: Record<string, LangDef> = {
  dockerfile: { monaco: "dockerfile" },
  makefile: { monaco: "makefile" },
  "cargo.lock": { monaco: "toml" },
};

export function detectLang(path: string): LangDef {
  const base = path.split(/[\\/]/).pop() ?? path;
  const byName = BY_NAME[base.toLowerCase()];
  if (byName) return byName;
  const ext = base.includes(".") ? base.split(".").pop()!.toLowerCase() : "";
  return BY_EXT[ext] ?? { monaco: "plaintext" };
}

export function basename(path: string): string {
  return path.split(/[\\/]/).pop() ?? path;
}
