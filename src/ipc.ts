// src/ipc.ts — typed front door to the Rust command surface (§8).
import { invoke } from "@tauri-apps/api/core";

export interface FileEntry {
  path: string;
  name: string;
  isDir: boolean;
  children?: FileEntry[];
}

export interface OpenedFile {
  path: string;
  content: string;
}

export type GitStatusKind =
  | "modified"
  | "added"
  | "deleted"
  | "new"
  | "renamed"
  | "conflicted";

export interface GitFileStatus {
  path: string;
  status: GitStatusKind;
}

export type HunkKind = "added" | "modified" | "deleted";

export interface DiffHunk {
  kind: HunkKind;
  /** 1-based first line of the hunk in the working file. */
  start: number;
  /** 1-based last line (== start for deletions). */
  end: number;
}

export interface GitEntry {
  path: string;
  staged: GitStatusKind | null;
  unstaged: GitStatusKind | null;
}

export interface BranchInfo {
  name: string;
  current: boolean;
  upstream: string | null;
  ahead: number;
  behind: number;
}

export interface CommitInfo {
  hash: string;
  short: string;
  summary: string;
  author: string;
  email: string;
  time: number;
}

export interface BlameLine {
  line: number;
  short: string;
  author: string;
  summary: string;
  time: number;
}

export interface DiffContent {
  old: string;
  new: string;
}

export const fsApi = {
  openFile: (path: string) => invoke<OpenedFile>("open_file", { path }),
  saveFile: (path: string, content: string) =>
    invoke<void>("save_file", { path, content }),
  createFile: (path: string) => invoke<void>("create_file", { path }),
  createDir: (path: string) => invoke<void>("create_dir", { path }),
  deletePath: (path: string) => invoke<void>("delete_path", { path }),
  renamePath: (from: string, to: string) =>
    invoke<void>("rename_path", { from, to }),
  listDir: (path: string, depth: number) =>
    invoke<FileEntry>("list_dir", { path, depth }),
  pickFolder: () => invoke<string | null>("pick_folder"),
};

export const gitApi = {
  branch: (repo: string) => invoke<string | null>("git_branch", { repo }),
  branches: (repo: string) => invoke<BranchInfo[]>("git_branches", { repo }),
  fileStatuses: (repo: string) =>
    invoke<GitFileStatus[]>("git_file_statuses", { repo }),
  status: (repo: string) => invoke<GitEntry[]>("git_status", { repo }),
  lineDiff: (repo: string, path: string) =>
    invoke<DiffHunk[]>("git_line_diff", { repo, path }),
  diff: (repo: string, path: string) =>
    invoke<DiffContent>("git_diff", { repo, path }),
  stage: (repo: string, path: string) => invoke<void>("git_stage", { repo, path }),
  unstage: (repo: string, path: string) => invoke<void>("git_unstage", { repo, path }),
  stageAll: (repo: string) => invoke<void>("git_stage_all", { repo }),
  unstageAll: (repo: string) => invoke<void>("git_unstage_all", { repo }),
  commit: (repo: string, message: string) => invoke<string>("git_commit", { repo, message }),
  discard: (repo: string, path: string) => invoke<void>("git_discard", { repo, path }),
  push: (repo: string) => invoke<string>("git_push", { repo }),
  pull: (repo: string) => invoke<string>("git_pull", { repo }),
  fetch: (repo: string) => invoke<string>("git_fetch", { repo }),
  checkout: (repo: string, branch: string) => invoke<string>("git_checkout", { repo, branch }),
  createBranch: (repo: string, name: string) => invoke<string>("git_create_branch", { repo, name }),
  merge: (repo: string, branch: string) => invoke<string>("git_merge", { repo, branch }),
  mergeAbort: (repo: string) => invoke<string>("git_merge_abort", { repo }),
  stash: (repo: string, message: string) => invoke<string>("git_stash", { repo, message }),
  stashPop: (repo: string) => invoke<string>("git_stash_pop", { repo }),
  stashList: (repo: string) => invoke<string[]>("git_stash_list", { repo }),
  stashApply: (repo: string, index: number) => invoke<string>("git_stash_apply", { repo, index }),
  stashDrop: (repo: string, index: number) => invoke<string>("git_stash_drop", { repo, index }),
  resolveOurs: (repo: string, path: string) => invoke<string>("git_resolve_ours", { repo, path }),
  resolveTheirs: (repo: string, path: string) => invoke<string>("git_resolve_theirs", { repo, path }),
  inMerge: (repo: string) => invoke<boolean>("git_in_merge", { repo }),
  log: (repo: string, limit: number) => invoke<CommitInfo[]>("git_log", { repo, limit }),
  blame: (repo: string, path: string) => invoke<BlameLine[]>("git_blame", { repo, path }),
};

export const windowApi = {
  newWindow: () => invoke<void>("new_window"),
};

export const watchApi = {
  watchPath: (path: string) => invoke<void>("watch_path", { path }),
  unwatchAll: () => invoke<void>("unwatch_all"),
};

export interface SearchMatch {
  path: string;
  line: number;
  col: number;
  text: string;
}

export const searchApi = {
  search: (folder: string, query: string, caseSensitive: boolean) =>
    invoke<SearchMatch[]>("search_text", { folder, query, caseSensitive }),
  replaceInFile: (path: string, find: string, replace: string) =>
    invoke<number>("replace_in_file", { path, find, replace }),
};

export const termApi = {
  open: (cwd: string, cols: number, rows: number) =>
    invoke<void>("term_open", { cwd, cols, rows }),
  write: (data: string) => invoke<void>("term_write", { data }),
  resize: (cols: number, rows: number) => invoke<void>("term_resize", { cols, rows }),
  close: () => invoke<void>("term_close"),
};

export const runApi = {
  run: (command: string, cwd: string) =>
    invoke<void>("run_command", { command, cwd }),
  stop: () => invoke<void>("stop_run"),
};

export const lspApi = {
  /** Spawn (or reuse) the language server for `language`, returns the ws port. */
  startServer: (language: string) =>
    invoke<number>("lsp_start_server", { language }),
  availableLanguages: () => invoke<string[]>("lsp_available_languages"),
};
