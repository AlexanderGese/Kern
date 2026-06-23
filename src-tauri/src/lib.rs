// src-tauri/src/lib.rs — Kern backend: command registry + plugin wiring (§3).
mod db;
mod fmt;
mod frontend;
mod fs;
mod git;
mod http_client;
mod lint;
mod lsp;
mod run;
mod search;
mod tasks;
mod terminal;
mod watch;
mod window_cmd;

use run::RunState;
use std::sync::atomic::Ordering;
use std::time::Duration;
use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};
use terminal::TermState;
use watch::WatchState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .register_uri_scheme_protocol("kernfs", |_ctx, request| frontend::serve_local(request))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .manage(WatchState::default())
        .manage(RunState::default())
        .manage(TermState::default())
        .setup(|app| {
            // Create the main window in code so we can choose its source:
            //   • a previously-downloaded local frontend (kernfs://), or
            //   • the embedded frontend (default for .deb/.rpm builds).
            let local = frontend::has_local_frontend();
            let url = if local {
                WebviewUrl::CustomProtocol("kernfs://localhost/index.html".parse().unwrap())
            } else {
                WebviewUrl::App("index.html".into())
            };
            WebviewWindowBuilder::new(app, "main", url)
                .title("Kern")
                .inner_size(1180.0, 760.0)
                .min_inner_size(680.0, 440.0)
                .decorations(false)
                .background_color(tauri::webview::Color(12, 12, 11, 255))
                .build()?;

            // If we loaded the embedded frontend and it never signals ready, the
            // assets are missing (cargo-install build) — download + reload.
            if !local {
                let handle = app.handle().clone();
                std::thread::spawn(move || {
                    std::thread::sleep(Duration::from_secs(4));
                    if frontend::FRONTEND_READY.load(Ordering::SeqCst) {
                        return;
                    }
                    match frontend::bootstrap_frontend() {
                        Ok(()) => {
                            if let Some(win) = handle.get_webview_window("main") {
                                let _ = win.navigate(
                                    "kernfs://localhost/index.html".parse().unwrap(),
                                );
                            }
                        }
                        Err(e) => eprintln!("[kern] frontend bootstrap failed: {e}"),
                    }
                });
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            frontend::frontend_ready,
            fs::open_file,
            fs::save_file,
            fs::create_file,
            fs::create_dir,
            fs::delete_path,
            fs::rename_path,
            fs::list_dir,
            fs::pick_folder,
            watch::watch_path,
            watch::unwatch_all,
            git::git_branch,
            git::git_branches,
            git::git_file_statuses,
            git::git_status,
            git::git_line_diff,
            git::git_diff,
            git::git_stage,
            git::git_unstage,
            git::git_stage_all,
            git::git_unstage_all,
            git::git_commit,
            git::git_discard,
            git::git_push,
            git::git_pull,
            git::git_fetch,
            git::git_checkout,
            git::git_create_branch,
            git::git_merge,
            git::git_merge_abort,
            git::git_stash,
            git::git_stash_pop,
            git::git_stash_list,
            git::git_stash_apply,
            git::git_stash_drop,
            git::git_resolve_ours,
            git::git_resolve_theirs,
            git::git_in_merge,
            git::git_log,
            git::git_blame,
            lsp::lsp_start_server,
            lsp::lsp_available_languages,
            search::search_text,
            search::replace_in_file,
            run::run_command,
            run::stop_run,
            tasks::detect_tasks,
            tasks::detect_tests,
            fmt::format_source,
            lint::lint_source,
            http_client::http_request,
            db::db_tables,
            db::db_query,
            terminal::term_open,
            terminal::term_write,
            terminal::term_resize,
            terminal::term_close,
            window_cmd::new_window,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
