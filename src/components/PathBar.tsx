// src/components/PathBar.tsx — the file-path breadcrumb + toolbar actions row
// (the "src/app/.../route.ts  …  🔍 ⚙ git" strip in the Zed reference).
import { useStore, activeTab } from "../store/useStore";
import { runActiveFile, stopRun } from "../runner";

export function PathBar() {
  const tab = useStore(activeTab);
  const folder = useStore((s) => s.folder);
  const running = useStore((s) => s.running);
  const mdPreview = useStore((s) => s.mdPreview);
  const toggleMdPreview = useStore((s) => s.toggleMdPreview);
  const openPalette = useStore((s) => s.openPalette);
  const togglePanel = useStore((s) => s.togglePanel);

  const segs = crumbs(folder, tab?.path);

  return (
    <div className="pathbar">
      <div className="pathbar__crumbs">
        {segs.length === 0 ? (
          <span className="pathbar__empty">no file open</span>
        ) : (
          segs.map((c, i) => (
            <span key={i} className="pathbar__seg-wrap">
              <span className={i === segs.length - 1 ? "pathbar__seg pathbar__seg--last" : "pathbar__seg"}>
                {c}
              </span>
              {i < segs.length - 1 && <span className="pathbar__sep">/</span>}
            </span>
          ))
        )}
      </div>

      <div className="pathbar__actions">
        {tab?.monacoLang === "markdown" && (
          <button
            className={"pathbar__icon" + (mdPreview ? " is-on" : "")}
            title="Toggle Markdown preview"
            onClick={toggleMdPreview}
          >
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
              <path d="M2 4.5h12v7H2z" stroke="currentColor" strokeWidth="1.1" />
              <path d="M4 9V7l1.3 1.3L6.6 7v2M9 7v2M8 8.2l1 0.8 1-.8" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}
        {running ? (
          <button className="pathbar__icon pathbar__run is-running" title="Stop" onClick={() => void stopRun()}>
            <svg width="13" height="13" viewBox="0 0 16 16"><rect x="3.5" y="3.5" width="9" height="9" rx="1.5" fill="currentColor" /></svg>
          </button>
        ) : (
          <button className="pathbar__icon pathbar__run" title="Run file" onClick={() => void runActiveFile()}>
            <svg width="14" height="14" viewBox="0 0 16 16"><path d="M4 3 L13 8 L4 13 Z" fill="currentColor" /></svg>
          </button>
        )}
        <button className="pathbar__icon" title="Extensions (⌘⇧E)" onClick={() => togglePanel("extensions")}>
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
            <rect x="2" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2" />
            <rect x="9" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2" />
            <rect x="2" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2" />
            <path d="M11.5 9.5v4M9.5 11.5h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
        </button>
        <button className="pathbar__icon" title="Go to file (⌘P)" onClick={() => openPalette("files")}>
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
            <circle cx="7" cy="7" r="4.4" stroke="currentColor" strokeWidth="1.3" />
            <path d="M10.4 10.4 14 14" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
        </button>
        <button className="pathbar__icon" title="Source control (⌘⇧G)" onClick={() => togglePanel("git")}>
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
            <circle cx="4" cy="4" r="1.7" stroke="currentColor" strokeWidth="1.25" />
            <circle cx="4" cy="12" r="1.7" stroke="currentColor" strokeWidth="1.25" />
            <circle cx="12" cy="5.6" r="1.7" stroke="currentColor" strokeWidth="1.25" />
            <path d="M4 5.7v4.6M4 8h4a3 3 0 0 0 3-3" stroke="currentColor" strokeWidth="1.25" fill="none" />
          </svg>
        </button>
        <button className="pathbar__icon" title="Addons (⌘⇧X)" onClick={() => togglePanel("addons")}>
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
            <path d="M3 4.5h4M9 4.5h4M3 8h7M3 11.5h4M9 11.5h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
            <circle cx="8.5" cy="4.5" r="1.5" fill="currentColor" />
            <circle cx="11" cy="8" r="1.5" fill="currentColor" />
            <circle cx="8.5" cy="11.5" r="1.5" fill="currentColor" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function crumbs(folder: string | null, filePath?: string): string[] {
  if (!filePath) return [];
  if (folder && filePath.startsWith(folder)) {
    const rel = filePath.slice(folder.length).replace(/^[\\/]/, "");
    return rel.split(/[\\/]/).filter(Boolean);
  }
  return filePath.split(/[\\/]/).filter(Boolean).slice(-4);
}
