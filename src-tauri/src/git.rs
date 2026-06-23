// src-tauri/src/git.rs — git signal + full source-control surface (§6.6, §8).
// Structured reads use git2; mutations + network ops shell out to the `git` CLI
// so user credentials, hooks, and merge logic all behave like the real client.
use git2::{BranchType, Patch, Repository, Sort, Status};
use serde::Serialize;
use std::path::Path;
use std::process::Command;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitFileStatus {
    pub path: String,
    pub status: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitEntry {
    pub path: String,
    pub staged: Option<String>,
    pub unstaged: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiffHunk {
    pub kind: String,
    pub start: u32,
    pub end: u32,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiffContent {
    pub old: String,
    pub new: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BranchInfo {
    pub name: String,
    pub current: bool,
    pub upstream: Option<String>,
    pub ahead: u32,
    pub behind: u32,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CommitInfo {
    pub hash: String,
    pub short: String,
    pub summary: String,
    pub author: String,
    pub email: String,
    pub time: i64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BlameLine {
    pub line: usize,
    pub short: String,
    pub author: String,
    pub summary: String,
    pub time: i64,
}

// ── helpers ─────────────────────────────────────────────────────────────────
fn run_git(repo: &str, args: &[&str]) -> Result<String, String> {
    let out = Command::new("git")
        .current_dir(repo)
        .args(args)
        .output()
        .map_err(|e| e.to_string())?;
    if out.status.success() {
        Ok(String::from_utf8_lossy(&out.stdout).to_string())
    } else {
        let err = String::from_utf8_lossy(&out.stderr).to_string();
        let outs = String::from_utf8_lossy(&out.stdout).to_string();
        Err(if err.trim().is_empty() { outs } else { err })
    }
}

fn workdir(repo: &str) -> Result<(Repository, std::path::PathBuf), String> {
    let r = Repository::discover(repo).map_err(|e| e.to_string())?;
    let wd = r
        .workdir()
        .ok_or_else(|| "bare repository".to_string())?
        .to_path_buf();
    Ok((r, wd))
}

// ── branch / signal ─────────────────────────────────────────────────────────
#[tauri::command]
pub fn git_branch(repo: String) -> Option<String> {
    let r = Repository::discover(&repo).ok()?;
    let head = r.head().ok()?;
    if let Some(name) = head.shorthand() {
        Some(name.to_string())
    } else {
        head.target().map(|oid| oid.to_string().chars().take(7).collect())
    }
}

#[tauri::command]
pub fn git_branches(repo: String) -> Result<Vec<BranchInfo>, String> {
    let r = Repository::discover(&repo).map_err(|e| e.to_string())?;
    let current = r.head().ok().and_then(|h| h.shorthand().map(String::from));
    let mut out = Vec::new();
    let branches = r.branches(Some(BranchType::Local)).map_err(|e| e.to_string())?;
    for b in branches {
        let (branch, _) = b.map_err(|e| e.to_string())?;
        let Some(name) = branch.name().ok().flatten() else { continue };
        let mut upstream = None;
        let (mut ahead, mut behind) = (0u32, 0u32);
        if let Ok(up) = branch.upstream() {
            upstream = up.name().ok().flatten().map(String::from);
            if let (Some(local), Some(remote)) = (
                branch.get().target(),
                up.get().target(),
            ) {
                if let Ok((a, b)) = r.graph_ahead_behind(local, remote) {
                    ahead = a as u32;
                    behind = b as u32;
                }
            }
        }
        out.push(BranchInfo {
            current: Some(name) == current.as_deref(),
            name: name.to_string(),
            upstream,
            ahead,
            behind,
        });
    }
    Ok(out)
}

// ── status (combined for tree badges) ───────────────────────────────────────
#[tauri::command]
pub fn git_file_statuses(repo: String) -> Result<Vec<GitFileStatus>, String> {
    let (r, wd) = workdir(&repo)?;
    let mut opts = git2::StatusOptions::new();
    opts.include_untracked(true).recurse_untracked_dirs(true);
    let statuses = r.statuses(Some(&mut opts)).map_err(|e| e.to_string())?;
    let mut out = Vec::new();
    for entry in statuses.iter() {
        let Some(rel) = entry.path() else { continue };
        let Some(kind) = combined_kind(entry.status()) else { continue };
        out.push(GitFileStatus {
            path: wd.join(rel).to_string_lossy().to_string(),
            status: kind.to_string(),
        });
    }
    Ok(out)
}

// ── status (split staged/unstaged for the SCM panel) ────────────────────────
#[tauri::command]
pub fn git_status(repo: String) -> Result<Vec<GitEntry>, String> {
    let (r, wd) = workdir(&repo)?;
    let mut opts = git2::StatusOptions::new();
    opts.include_untracked(true).recurse_untracked_dirs(true);
    let statuses = r.statuses(Some(&mut opts)).map_err(|e| e.to_string())?;
    let mut out = Vec::new();
    for entry in statuses.iter() {
        let Some(rel) = entry.path() else { continue };
        let s = entry.status();
        let staged = staged_kind(s);
        let unstaged = unstaged_kind(s);
        if staged.is_none() && unstaged.is_none() {
            continue;
        }
        out.push(GitEntry {
            path: wd.join(rel).to_string_lossy().to_string(),
            staged: staged.map(String::from),
            unstaged: unstaged.map(String::from),
        });
    }
    Ok(out)
}

fn staged_kind(s: Status) -> Option<&'static str> {
    if s.intersects(Status::INDEX_NEW) {
        Some("added")
    } else if s.intersects(Status::INDEX_DELETED) {
        Some("deleted")
    } else if s.intersects(Status::INDEX_RENAMED) {
        Some("renamed")
    } else if s.intersects(Status::INDEX_MODIFIED | Status::INDEX_TYPECHANGE) {
        Some("modified")
    } else {
        None
    }
}

fn unstaged_kind(s: Status) -> Option<&'static str> {
    if s.is_conflicted() {
        Some("conflicted")
    } else if s.intersects(Status::WT_NEW) {
        Some("new")
    } else if s.intersects(Status::WT_DELETED) {
        Some("deleted")
    } else if s.intersects(Status::WT_RENAMED) {
        Some("renamed")
    } else if s.intersects(Status::WT_MODIFIED | Status::WT_TYPECHANGE) {
        Some("modified")
    } else {
        None
    }
}

fn combined_kind(s: Status) -> Option<&'static str> {
    staged_kind(s).or_else(|| unstaged_kind(s))
}

// ── stage / unstage / commit ────────────────────────────────────────────────
#[tauri::command]
pub fn git_stage(repo: String, path: String) -> Result<(), String> {
    run_git(&repo, &["add", "--", &path]).map(|_| ())
}

#[tauri::command]
pub fn git_unstage(repo: String, path: String) -> Result<(), String> {
    // `restore --staged` works with a HEAD; fall back to `rm --cached` for the
    // very first commit where there is no HEAD yet.
    run_git(&repo, &["restore", "--staged", "--", &path])
        .or_else(|_| run_git(&repo, &["rm", "--cached", "-q", "--", &path]))
        .map(|_| ())
}

#[tauri::command]
pub fn git_stage_all(repo: String) -> Result<(), String> {
    run_git(&repo, &["add", "-A"]).map(|_| ())
}

#[tauri::command]
pub fn git_unstage_all(repo: String) -> Result<(), String> {
    run_git(&repo, &["reset", "-q"]).map(|_| ())
}

#[tauri::command]
pub fn git_commit(repo: String, message: String) -> Result<String, String> {
    run_git(&repo, &["commit", "-m", &message])
}

#[tauri::command]
pub fn git_discard(repo: String, path: String) -> Result<(), String> {
    // Drop working-tree changes; for untracked files remove them.
    run_git(&repo, &["checkout", "--", &path])
        .or_else(|_| run_git(&repo, &["clean", "-fdq", "--", &path]))
        .map(|_| ())
}

// ── network + branch ops (CLI) ──────────────────────────────────────────────
#[tauri::command]
pub fn git_push(repo: String) -> Result<String, String> {
    run_git(&repo, &["push"])
}

#[tauri::command]
pub fn git_pull(repo: String) -> Result<String, String> {
    run_git(&repo, &["pull"])
}

#[tauri::command]
pub fn git_fetch(repo: String) -> Result<String, String> {
    run_git(&repo, &["fetch", "--all", "--prune"])
}

#[tauri::command]
pub fn git_checkout(repo: String, branch: String) -> Result<String, String> {
    run_git(&repo, &["checkout", &branch])
}

#[tauri::command]
pub fn git_create_branch(repo: String, name: String) -> Result<String, String> {
    run_git(&repo, &["checkout", "-b", &name])
}

#[tauri::command]
pub fn git_merge(repo: String, branch: String) -> Result<String, String> {
    run_git(&repo, &["merge", "--no-edit", &branch])
}

#[tauri::command]
pub fn git_merge_abort(repo: String) -> Result<String, String> {
    run_git(&repo, &["merge", "--abort"])
}

// ── stash ───────────────────────────────────────────────────────────────────
#[tauri::command]
pub fn git_stash(repo: String, message: String) -> Result<String, String> {
    if message.trim().is_empty() {
        run_git(&repo, &["stash", "push", "--include-untracked"])
    } else {
        run_git(&repo, &["stash", "push", "--include-untracked", "-m", &message])
    }
}

#[tauri::command]
pub fn git_stash_pop(repo: String) -> Result<String, String> {
    run_git(&repo, &["stash", "pop"])
}

#[tauri::command]
pub fn git_stash_list(repo: String) -> Result<Vec<String>, String> {
    let out = run_git(&repo, &["stash", "list", "--pretty=%gd: %s"])?;
    Ok(out.lines().filter(|l| !l.trim().is_empty()).map(String::from).collect())
}

#[tauri::command]
pub fn git_stash_apply(repo: String, index: usize) -> Result<String, String> {
    run_git(&repo, &["stash", "apply", &format!("stash@{{{index}}}")])
}

#[tauri::command]
pub fn git_stash_drop(repo: String, index: usize) -> Result<String, String> {
    run_git(&repo, &["stash", "drop", &format!("stash@{{{index}}}")])
}

// ── conflict resolution ─────────────────────────────────────────────────────
#[tauri::command]
pub fn git_resolve_ours(repo: String, path: String) -> Result<String, String> {
    run_git(&repo, &["checkout", "--ours", "--", &path])?;
    run_git(&repo, &["add", "--", &path])
}

#[tauri::command]
pub fn git_resolve_theirs(repo: String, path: String) -> Result<String, String> {
    run_git(&repo, &["checkout", "--theirs", "--", &path])?;
    run_git(&repo, &["add", "--", &path])
}

/// True when a merge is in progress (MERGE_HEAD exists).
#[tauri::command]
pub fn git_in_merge(repo: String) -> bool {
    Repository::discover(&repo)
        .ok()
        .map(|r| r.path().join("MERGE_HEAD").exists())
        .unwrap_or(false)
}

// ── log / blame / diff ──────────────────────────────────────────────────────
#[tauri::command]
pub fn git_log(repo: String, limit: usize) -> Result<Vec<CommitInfo>, String> {
    let r = Repository::discover(&repo).map_err(|e| e.to_string())?;
    let mut walk = match r.revwalk() {
        Ok(w) => w,
        Err(_) => return Ok(Vec::new()),
    };
    if walk.push_head().is_err() {
        return Ok(Vec::new());
    }
    let _ = walk.set_sorting(Sort::TIME);
    let mut out = Vec::new();
    for oid in walk.take(limit) {
        let Ok(oid) = oid else { continue };
        let Ok(c) = r.find_commit(oid) else { continue };
        let hash = oid.to_string();
        out.push(CommitInfo {
            short: hash.chars().take(7).collect(),
            hash,
            summary: c.summary().unwrap_or("").to_string(),
            author: c.author().name().unwrap_or("").to_string(),
            email: c.author().email().unwrap_or("").to_string(),
            time: c.time().seconds(),
        });
    }
    Ok(out)
}

#[tauri::command]
pub fn git_blame(repo: String, path: String) -> Result<Vec<BlameLine>, String> {
    let (r, wd) = workdir(&repo)?;
    let abs = Path::new(&path);
    let rel = abs.strip_prefix(&wd).map_err(|_| "outside repo".to_string())?;
    let blame = match r.blame_file(rel, None) {
        Ok(b) => b,
        Err(_) => return Ok(Vec::new()), // untracked / new file
    };
    let content = std::fs::read_to_string(abs).unwrap_or_default();
    let n = content.lines().count();
    let mut out = Vec::new();
    for i in 1..=n {
        if let Some(hunk) = blame.get_line(i) {
            let sig = hunk.final_signature();
            let cid = hunk.final_commit_id();
            let summary = r
                .find_commit(cid)
                .ok()
                .and_then(|c| c.summary().map(String::from))
                .unwrap_or_default();
            out.push(BlameLine {
                line: i,
                short: cid.to_string().chars().take(7).collect(),
                author: sig.name().unwrap_or("").to_string(),
                summary,
                time: sig.when().seconds(),
            });
        }
    }
    Ok(out)
}

#[tauri::command]
pub fn git_diff(repo: String, path: String) -> Result<DiffContent, String> {
    let (r, wd) = workdir(&repo)?;
    let rel = Path::new(&path)
        .strip_prefix(&wd)
        .map_err(|_| "outside repo".to_string())?;
    let old = head_blob(&r, rel)
        .map(|b| String::from_utf8_lossy(&b).to_string())
        .unwrap_or_default();
    let new = std::fs::read_to_string(&path).unwrap_or_default();
    Ok(DiffContent { old, new })
}

#[tauri::command]
pub fn git_line_diff(repo: String, path: String) -> Result<Vec<DiffHunk>, String> {
    let (r, wd) = workdir(&repo)?;
    let abs = Path::new(&path);
    let rel = abs.strip_prefix(&wd).map_err(|_| "outside repo".to_string())?;
    let old = head_blob(&r, rel).unwrap_or_default();
    let new = std::fs::read(abs).unwrap_or_default();
    if old == new {
        return Ok(Vec::new());
    }
    let patch = Patch::from_buffers(&old, None, &new, None, None).map_err(|e| e.to_string())?;
    let mut hunks = Vec::new();
    for i in 0..patch.num_hunks() {
        let (hunk, _) = patch.hunk(i).map_err(|e| e.to_string())?;
        let new_start = hunk.new_start();
        let new_lines = hunk.new_lines();
        let old_lines = hunk.old_lines();
        let kind = if old_lines == 0 {
            "added"
        } else if new_lines == 0 {
            "deleted"
        } else {
            "modified"
        };
        let (start, end) = if new_lines == 0 {
            let s = new_start.max(1);
            (s, s)
        } else {
            (new_start, new_start + new_lines - 1)
        };
        hunks.push(DiffHunk {
            kind: kind.to_string(),
            start,
            end,
        });
    }
    Ok(hunks)
}

fn head_blob(repo: &Repository, rel: &Path) -> Option<Vec<u8>> {
    let head = repo.head().ok()?;
    let tree = head.peel_to_tree().ok()?;
    let entry = tree.get_path(rel).ok()?;
    let obj = entry.to_object(repo).ok()?;
    Some(obj.as_blob()?.content().to_vec())
}
