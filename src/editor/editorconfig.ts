// src/editor/editorconfig.ts — lightweight .editorconfig support.
// Walks up from the file to the workspace root, merging matching sections.
// Covers the common patterns ([*], [*.ext], [{a,b}], [*.{js,ts}]) — enough for
// almost every real-world config. Drives per-file indentation.
import { fsApi } from "../ipc";

export interface EcResult {
  indentSize?: number;
  insertSpaces?: boolean;
}

function sep(p: string) {
  return p.includes("\\") ? "\\" : "/";
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
  const s = sep(filePath);
  const basename = filePath.split(/[\\/]/).pop() ?? "";
  const result: EcResult = {};
  let dir = filePath.slice(0, filePath.lastIndexOf(s));
  // Walk up until we leave the workspace folder.
  for (let guard = 0; guard < 40 && dir && dir.startsWith(folder.slice(0, dir.length || 1)); guard++) {
    try {
      const file = await fsApi.openFile(`${dir}${s}.editorconfig`);
      const parsed = parse(file.content, basename);
      // Closest file wins; only fill unset keys as we walk upward.
      if (result.indentSize == null && parsed.indentSize != null) result.indentSize = parsed.indentSize;
      if (result.insertSpaces == null && parsed.insertSpaces != null) result.insertSpaces = parsed.insertSpaces;
      if (parsed.root) break;
    } catch {
      /* no .editorconfig here */
    }
    if (dir === folder) break;
    const up = dir.slice(0, dir.lastIndexOf(s));
    if (!up || up === dir) break;
    dir = up;
  }
  return result;
}
