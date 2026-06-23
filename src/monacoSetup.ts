// src/monacoSetup.ts — make @monaco-editor/react use the BUNDLED monaco-editor
// and locally-bundled web workers. Without this, the loader fetches Monaco from
// a CDN, which fails in the offline Tauri webview. Import this before <App/>.
import * as monaco from "monaco-editor";
import { loader } from "@monaco-editor/react";
import { registerSnippets } from "./snippets";
import editorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import jsonWorker from "monaco-editor/esm/vs/language/json/json.worker?worker";
import cssWorker from "monaco-editor/esm/vs/language/css/css.worker?worker";
import htmlWorker from "monaco-editor/esm/vs/language/html/html.worker?worker";
import tsWorker from "monaco-editor/esm/vs/language/typescript/ts.worker?worker";

self.MonacoEnvironment = {
  getWorker(_workerId, label) {
    switch (label) {
      case "json":
        return new jsonWorker();
      case "css":
      case "scss":
      case "less":
        return new cssWorker();
      case "html":
      case "handlebars":
      case "razor":
        return new htmlWorker();
      case "typescript":
      case "javascript":
        return new tsWorker();
      default:
        return new editorWorker();
    }
  },
};

loader.config({ monaco });

// Curated code snippets (completion items per language).
registerSnippets(monaco);
