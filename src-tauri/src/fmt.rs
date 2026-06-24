// src-tauri/src/fmt.rs — run an external formatter over stdin→stdout (prettier,
// black, rustfmt, gofmt, shfmt, …). The frontend applies the result as a
// full-document edit. A background thread feeds stdin to avoid pipe deadlock.
use std::io::Write;
use std::process::{Command, Stdio};

#[tauri::command]
pub async fn format_source(
    tool: String,
    args: Vec<String>,
    content: String,
    cwd: String,
) -> Result<String, String> {
    tokio::task::spawn_blocking(move || format_blocking(tool, args, content, cwd))
        .await
        .map_err(|e| e.to_string())?
}

fn format_blocking(
    tool: String,
    args: Vec<String>,
    content: String,
    cwd: String,
) -> Result<String, String> {
    let mut cmd = Command::new(&tool);
    cmd.args(&args)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    if !cwd.is_empty() {
        cmd.current_dir(&cwd);
    }
    let mut child = cmd.spawn().map_err(|e| format!("{tool}: {e}"))?;

    if let Some(mut stdin) = child.stdin.take() {
        std::thread::spawn(move || {
            let _ = stdin.write_all(content.as_bytes());
        });
    }
    let out = child.wait_with_output().map_err(|e| e.to_string())?;
    if !out.status.success() {
        let err = String::from_utf8_lossy(&out.stderr);
        return Err(if err.is_empty() {
            format!("{tool} exited with status {}", out.status)
        } else {
            err.to_string()
        });
    }
    let formatted = String::from_utf8_lossy(&out.stdout).to_string();
    if formatted.trim().is_empty() {
        return Err("formatter produced no output".into());
    }
    Ok(formatted)
}
