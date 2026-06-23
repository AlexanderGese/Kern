// src/hooks/useGitSignal.ts — branch + per-file status in the status bar and
// tree (§6.6). Polls on an interval and whenever the folder changes; the file
// watcher also nudges a refresh through the `gitTick` bump in useFileWatcher.
import { useEffect } from "react";
import { useStore } from "../store/useStore";
import { gitApi, type GitStatusKind } from "../ipc";

export function useGitSignal() {
  const folder = useStore((s) => s.folder);
  const gitRev = useStore((s) => s.gitRev);

  useEffect(() => {
    if (!folder) {
      useStore.getState().setBranch(null);
      useStore.getState().setGitStatuses(new Map());
      return;
    }
    let alive = true;

    const refresh = async () => {
      try {
        const [branch, statuses] = await Promise.all([
          gitApi.branch(folder),
          gitApi.fileStatuses(folder),
        ]);
        if (!alive) return;
        useStore.getState().setBranch(branch);
        const map = new Map<string, GitStatusKind>();
        for (const s of statuses) map.set(s.path, s.status);
        useStore.getState().setGitStatuses(map);
      } catch {
        if (!alive) return;
        useStore.getState().setBranch(null);
        useStore.getState().setGitStatuses(new Map());
      }
    };

    void refresh();
    const id = window.setInterval(refresh, 4000);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, [folder, gitRev]);
}
