import { useEffect } from "react";
import { TitleBar } from "./components/TitleBar";
import { Sidebar } from "./components/Sidebar";
import { TabBar } from "./components/TabBar";
import { PathBar } from "./components/PathBar";
import { StatusBar } from "./components/StatusBar";
import { CommandPalette } from "./components/CommandPalette";
import { GitPanel } from "./components/GitPanel";
import { AddonsPanel } from "./components/AddonsPanel";
import { AboutPanel } from "./components/AboutPanel";
import { HistoryPanel } from "./components/HistoryPanel";
import { SearchPanel } from "./components/SearchPanel";
import { ExtensionsPanel } from "./components/ExtensionsPanel";
import { RunnerPanel } from "./components/RunnerPanel";
import { SettingsPanel } from "./components/SettingsPanel";
import { ProblemsPanel } from "./components/ProblemsPanel";
import { BottomDock } from "./components/BottomDock";
import { EditorArea } from "./components/EditorArea";
import { Toasts } from "./components/Toasts";
import { PromptModal } from "./components/PromptModal";
import { Onboarding } from "./components/Onboarding";
import { useStore } from "./store/useStore";
import { useKeymap } from "./hooks/useKeymap";
import { useGitSignal } from "./hooks/useGitSignal";
import { useFileWatcher } from "./hooks/useFileWatcher";
import { useRunner } from "./hooks/useRunner";
import { useAutoSave } from "./hooks/useAutoSave";
import { openPath } from "./actions";
import { fsApi } from "./ipc";

export default function App() {
  const ready = useStore((s) => s.ready);
  const sidebarVisible = useStore((s) => s.sidebarVisible);
  const zen = useStore((s) => s.zen);
  const panel = useStore((s) => s.panel);
  const bottomOpen = useStore((s) => s.outputOpen || s.termOpen);

  // Hydrate persisted settings, then reopen folder + tabs from last session.
  useEffect(() => {
    (async () => {
      const { folder, openPaths, activePath } = await useStore.getState().hydrate();
      if (folder) {
        try {
          await fsApi.listDir(folder, 1);
        } catch {
          useStore.getState().setFolder(null);
        }
      }
      for (const p of openPaths) await openPath(p);
      if (activePath) useStore.getState().setActive(activePath);
    })();
  }, []);

  useKeymap();
  useGitSignal();
  useFileWatcher();
  useRunner();
  useAutoSave();

  if (!ready) return <div className="app" />;

  return (
    <div className={"app" + (zen ? " is-zen" : "")}>
      <TitleBar />
      <div className="app__body">
        {panel === "git" && !zen && <GitPanel />}
        <div className="app__main">
          <TabBar />
          <PathBar />
          <div className="app__editor-area">
            <EditorArea />
          </div>
          {bottomOpen && !zen && <BottomDock />}
        </div>
        {sidebarVisible && !zen && <Sidebar />}
      </div>
      <StatusBar />

      {panel === "addons" && <AddonsPanel />}
      {panel === "about" && <AboutPanel />}
      {panel === "history" && <HistoryPanel />}
      {panel === "search" && <SearchPanel />}
      {panel === "extensions" && <ExtensionsPanel />}
      {panel === "runner" && <RunnerPanel />}
      {panel === "settings" && <SettingsPanel />}
      {panel === "problems" && <ProblemsPanel />}
      <CommandPalette />
      <Toasts />
      <PromptModal />
      <Onboarding />
    </div>
  );
}
