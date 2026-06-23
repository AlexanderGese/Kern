// src-tauri/src/search.rs — project-wide text search (§ global search & replace).
// A simple recursive scan: skips ignored/binary/large files, caps results.
use serde::Serialize;
use std::fs;
use std::path::Path;

const IGNORE_DIRS: &[&str] = &[
    ".git", "node_modules", "target", "dist", "build", ".next", ".turbo", ".cache",
    ".svelte-kit", "out", "coverage", ".idea", ".vscode",
];
const MAX_RESULTS: usize = 1000;
const MAX_FILE_BYTES: u64 = 2_000_000;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchMatch {
    pub path: String,
    pub line: usize,
    pub col: usize,
    pub text: String,
}

#[tauri::command]
pub fn search_text(
    folder: String,
    query: String,
    case_sensitive: bool,
) -> Result<Vec<SearchMatch>, String> {
    if query.is_empty() {
        return Ok(Vec::new());
    }
    let needle = if case_sensitive { query.clone() } else { query.to_lowercase() };
    let mut out = Vec::new();
    walk(Path::new(&folder), &needle, case_sensitive, &mut out);
    Ok(out)
}

fn walk(dir: &Path, needle: &str, cs: bool, out: &mut Vec<SearchMatch>) {
    if out.len() >= MAX_RESULTS {
        return;
    }
    let Ok(rd) = fs::read_dir(dir) else { return };
    let mut entries: Vec<_> = rd.filter_map(|e| e.ok()).collect();
    entries.sort_by_key(|e| e.file_name());
    for entry in entries {
        if out.len() >= MAX_RESULTS {
            return;
        }
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();
        let is_dir = path.is_dir();
        if is_dir {
            if IGNORE_DIRS.contains(&name.as_str()) {
                continue;
            }
            walk(&path, needle, cs, out);
        } else {
            if fs::metadata(&path).map(|m| m.len()).unwrap_or(0) > MAX_FILE_BYTES {
                continue;
            }
            let Ok(content) = fs::read_to_string(&path) else { continue }; // skips binary
            for (i, raw) in content.lines().enumerate() {
                let hay = if cs { raw.to_string() } else { raw.to_lowercase() };
                if let Some(col) = hay.find(needle) {
                    out.push(SearchMatch {
                        path: path.to_string_lossy().to_string(),
                        line: i + 1,
                        col: col + 1,
                        text: raw.chars().take(200).collect(),
                    });
                    if out.len() >= MAX_RESULTS {
                        return;
                    }
                }
            }
        }
    }
}

#[tauri::command]
pub fn replace_in_file(path: String, find: String, replace: String) -> Result<usize, String> {
    let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let count = content.matches(&find).count();
    if count == 0 {
        return Ok(0);
    }
    let replaced = content.replace(&find, &replace);
    fs::write(&path, replaced).map_err(|e| e.to_string())?;
    Ok(count)
}
