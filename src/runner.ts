// src/runner.ts — the configurable code runner. Resolves the command template
// for the active file's language, substitutes placeholders, and streams output
// to the Output panel. Listeners are installed by useRunner().
import { listen } from "@tauri-apps/api/event";
import { runApi } from "./ipc";
import { useStore, activeTab, type OutputLine } from "./store/useStore";
import { saveActive } from "./actions";
import { basename } from "./lang";

function substitute(template: string, file: string): string {
  const dir = file.replace(/[\\/][^\\/]*$/, "");
  const base = basename(file);
  const noExt = base.replace(/\.[^.]+$/, "");
  return template
    .split("$fileBasenameNoExt").join(noExt)
    .split("$fileBasename").join(base)
    .split("$file").join(file)
    .split("$dir").join(dir);
}

export async function runActiveFile() {
  const s = useStore.getState();
  const tab = activeTab(s);
  if (!tab) {
    s.toast("error", "No file to run");
    return;
  }
  const template = s.runner[tab.monacoLang];
  if (!template) {
    s.toast("error", `No run command for ${tab.monacoLang}. Configure it in Extensions → Code Runner.`);
    return;
  }
  await saveActive();
  const cwd = s.folder ?? tab.path.replace(/[\\/][^\\/]*$/, "");
  const command = substitute(template, tab.path);

  s.clearOutput();
  s.setOutputOpen(true);
  s.setRunning(true);
  try {
    await runApi.run(command, cwd);
  } catch (e) {
    s.appendOutput({ line: `failed to start: ${e}`, stream: "stderr" });
    s.setRunning(false);
  }
}

export async function stopRun() {
  try {
    await runApi.stop();
  } catch {
    /* ignore */
  }
  useStore.getState().setRunning(false);
}

/** Install the run:output / run:exit listeners (call once from a hook). */
export async function installRunnerListeners(): Promise<() => void> {
  const un1 = await listen<OutputLine>("run:output", (e) => {
    useStore.getState().appendOutput(e.payload);
  });
  const un2 = await listen<{ code: number }>("run:exit", (e) => {
    const s = useStore.getState();
    s.appendOutput({
      line: `— exited with code ${e.payload.code} —`,
      stream: e.payload.code === 0 ? "meta" : "stderr",
    });
    s.setRunning(false);
  });
  return () => {
    un1();
    un2();
  };
}
