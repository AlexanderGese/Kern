// src/components/EditorArea.tsx — decides what fills the editor region:
// a diff view, split panes, a markdown split (editor + preview), or the editor.
import { useStore, activeTab } from "../store/useStore";
import { Editor } from "./Editor";
import { DiffView } from "./DiffView";
import { MarkdownPreview } from "./MarkdownPreview";
import { Welcome } from "./Welcome";
import { basename } from "../lang";

export function EditorArea() {
  const diffPath = useStore((s) => s.diffPath);
  const mdPreview = useStore((s) => s.mdPreview);
  const splitPath = useStore((s) => s.splitPath);
  const tabs = useStore((s) => s.tabs);
  const setSplit = useStore((s) => s.setSplit);
  const tab = useStore(activeTab);

  if (!tab && !diffPath) return <Welcome />;

  if (diffPath) return <DiffView path={diffPath} />;

  if (splitPath) {
    const splitTab = tabs.find((t) => t.path === splitPath);
    if (splitTab) {
      return (
        <div className="editor-split">
          <div className="editor-split__pane">
            <Editor />
          </div>
          <div className="editor-split__pane">
            <div className="editor-split__head">
              <span>{basename(splitTab.path)}</span>
              <span className="editor-split__close" title="Close split" onClick={() => setSplit(null)}>×</span>
            </div>
            <Editor paneTab={splitTab} primary={false} />
          </div>
        </div>
      );
    }
  }

  if (mdPreview && tab?.monacoLang === "markdown") {
    return (
      <div className="mdpreview__split">
        <Editor />
        <MarkdownPreview />
      </div>
    );
  }

  return <Editor />;
}
