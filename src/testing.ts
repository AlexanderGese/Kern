// src/testing.ts — run project tests (all / current file / nearest) using the
// detected framework, streamed through the run pipeline.
import { invoke } from "@tauri-apps/api/core";
import { useStore, activeTab } from "./store/useStore";
import { runTask } from "./runner";
import { getEditor } from "./editorBridge";

interface TestRunner {
  framework: string;
  command: string;
}

let cache: TestRunner[] = [];

export async function loadTestRunners(): Promise<TestRunner[]> {
  const folder = useStore.getState().folder;
  if (!folder) return (cache = []);
  try {
    cache = await invoke<TestRunner[]>("detect_tests", { folder });
  } catch {
    cache = [];
  }
  return cache;
}

function runnerForActive(): TestRunner | undefined {
  const tab = activeTab(useStore.getState());
  const lang = tab?.monacoLang;
  // Prefer the framework matching the active file's language.
  const byLang: Record<string, string[]> = {
    rust: ["cargo"],
    go: ["go"],
    python: ["pytest"],
    typescript: ["vitest", "jest", "npm"],
    javascript: ["vitest", "jest", "npm"],
  };
  const prefs = lang ? byLang[lang] ?? [] : [];
  for (const f of prefs) {
    const r = cache.find((c) => c.framework === f);
    if (r) return r;
  }
  return cache[0];
}

export async function runAllTests() {
  await loadTestRunners();
  const r = runnerForActive();
  if (!r) return useStore.getState().toast("error", "No test framework detected");
  void runTask(r.command, `tests · ${r.framework}`);
}

export async function runFileTests() {
  await loadTestRunners();
  const r = runnerForActive();
  const tab = activeTab(useStore.getState());
  if (!r || !tab) return useStore.getState().toast("error", "No test framework / file");
  const file = tab.path;
  const dir = file.replace(/[\\/][^\\/]*$/, "");
  const cmd =
    r.framework === "cargo"
      ? "cargo test"
      : r.framework === "go"
        ? `go test ${dir}`
        : `${r.command} "${file}"`;
  void runTask(cmd, `tests · ${tab.path.split(/[\\/]/).pop()}`);
}

/** Walk up from the cursor to find the enclosing test name for this language. */
function nearestTestName(lang: string): string | null {
  const ed = getEditor();
  const model = ed?.getModel();
  const pos = ed?.getPosition();
  if (!model || !pos) return null;
  const patterns: Record<string, RegExp> = {
    python: /^\s*def\s+(test\w*)\s*\(/,
    rust: /^\s*fn\s+(\w+)\s*\(/,
    go: /^\s*func\s+(Test\w*)\s*\(/,
    typescript: /(?:it|test)\s*\(\s*["'`](.+?)["'`]/,
    javascript: /(?:it|test)\s*\(\s*["'`](.+?)["'`]/,
  };
  const re = patterns[lang];
  if (!re) return null;
  for (let line = pos.lineNumber; line >= 1; line--) {
    const m = model.getLineContent(line).match(re);
    if (m) return m[1];
  }
  return null;
}

export async function runNearestTest() {
  await loadTestRunners();
  const r = runnerForActive();
  const tab = activeTab(useStore.getState());
  if (!r || !tab) return useStore.getState().toast("error", "No test framework / file");
  const name = nearestTestName(tab.monacoLang);
  if (!name) {
    useStore.getState().toast("info", "No test found at cursor — running file");
    return runFileTests();
  }
  const file = tab.path;
  const dir = file.replace(/[\\/][^\\/]*$/, "");
  let cmd: string;
  switch (r.framework) {
    case "cargo": cmd = `cargo test ${name}`; break;
    case "go": cmd = `go test -run ${name} ${dir}`; break;
    case "pytest": cmd = `pytest "${file}::${name}"`; break;
    case "vitest": cmd = `${r.command} "${file}" -t "${name}"`; break;
    case "jest": cmd = `${r.command} "${file}" -t "${name}"`; break;
    default: cmd = `${r.command} "${file}"`;
  }
  void runTask(cmd, `test · ${name}`);
}
