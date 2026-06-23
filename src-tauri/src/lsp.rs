// src-tauri/src/lsp.rs — spawn language servers and bridge stdio <-> WebSocket
// (§9). The browser speaks raw LSP JSON-RPC over the socket (one JSON object per
// ws message); this module owns the Content-Length framing against the child's
// stdio. Build this last and incrementally — start with ONE language (Pyright).
use futures_util::{SinkExt, StreamExt};
use std::env;
use std::path::PathBuf;
use std::process::Stdio;
use tauri::Emitter;
use tokio::io::{AsyncReadExt, AsyncWriteExt, BufReader};
use tokio::net::TcpListener;
use tokio::process::Command;
use tokio_tungstenite::tungstenite::Message;

/// Resolve the server program + args for a language key (§9 examples).
fn server_for(language: &str) -> Option<(Vec<&'static str>, Vec<&'static str>)> {
    // Each entry is (candidate programs, args). The first program found on PATH
    // wins, so e.g. basedpyright can stand in for pyright.
    match language {
        "python" => Some((vec!["pyright-langserver", "basedpyright-langserver"], vec!["--stdio"])),
        "typescript" => Some((vec!["typescript-language-server"], vec!["--stdio"])),
        "rust" => Some((vec!["rust-analyzer"], vec![])),
        "go" => Some((vec!["gopls"], vec![])),
        "c" | "cpp" => Some((vec!["clangd"], vec![])),
        "java" => Some((vec!["jdtls"], vec![])),
        "json" => Some((vec!["vscode-json-language-server", "vscode-json-languageserver"], vec!["--stdio"])),
        "html" => Some((vec!["vscode-html-language-server", "vscode-html-languageserver"], vec!["--stdio"])),
        "css" => Some((vec!["vscode-css-language-server", "vscode-css-languageserver"], vec!["--stdio"])),
        "yaml" => Some((vec!["yaml-language-server"], vec!["--stdio"])),
        "toml" => Some((vec!["taplo"], vec!["lsp", "stdio"])),
        "markdown" => Some((vec!["marksman"], vec!["server"])),
        "bash" => Some((vec!["bash-language-server"], vec!["start"])),
        "dockerfile" => Some((vec!["docker-langserver"], vec!["--stdio"])),
        "php" => Some((vec!["intelephense"], vec!["--stdio"])),
        "ruby" => Some((vec!["ruby-lsp", "solargraph"], vec![])),
        "lua" => Some((vec!["lua-language-server"], vec![])),
        "kotlin" => Some((vec!["kotlin-language-server"], vec![])),
        "swift" => Some((vec!["sourcekit-lsp"], vec![])),
        "dart" => Some((vec!["dart"], vec!["language-server", "--protocol=lsp"])),
        "clojure" => Some((vec!["clojure-lsp"], vec![])),
        "vue" => Some((vec!["vue-language-server"], vec!["--stdio"])),
        "svelte" => Some((vec!["svelteserver"], vec!["--stdio"])),
        "astro" => Some((vec!["astro-ls"], vec!["--stdio"])),
        "zig" => Some((vec!["zls"], vec![])),
        "elixir" => Some((vec!["elixir-ls", "language_server.sh"], vec![])),
        "haskell" => Some((vec!["haskell-language-server-wrapper"], vec!["--lsp"])),
        "ocaml" => Some((vec!["ocamllsp"], vec![])),
        "terraform" => Some((vec!["terraform-ls"], vec!["serve"])),
        "elm" => Some((vec!["elm-language-server"], vec!["--stdio"])),
        "prisma" => Some((vec!["prisma-language-server"], vec!["--stdio"])),
        "latex" => Some((vec!["texlab"], vec![])),
        "graphql" => Some((vec!["graphql-lsp"], vec!["server", "-m", "stream"])),
        "csharp" => Some((vec!["csharp-ls", "omnisharp"], vec![])),
        _ => None,
    }
}

fn which(program: &str) -> Option<PathBuf> {
    let path = env::var_os("PATH")?;
    let exts: &[&str] = if cfg!(windows) { &["", ".exe", ".cmd", ".bat"] } else { &[""] };
    for dir in env::split_paths(&path) {
        for ext in exts {
            let candidate = dir.join(format!("{program}{ext}"));
            if candidate.is_file() {
                return Some(candidate);
            }
        }
    }
    None
}

fn resolve(language: &str) -> Option<(PathBuf, Vec<&'static str>)> {
    let (candidates, args) = server_for(language)?;
    for c in candidates {
        if let Some(p) = which(c) {
            return Some((p, args));
        }
    }
    None
}

#[tauri::command]
pub fn lsp_available_languages() -> Vec<String> {
    ["python", "typescript", "rust", "go", "c", "cpp"]
        .into_iter()
        .filter(|l| resolve(l).is_some())
        .map(|l| l.to_string())
        .collect()
}

/// Spawn the server for `language` and return the localhost ws port the UI
/// should connect to. The listener accepts exactly one connection, then pumps
/// until either side closes, at which point the child is killed.
#[tauri::command]
pub async fn lsp_start_server(app: tauri::AppHandle, language: String) -> Result<u16, String> {
    let (program, args) =
        resolve(&language).ok_or_else(|| format!("no language server for {language}"))?;

    let listener = TcpListener::bind("127.0.0.1:0")
        .await
        .map_err(|e| e.to_string())?;
    let port = listener.local_addr().map_err(|e| e.to_string())?.port();

    let lang = language.clone();
    let err_handle = app.clone();
    tokio::spawn(async move {
        let Ok((stream, _peer)) = listener.accept().await else {
            return;
        };
        let ws = match tokio_tungstenite::accept_async(stream).await {
            Ok(ws) => ws,
            Err(e) => {
                let _ = err_handle.emit("lsp:error", format!("{lang}: ws handshake: {e}"));
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
                let _ = app.emit("lsp:error", format!("{lang}: {e}"));
                return;
            }
        };

        let mut child_stdin = child.stdin.take().unwrap();
        let child_stdout = child.stdout.take().unwrap();
        let mut reader = BufReader::new(child_stdout);

        let (mut ws_tx, mut ws_rx) = ws.split();

        // child stdout (framed) -> ws (raw JSON text)
        let to_ws = async move {
            loop {
                match read_frame(&mut reader).await {
                    Ok(Some(body)) => {
                        if ws_tx.send(Message::Text(body.into())).await.is_err() {
                            break;
                        }
                    }
                    _ => break,
                }
            }
            let _ = ws_tx.close().await;
        };

        // ws (raw JSON text) -> child stdin (framed)
        let to_child = async move {
            while let Some(Ok(msg)) = ws_rx.next().await {
                match msg {
                    Message::Text(_) | Message::Binary(_) => {
                        let data = msg.into_data();
                        if write_frame(&mut child_stdin, &data).await.is_err() {
                            break;
                        }
                    }
                    Message::Close(_) => break,
                    _ => {}
                }
            }
        };

        tokio::select! {
            _ = to_ws => {},
            _ = to_child => {},
        }
        let _ = child.kill().await;
    });

    Ok(port)
}

/// Read one Content-Length-framed LSP message; returns the JSON body as String.
async fn read_frame<R: AsyncReadExt + Unpin>(
    reader: &mut R,
) -> std::io::Result<Option<String>> {
    let mut content_length: Option<usize> = None;

    // Read headers line by line until the blank separator line.
    loop {
        let line = read_header_line(reader).await?;
        match line {
            None => return Ok(None), // EOF
            Some(l) => {
                if l.is_empty() {
                    break; // end of headers
                }
                if let Some(rest) = l.strip_prefix("Content-Length:") {
                    content_length = rest.trim().parse::<usize>().ok();
                }
            }
        }
    }

    let len = content_length.ok_or_else(|| {
        std::io::Error::new(std::io::ErrorKind::InvalidData, "missing Content-Length")
    })?;
    let mut buf = vec![0u8; len];
    reader.read_exact(&mut buf).await?;
    Ok(Some(String::from_utf8_lossy(&buf).to_string()))
}

/// Read a single header line terminated by \r\n (without the terminator).
async fn read_header_line<R: AsyncReadExt + Unpin>(
    reader: &mut R,
) -> std::io::Result<Option<String>> {
    let mut bytes = Vec::new();
    let mut byte = [0u8; 1];
    loop {
        let n = reader.read(&mut byte).await?;
        if n == 0 {
            return Ok(None); // EOF
        }
        if byte[0] == b'\n' {
            if bytes.last() == Some(&b'\r') {
                bytes.pop();
            }
            return Ok(Some(String::from_utf8_lossy(&bytes).to_string()));
        }
        bytes.push(byte[0]);
    }
}

async fn write_frame<W: AsyncWriteExt + Unpin>(
    writer: &mut W,
    body: &[u8],
) -> std::io::Result<()> {
    let header = format!("Content-Length: {}\r\n\r\n", body.len());
    writer.write_all(header.as_bytes()).await?;
    writer.write_all(body).await?;
    writer.flush().await
}
