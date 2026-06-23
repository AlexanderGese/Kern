// src-tauri/src/terminal.rs — a real PTY-backed integrated terminal.
// Spawns the user's shell, streams bytes to the UI as "term:output" events,
// and accepts input/resize from the frontend.
use portable_pty::{native_pty_system, CommandBuilder, MasterPty, PtySize};
use std::io::{Read, Write};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager};

struct TermInner {
    master: Box<dyn MasterPty + Send>,
    writer: Box<dyn Write + Send>,
    child: Box<dyn portable_pty::Child + Send + Sync>,
}

#[derive(Default)]
pub struct TermState(Mutex<Option<TermInner>>);

fn default_shell() -> String {
    if cfg!(windows) {
        std::env::var("COMSPEC").unwrap_or_else(|_| "cmd.exe".into())
    } else {
        std::env::var("SHELL").unwrap_or_else(|_| "/bin/bash".into())
    }
}

#[tauri::command]
pub fn term_open(app: AppHandle, cwd: String, cols: u16, rows: u16) -> Result<(), String> {
    // Close any existing session first.
    let _ = term_close(app.clone());

    let pty = native_pty_system();
    let pair = pty
        .openpty(PtySize { rows, cols, pixel_width: 0, pixel_height: 0 })
        .map_err(|e| e.to_string())?;

    let mut cmd = CommandBuilder::new(default_shell());
    if !cwd.is_empty() {
        cmd.cwd(cwd);
    }
    cmd.env("TERM", "xterm-256color");

    let child = pair.slave.spawn_command(cmd).map_err(|e| e.to_string())?;
    drop(pair.slave);

    let mut reader = pair.master.try_clone_reader().map_err(|e| e.to_string())?;
    let writer = pair.master.take_writer().map_err(|e| e.to_string())?;

    // Reader thread: stream raw bytes to the webview.
    let h = app.clone();
    std::thread::spawn(move || {
        let mut buf = [0u8; 4096];
        loop {
            match reader.read(&mut buf) {
                Ok(0) => break,
                Ok(n) => {
                    let _ = h.emit("term:output", buf[..n].to_vec());
                }
                Err(_) => break,
            }
        }
        let _ = h.emit("term:exit", ());
    });

    if let Some(state) = app.try_state::<TermState>() {
        *state.0.lock().unwrap() = Some(TermInner {
            master: pair.master,
            writer,
            child,
        });
    }
    Ok(())
}

#[tauri::command]
pub fn term_write(app: AppHandle, data: String) -> Result<(), String> {
    if let Some(state) = app.try_state::<TermState>() {
        if let Some(inner) = state.0.lock().unwrap().as_mut() {
            inner.writer.write_all(data.as_bytes()).map_err(|e| e.to_string())?;
            inner.writer.flush().map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

#[tauri::command]
pub fn term_resize(app: AppHandle, cols: u16, rows: u16) -> Result<(), String> {
    if let Some(state) = app.try_state::<TermState>() {
        if let Some(inner) = state.0.lock().unwrap().as_ref() {
            let _ = inner.master.resize(PtySize { rows, cols, pixel_width: 0, pixel_height: 0 });
        }
    }
    Ok(())
}

#[tauri::command]
pub fn term_close(app: AppHandle) -> Result<(), String> {
    if let Some(state) = app.try_state::<TermState>() {
        if let Some(mut inner) = state.0.lock().unwrap().take() {
            let _ = inner.child.kill();
        }
    }
    Ok(())
}
