// src-tauri/src/lint.rs — run an external linter and normalize its JSON output
// into diagnostics the UI turns into Monaco markers (owner "kern-lint", so they
// coexist with LSP markers). Supports ruff, eslint, shellcheck.
use serde::Serialize;
use serde_json::Value;
use std::process::Command;

#[derive(Serialize, Default)]
pub struct LintDiag {
    pub line: u32,
    pub column: u32,
    pub end_line: u32,
    pub end_column: u32,
    pub message: String,
    pub severity: String, // "error" | "warning" | "info"
    pub source: String,
}

fn run(tool: &str, args: &[&str], cwd: &str) -> Option<String> {
    let mut cmd = Command::new(tool);
    cmd.args(args);
    if !cwd.is_empty() {
        cmd.current_dir(cwd);
    }
    let out = cmd.output().ok()?;
    Some(String::from_utf8_lossy(&out.stdout).to_string())
}

#[tauri::command]
pub fn lint_source(language: String, file: String, cwd: String) -> Vec<LintDiag> {
    match language.as_str() {
        "python" => ruff(&file, &cwd),
        "typescript" | "javascript" => eslint(&file, &cwd),
        "shell" => shellcheck(&file, &cwd),
        _ => Vec::new(),
    }
}

fn ruff(file: &str, cwd: &str) -> Vec<LintDiag> {
    let Some(out) = run("ruff", &["check", "--output-format", "json", "--quiet", file], cwd) else {
        return Vec::new();
    };
    let Ok(Value::Array(items)) = serde_json::from_str::<Value>(&out) else {
        return Vec::new();
    };
    items
        .iter()
        .map(|d| LintDiag {
            line: d["location"]["row"].as_u64().unwrap_or(1) as u32,
            column: d["location"]["column"].as_u64().unwrap_or(1) as u32,
            end_line: d["end_location"]["row"].as_u64().unwrap_or(1) as u32,
            end_column: d["end_location"]["column"].as_u64().unwrap_or(1) as u32,
            message: format!(
                "{} {}",
                d["code"].as_str().unwrap_or(""),
                d["message"].as_str().unwrap_or("")
            ),
            severity: "warning".into(),
            source: "ruff".into(),
        })
        .collect()
}

fn eslint(file: &str, cwd: &str) -> Vec<LintDiag> {
    let Some(out) = run("eslint", &["-f", "json", file], cwd) else {
        return Vec::new();
    };
    let Ok(Value::Array(files)) = serde_json::from_str::<Value>(&out) else {
        return Vec::new();
    };
    let mut diags = Vec::new();
    for f in &files {
        if let Some(Value::Array(msgs)) = f.get("messages") {
            for m in msgs {
                let line = m["line"].as_u64().unwrap_or(1) as u32;
                let col = m["column"].as_u64().unwrap_or(1) as u32;
                diags.push(LintDiag {
                    line,
                    column: col,
                    end_line: m["endLine"].as_u64().unwrap_or(line as u64) as u32,
                    end_column: m["endColumn"].as_u64().unwrap_or(col as u64 + 1) as u32,
                    message: format!(
                        "{}{}",
                        m["message"].as_str().unwrap_or(""),
                        m["ruleId"].as_str().map(|r| format!(" ({r})")).unwrap_or_default()
                    ),
                    severity: if m["severity"].as_u64() == Some(2) { "error" } else { "warning" }.into(),
                    source: "eslint".into(),
                });
            }
        }
    }
    diags
}

fn shellcheck(file: &str, cwd: &str) -> Vec<LintDiag> {
    let Some(out) = run("shellcheck", &["-f", "json", file], cwd) else {
        return Vec::new();
    };
    let Ok(Value::Array(items)) = serde_json::from_str::<Value>(&out) else {
        return Vec::new();
    };
    items
        .iter()
        .map(|d| {
            let line = d["line"].as_u64().unwrap_or(1) as u32;
            let col = d["column"].as_u64().unwrap_or(1) as u32;
            LintDiag {
                line,
                column: col,
                end_line: d["endLine"].as_u64().unwrap_or(line as u64) as u32,
                end_column: d["endColumn"].as_u64().unwrap_or(col as u64 + 1) as u32,
                message: format!("SC{} {}", d["code"].as_u64().unwrap_or(0), d["message"].as_str().unwrap_or("")),
                severity: match d["level"].as_str().unwrap_or("warning") {
                    "error" => "error",
                    "info" | "style" => "info",
                    _ => "warning",
                }
                .into(),
                source: "shellcheck".into(),
            }
        })
        .collect()
}
