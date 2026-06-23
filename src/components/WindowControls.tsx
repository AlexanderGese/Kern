// src/components/WindowControls.tsx — custom min/max/close (decorations: false)
// so the title bar reads as one integrated Zed-style strip.
import { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";

export function WindowControls() {
  const [maximized, setMaximized] = useState(false);
  const win = getCurrentWindow();

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    win.isMaximized().then(setMaximized).catch(() => {});
    win
      .onResized(() => {
        win.isMaximized().then(setMaximized).catch(() => {});
      })
      .then((u) => (unlisten = u))
      .catch(() => {});
    return () => unlisten?.();
  }, [win]);

  return (
    <div className="winctl">
      <button className="winctl__btn" title="Minimize" onClick={() => void win.minimize()}>
        <svg width="11" height="11" viewBox="0 0 11 11">
          <rect x="1.5" y="5" width="8" height="1" fill="currentColor" />
        </svg>
      </button>
      <button
        className="winctl__btn"
        title={maximized ? "Restore" : "Maximize"}
        onClick={() => void win.toggleMaximize()}
      >
        <svg width="11" height="11" viewBox="0 0 11 11">
          <rect x="1.5" y="1.5" width="8" height="8" fill="none" stroke="currentColor" strokeWidth="1" />
        </svg>
      </button>
      <button
        className="winctl__btn winctl__btn--close"
        title="Close"
        onClick={() => void win.close()}
      >
        <svg width="11" height="11" viewBox="0 0 11 11">
          <path d="M2 2 L9 9 M9 2 L2 9" stroke="currentColor" strokeWidth="1.1" />
        </svg>
      </button>
    </div>
  );
}
