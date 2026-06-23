// src/components/fileIcons.tsx — calm, all-mono file icons: a short colored
// monogram per file type (Material-ish, but fits Kern's typographic chrome).
import { useStore } from "../store/useStore";

type Icon = { label: string; color: string };

const BY_EXT: Record<string, Icon> = {
  ts: { label: "ts", color: "#3178c6" },
  tsx: { label: "tsx", color: "#3178c6" },
  js: { label: "js", color: "#e8d44d" },
  jsx: { label: "jsx", color: "#e8d44d" },
  mjs: { label: "js", color: "#e8d44d" },
  cjs: { label: "js", color: "#e8d44d" },
  py: { label: "py", color: "#4b8bbe" },
  rs: { label: "rs", color: "#dd7a4a" },
  go: { label: "go", color: "#00add8" },
  java: { label: "jv", color: "#e76f00" },
  kt: { label: "kt", color: "#a97bff" },
  c: { label: "c", color: "#5c6bc0" },
  h: { label: "h", color: "#5c6bc0" },
  cpp: { label: "c+", color: "#00599c" },
  cc: { label: "c+", color: "#00599c" },
  hpp: { label: "h+", color: "#00599c" },
  cs: { label: "cs", color: "#9b59b6" },
  rb: { label: "rb", color: "#cc342d" },
  php: { label: "php", color: "#777bb4" },
  swift: { label: "sw", color: "#f05138" },
  lua: { label: "lua", color: "#7c8ce0" },
  dart: { label: "da", color: "#00b4ab" },
  scala: { label: "sc", color: "#dc322f" },
  ex: { label: "ex", color: "#9c6fd8" },
  exs: { label: "ex", color: "#9c6fd8" },
  zig: { label: "zig", color: "#f7a41d" },
  json: { label: "{}", color: "#d9a85f" },
  jsonc: { label: "{}", color: "#d9a85f" },
  yaml: { label: "yml", color: "#d987b0" },
  yml: { label: "yml", color: "#d987b0" },
  toml: { label: "tml", color: "#bd7c4f" },
  ini: { label: "ini", color: "#9aa0a6" },
  env: { label: "env", color: "#d9a85f" },
  md: { label: "md", color: "#7fa8c9" },
  mdx: { label: "md", color: "#7fa8c9" },
  txt: { label: "txt", color: "#9aa0a6" },
  html: { label: "<>", color: "#e34c26" },
  htm: { label: "<>", color: "#e34c26" },
  xml: { label: "xml", color: "#8bc34a" },
  css: { label: "css", color: "#5b8def" },
  scss: { label: "scss", color: "#cd6799" },
  sass: { label: "sass", color: "#cd6799" },
  less: { label: "less", color: "#2a4d80" },
  vue: { label: "vue", color: "#41b883" },
  svelte: { label: "sv", color: "#ff3e00" },
  astro: { label: "as", color: "#ff5d01" },
  sh: { label: "sh", color: "#89e051" },
  bash: { label: "sh", color: "#89e051" },
  zsh: { label: "sh", color: "#89e051" },
  fish: { label: "sh", color: "#89e051" },
  sql: { label: "sql", color: "#e38c00" },
  graphql: { label: "gql", color: "#e10098" },
  gql: { label: "gql", color: "#e10098" },
  proto: { label: "pb", color: "#7fa8c9" },
  tf: { label: "tf", color: "#7b42bc" },
  dockerfile: { label: "dk", color: "#2496ed" },
  lock: { label: "lk", color: "#7d7468" },
  toml_lock: { label: "lk", color: "#7d7468" },
  svg: { label: "svg", color: "#ffb13b" },
  png: { label: "img", color: "#26a69a" },
  jpg: { label: "img", color: "#26a69a" },
  jpeg: { label: "img", color: "#26a69a" },
  gif: { label: "img", color: "#26a69a" },
  webp: { label: "img", color: "#26a69a" },
  ico: { label: "img", color: "#26a69a" },
  pdf: { label: "pdf", color: "#e0796a" },
  csv: { label: "csv", color: "#6cc08a" },
  ipynb: { label: "nb", color: "#f37726" },
};

const BY_NAME: Record<string, Icon> = {
  "package.json": { label: "npm", color: "#cb3837" },
  "package-lock.json": { label: "lk", color: "#7d7468" },
  "pnpm-lock.yaml": { label: "lk", color: "#7d7468" },
  "yarn.lock": { label: "lk", color: "#7d7468" },
  "cargo.toml": { label: "rs", color: "#dd7a4a" },
  "cargo.lock": { label: "lk", color: "#7d7468" },
  "tsconfig.json": { label: "ts", color: "#3178c6" },
  "dockerfile": { label: "dk", color: "#2496ed" },
  "makefile": { label: "mk", color: "#9aa0a6" },
  ".gitignore": { label: "git", color: "#f05133" },
  ".editorconfig": { label: "ec", color: "#9aa0a6" },
  "readme.md": { label: "md", color: "#7fa8c9" },
  "license": { label: "©", color: "#d9a85f" },
};

export function iconFor(name: string, isDir: boolean): Icon {
  if (isDir) return { label: "▸", color: "var(--accent)" };
  const lower = name.toLowerCase();
  if (BY_NAME[lower]) return BY_NAME[lower];
  const ext = lower.includes(".") ? lower.slice(lower.lastIndexOf(".") + 1) : "";
  return BY_EXT[ext] ?? { label: "·", color: "var(--fg-faint)" };
}

export function FileIcon({ name, isDir }: { name: string; isDir: boolean }) {
  const mono = useStore((s) => s.editor.monoIcons);
  const { label, color } = iconFor(name, isDir);
  return (
    <span className="tree-row__icon" style={{ color: mono ? "var(--fg-dim)" : color }} aria-hidden>
      {label}
    </span>
  );
}
