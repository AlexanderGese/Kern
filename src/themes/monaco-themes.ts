// src/themes/monaco-themes.ts
// Monaco is NOT styled by CSS variables (§13.2) — it needs its own theme
// objects. One factory + per-theme palette & canvas, so the CSS chrome and
// Monaco never drift. Dark themes share the warm-graphite canvas; the two light
// themes carry their own light canvas + the `vs` base. Mirrors tokens.css.
import type { editor } from "monaco-editor";

export type ThemeName =
  | "arctic"
  | "grape"
  | "amber"
  | "ember"
  | "forest"
  | "rose"
  | "slate"
  | "paper"
  | "frost";

export const THEME_NAMES: ThemeName[] = [
  "arctic", "grape", "amber", "ember", "forest", "rose", "slate", "paper", "frost",
];

export const LIGHT_THEMES: ThemeName[] = ["paper", "frost"];

// Accent (swatch) colour per theme — mirrors the --accent in tokens.css so UI
// swatches show each theme's real colour, not just the active accent.
export const THEME_ACCENTS: Record<ThemeName, string> = {
  arctic: "#5dc9c2",
  grape: "#b58ad6",
  amber: "#d9a85f",
  ember: "#e07a6a",
  forest: "#6cc08a",
  rose: "#d987b0",
  slate: "#7fa8c9",
  paper: "#1f9e93",
  frost: "#2f74cf",
};

export const themeLabel = (t: ThemeName) => t[0].toUpperCase() + t.slice(1);

type Canvas = {
  base: "vs" | "vs-dark";
  bg: string; fg: string; line: string; comment: string;
  lineHi: string; panel: string; border: string; selA: string;
};

const DARK: Canvas = {
  base: "vs-dark", bg: "#1a1918", fg: "#ece9e3", line: "#5b554e", comment: "756f65",
  lineHi: "#ffffff06", panel: "#151414", border: "#ffffff0d", selA: "24",
};
const PAPER: Canvas = {
  base: "vs", bg: "#faf8f3", fg: "#2b2823", line: "#b3ac9e", comment: "9b9587",
  lineHi: "#0000000a", panel: "#f1eee7", border: "#0000001a", selA: "28",
};
const FROST: Canvas = {
  base: "vs", bg: "#f6f7f9", fg: "#1f2730", line: "#a3adba", comment: "8a93a0",
  lineHi: "#0000000a", panel: "#edeff3", border: "#0000001a", selA: "28",
};

const CANVASES: Record<ThemeName, Canvas> = {
  arctic: DARK, grape: DARK, amber: DARK, ember: DARK, forest: DARK, rose: DARK, slate: DARK,
  paper: PAPER, frost: FROST,
};

type Palette = {
  keyword: string; func: string; type: string; string: string;
  number: string; constant: string; operator: string;
};

export const PALETTES: Record<ThemeName, Palette> = {
  arctic: { keyword: "5dc9c2", func: "79cfe0", type: "58c79a", string: "9bd9b9", number: "6bbcd6", constant: "b0e6df", operator: "6aa9bf" },
  grape: { keyword: "b58ad6", func: "c9a6e8", type: "d7a2d2", string: "c994c0", number: "c47fb8", constant: "bd8fe2", operator: "a98cc4" },
  amber: { keyword: "d9a85f", func: "e6c074", type: "d4b483", string: "b3aa6a", number: "e0975c", constant: "e8b84f", operator: "c2a079" },
  ember: { keyword: "e07a6a", func: "ec9a86", type: "d98f7a", string: "d7a98f", number: "e88a6e", constant: "f0b59a", operator: "c99685" },
  forest: { keyword: "6cc08a", func: "8fd0a0", type: "5fb888", string: "a7d6a0", number: "7fc890", constant: "b5e0b0", operator: "79b894" },
  rose: { keyword: "d987b0", func: "e6a3c4", type: "d895b8", string: "d99fc0", number: "e088b5", constant: "ecaecf", operator: "c890ad" },
  slate: { keyword: "7fa8c9", func: "9bbdd8", type: "88b0cc", string: "a8c2d4", number: "7fb0d0", constant: "b5cee0", operator: "8aa8c0" },
  // Light themes — darker, saturated syntax for contrast on a light canvas.
  paper: { keyword: "1f9e93", func: "2585a8", type: "1f9e76", string: "3f9a5e", number: "2f86b0", constant: "2f9e8c", operator: "4a8a9c" },
  frost: { keyword: "2f74cf", func: "5a3fc0", type: "1f8f86", string: "2f8f55", number: "b5642a", constant: "b03a8f", operator: "4a6f9c" },
};

function makeTheme(p: Palette, c: Canvas): editor.IStandaloneThemeData {
  const light = c.base === "vs";
  const guide = light ? "#00000010" : "#ffffff08";
  const guideActive = light ? "#0000001f" : "#ffffff14";
  const slider = light ? "#00000014" : "#ffffff10";
  return {
    base: c.base,
    inherit: true,
    rules: [
      { token: "", foreground: c.fg.slice(1) },
      { token: "keyword", foreground: p.keyword },
      { token: "storage", foreground: p.keyword },
      { token: "storage.type", foreground: p.keyword },
      { token: "keyword.operator", foreground: p.operator },
      { token: "operator", foreground: p.operator },
      { token: "delimiter", foreground: light ? "6a655b" : "9a948b" },
      { token: "entity.name.function", foreground: p.func },
      { token: "support.function", foreground: p.func },
      { token: "meta.function-call", foreground: p.func },
      { token: "entity.name.type", foreground: p.type },
      { token: "entity.name.class", foreground: p.type },
      { token: "support.type", foreground: p.type },
      { token: "support.class", foreground: p.type },
      { token: "type", foreground: p.type },
      { token: "type.identifier", foreground: p.type },
      { token: "string", foreground: p.string },
      { token: "string.key.json", foreground: p.func },
      { token: "string.value.json", foreground: p.string },
      { token: "constant.numeric", foreground: p.number },
      { token: "number", foreground: p.number },
      { token: "constant.language", foreground: p.constant },
      { token: "constant.character", foreground: p.constant },
      { token: "variable.other.constant", foreground: p.constant },
      { token: "entity.name.constant", foreground: p.constant },
      { token: "constant", foreground: p.constant },
      { token: "tag", foreground: p.keyword },
      { token: "attribute.name", foreground: p.func },
      { token: "attribute.value", foreground: p.string },
      { token: "comment", foreground: c.comment, fontStyle: "italic" },
      { token: "variable", foreground: c.fg.slice(1) },
    ],
    colors: {
      "editor.background": c.bg,
      "editor.foreground": c.fg,
      "editorLineNumber.foreground": c.line,
      "editorLineNumber.activeForeground": "#" + p.keyword,
      "editorCursor.foreground": "#" + p.keyword,
      "editor.selectionBackground": "#" + p.keyword + c.selA,
      "editor.inactiveSelectionBackground": "#" + p.keyword + "16",
      "editor.lineHighlightBackground": c.lineHi,
      "editor.lineHighlightBorder": "#00000000",
      "editorGutter.background": c.bg,
      "editorWidget.background": c.panel,
      "editorWidget.border": c.border,
      "editorSuggestWidget.background": c.panel,
      "editorSuggestWidget.border": c.border,
      "editorSuggestWidget.selectedBackground": light ? "#e3e0d6" : "#222120",
      "editorHoverWidget.background": c.panel,
      "editorHoverWidget.border": c.border,
      "editorIndentGuide.background1": guide,
      "editorIndentGuide.activeBackground1": guideActive,
      "editorGutter.modifiedBackground": "#" + p.number,
      "editorGutter.addedBackground": "#" + p.string,
      "editorGutter.deletedBackground": "#c96f6f",
      "editorOverviewRuler.border": "#00000000",
      "scrollbarSlider.background": slider,
      "scrollbarSlider.hoverBackground": light ? "#0000001f" : "#ffffff1e",
      "scrollbarSlider.activeBackground": light ? "#00000029" : "#ffffff28",
      "editorWhitespace.foreground": guide,
    },
  };
}

export function registerThemes(monaco: typeof import("monaco-editor")) {
  THEME_NAMES.forEach((name) =>
    monaco.editor.defineTheme(name, makeTheme(PALETTES[name], CANVASES[name])),
  );
}
