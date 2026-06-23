// src/lsp/client.ts — language-server bridge (§6.7, §9).
//
// A deliberately small LSP <-> Monaco client. The Rust side spawns the server
// and exposes it as a localhost WebSocket carrying one raw JSON-RPC message per
// frame (Content-Length framing lives in Rust). Here we:
//   • initialize the server, then keep the active document in sync (didOpen /
//     didChange / didClose, full-text sync),
//   • route Monaco completion + hover to the server,
//   • turn publishDiagnostics into Monaco markers.
//
// This intentionally avoids the heavy monaco-languageclient / monaco-vscode-api
// stack (which the spec flags as version-brittle, §13.4) in favour of something
// robust and dependency-light that still delivers the §14 DoD: completion +
// diagnostics. attachLsp() is the single entry point the editor calls.
import type { editor as MEditor, IDisposable, languages, Position } from "monaco-editor";
import { lspApi, fsApi } from "../ipc";
import { useStore, type Tab } from "../store/useStore";
import { openAt, openPath } from "../actions";
import { askInput } from "../prompt";

type Monaco = typeof import("monaco-editor");

const DISPLAY_NAME: Record<string, string> = {
  python: "pyright",
  typescript: "tsserver",
  rust: "rust-analyzer",
  go: "gopls",
  c: "clangd",
  cpp: "clangd",
};

// Monaco language id → LSP server key (mirrors src/lang.ts).
const MONACO_TO_LSP: Record<string, string> = {
  python: "python",
  typescript: "typescript",
  javascript: "typescript",
  rust: "rust",
  go: "go",
  c: "c",
  cpp: "cpp",
};

interface Pending {
  resolve: (v: any) => void;
  reject: (e: any) => void;
}

class LanguageClient {
  private ws: WebSocket | null = null;
  private nextId = 1;
  private pending = new Map<number, Pending>();
  private openDocs = new Set<string>();
  private versions = new Map<string, number>();
  private ready: Promise<void>;
  private resolveReady!: () => void;
  private rejectReady!: (e: any) => void;
  connected = false;

  constructor(
    private monaco: Monaco,
    public lang: string,
  ) {
    this.ready = new Promise((res, rej) => {
      this.resolveReady = res;
      this.rejectReady = rej;
    });
  }

  async connect(): Promise<void> {
    const port = await lspApi.startServer(this.lang);
    const ws = new WebSocket(`ws://127.0.0.1:${port}`);
    this.ws = ws;
    ws.onmessage = (ev) => this.onMessage(ev.data as string);
    ws.onclose = () => this.teardown();
    ws.onerror = () => this.teardown();

    await new Promise<void>((res, rej) => {
      ws.onopen = () => res();
      window.setTimeout(() => rej(new Error("ws timeout")), 6000);
    });

    const root = useStore.getState().folder;
    const rootUri = root ? this.monaco.Uri.file(root).toString() : null;
    await this.request("initialize", {
      processId: null,
      clientInfo: { name: "Kern", version: "0.1.0" },
      rootUri,
      workspaceFolders: rootUri ? [{ uri: rootUri, name: "workspace" }] : null,
      capabilities: {
        textDocument: {
          synchronization: { didSave: true, dynamicRegistration: false },
          completion: {
            completionItem: { snippetSupport: true, documentationFormat: ["markdown", "plaintext"] },
            contextSupport: true,
          },
          hover: { contentFormat: ["markdown", "plaintext"] },
          publishDiagnostics: { relatedInformation: true },
        },
      },
    });
    this.notify("initialized", {});
    this.connected = true;
    this.resolveReady();
  }

  private teardown() {
    if (!this.ws) return;
    this.ws = null;
    this.connected = false;
    this.rejectReady(new Error("disconnected"));
    for (const p of this.pending.values()) p.reject(new Error("disconnected"));
    this.pending.clear();
    this.openDocs.clear();
    clients.delete(this.lang);
    // Reflect loss of connection if this was the active language.
    const st = useStore.getState();
    if (st.lsp.language === this.lang) st.setLsp({ connected: false, serverName: null });
  }

  private send(obj: unknown) {
    this.ws?.send(JSON.stringify(obj));
  }

  private request<T = any>(method: string, params: unknown): Promise<T> {
    const id = this.nextId++;
    const promise = new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      window.setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`${method} timeout`));
        }
      }, 7000);
    });
    this.send({ jsonrpc: "2.0", id, method, params });
    return promise;
  }

  private notify(method: string, params: unknown) {
    this.send({ jsonrpc: "2.0", method, params });
  }

  private onMessage(data: string) {
    let msg: any;
    try {
      msg = JSON.parse(data);
    } catch {
      return;
    }
    if (msg.id !== undefined && (msg.result !== undefined || msg.error !== undefined)) {
      const p = this.pending.get(msg.id);
      if (!p) return;
      this.pending.delete(msg.id);
      msg.error ? p.reject(msg.error) : p.resolve(msg.result);
      return;
    }
    if (msg.method === "textDocument/publishDiagnostics") {
      this.applyDiagnostics(msg.params);
    } else if (msg.id !== undefined) {
      // Server-initiated request we don't handle — reply with null result.
      this.send({ jsonrpc: "2.0", id: msg.id, result: null });
    }
  }

  // ── document sync ──────────────────────────────────────────────────────
  async openDoc(uri: string, languageId: string, text: string) {
    await this.ready;
    if (this.openDocs.has(uri)) return;
    this.openDocs.add(uri);
    this.versions.set(uri, 1);
    this.notify("textDocument/didOpen", {
      textDocument: { uri, languageId, version: 1, text },
    });
  }

  changeDoc(uri: string, text: string) {
    if (!this.openDocs.has(uri)) return;
    const v = (this.versions.get(uri) ?? 1) + 1;
    this.versions.set(uri, v);
    this.notify("textDocument/didChange", {
      textDocument: { uri, version: v },
      contentChanges: [{ text }],
    });
  }

  closeDoc(uri: string) {
    if (!this.openDocs.has(uri)) return;
    this.openDocs.delete(uri);
    this.notify("textDocument/didClose", { textDocument: { uri } });
  }

  async completion(uri: string, pos: Position) {
    await this.ready;
    return this.request("textDocument/completion", {
      textDocument: { uri },
      position: { line: pos.lineNumber - 1, character: pos.column - 1 },
    });
  }

  async hover(uri: string, pos: Position) {
    await this.ready;
    return this.request("textDocument/hover", {
      textDocument: { uri },
      position: { line: pos.lineNumber - 1, character: pos.column - 1 },
    });
  }

  async definition(uri: string, pos: Position) {
    await this.ready;
    return this.request("textDocument/definition", {
      textDocument: { uri },
      position: { line: pos.lineNumber - 1, character: pos.column - 1 },
    });
  }

  async references(uri: string, pos: Position) {
    await this.ready;
    return this.request("textDocument/references", {
      textDocument: { uri },
      position: { line: pos.lineNumber - 1, character: pos.column - 1 },
      context: { includeDeclaration: false },
    });
  }

  async rename(uri: string, pos: Position, newName: string) {
    await this.ready;
    return this.request("textDocument/rename", {
      textDocument: { uri },
      position: { line: pos.lineNumber - 1, character: pos.column - 1 },
      newName,
    });
  }

  async documentSymbols(uri: string) {
    await this.ready;
    return this.request("textDocument/documentSymbol", { textDocument: { uri } });
  }

  async formatting(uri: string, tabSize: number) {
    await this.ready;
    return this.request("textDocument/formatting", {
      textDocument: { uri },
      options: { tabSize, insertSpaces: true },
    });
  }

  private applyDiagnostics(params: any) {
    const model = modelForUri(this.monaco, params.uri);
    if (!model) return;
    const markers = (params.diagnostics ?? []).map((d: any) => ({
      severity: severityToMonaco(this.monaco, d.severity),
      message: d.message,
      source: d.source,
      code: typeof d.code === "object" ? d.code?.value : d.code,
      startLineNumber: d.range.start.line + 1,
      startColumn: d.range.start.character + 1,
      endLineNumber: d.range.end.line + 1,
      endColumn: d.range.end.character + 1,
    }));
    this.monaco.editor.setModelMarkers(model, "kern-lsp", markers);
  }
}

const clients = new Map<string, LanguageClient>();
let providersRegistered = false;

function clientForMonacoLang(monaco: Monaco, monacoLang: string): LanguageClient | null {
  const lspLang = MONACO_TO_LSP[monacoLang];
  if (!lspLang) return null;
  let c = clients.get(lspLang);
  if (!c) {
    c = new LanguageClient(monaco, lspLang);
    clients.set(lspLang, c);
    c.connect().catch(() => {
      /* server missing / failed — teardown already cleaned up */
    });
  }
  return c;
}

function registerProviders(monaco: Monaco) {
  if (providersRegistered) return;
  providersRegistered = true;
  const langs = Object.keys(MONACO_TO_LSP);

  const completion: languages.CompletionItemProvider = {
    triggerCharacters: [".", ":", "<", '"', "'", "/", "@", " "],
    async provideCompletionItems(model, position) {
      const c = clients.get(MONACO_TO_LSP[model.getLanguageId()]);
      if (!c?.connected) return { suggestions: [] };
      const uri = monaco.Uri.file(model.uri.path).toString();
      let result: any;
      try {
        result = await c.completion(uri, position);
      } catch {
        return { suggestions: [] };
      }
      const items: any[] = Array.isArray(result) ? result : (result?.items ?? []);
      const word = model.getWordUntilPosition(position);
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      };
      return {
        suggestions: items.map((it) => lspToMonacoCompletion(monaco, it, range)),
      };
    },
  };

  const hover: languages.HoverProvider = {
    async provideHover(model, position) {
      const c = clients.get(MONACO_TO_LSP[model.getLanguageId()]);
      if (!c?.connected) return null;
      const uri = monaco.Uri.file(model.uri.path).toString();
      let result: any;
      try {
        result = await c.hover(uri, position);
      } catch {
        return null;
      }
      if (!result?.contents) return null;
      return { contents: hoverContents(result.contents) };
    },
  };

  const symbols: languages.DocumentSymbolProvider = {
    async provideDocumentSymbols(model) {
      const c = clients.get(MONACO_TO_LSP[model.getLanguageId()]);
      if (!c?.connected) return [];
      try {
        const res = (await c.documentSymbols(monaco.Uri.file(model.uri.path).toString())) as any[];
        return (res ?? []).map((sym) => lspToMonacoSymbol(monaco, sym));
      } catch {
        return [];
      }
    },
  };

  const formatter: languages.DocumentFormattingEditProvider = {
    async provideDocumentFormattingEdits(model) {
      const c = clients.get(MONACO_TO_LSP[model.getLanguageId()]);
      if (!c?.connected) return [];
      try {
        const tabSize = model.getOptions().tabSize;
        const edits = (await c.formatting(monaco.Uri.file(model.uri.path).toString(), tabSize)) as any[];
        return (edits ?? []).map((e) => ({
          range: {
            startLineNumber: e.range.start.line + 1,
            startColumn: e.range.start.character + 1,
            endLineNumber: e.range.end.line + 1,
            endColumn: e.range.end.character + 1,
          },
          text: e.newText,
        }));
      } catch {
        return [];
      }
    },
  };

  for (const l of langs) {
    monaco.languages.registerCompletionItemProvider(l, completion);
    monaco.languages.registerHoverProvider(l, hover);
    monaco.languages.registerDocumentSymbolProvider(l, symbols);
    monaco.languages.registerDocumentFormattingEditProvider(l, formatter);
  }
}

function lspToMonacoSymbol(monaco: Monaco, sym: any): any {
  // Handles both DocumentSymbol (with range/selectionRange/children) and the
  // older SymbolInformation (with location).
  const range = sym.range ?? sym.location?.range;
  const r = {
    startLineNumber: (range?.start.line ?? 0) + 1,
    startColumn: (range?.start.character ?? 0) + 1,
    endLineNumber: (range?.end.line ?? 0) + 1,
    endColumn: (range?.end.character ?? 0) + 1,
  };
  return {
    name: sym.name,
    detail: sym.detail ?? "",
    kind: (sym.kind ?? 1) - 1, // LSP SymbolKind is 1-based; Monaco is 0-based
    tags: [],
    range: r,
    selectionRange: sym.selectionRange
      ? {
          startLineNumber: sym.selectionRange.start.line + 1,
          startColumn: sym.selectionRange.start.character + 1,
          endLineNumber: sym.selectionRange.end.line + 1,
          endColumn: sym.selectionRange.end.character + 1,
        }
      : r,
    children: (sym.children ?? []).map((c: any) => lspToMonacoSymbol(monaco, c)),
  };
}

export function attachLsp(
  monaco: Monaco,
  _editor: MEditor.IStandaloneCodeEditor,
  tab: Tab,
): () => void {
  if (!tab.lspLang) {
    useStore.getState().setLsp({ language: null, serverName: null, connected: false });
    return () => {};
  }
  registerProviders(monaco);
  const client = clientForMonacoLang(monaco, tab.monacoLang);
  if (!client) return () => {};

  const model = monaco.editor.getModels().find((m) => m.uri.path === tab.path);
  const uri = monaco.Uri.file(tab.path).toString();
  const disposables: IDisposable[] = [];
  let cancelled = false;

  // openDoc awaits the server's initialize handshake internally.
  client
    .openDoc(uri, tab.monacoLang, model?.getValue() ?? tab.content)
    .then(() => {
      if (cancelled) return;
      useStore.getState().setLsp({
        language: tab.lspLang!,
        serverName: DISPLAY_NAME[tab.lspLang!] ?? tab.lspLang!,
        connected: client.connected,
      });
      if (model) {
        disposables.push(
          model.onDidChangeContent(() => client.changeDoc(uri, model.getValue())),
        );
      }
    })
    .catch(() => {
      if (!cancelled)
        useStore.getState().setLsp({ language: tab.lspLang!, serverName: null, connected: false });
    });

  return () => {
    cancelled = true;
    disposables.forEach((d) => d.dispose());
    client.closeDoc(uri);
  };
}

// ── helpers ────────────────────────────────────────────────────────────────
function modelForUri(monaco: Monaco, uri: string): MEditor.ITextModel | null {
  const target = uri.replace(/^file:\/\//, "");
  return (
    monaco.editor.getModels().find((m) => {
      const p = m.uri.path;
      return p === target || monaco.Uri.file(p).toString() === uri;
    }) ?? null
  );
}

function severityToMonaco(monaco: Monaco, sev: number | undefined): number {
  switch (sev) {
    case 1:
      return monaco.MarkerSeverity.Error;
    case 2:
      return monaco.MarkerSeverity.Warning;
    case 3:
      return monaco.MarkerSeverity.Info;
    default:
      return monaco.MarkerSeverity.Hint;
  }
}

function lspToMonacoCompletion(monaco: Monaco, it: any, range: any) {
  const kind = lspKindToMonaco(monaco, it.kind);
  const insertText = it.insertText ?? it.textEdit?.newText ?? it.label;
  const isSnippet = it.insertTextFormat === 2;
  return {
    label: typeof it.label === "string" ? it.label : it.label?.label,
    kind,
    insertText,
    insertTextRules: isSnippet
      ? monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
      : undefined,
    detail: it.detail,
    documentation:
      typeof it.documentation === "string"
        ? it.documentation
        : it.documentation?.value
          ? { value: it.documentation.value }
          : undefined,
    sortText: it.sortText,
    filterText: it.filterText,
    range,
  };
}

function lspKindToMonaco(monaco: Monaco, kind: number | undefined): number {
  const K = monaco.languages.CompletionItemKind;
  const map: Record<number, number> = {
    1: K.Text, 2: K.Method, 3: K.Function, 4: K.Constructor, 5: K.Field,
    6: K.Variable, 7: K.Class, 8: K.Interface, 9: K.Module, 10: K.Property,
    11: K.Unit, 12: K.Value, 13: K.Enum, 14: K.Keyword, 15: K.Snippet,
    16: K.Color, 17: K.File, 18: K.Reference, 19: K.Folder, 20: K.EnumMember,
    21: K.Constant, 22: K.Struct, 23: K.Event, 24: K.Operator, 25: K.TypeParameter,
  };
  return map[kind ?? 0] ?? K.Text;
}

function hoverContents(contents: any): { value: string }[] {
  if (typeof contents === "string") return [{ value: contents }];
  if (Array.isArray(contents))
    return contents.map((c) => ({ value: typeof c === "string" ? c : c.value ?? "" }));
  if (contents.value) return [{ value: contents.value }];
  return [];
}

// ── navigation (go-to-def / references / rename) ────────────────────────────
function clientForModel(model: MEditor.ITextModel) {
  return clients.get(MONACO_TO_LSP[model.getLanguageId()]);
}
function uriOf(monaco: Monaco, model: MEditor.ITextModel) {
  return monaco.Uri.file(model.uri.path).toString();
}
function pathFromUri(uri: string): string {
  return decodeURIComponent(uri.replace(/^file:\/\//, ""));
}
function loc(result: any): { uri: string; line: number; col: number } | null {
  const first = Array.isArray(result) ? result[0] : result;
  if (!first) return null;
  // Location | LocationLink
  const uri = first.uri ?? first.targetUri;
  const range = first.range ?? first.targetSelectionRange ?? first.targetRange;
  if (!uri || !range) return null;
  return { uri, line: range.start.line + 1, col: range.start.character + 1 };
}

export async function gotoDefinition(monaco: Monaco, editor: MEditor.IStandaloneCodeEditor) {
  const model = editor.getModel();
  const pos = editor.getPosition();
  if (!model || !pos) return;
  const c = clientForModel(model);
  if (!c?.connected) return useStore.getState().toast("info", "No language server for this file");
  try {
    const target = loc(await c.definition(uriOf(monaco, model), pos));
    if (!target) return useStore.getState().toast("info", "No definition found");
    await openAt(pathFromUri(target.uri), target.line, target.col);
  } catch {
    useStore.getState().toast("error", "Go to definition failed");
  }
}

export async function findReferences(monaco: Monaco, editor: MEditor.IStandaloneCodeEditor) {
  const model = editor.getModel();
  const pos = editor.getPosition();
  if (!model || !pos) return;
  const c = clientForModel(model);
  if (!c?.connected) return useStore.getState().toast("info", "No language server for this file");
  try {
    const res = (await c.references(uriOf(monaco, model), pos)) as any[];
    if (!res?.length) return useStore.getState().toast("info", "No references found");
    useStore.getState().toast("success", `${res.length} reference${res.length === 1 ? "" : "s"} — opening first`);
    const t = loc(res);
    if (t) await openAt(pathFromUri(t.uri), t.line, t.col);
  } catch {
    useStore.getState().toast("error", "Find references failed");
  }
}

export async function renameSymbol(monaco: Monaco, editor: MEditor.IStandaloneCodeEditor) {
  const model = editor.getModel();
  const pos = editor.getPosition();
  if (!model || !pos) return;
  const c = clientForModel(model);
  if (!c?.connected) return useStore.getState().toast("info", "No language server for this file");
  const word = model.getWordAtPosition(pos)?.word ?? "";
  const newName = await askInput({ title: "Rename symbol", initial: word });
  if (!newName || newName === word) return;
  try {
    const edit = (await c.rename(uriOf(monaco, model), pos, newName)) as any;
    const changes = normalizeWorkspaceEdit(edit);
    if (!changes.length) return useStore.getState().toast("info", "Nothing to rename");
    let files = 0;
    for (const { uri, edits } of changes) {
      await applyEditsToFile(pathFromUri(uri), edits);
      files++;
    }
    useStore.getState().bumpTree();
    useStore.getState().toast("success", `Renamed in ${files} file${files === 1 ? "" : "s"}`);
  } catch {
    useStore.getState().toast("error", "Rename failed");
  }
}

function normalizeWorkspaceEdit(edit: any): { uri: string; edits: any[] }[] {
  if (!edit) return [];
  if (edit.changes) {
    return Object.entries(edit.changes).map(([uri, edits]) => ({ uri, edits: edits as any[] }));
  }
  if (edit.documentChanges) {
    return edit.documentChanges
      .filter((d: any) => d.textDocument && d.edits)
      .map((d: any) => ({ uri: d.textDocument.uri, edits: d.edits }));
  }
  return [];
}

/** Apply LSP TextEdits to a file: to its open model if any, else on disk. */
async function applyEditsToFile(path: string, edits: any[]) {
  const file = await fsApi.openFile(path);
  const next = applyTextEdits(file.content, edits);
  await fsApi.saveFile(path, next);
  // If the file is open as a tab, refresh its buffer.
  const st = useStore.getState();
  if (st.tabs.some((t) => t.path === path)) {
    st.updateContent(path, next);
    st.markSaved(path);
    await openPath(path);
  }
}

function applyTextEdits(text: string, edits: any[]): string {
  const lines = text.split("\n");
  const offsetOf = (line: number, ch: number) => {
    let off = 0;
    for (let i = 0; i < line; i++) off += lines[i].length + 1;
    return off + ch;
  };
  // Apply from last to first so offsets stay valid.
  const sorted = [...edits].sort((a, b) => {
    const al = a.range.start.line, bl = b.range.start.line;
    if (al !== bl) return bl - al;
    return b.range.start.character - a.range.start.character;
  });
  let out = text;
  for (const e of sorted) {
    const start = offsetOf(e.range.start.line, e.range.start.character);
    const end = offsetOf(e.range.end.line, e.range.end.character);
    out = out.slice(0, start) + e.newText + out.slice(end);
  }
  return out;
}
