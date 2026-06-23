// src/components/TitleBar.tsx — integrated window chrome, Zed-style (§5.6).
// Hamburger (command palette) · project name · branch chip · account · controls.
import { useStore } from "../store/useStore";
import { basename } from "../lang";
import { WindowControls } from "./WindowControls";

export function TitleBar() {
  const folder = useStore((s) => s.folder);
  const branch = useStore((s) => s.branch);
  const openPalette = useStore((s) => s.openPalette);
  const togglePanel = useStore((s) => s.togglePanel);
  const openPanel = useStore((s) => s.openPanel);

  const project = folder ? basename(folder) : "Kern";

  return (
    <header className="titlebar" data-tauri-drag-region>
      <button
        className="titlebar__icon"
        title="Command palette"
        onClick={() => openPalette("commands")}
      >
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
          <path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
      </button>

      <span className="titlebar__project">{project}</span>

      {branch && (
        <button className="titlebar__branch" title="Git panel" onClick={() => togglePanel("git")}>
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
            <circle cx="4" cy="4" r="1.6" stroke="currentColor" strokeWidth="1.2" />
            <circle cx="4" cy="12" r="1.6" stroke="currentColor" strokeWidth="1.2" />
            <circle cx="12" cy="5.5" r="1.6" stroke="currentColor" strokeWidth="1.2" />
            <path d="M4 5.6v4.8M4 8h4a3 3 0 0 0 3-3" stroke="currentColor" strokeWidth="1.2" fill="none" />
          </svg>
          {branch}
        </button>
      )}

      <span className="titlebar__spacer" data-tauri-drag-region />

      <button className="titlebar__icon" title="About Kern" onClick={() => openPanel("about")}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="6.2" stroke="currentColor" strokeWidth="1.2" />
          <circle cx="8" cy="6.4" r="2.2" fill="currentColor" />
          <path d="M3.6 12.4a4.6 4.6 0 0 1 8.8 0" stroke="currentColor" strokeWidth="1.2" fill="none" />
        </svg>
      </button>

      <WindowControls />
    </header>
  );
}
