// src-tauri/src/frontend.rs — runtime frontend bootstrap.
//
// The bundled .deb/.rpm embed the web frontend, so they Just Work. A binary
// installed via `cargo install kern-code` has NO embedded frontend (crates.io
// can't carry it) — so on first launch it downloads the matching frontend
// tarball from the GitHub release into the app-data dir and serves it through
// the `kernfs://` custom protocol.
use std::io::Read;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::http::{Request, Response};

pub static FRONTEND_READY: AtomicBool = AtomicBool::new(false);

/// The embedded frontend calls this once it has rendered. If it never fires,
/// the embedded assets are missing (cargo-install build) and we bootstrap.
#[tauri::command]
pub fn frontend_ready() {
    FRONTEND_READY.store(true, Ordering::SeqCst);
}

/// `<data_dir>/com.kern.app/frontend`
pub fn frontend_dir() -> PathBuf {
    dirs::data_dir()
        .unwrap_or_else(|| std::env::temp_dir())
        .join("com.kern.app")
        .join("frontend")
}

pub fn has_local_frontend() -> bool {
    frontend_dir().join("index.html").is_file()
}

const VERSION: &str = env!("CARGO_PKG_VERSION");

/// Download + extract the frontend tarball for this version into `frontend_dir`.
pub fn bootstrap_frontend() -> Result<(), String> {
    let dir = frontend_dir();
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let url = format!(
        "https://github.com/AlexanderGese/Kern/releases/download/v{VERSION}/kern-frontend.tar.gz"
    );

    let resp = ureq::get(&url)
        .call()
        .map_err(|e| format!("download {url}: {e}"))?;
    let mut bytes: Vec<u8> = Vec::new();
    resp.into_reader()
        .read_to_end(&mut bytes)
        .map_err(|e| e.to_string())?;

    let gz = flate2::read::GzDecoder::new(&bytes[..]);
    let mut archive = tar::Archive::new(gz);
    // Extract into a temp dir, then atomically swap, so a partial download never
    // leaves a half-written frontend behind.
    let tmp = dir.with_extension("incoming");
    let _ = std::fs::remove_dir_all(&tmp);
    std::fs::create_dir_all(&tmp).map_err(|e| e.to_string())?;
    archive.unpack(&tmp).map_err(|e| e.to_string())?;

    // The tarball may contain a top-level `dist/` folder — flatten it.
    let root = if tmp.join("dist").join("index.html").is_file() {
        tmp.join("dist")
    } else {
        tmp.clone()
    };
    let _ = std::fs::remove_dir_all(&dir);
    std::fs::rename(&root, &dir).or_else(|_| copy_dir(&root, &dir)).map_err(|e| e.to_string())?;
    let _ = std::fs::remove_dir_all(&tmp);

    if frontend_dir().join("index.html").is_file() {
        Ok(())
    } else {
        Err("frontend tarball did not contain index.html".into())
    }
}

fn copy_dir(from: &Path, to: &Path) -> std::io::Result<()> {
    std::fs::create_dir_all(to)?;
    for entry in std::fs::read_dir(from)? {
        let entry = entry?;
        let dst = to.join(entry.file_name());
        if entry.file_type()?.is_dir() {
            copy_dir(&entry.path(), &dst)?;
        } else {
            std::fs::copy(entry.path(), dst)?;
        }
    }
    Ok(())
}

/// Serve a file from the local frontend dir for the `kernfs://` protocol.
pub fn serve_local(request: Request<Vec<u8>>) -> Response<Vec<u8>> {
    let dir = frontend_dir();
    let mut rel = request.uri().path().trim_start_matches('/').to_string();
    if rel.is_empty() {
        rel = "index.html".into();
    }
    let mut path = dir.join(&rel);
    // SPA fallback: extension-less paths resolve to index.html.
    if !path.is_file() && !rel.contains('.') {
        path = dir.join("index.html");
    }
    match std::fs::read(&path) {
        Ok(body) => Response::builder()
            .status(200)
            .header("Content-Type", mime_for(&path))
            .header("Access-Control-Allow-Origin", "*")
            .header("Cache-Control", "no-cache")
            .body(body)
            .unwrap(),
        Err(_) => Response::builder().status(404).body(Vec::new()).unwrap(),
    }
}

fn mime_for(path: &Path) -> &'static str {
    match path.extension().and_then(|e| e.to_str()).unwrap_or("") {
        "html" => "text/html",
        "js" | "mjs" => "text/javascript",
        "css" => "text/css",
        "json" | "map" => "application/json",
        "woff2" => "font/woff2",
        "woff" => "font/woff",
        "ttf" => "font/ttf",
        "png" => "image/png",
        "svg" => "image/svg+xml",
        "ico" => "image/x-icon",
        "wasm" => "application/wasm",
        _ => "application/octet-stream",
    }
}
