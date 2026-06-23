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
  java: { monaco: "java", lsp: "java" },
  json: { monaco: "json", lsp: "json" },
  jsonc: { monaco: "json", lsp: "json" },
  yaml: { monaco: "yaml", lsp: "yaml" },
  yml: { monaco: "yaml", lsp: "yaml" },
  toml: { monaco: "toml", lsp: "toml" },
  html: { monaco: "html", lsp: "html" },
  htm: { monaco: "html", lsp: "html" },
  css: { monaco: "css", lsp: "css" },
  scss: { monaco: "scss", lsp: "css" },
  sass: { monaco: "scss", lsp: "css" },
  less: { monaco: "less", lsp: "css" },
  md: { monaco: "markdown", lsp: "markdown" },
  markdown: { monaco: "markdown", lsp: "markdown" },
  sh: { monaco: "shell", lsp: "bash" },
  bash: { monaco: "shell", lsp: "bash" },
  zsh: { monaco: "shell", lsp: "bash" },
  sql: { monaco: "sql" },
  xml: { monaco: "xml" },
  // Newly server-backed languages (light up only if the server is on PATH):
  php: { monaco: "php", lsp: "php" },
  rb: { monaco: "ruby", lsp: "ruby" },
  lua: { monaco: "lua", lsp: "lua" },
  kt: { monaco: "kotlin", lsp: "kotlin" },
  kts: { monaco: "kotlin", lsp: "kotlin" },
  swift: { monaco: "swift", lsp: "swift" },
  dart: { monaco: "dart", lsp: "dart" },
  clj: { monaco: "clojure", lsp: "clojure" },
  cljs: { monaco: "clojure", lsp: "clojure" },
  vue: { monaco: "vue", lsp: "vue" },
  svelte: { monaco: "svelte", lsp: "svelte" },
  astro: { monaco: "astro", lsp: "astro" },
  zig: { monaco: "zig", lsp: "zig" },
  ex: { monaco: "elixir", lsp: "elixir" },
  exs: { monaco: "elixir", lsp: "elixir" },
  hs: { monaco: "haskell", lsp: "haskell" },
  ml: { monaco: "ocaml", lsp: "ocaml" },
  mli: { monaco: "ocaml", lsp: "ocaml" },
  tf: { monaco: "terraform", lsp: "terraform" },
  tfvars: { monaco: "terraform", lsp: "terraform" },
  elm: { monaco: "elm", lsp: "elm" },
  prisma: { monaco: "prisma", lsp: "prisma" },
  tex: { monaco: "latex", lsp: "latex" },
  graphql: { monaco: "graphql", lsp: "graphql" },
  gql: { monaco: "graphql", lsp: "graphql" },
  cs: { monaco: "csharp", lsp: "csharp" },
};

const BY_NAME: Record<string, LangDef> = {
  dockerfile: { monaco: "dockerfile", lsp: "dockerfile" },
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
