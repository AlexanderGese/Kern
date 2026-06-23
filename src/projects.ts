// src/projects.ts — save the open folder as a named Project, then re-open it
// instantly from the command palette or Welcome screen.
import { useStore, type Project } from "./store/useStore";
import { openPath } from "./actions";
import { askInput } from "./prompt";
import { fsApi } from "./ipc";
import { basename } from "./lang";

const COLORS = ["#5dc9c2", "#b58ad6", "#d9a85f", "#e07a6a", "#6cc08a", "#d987b0", "#7fa8c9"];

export async function createProjectFromFolder() {
  const s = useStore.getState();
  let folder = s.folder;
  if (!folder) {
    folder = await fsApi.pickFolder();
    if (!folder) return;
    s.setFolder(folder);
  }
  const name = await askInput({ title: "Project name", initial: basename(folder) });
  if (!name) return;
  const description = (await askInput({ title: "Short description (optional)", placeholder: "what is this project?" })) ?? "";
  const existing = useStore.getState().projects.find((p) => p.path === folder);
  const project: Project = {
    id: existing?.id ?? "p_" + Date.now() + "_" + Math.floor(useStore.getState().projects.length),
    name,
    path: folder,
    description,
    color: existing?.color ?? COLORS[useStore.getState().projects.length % COLORS.length],
    lastOpened: Date.now(),
    openPaths: useStore.getState().tabs.map((t) => t.path),
  };
  useStore.getState().saveProject(project);
  useStore.getState().toast("success", `Saved project "${name}"`);
}

export async function openProject(p: Project) {
  const s = useStore.getState();
  // Validate the folder still exists.
  try {
    await fsApi.listDir(p.path, 1);
  } catch {
    s.toast("error", `Folder missing: ${p.path}`);
    return;
  }
  // Close current tabs, switch folder, reopen the project's files.
  for (const t of [...s.tabs]) s.closeTab(t.path);
  s.setFolder(p.path);
  for (const path of p.openPaths) await openPath(path);
  if (p.openPaths[0]) useStore.getState().setActive(p.openPaths[0]);
  useStore.getState().touchProject(p.path, p.openPaths);
  useStore.getState().closePanel();
}
