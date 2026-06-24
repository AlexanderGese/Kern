// src/editor/editorconfig.ts — lightweight .editorconfig support.
// Walks up from the file to the workspace root, merging matching sections.
// Covers the common patterns ([*], [*.ext], [{a,b}], [*.{js,ts}]) — enough for
// almost every real-world config. Drives per-file indentation.
import { invoke } from "@tauri-apps/api/core";

export interface EcResult {
  indentSize?: number;
  insertSpaces?: boolean;
}

/** Translate an editorconfig glob to a RegExp tested against the basename. */
function globToRe(glob: string): RegExp {
  let re = "";
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === "*") re += glob[i + 1] === "*" ? (i++, ".*") : "[^/]*";
    else if (c === "?") re += ".";
    else if (c === ".") re += "\\.";
    else if (c === "{") re += "(";
    else if (c === "}") re += ")";
    else if (c === ",") re += "|";
    else re += c.replace(/[+^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`^(${re})$`);
}

function parse(text: string, basename: string): EcResult & { root?: boolean } {
  const out: EcResult & { root?: boolean } = {};
  let active = false; // are we in a section that matches?
  for (let raw of text.split(/\r?\n/)) {
    const line = raw.replace(/[;#].*$/, "").trim();
    if (!line) continue;
    if (line.startsWith("[") && line.endsWith("]")) {
      const pat = line.slice(1, -1);
      active = globToRe(pat).test(basename);
      continue;
    }
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim().toLowerCase();
    const val = line.slice(eq + 1).trim().toLowerCase();
    if (key === "root" && val === "true") out.root = true;
    if (!active) continue;
    if (key === "indent_style") out.insertSpaces = val === "space";
    if (key === "indent_size" && val !== "tab") out.indentSize = parseInt(val, 10) || undefined;
    if (key === "tab_width" && out.indentSize == null) out.indentSize = parseInt(val, 10) || undefined;
  }
  return out;
}

export async function loadEditorConfig(folder: string, filePath: string): Promise<EcResult> {
  if (!folder || !filePath) return {};
  const basename = filePath.split(/[\\/]/).pop() ?? "";
  const result: EcResult = {};
  // One backend call returns the .editorconfig contents, closest dir first.
  let contents: string[];
  try {
    contents = await invoke<string[]>("read_editorconfig", { folder, file: filePath });
  } catch {
    return result;
  }
  for (const text of contents) {
    const parsed = parse(text, basename);
    if (result.indentSize == null && parsed.indentSize != null) result.indentSize = parsed.indentSize;
    if (result.insertSpaces == null && parsed.insertSpaces != null) result.insertSpaces = parsed.insertSpaces;
    if (parsed.root) break;
  }
  return result;
}
