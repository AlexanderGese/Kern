// src/fsActions.ts — file-tree mutations (new/rename/delete) used by the
// Sidebar context menu. Each prompts, calls the Rust fs command, toasts, and
// bumps the tree to re-read.
import { fsApi } from "./ipc";
import { askInput } from "./prompt";
import { useStore } from "./store/useStore";
import { openPath } from "./actions";
import { basename } from "./lang";

function dirOf(path: string): string {
  return path.replace(/[\\/][^\\/]*$/, "");
}
function join(dir: string, name: string): string {
  return dir.replace(/[\\/]$/, "") + "/" + name;
}

export async function newFile(targetDir: string) {
  const name = await askInput({ title: "New file", placeholder: "name.ts" });
  if (!name) return;
  const path = join(targetDir, name);
  try {
    await fsApi.createFile(path);
    useStore.getState().bumpTree();
    await openPath(path);
  } catch (e) {
    useStore.getState().toast("error", `Create failed: ${e}`);
  }
}

export async function newFolder(targetDir: string) {
  const name = await askInput({ title: "New folder", placeholder: "folder" });
  if (!name) return;
  try {
    await fsApi.createDir(join(targetDir, name));
    useStore.getState().bumpTree();
  } catch (e) {
    useStore.getState().toast("error", `Create failed: ${e}`);
  }
}

export async function renamePath(path: string) {
  const name = await askInput({ title: "Rename", initial: basename(path) });
  if (!name || name === basename(path)) return;
  const to = join(dirOf(path), name);
  try {
    await fsApi.renamePath(path, to);
    useStore.getState().bumpTree();
    // Reopen under the new name if it was an open tab.
    const st = useStore.getState();
    if (st.tabs.some((t) => t.path === path)) {
      st.closeTab(path);
      await openPath(to);
    }
  } catch (e) {
    useStore.getState().toast("error", `Rename failed: ${e}`);
  }
}

export async function deletePath(path: string) {
  const confirm = await askInput({
    title: `Delete "${basename(path)}"? Type the name to confirm`,
    placeholder: basename(path),
  });
  if (confirm !== basename(path)) {
    if (confirm !== null) useStore.getState().toast("info", "Delete cancelled (name didn't match)");
    return;
  }
  try {
    await fsApi.deletePath(path);
    useStore.getState().closeTab(path);
    useStore.getState().bumpTree();
    useStore.getState().toast("success", `Deleted ${basename(path)}`);
  } catch (e) {
    useStore.getState().toast("error", `Delete failed: ${e}`);
  }
}
