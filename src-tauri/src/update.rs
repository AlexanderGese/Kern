// src-tauri/src/update.rs — lightweight self-update. Checks the latest GitHub
// release and, on request, downloads the portable binary and atomically replaces
// the running executable (works for per-user installs in ~/.local/bin / ~/.cargo).
use serde::Serialize;
use std::io::Read;

const REPO: &str = "AlexanderGese/Kern";

#[derive(Serialize)]
pub struct UpdateInfo {
    pub current: String,
    pub latest: String,
    pub update_available: bool,
}

fn parse_ver(v: &str) -> (u64, u64, u64) {
    let mut it = v.trim_start_matches('v').split('.').map(|p| p.parse().unwrap_or(0));
    (it.next().unwrap_or(0), it.next().unwrap_or(0), it.next().unwrap_or(0))
}

#[tauri::command]
pub async fn check_update() -> Result<UpdateInfo, String> {
    tokio::task::spawn_blocking(check_update_blocking)
        .await
        .map_err(|e| e.to_string())?
}

fn check_update_blocking() -> Result<UpdateInfo, String> {
    let url = format!("https://api.github.com/repos/{REPO}/releases/latest");
    let resp = ureq::get(&url)
        .set("User-Agent", "kern-updater")
        .call()
        .map_err(|e| e.to_string())?;
    let text = resp.into_string().map_err(|e| e.to_string())?;
    let json: serde_json::Value = serde_json::from_str(&text).map_err(|e| e.to_string())?;
    let latest = json["tag_name"].as_str().unwrap_or("").trim_start_matches('v').to_string();
    let current = env!("CARGO_PKG_VERSION").to_string();
    let update_available = parse_ver(&latest) > parse_ver(&current);
    Ok(UpdateInfo { current, latest, update_available })
}

#[tauri::command]
pub async fn self_update() -> Result<String, String> {
    tokio::task::spawn_blocking(self_update_blocking)
        .await
        .map_err(|e| e.to_string())?
}

fn self_update_blocking() -> Result<String, String> {
    let info = check_update_blocking()?;
    if !info.update_available {
        return Ok(format!("Kern is up to date (v{}).", info.current));
    }
    let url = format!("https://github.com/{REPO}/releases/latest/download/kern-linux-x86_64");
    let resp = ureq::get(&url).call().map_err(|e| format!("download: {e}"))?;
    let mut bytes = Vec::new();
    resp.into_reader().read_to_end(&mut bytes).map_err(|e| e.to_string())?;
    if bytes.len() < 1_000_000 {
        return Err("downloaded binary looks too small — aborting".into());
    }
    let exe = std::env::current_exe().map_err(|e| e.to_string())?;
    let tmp = exe.with_extension("new");
    std::fs::write(&tmp, &bytes).map_err(|e| format!("write {tmp:?}: {e}"))?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = std::fs::set_permissions(&tmp, std::fs::Permissions::from_mode(0o755));
    }
    // Renaming over the running binary is fine on Unix (old inode stays mapped).
    std::fs::rename(&tmp, &exe).map_err(|e| {
        let _ = std::fs::remove_file(&tmp);
        format!("could not replace {exe:?}: {e}")
    })?;
    Ok(format!("Updated to v{} — restart Kern to apply.", info.latest))
}
