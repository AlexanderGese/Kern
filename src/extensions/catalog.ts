// src/extensions/catalog.ts — the curated extension catalog ("pre-chosen"
// packages). Enabling is persisted; the Extensions page also lets you add your
// own entries (the dev/curation window). `install` is the shell hint shown.
import type { ExtItem } from "../store/useStore";

export const CATALOG: ExtItem[] = [
  // ── Language Servers ──
  { id: "lsp.pyright", name: "Pyright", description: "Python language server (types, completion)", category: "Language Servers", install: "npm i -g pyright" },
  { id: "lsp.tsserver", name: "TypeScript Language Server", description: "TS/JS intelligence", category: "Language Servers", install: "npm i -g typescript typescript-language-server" },
  { id: "lsp.rust-analyzer", name: "rust-analyzer", description: "Rust language server", category: "Language Servers", install: "rustup component add rust-analyzer" },
  { id: "lsp.gopls", name: "gopls", description: "Go language server", category: "Language Servers", install: "go install golang.org/x/tools/gopls@latest" },
  { id: "lsp.clangd", name: "clangd", description: "C/C++ language server", category: "Language Servers", install: "apt install clangd" },
  { id: "lsp.lua", name: "lua-language-server", description: "Lua intelligence", category: "Language Servers", install: "brew install lua-language-server" },
  { id: "lsp.jdtls", name: "jdtls", description: "Java language server", category: "Language Servers", install: "brew install jdtls" },
  { id: "lsp.solargraph", name: "Solargraph", description: "Ruby language server", category: "Language Servers", install: "gem install solargraph" },
  { id: "lsp.omnisharp", name: "OmniSharp", description: "C# language server", category: "Language Servers", install: "dotnet tool install -g omnisharp" },
  { id: "lsp.zls", name: "ZLS", description: "Zig language server", category: "Language Servers", install: "see github.com/zigtools/zls" },

  // ── Formatters ──
  { id: "fmt.prettier", name: "Prettier", description: "Opinionated JS/TS/CSS/MD formatter", category: "Formatters", install: "npm i -g prettier" },
  { id: "fmt.black", name: "Black", description: "Python formatter", category: "Formatters", install: "pipx install black" },
  { id: "fmt.rustfmt", name: "rustfmt", description: "Rust formatter", category: "Formatters", install: "rustup component add rustfmt" },
  { id: "fmt.gofmt", name: "gofmt", description: "Go formatter (built into Go)", category: "Formatters", install: "comes with Go" },
  { id: "fmt.clang-format", name: "clang-format", description: "C/C++ formatter", category: "Formatters", install: "apt install clang-format" },

  // ── Linters ──
  { id: "lint.eslint", name: "ESLint", description: "Pluggable JS/TS linter", category: "Linters", install: "npm i -g eslint" },
  { id: "lint.ruff", name: "Ruff", description: "Fast Python linter", category: "Linters", install: "pipx install ruff" },
  { id: "lint.clippy", name: "Clippy", description: "Rust lints", category: "Linters", install: "rustup component add clippy" },
  { id: "lint.shellcheck", name: "ShellCheck", description: "Shell script linter", category: "Linters", install: "apt install shellcheck" },

  // ── Editor Features ──
  { id: "feat.vim", name: "Vim Mode", description: "Modal editing keybindings", category: "Editor Features" },
  { id: "feat.minimap", name: "Minimap", description: "Code overview on the right edge", category: "Editor Features" },
  { id: "feat.ligatures", name: "Font Ligatures", description: "Combine ->, =>, != into glyphs", category: "Editor Features" },
  { id: "feat.wordwrap", name: "Word Wrap", description: "Wrap long lines", category: "Editor Features" },
  { id: "feat.relnum", name: "Relative Line Numbers", description: "Distance from cursor", category: "Editor Features" },
  { id: "feat.blame", name: "Git Blame", description: "Inline last-commit annotation on the current line", category: "Editor Features" },
  { id: "feat.bracket-colors", name: "Bracket Pair Colors", description: "Colorize matching brackets", category: "Editor Features" },

  // ── Themes ──
  { id: "theme.arctic", name: "Arctic", description: "Glacier teal syntax theme", category: "Themes" },
  { id: "theme.grape", name: "Grape", description: "Violet/orchid syntax theme", category: "Themes" },
  { id: "theme.amber", name: "Amber", description: "Honey/gold syntax theme", category: "Themes" },
  { id: "theme.ember", name: "Ember", description: "Warm red syntax theme", category: "Themes" },
  { id: "theme.forest", name: "Forest", description: "Green syntax theme", category: "Themes" },
  { id: "theme.rose", name: "Rose", description: "Pink/magenta syntax theme", category: "Themes" },
  { id: "theme.slate", name: "Slate", description: "Cool blue-grey syntax theme", category: "Themes" },

  // ── Tools ──
  { id: "tool.ripgrep", name: "ripgrep", description: "Ultra-fast project search backend", category: "Tools", install: "apt install ripgrep" },
  { id: "tool.fd", name: "fd", description: "Fast file finder", category: "Tools", install: "apt install fd-find" },
  { id: "tool.gh", name: "GitHub CLI", description: "PRs, issues, gists from the terminal", category: "Tools", install: "apt install gh" },
  { id: "tool.docker", name: "Docker", description: "Container tooling integration", category: "Tools", install: "see docs.docker.com" },
  { id: "tool.lazygit", name: "lazygit", description: "Terminal UI for git", category: "Tools", install: "brew install lazygit" },

  // ── Language Packs (highlighting + runner presets) ──
  { id: "pack.markdown", name: "Markdown", description: "Live preview + highlighting", category: "Language Packs" },
  { id: "pack.toml", name: "TOML", description: "TOML highlighting", category: "Language Packs" },
  { id: "pack.yaml", name: "YAML", description: "YAML highlighting + schema", category: "Language Packs" },
  { id: "pack.dockerfile", name: "Dockerfile", description: "Dockerfile highlighting", category: "Language Packs" },
  { id: "pack.graphql", name: "GraphQL", description: "GraphQL highlighting", category: "Language Packs" },
  { id: "pack.svelte", name: "Svelte", description: "Svelte component support", category: "Language Packs", install: "npm i -g svelte-language-server" },
  { id: "pack.vue", name: "Vue", description: "Vue SFC support", category: "Language Packs", install: "npm i -g @vue/language-server" },
];

export const CATEGORIES = [
  "Language Servers",
  "Formatters",
  "Linters",
  "Editor Features",
  "Themes",
  "Language Packs",
  "Tools",
  "Custom",
];

/** Extension ids that map to a real built-in effect when enabled. */
export const EXT_THEME: Record<string, string> = {
  "theme.arctic": "arctic",
  "theme.grape": "grape",
  "theme.amber": "amber",
  "theme.ember": "ember",
  "theme.forest": "forest",
  "theme.rose": "rose",
  "theme.slate": "slate",
};

export const EXT_FEATURE: Record<string, string> = {
  "feat.minimap": "minimap",
  "feat.ligatures": "ligatures",
  "feat.wordwrap": "wordWrap",
  "feat.relnum": "relativeLineNumbers",
};
