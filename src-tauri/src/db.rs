// src-tauri/src/db.rs — minimal SQLite explorer via the `sqlite3` CLI (so there's
// no heavy native dependency; lights up when sqlite3 is installed).
use std::process::Command;

#[tauri::command]
pub fn db_tables(path: String) -> Result<Vec<String>, String> {
    let out = Command::new("sqlite3")
        .arg(&path)
        .arg(".tables")
        .output()
        .map_err(|e| format!("sqlite3: {e}"))?;
    if !out.status.success() {
        return Err(String::from_utf8_lossy(&out.stderr).to_string());
    }
    Ok(String::from_utf8_lossy(&out.stdout)
        .split_whitespace()
        .map(|s| s.to_string())
        .collect())
}

/// Run a query and return the rows as a JSON string (sqlite3 -json).
#[tauri::command]
pub fn db_query(path: String, sql: String) -> Result<String, String> {
    let out = Command::new("sqlite3")
        .arg("-json")
        .arg(&path)
        .arg(&sql)
        .output()
        .map_err(|e| format!("sqlite3: {e}"))?;
    if !out.status.success() {
        return Err(String::from_utf8_lossy(&out.stderr).to_string());
    }
    let s = String::from_utf8_lossy(&out.stdout).to_string();
    Ok(if s.trim().is_empty() { "[]".into() } else { s })
}
