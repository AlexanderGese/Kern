// src-tauri/src/dap.rs — spawn a Debug Adapter and bridge its stdio <-> a
// WebSocket, reusing the same Content-Length framing as the LSP bridge. The
// frontend (src/dap/client.ts) speaks raw DAP JSON over the socket.
use crate::lsp::{read_frame, write_frame};
use futures_util::{SinkExt, StreamExt};
use std::process::Stdio;
use tauri::Emitter;
use tokio::io::BufReader;
use tokio::net::TcpListener;
use tokio::process::Command;
use tokio_tungstenite::tungstenite::Message;

/// Resolve the debug-adapter program + args for a debugger key.
fn adapter_for(kind: &str) -> Option<(String, Vec<String>)> {
    match kind {
        // debugpy ships its own DAP adapter entrypoint.
        "python" => Some(("python3".into(), vec!["-m".into(), "debugpy.adapter".into()])),
        "python-py" => Some(("python".into(), vec!["-m".into(), "debugpy.adapter".into()])),
        // vscode-js-debug's DAP server binary (if installed as `js-debug-adapter`).
        "node" => Some(("js-debug-adapter".into(), vec![])),
        // CodeLLDB for Rust/C/C++.
        "lldb" => Some(("codelldb".into(), vec![])),
        _ => None,
    }
}

#[tauri::command]
pub fn dap_adapters() -> Vec<String> {
    ["python", "node", "lldb"]
        .iter()
        .filter(|k| {
            adapter_for(k)
                .map(|(p, _)| which(&p).is_some())
                .unwrap_or(false)
        })
        .map(|s| s.to_string())
        .collect()
}

fn which(program: &str) -> Option<()> {
    let path = std::env::var_os("PATH")?;
    for dir in std::env::split_paths(&path) {
        if dir.join(program).is_file() {
            return Some(());
        }
    }
    None
}

/// Spawn the debug adapter for `kind` and return the localhost ws port.
#[tauri::command]
pub async fn dap_start(app: tauri::AppHandle, kind: String) -> Result<u16, String> {
    let (program, args) = adapter_for(&kind)
        .or_else(|| adapter_for("python-py").filter(|_| kind == "python"))
        .ok_or_else(|| format!("no debug adapter for {kind}"))?;

    let listener = TcpListener::bind("127.0.0.1:0")
        .await
        .map_err(|e| e.to_string())?;
    let port = listener.local_addr().map_err(|e| e.to_string())?.port();
    let err_handle = app.clone();

    tokio::spawn(async move {
        let Ok((stream, _peer)) = listener.accept().await else { return };
        let ws = match tokio_tungstenite::accept_async(stream).await {
            Ok(ws) => ws,
            Err(e) => {
                let _ = err_handle.emit("dap:error", format!("ws handshake: {e}"));
                return;
            }
        };
        let mut child = match Command::new(&program)
            .args(&args)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::null())
            .spawn()
        {
            Ok(c) => c,
            Err(e) => {
                let _ = app.emit("dap:error", format!("{program}: {e}"));
                return;
            }
        };
        let mut child_stdin = child.stdin.take().unwrap();
        let mut reader = BufReader::new(child.stdout.take().unwrap());
        let (mut ws_tx, mut ws_rx) = ws.split();

        let to_ws = async move {
            while let Ok(Some(body)) = read_frame(&mut reader).await {
                if ws_tx.send(Message::Text(body.into())).await.is_err() {
                    break;
                }
            }
            let _ = ws_tx.close().await;
        };
        let to_child = async move {
            while let Some(Ok(msg)) = ws_rx.next().await {
                match msg {
                    Message::Text(_) | Message::Binary(_) => {
                        if write_frame(&mut child_stdin, &msg.into_data()).await.is_err() {
                            break;
                        }
                    }
                    Message::Close(_) => break,
                    _ => {}
                }
            }
        };
        tokio::select! { _ = to_ws => {}, _ = to_child => {} }
        let _ = child.kill().await;
    });

    Ok(port)
}
