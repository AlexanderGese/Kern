// src-tauri/src/lib.rs — Kern backend: command registry + plugin wiring (§3).
mod fs;
mod git;
mod lsp;
mod run;
mod search;
mod terminal;
mod watch;
mod window_cmd;

use run::RunState;
use terminal::TermState;
use watch::WatchState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .manage(WatchState::default())
        .manage(RunState::default())
        .manage(TermState::default())
        .invoke_handler(tauri::generate_handler![
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
            terminal::term_open,
            terminal::term_write,
            terminal::term_resize,
            terminal::term_close,
            window_cmd::new_window,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
