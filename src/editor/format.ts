// src/editor/format.ts — external formatters (stdin→stdout) used as a fallback
// when no LSP formatter is available, and lint-on-save markers.
import { fmtApi, lintApi } from "../ipc";
import { useStore } from "../store/useStore";
import { getEditor, getMonaco } from "../editorBridge";

/** monaco language id → (tool, args). `$file` is replaced with the file path. */
const FORMATTERS: Record<string, { tool: string; args: string[] }> = {
  typescript: { tool: "prettier", args: ["--stdin-filepath", "$file"] },
  javascript: { tool: "prettier", args: ["--stdin-filepath", "$file"] },
  json: { tool: "prettier", args: ["--stdin-filepath", "$file"] },
  css: { tool: "prettier", args: ["--stdin-filepath", "$file"] },
  scss: { tool: "prettier", args: ["--stdin-filepath", "$file"] },
  less: { tool: "prettier", args: ["--stdin-filepath", "$file"] },
  html: { tool: "prettier", args: ["--stdin-filepath", "$file"] },
  markdown: { tool: "prettier", args: ["--stdin-filepath", "$file"] },
  yaml: { tool: "prettier", args: ["--stdin-filepath", "$file"] },
  vue: { tool: "prettier", args: ["--stdin-filepath", "$file"] },
  svelte: { tool: "prettier", args: ["--stdin-filepath", "$file"] },
  python: { tool: "black", args: ["-q", "-"] },
  rust: { tool: "rustfmt", args: ["--edition", "2021"] },
  go: { tool: "gofmt", args: [] },
  c: { tool: "clang-format", args: ["--assume-filename=$file"] },
  cpp: { tool: "clang-format", args: ["--assume-filename=$file"] },
  shell: { tool: "shfmt", args: ["-"] },
  toml: { tool: "taplo", args: ["fmt", "-"] },
  lua: { tool: "stylua", args: ["-"] },
  sql: { tool: "sql-formatter", args: [] },
};

export function hasExternalFormatter(lang: string): boolean {
  return lang in FORMATTERS;
}

/** Format the active model with its external formatter. Returns true on success. */
export async function formatExternal(): Promise<boolean> {
  const ed = getEditor();
  const monaco = getMonaco();
  const model = ed?.getModel();
  if (!ed || !monaco || !model) return false;
  const lang = model.getLanguageId();
  const spec = FORMATTERS[lang];
  if (!spec) return false;

  const s = useStore.getState();
  const path = model.uri.path;
  const cwd = s.folder ?? path.replace(/[\\/][^\\/]*$/, "");
  const args = spec.args.map((a) => a.replace("$file", path));
  try {
    const formatted = await fmtApi.format(spec.tool, args, model.getValue(), cwd);
    if (formatted && formatted !== model.getValue()) {
      // Replace whole model, preserving the view state + undo stack.
      const full = model.getFullModelRange();
      ed.executeEdits("kern.format", [{ range: full, text: formatted }]);
      ed.pushUndoStop();
    }
    return true;
  } catch (e) {
    s.toast("error", `${spec.tool}: ${String(e).slice(0, 80)}`);
    return false;
  }
}

/** Run the configured linter for `path`'s language and set kern-lint markers. */
export async function lintActive(path: string, language: string) {
  const monaco = getMonaco();
  if (!monaco) return;
  const model = monaco.editor.getModels().find((m) => m.uri.path === path);
  if (!model) return;
  const s = useStore.getState();
  const cwd = s.folder ?? path.replace(/[\\/][^\\/]*$/, "");
  try {
    const diags = await lintApi.lint(language, path, cwd);
    const markers = diags.map((d) => ({
      severity:
        d.severity === "error"
          ? monaco.MarkerSeverity.Error
          : d.severity === "info"
            ? monaco.MarkerSeverity.Info
            : monaco.MarkerSeverity.Warning,
      message: d.message,
      source: d.source,
      startLineNumber: d.line,
      startColumn: d.column,
      endLineNumber: d.end_line,
      endColumn: d.end_column,
    }));
    monaco.editor.setModelMarkers(model, "kern-lint", markers);
  } catch {
    /* linter missing — ignore */
  }
}
