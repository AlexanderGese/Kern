// src-tauri/src/tasks.rs — detect runnable project tasks (npm/pnpm/yarn scripts,
// Cargo, Makefile targets, Go). Each task is just a shell command run through the
// existing run_command streaming pipeline.
use serde::Serialize;
use std::path::Path;

#[derive(Serialize)]
pub struct Task {
    pub source: String,
    pub name: String,
    pub command: String,
}

#[derive(Serialize)]
pub struct TestRunner {
    pub framework: String,
    pub command: String,
}

/// Detect the test framework(s) for a workspace.
#[tauri::command]
pub fn detect_tests(folder: String) -> Vec<TestRunner> {
    let mut out = Vec::new();
    let root = Path::new(&folder);
    if folder.is_empty() {
        return out;
    }
    if root.join("Cargo.toml").exists() {
        out.push(TestRunner { framework: "cargo".into(), command: "cargo test".into() });
    }
    if root.join("go.mod").exists() {
        out.push(TestRunner { framework: "go".into(), command: "go test ./...".into() });
    }
    if let Ok(txt) = std::fs::read_to_string(root.join("package.json")) {
        let v: serde_json::Value = serde_json::from_str(&txt).unwrap_or_default();
        let has = |name: &str| {
            v["devDependencies"].get(name).is_some() || v["dependencies"].get(name).is_some()
        };
        let runner = if root.join("pnpm-lock.yaml").exists() {
            "pnpm exec"
        } else if root.join("yarn.lock").exists() {
            "yarn"
        } else {
            "npx"
        };
        if has("vitest") {
            out.push(TestRunner { framework: "vitest".into(), command: format!("{runner} vitest run") });
        } else if has("jest") {
            out.push(TestRunner { framework: "jest".into(), command: format!("{runner} jest") });
        } else if v["scripts"].get("test").is_some() {
            out.push(TestRunner { framework: "npm".into(), command: "npm test".into() });
        }
    }
    let py_cfg = root.join("pytest.ini").exists()
        || root.join("pyproject.toml").exists()
        || root.join("setup.cfg").exists();
    if py_cfg {
        out.push(TestRunner { framework: "pytest".into(), command: "pytest".into() });
    }
    out
}

#[tauri::command]
pub fn detect_tasks(folder: String) -> Vec<Task> {
    let mut out: Vec<Task> = Vec::new();
    let root = Path::new(&folder);
    if folder.is_empty() {
        return out;
    }

    // package.json scripts (pick the package manager from the lockfile).
    if let Ok(txt) = std::fs::read_to_string(root.join("package.json")) {
        if let Ok(json) = serde_json::from_str::<serde_json::Value>(&txt) {
            let pm = if root.join("pnpm-lock.yaml").exists() {
                "pnpm"
            } else if root.join("yarn.lock").exists() {
                "yarn"
            } else if root.join("bun.lockb").exists() {
                "bun run"
            } else {
                "npm run"
            };
            if let Some(scripts) = json.get("scripts").and_then(|s| s.as_object()) {
                for name in scripts.keys() {
                    out.push(Task {
                        source: "npm".into(),
                        name: name.clone(),
                        command: format!("{pm} {name}"),
                    });
                }
            }
        }
    }

    // Cargo.
    if root.join("Cargo.toml").exists() {
        for (name, command) in [
            ("run", "cargo run"),
            ("build", "cargo build"),
            ("test", "cargo test"),
            ("check", "cargo check"),
            ("clippy", "cargo clippy"),
            ("build --release", "cargo build --release"),
        ] {
            out.push(Task { source: "cargo".into(), name: name.into(), command: command.into() });
        }
    }

    // Go modules.
    if root.join("go.mod").exists() {
        for (name, command) in [
            ("run", "go run ."),
            ("build", "go build ./..."),
            ("test", "go test ./..."),
        ] {
            out.push(Task { source: "go".into(), name: name.into(), command: command.into() });
        }
    }

    // Makefile targets (top-level `name:` lines, skipping variables + .PHONY etc.).
    for mk in ["Makefile", "makefile", "GNUmakefile"] {
        if let Ok(txt) = std::fs::read_to_string(root.join(mk)) {
            for line in txt.lines() {
                if line.starts_with([' ', '\t', '#', '.']) || line.contains('=') {
                    continue;
                }
                if let Some(colon) = line.find(':') {
                    let target = line[..colon].trim();
                    if !target.is_empty()
                        && target.chars().all(|c| c.is_alphanumeric() || c == '_' || c == '-')
                    {
                        out.push(Task {
                            source: "make".into(),
                            name: target.into(),
                            command: format!("make {target}"),
                        });
                    }
                }
            }
            break;
        }
    }

    out
}
