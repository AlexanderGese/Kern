// src-tauri/src/editorconfig.rs — read the .editorconfig chain for a file in a
// single async call (closest dir first, up to the workspace root), instead of
// the frontend doing one IPC round-trip per directory level on the main thread.
use std::path::Path;

#[tauri::command]
pub async fn read_editorconfig(folder: String, file: String) -> Vec<String> {
    tokio::task::spawn_blocking(move || chain(&folder, &file))
        .await
        .unwrap_or_default()
}

fn chain(folder: &str, file: &str) -> Vec<String> {
    let mut out = Vec::new();
    if folder.is_empty() || file.is_empty() {
        return out;
    }
    let mut dir = match Path::new(file).parent() {
        Some(p) => p.to_path_buf(),
        None => return out,
    };
    let root = Path::new(folder);
    for _ in 0..64 {
        if let Ok(content) = std::fs::read_to_string(dir.join(".editorconfig")) {
            let is_root = content
                .lines()
                .any(|l| l.replace(' ', "").to_lowercase().starts_with("root=true"));
            out.push(content);
            if is_root {
                break;
            }
        }
        if dir == root {
            break;
        }
        match dir.parent() {
            Some(p) if p != dir => dir = p.to_path_buf(),
            _ => break,
        }
    }
    out
}
