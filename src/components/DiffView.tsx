// src/components/DiffView.tsx — side-by-side diff (HEAD vs working tree) for a
// changed file, shown in the editor area when store.diffPath is set.
import { useEffect, useState } from "react";
import { DiffEditor, type DiffOnMount } from "@monaco-editor/react";
import { useStore } from "../store/useStore";
import { gitApi } from "../ipc";
import { detectLang, basename } from "../lang";

export function DiffView({ path }: { path: string }) {
  const folder = useStore((s) => s.folder);
  const theme = useStore((s) => s.theme);
  const settings = useStore((s) => s.editor);
  const gitRev = useStore((s) => s.gitRev);
  const closeDiff = useStore((s) => s.openDiff);
  const [content, setContent] = useState<{ old: string; new: string } | null>(null);

  useEffect(() => {
    if (!folder) return;
    gitApi.diff(folder, path).then(setContent).catch(() => setContent(null));
  }, [folder, path, gitRev]);

  const onMount: DiffOnMount = (_editor, monaco) => {
    monaco.editor.setTheme(theme);
  };

  const lang = detectLang(path).monaco;

  return (
    <div className="diffview">
      <div className="diffview__bar">
        <span className="diffview__title">{basename(path)} — diff vs HEAD</span>
        <button className="diffview__close" onClick={() => closeDiff(null)} title="Close diff (back to editor)">
          ×
        </button>
      </div>
      <div className="diffview__body">
        {content && (
          <DiffEditor
            original={content.old}
            modified={content.new}
            language={lang}
            theme={theme}
            onMount={onMount}
            options={{
              readOnly: true,
              renderSideBySide: true,
              minimap: { enabled: false },
              fontFamily: `${settings.fontFamily}, ui-monospace, monospace`,
              fontSize: settings.fontSize,
              lineHeight: Math.round(settings.fontSize * settings.lineHeight),
              fontLigatures: settings.ligatures,
              scrollBeyondLastLine: false,
              renderOverviewRuler: false,
            }}
          />
        )}
      </div>
    </div>
  );
}
