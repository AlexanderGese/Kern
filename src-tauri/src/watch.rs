// src-tauri/src/watch.rs — watch the open folder and emit "fs:changed" (§8).
use notify::{EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use serde::Serialize;
use std::path::Path;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager};

/// Held in Tauri managed state so a new watch replaces the old one and
/// `unwatch_all` can drop it.
#[derive(Default)]
pub struct WatchState(pub Mutex<Option<RecommendedWatcher>>);

#[derive(Clone, Serialize)]
struct ChangedPayload {
    path: String,
}

/// Noisy/irrelevant directories whose churn we never surface to the UI.
fn is_noise(path: &Path) -> bool {
    path.components().any(|c| {
        matches!(
            c.as_os_str().to_str(),
            Some(".git") | Some("node_modules") | Some("target") | Some(".next") | Some("dist")
        )
    })
}

#[tauri::command]
pub fn watch_path(app: AppHandle, path: String) -> Result<(), String> {
    let handle = app.clone();
    let mut watcher = RecommendedWatcher::new(
        move |res: notify::Result<notify::Event>| {
            let Ok(event) = res else { return };
            // Ignore pure metadata/access reads; keep create/modify/remove/rename.
            if matches!(event.kind, EventKind::Access(_) | EventKind::Other) {
                return;
            }
            for p in event.paths {
                if is_noise(&p) {
                    continue;
                }
                let _ = handle.emit(
                    "fs:changed",
                    ChangedPayload {
                        path: p.to_string_lossy().to_string(),
                    },
                );
            }
        },
        notify::Config::default(),
    )
    .map_err(|e| e.to_string())?;

    watcher
        .watch(Path::new(&path), RecursiveMode::Recursive)
        .map_err(|e| e.to_string())?;

    let state = app.state::<WatchState>();
    *state.0.lock().unwrap() = Some(watcher);
    Ok(())
}

#[tauri::command]
pub fn unwatch_all(app: AppHandle) -> Result<(), String> {
    let state = app.state::<WatchState>();
    *state.0.lock().unwrap() = None;
    Ok(())
}
