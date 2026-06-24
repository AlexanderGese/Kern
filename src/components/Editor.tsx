// src/components/Editor.tsx — the Monaco wrapper (§6.3).
// One editor instance; @monaco-editor/react keeps a model per `path`, so tab
// switches preserve undo + view state automatically. Editor options are derived
// live from the user's EditorSettings (palette + Addons page).
import { useEffect, useMemo, useRef, useState } from "react";
import MonacoEditor, { type OnMount, type BeforeMount } from "@monaco-editor/react";
import type { editor as MEditor, IDisposable } from "monaco-editor";
import { useStore, activeTab, type EditorSettings, type Tab } from "../store/useStore";
import { registerThemes } from "../themes/monaco-themes";
import { setMonaco, setEditor } from "../editorBridge";
import { refreshLineDiff } from "../git/gutter";
import { attachLsp, gotoDefinition, findReferences, renameSymbol } from "../lsp/client";
import { attachErrorLens, attachTodos } from "../editor/lens";
import { loadEditorConfig } from "../editor/editorconfig";
import { lintActive } from "../editor/format";
import { useDebug } from "../dap/store";
import { syncBreakpoints } from "../dap/client";
import { gitApi, type BlameLine } from "../ipc";

function buildOptions(
  s: EditorSettings,
  reduced: boolean,
): MEditor.IStandaloneEditorConstructionOptions {
  return {
    minimap: { enabled: s.minimap, renderCharacters: false, maxColumn: 90 },
    lineNumbers: s.relativeLineNumbers ? "relative" : "on",
    wordWrap: s.wordWrap ? "on" : "off",
    fontLigatures: s.ligatures,
    fontFamily: `${s.fontFamily}, ui-monospace, "SF Mono", Menlo, Consolas, monospace`,
    fontSize: s.fontSize,
    lineHeight: Math.round(s.fontSize * s.lineHeight),
    letterSpacing: 0.2,
    tabSize: s.tabSize,
    // Don't let Monaco override our tab size from the file's existing indentation.
    detectIndentation: false,
    cursorBlinking: reduced || !s.cursorBlink ? "solid" : "smooth",
    cursorSmoothCaretAnimation: reduced ? "off" : "on",
    renderWhitespace: "selection",
    scrollBeyondLastLine: false,
    smoothScrolling: true,
    padding: { top: 16, bottom: 16 },
    renderLineHighlight: "line",
    guides: {
      indentation: s.indentGuides,
      highlightActiveIndentation: s.indentGuides,
      bracketPairs: s.bracketColors ? "active" : false,
    },
    folding: true,
    foldingHighlight: true,
    foldingStrategy: "auto",
    showFoldingControls: "mouseover",
    glyphMargin: true,
    scrollbar: { verticalScrollbarSize: 11, horizontalScrollbarSize: 11, useShadows: false },
    occurrencesHighlight: "off",
    selectionHighlight: false,
    bracketPairColorization: { enabled: s.bracketColors },
    stickyScroll: { enabled: s.stickyScroll, maxLineCount: 5 },
    contextmenu: false,
    fixedOverflowWidgets: true,
  };
}

export function Editor({ paneTab, primary = true }: { paneTab?: Tab; primary?: boolean } = {}) {
  const storeTab = useStore(activeTab);
  const tab = paneTab ?? storeTab;
  const theme = useStore((s) => s.theme);
  const settings = useStore((s) => s.editor);
  const vimRaw = useStore((s) => s.addons.has("vim"));
  const blameRaw = useStore((s) => s.addons.has("blame"));
  const vimOn = primary && vimRaw;
  const blameOn = primary && blameRaw;
  const folder = useStore((s) => s.folder);
  const gitRev = useStore((s) => s.gitRev);
  const updateContent = useStore((s) => s.updateContent);
  const setCursor = useStore((s) => s.setCursor);
  const editorRef = useRef<MEditor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Parameters<OnMount>[1] | null>(null);
  const cursorSub = useRef<IDisposable | null>(null);
  const vimRef = useRef<{ dispose: () => void } | null>(null);
  const vimStatusRef = useRef<HTMLDivElement>(null);
  const blameRef = useRef<BlameLine[] | null>(null);
  const blameDecoRef = useRef<MEditor.IEditorDecorationsCollection | null>(null);
  const lensRef = useRef<IDisposable | null>(null);
  const todoRef = useRef<IDisposable | null>(null);
  const bpDecoRef = useRef<MEditor.IEditorDecorationsCollection | null>(null);
  const inlineErrors = useStore((s) => s.editor.inlineErrors);
  const breakpoints = useDebug((s) => s.breakpoints);
  const stoppedAt = useDebug((s) => s.stoppedAt);
  const [mounted, setMounted] = useState(false);

  const reduced =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const options = useMemo(() => buildOptions(settings, reduced), [settings, reduced]);

  const beforeMount: BeforeMount = (monaco) => {
    registerThemes(monaco);
  };

  const onMount: OnMount = (ed, monaco) => {
    editorRef.current = ed;
    monacoRef.current = monaco;
    monaco.editor.setTheme(theme);
    if (primary) {
      // Only the primary pane owns the shared bridge + cursor reporting.
      setEditor(ed);
      setMonaco(monaco);
      cursorSub.current?.dispose();
      cursorSub.current = ed.onDidChangeCursorPosition((e) => {
        setCursor(e.position.lineNumber, e.position.column);
      });

      // LSP navigation actions.
      ed.addAction({
        id: "kern.gotoDefinition",
        label: "Go to Definition",
        keybindings: [monaco.KeyCode.F12],
        contextMenuGroupId: "navigation",
        run: () => void gotoDefinition(monaco, ed),
      });
      ed.addAction({
        id: "kern.findReferences",
        label: "Find References",
        keybindings: [monaco.KeyMod.Shift | monaco.KeyCode.F12],
        contextMenuGroupId: "navigation",
        run: () => void findReferences(monaco, ed),
      });
      ed.addAction({
        id: "kern.rename",
        label: "Rename Symbol",
        keybindings: [monaco.KeyCode.F2],
        contextMenuGroupId: "navigation",
        run: () => void renameSymbol(monaco, ed),
      });

      // Click the glyph margin to toggle a breakpoint.
      ed.onMouseDown((e) => {
        if (e.target.type === monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN) {
          const line = e.target.position?.lineNumber;
          const path = ed.getModel()?.uri.path;
          if (line && path) {
            useDebug.getState().toggleBreakpoint(path, line);
            void syncBreakpoints(path);
          }
        }
      });
    }
    setMounted(true);
  };

  // Keep Monaco's theme in lockstep with the CSS data-theme (§6.4, §13.2).
  useEffect(() => {
    monacoRef.current?.editor.setTheme(theme);
  }, [theme]);

  // Apply live editor-setting changes to the running editor (and the model, for
  // tab size — editor.updateOptions alone won't change an existing model's tabs).
  useEffect(() => {
    editorRef.current?.updateOptions(options);
    editorRef.current
      ?.getModel()
      ?.updateOptions({ tabSize: settings.tabSize, insertSpaces: true });
  }, [options, settings.tabSize]);

  // Vim mode (addon).
  useEffect(() => {
    if (!mounted || !editorRef.current) return;
    if (vimOn && !vimRef.current) {
      import("monaco-vim")
        .then(({ initVimMode }) => {
          if (editorRef.current)
            vimRef.current = initVimMode(editorRef.current, vimStatusRef.current);
        })
        .catch(() => {});
    } else if (!vimOn && vimRef.current) {
      vimRef.current.dispose();
      vimRef.current = null;
    }
  }, [vimOn, mounted]);

  // Inline git blame (addon): annotate the cursor line with last-commit info.
  useEffect(() => {
    if (!mounted || !blameOn || !tab || !folder || !editorRef.current) {
      blameDecoRef.current?.clear();
      blameRef.current = null;
      return;
    }
    const ed = editorRef.current;
    let alive = true;
    gitApi
      .blame(folder, tab.path)
      .then((b) => {
        if (alive) {
          blameRef.current = b;
          paintBlame(ed.getPosition()?.lineNumber ?? 1);
        }
      })
      .catch(() => {});
    const sub = ed.onDidChangeCursorPosition((e) => paintBlame(e.position.lineNumber));
    function paintBlame(line: number) {
      const info = blameRef.current?.find((x) => x.line === line);
      const mref = monacoRef.current;
      if (!info || !mref) {
        blameDecoRef.current?.clear();
        return;
      }
      const when = new Date(info.time * 1000).toLocaleDateString();
      const text = `${info.author}, ${when} · ${info.summary}`.slice(0, 90);
      const deco: MEditor.IModelDeltaDecoration = {
        range: new mref.Range(line, 1, line, 1),
        options: {
          after: { content: `    ${text}`, inlineClassName: "kern-blame" },
        },
      };
      if (!blameDecoRef.current) blameDecoRef.current = ed.createDecorationsCollection([deco]);
      else blameDecoRef.current.set([deco]);
    }
    return () => {
      alive = false;
      sub.dispose();
      blameDecoRef.current?.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blameOn, mounted, tab?.path, folder, gitRev]);

  // Recompute git gutter markers + (re)attach LSP when the active file changes
  // or its saved baseline moves.
  useEffect(() => {
    if (!primary || !tab || !mounted || !editorRef.current || !monacoRef.current) return;
    refreshLineDiff(tab.path);
    // Apply .editorconfig indentation for this file (overrides the global setting).
    if (folder) {
      loadEditorConfig(folder, tab.path)
        .then((ec) => {
          const model = editorRef.current?.getModel();
          if (!model || (ec.indentSize == null && ec.insertSpaces == null)) return;
          model.updateOptions({
            ...(ec.indentSize != null ? { tabSize: ec.indentSize } : {}),
            ...(ec.insertSpaces != null ? { insertSpaces: ec.insertSpaces } : {}),
          });
        })
        .catch(() => {});
    }
    const dispose = attachLsp(monacoRef.current, editorRef.current, tab);
    // Lint is deferred off the open path and cancelled if you switch files fast.
    const lintTimer = window.setTimeout(() => void lintActive(tab.path, tab.monacoLang), 500);
    return () => {
      window.clearTimeout(lintTimer);
      dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab?.path, tab?.saved, mounted, primary]);

  // error-lens (toggleable) + TODO highlight, primary pane only.
  useEffect(() => {
    if (!primary || !mounted || !editorRef.current || !monacoRef.current) return;
    if (!todoRef.current) todoRef.current = attachTodos(monacoRef.current, editorRef.current);
    if (inlineErrors && !lensRef.current) {
      lensRef.current = attachErrorLens(monacoRef.current, editorRef.current);
    } else if (!inlineErrors && lensRef.current) {
      lensRef.current.dispose();
      lensRef.current = null;
    }
  }, [primary, mounted, inlineErrors]);

  // Paint breakpoint glyphs + the current stopped line for this file.
  useEffect(() => {
    if (!primary || !mounted || !editorRef.current || !monacoRef.current || !tab) return;
    const monaco = monacoRef.current;
    const decos: MEditor.IModelDeltaDecoration[] = [];
    for (const line of breakpoints[tab.path] ?? []) {
      decos.push({
        range: new monaco.Range(line, 1, line, 1),
        options: { isWholeLine: false, glyphMarginClassName: "kern-bp", glyphMarginHoverMessage: { value: "Breakpoint" } },
      });
    }
    if (stoppedAt && stoppedAt.path === tab.path) {
      decos.push({
        range: new monaco.Range(stoppedAt.line, 1, stoppedAt.line, 1),
        options: { isWholeLine: true, className: "kern-bp-line", glyphMarginClassName: "kern-bp-arrow" },
      });
    }
    if (!bpDecoRef.current) bpDecoRef.current = editorRef.current.createDecorationsCollection(decos);
    else bpDecoRef.current.set(decos);
  }, [breakpoints, stoppedAt, tab?.path, mounted, primary]);

  useEffect(() => () => {
    cursorSub.current?.dispose();
    lensRef.current?.dispose();
    todoRef.current?.dispose();
  }, []);

  if (!tab) {
    return (
      <div className="editor">
        <div className="editor__empty">
          <img className="editor__empty-mark" src="/icon.png" alt="Kern" />
          <div>
            Open a file from the tree, or press{" "}
            <span className="kbd">⌘P</span> to go to file.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="editor">
      <MonacoEditor
        path={tab.path}
        language={tab.monacoLang}
        value={tab.content}
        theme={theme}
        options={options}
        beforeMount={beforeMount}
        onMount={onMount}
        onChange={(val) => updateContent(tab.path, val ?? "")}
        keepCurrentModel
      />
      {vimOn && <div className="vim-status" ref={vimStatusRef} />}
    </div>
  );
}
