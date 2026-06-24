// src/hooks/useFileWatcher.ts — react to on-disk changes (§6.1).
// Rust watches the open folder and emits "fs:changed" { path }. If a changed
// file is open and NOT dirty, we reload it silently; if it has unsaved edits we
// leave it alone (don't clobber the user). Any change also refreshes the git
// gutter for the active file. As a robust fallback (inotify limits on big
// projects, atomic-save renames, network drives), we also re-check open clean
// tabs whenever the window regains focus.
import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { useStore, activeTab } from "../store/useStore";
import { fsApi, watchApi } from "../ipc";
import { refreshLineDiff } from "../git/gutter";

/** Re-read every open, unmodified tab from disk; update any that changed. */
async function reloadCleanTabsFromDisk() {
  const tabs = useStore.getState().tabs.filter((t) => t.content === t.saved);
  for (const t of tabs) {
    try {
      const f = await fsApi.openFile(t.path);
      const cur = useStore.getState().tabs.find((x) => x.path === t.path);
      if (cur && cur.content === cur.saved && cur.content !== f.content) {
        useStore.getState().updateContent(t.path, f.content);
        useStore.getState().markSaved(t.path);
      }
    } catch {
      /* file removed/unreadable — leave the buffer */
    }
  }
}

export function useFileWatcher() {
  const folder = useStore((s) => s.folder);

  useEffect(() => {
    if (!folder) return;
    void watchApi.watchPath(folder);
    return () => void watchApi.unwatchAll();
  }, [folder]);

  // Reload-on-focus: covers everything the OS watcher can miss.
  useEffect(() => {
    const onFocus = () => void reloadCleanTabsFromDisk();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let timer: number | undefined;

    listen<{ path: string }>("fs:changed", (e) => {
      const changed = e.payload.path;
      const st = useStore.getState();
      const tab = st.tabs.find((t) => t.path === changed);

      if (tab && tab.content === tab.saved) {
        // Clean buffer — pull the new bytes from disk.
        fsApi
          .openFile(changed)
          .then((f) => {
            const cur = useStore.getState().tabs.find((t) => t.path === changed);
            if (cur && cur.content === cur.saved) {
              useStore.getState().updateContent(changed, f.content);
              useStore.getState().markSaved(changed);
            }
          })
          .catch(() => {});
      }

      // Debounced gutter refresh for the active file.
      const active = activeTab(useStore.getState());
      if (active) {
        window.clearTimeout(timer);
        timer = window.setTimeout(() => refreshLineDiff(active.path), 250);
      }
    }).then((u) => (unlisten = u));

    return () => {
      unlisten?.();
      window.clearTimeout(timer);
    };
  }, []);
}
