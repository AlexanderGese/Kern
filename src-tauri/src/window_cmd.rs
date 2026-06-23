// src-tauri/src/window_cmd.rs — open additional editor windows. Each new window
// loads the app fresh with its own JS context (and thus its own store/session).
use std::sync::atomic::{AtomicUsize, Ordering};
use tauri::{AppHandle, WebviewUrl, WebviewWindowBuilder};

static COUNTER: AtomicUsize = AtomicUsize::new(1);

#[tauri::command]
pub fn new_window(app: AppHandle) -> Result<(), String> {
    let n = COUNTER.fetch_add(1, Ordering::SeqCst);
    let label = format!("kern-{n}");
    // Match the main window's frontend source (downloaded local copy if present).
    let url = if crate::frontend::has_local_frontend() {
        WebviewUrl::CustomProtocol("kernfs://localhost/index.html".parse().unwrap())
    } else {
        WebviewUrl::App("index.html".into())
    };
    WebviewWindowBuilder::new(&app, &label, url)
        .title("Kern")
        .inner_size(1180.0, 760.0)
        .min_inner_size(680.0, 440.0)
        .decorations(false)
        .background_color(tauri::webview::Color(12, 12, 11, 255))
        .build()
        .map_err(|e| e.to_string())?;
    Ok(())
}
