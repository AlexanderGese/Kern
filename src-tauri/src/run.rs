// src-tauri/src/run.rs — the configurable code runner. Spawns a shell command,
// streams stdout/stderr to the UI as "run:output" events, and emits "run:exit".
use serde::Serialize;
use std::io::{BufRead, BufReader};
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager};

#[derive(Default)]
pub struct RunState(pub Mutex<Option<Child>>);

#[derive(Clone, Serialize)]
struct OutputLine {
    line: String,
    stream: String, // "stdout" | "stderr" | "meta"
}

#[derive(Clone, Serialize)]
struct ExitPayload {
    code: i32,
}

/// Run `command` (via the platform shell) in `cwd`, streaming output.
#[tauri::command]
pub fn run_command(app: AppHandle, command: String, cwd: String) -> Result<(), String> {
    // Kill any previous run.
    let _ = stop_run(app.clone());

    let mut cmd = if cfg!(windows) {
        let mut c = Command::new("cmd");
        c.args(["/C", &command]);
        c
    } else {
        let mut c = Command::new("sh");
        c.args(["-c", &command]);
        c
    };
    cmd.current_dir(&cwd)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    let _ = app.emit(
        "run:output",
        OutputLine { line: format!("$ {command}"), stream: "meta".into() },
    );

    let mut child = cmd.spawn().map_err(|e| e.to_string())?;
    let stdout = child.stdout.take();
    let stderr = child.stderr.take();

    if let Some(out) = stdout {
        let h = app.clone();
        std::thread::spawn(move || {
            for line in BufReader::new(out).lines().map_while(Result::ok) {
                let _ = h.emit("run:output", OutputLine { line, stream: "stdout".into() });
            }
        });
    }
    if let Some(err) = stderr {
        let h = app.clone();
        std::thread::spawn(move || {
            for line in BufReader::new(err).lines().map_while(Result::ok) {
                let _ = h.emit("run:output", OutputLine { line, stream: "stderr".into() });
            }
        });
    }

    // Store the child so stop_run can kill it; a poll thread detects exit.
    if let Some(state) = app.try_state::<RunState>() {
        *state.0.lock().unwrap() = Some(child);
    }

    let wait_app = app.clone();
    std::thread::spawn(move || loop {
        std::thread::sleep(Duration::from_millis(120));
        let Some(state) = wait_app.try_state::<RunState>() else { break };
        let mut guard = state.0.lock().unwrap();
        match guard.as_mut() {
            Some(c) => match c.try_wait() {
                Ok(Some(status)) => {
                    *guard = None;
                    drop(guard);
                    let _ = wait_app.emit("run:exit", ExitPayload { code: status.code().unwrap_or(-1) });
                    break;
                }
                Ok(None) => {}
                Err(_) => {
                    *guard = None;
                    break;
                }
            },
            None => break, // cleared/stopped elsewhere
        }
    });

    Ok(())
}

#[tauri::command]
pub fn stop_run(app: AppHandle) -> Result<(), String> {
    if let Some(state) = app.try_state::<RunState>() {
        if let Some(child) = state.0.lock().unwrap().as_mut() {
            let _ = child.kill();
        }
    }
    let _ = app.emit("run:output", OutputLine { line: "— stopped —".into(), stream: "meta".into() });
    Ok(())
}
