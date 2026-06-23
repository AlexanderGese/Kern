// src/components/StatusBar.tsx — mono, faint, hoverable segments (§5.6).
// Left: quick panel toggles + branch. Right: LSP + file meta + theme.
import { useStore, activeTab } from "../store/useStore";

export function StatusBar() {
  const branch = useStore((s) => s.branch);
  const lsp = useStore((s) => s.lsp);
  const cursor = useStore((s) => s.cursor);
  const theme = useStore((s) => s.theme);
  const tab = useStore(activeTab);
  const togglePanel = useStore((s) => s.togglePanel);
  const toggleSidebar = useStore((s) => s.toggleSidebar);
  const cycleTheme = useStore((s) => s.cycleTheme);

  return (
    <footer className="statusbar">
      <span className="status-seg" title="Toggle file tree (⌘B)" onClick={toggleSidebar}>
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
          <rect x="1.5" y="2.5" width="13" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.1" />
          <path d="M10.5 2.5v11" stroke="currentColor" strokeWidth="1.1" />
        </svg>
      </span>
      <span className="status-seg" title="Addons (⌘⇧X)" onClick={() => togglePanel("addons")}>
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
          <path d="M3 4.5h4M9 4.5h4M3 8h7M3 11.5h4M9 11.5h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      </span>

      {branch && (
        <span className="status-seg" title="Source control (⌘⇧G)" onClick={() => togglePanel("git")}>
          <span className="branch-dot" />
          {branch}
        </span>
      )}

      <span className="statusbar__spacer" />

      <span className="status-seg" title="Language server">
        <span className={"lsp-dot" + (lsp.connected ? "" : " is-idle")} />
        {lsp.connected ? lsp.serverName ?? lsp.language : "no lsp"}
      </span>
      <span className="status-mid">·</span>
      <span className="status-seg" title="Line / column">ln {cursor.line}, col {cursor.col}</span>
      <span className="status-mid">·</span>
      <span className="status-seg">utf-8</span>
      {tab && (
        <>
          <span className="status-mid">·</span>
          <span className="status-seg">{tab.monacoLang}</span>
        </>
      )}
      <span className="status-mid">·</span>
      <span className="status-seg" title="Cycle theme" onClick={cycleTheme}>{theme}</span>
    </footer>
  );
}
