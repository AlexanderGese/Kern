// src/components/GitPanel.tsx — full Source Control dock (⌘⇧G).
// Branch + ahead/behind, push/pull/fetch, branch switch/create/merge, staged &
// unstaged sections with stage/unstage/discard, commit box, history shortcut.
import { useCallback, useEffect, useRef, useState } from "react";
import { useStore } from "../store/useStore";
import { basename } from "../lang";
import { openPath } from "../actions";
import { git } from "../git/actions";
import { gitApi, type GitEntry, type BranchInfo, type GitStatusKind } from "../ipc";

const LABEL: Record<GitStatusKind, string> = {
  modified: "M", added: "A", new: "U", deleted: "D", renamed: "R", conflicted: "!",
};

export function GitPanel() {
  const folder = useStore((s) => s.folder);
  const gitRev = useStore((s) => s.gitRev);
  const close = useStore((s) => s.closePanel);
  const openPanel = useStore((s) => s.openPanel);
  const openDiff = useStore((s) => s.openDiff);
  const bumpGit = useStore((s) => s.bumpGit);

  const [entries, setEntries] = useState<GitEntry[]>([]);
  const [branches, setBranches] = useState<BranchInfo[]>([]);
  const [isRepo, setIsRepo] = useState(true);
  const [message, setMessage] = useState("");
  const [branchMenu, setBranchMenu] = useState(false);
  const [inMerge, setInMerge] = useState(false);
  const [stashes, setStashes] = useState<string[]>([]);
  const [showStashes, setShowStashes] = useState(false);

  const refresh = useCallback(async () => {
    if (!folder) return;
    try {
      const [st, br, merging, sl] = await Promise.all([
        gitApi.status(folder),
        gitApi.branches(folder),
        gitApi.inMerge(folder),
        gitApi.stashList(folder).catch(() => []),
      ]);
      setEntries(st);
      setBranches(br);
      setInMerge(merging);
      setStashes(sl);
      setIsRepo(true);
    } catch {
      setIsRepo(false);
      setEntries([]);
      setBranches([]);
    }
  }, [folder]);

  useEffect(() => {
    void refresh();
  }, [refresh, gitRev]);

  const current = branches.find((b) => b.current);
  const conflicts = entries.filter((e) => e.unstaged === "conflicted");
  const staged = entries.filter((e) => e.staged);
  const unstaged = entries.filter((e) => e.unstaged && e.unstaged !== "conflicted");

  const openFileDiff = (path: string) => {
    void openPath(path).then(() => openDiff(path));
  };

  const doCommit = async () => {
    if (!message.trim()) return;
    await git.commit(message.trim());
    setMessage("");
  };

  if (!folder) {
    return (
      <aside className="gitpanel">
        <Head onClose={close} />
        <div className="panel__empty">No folder open.</div>
      </aside>
    );
  }

  return (
    <aside className="gitpanel">
      <Head onClose={close} />

      {!isRepo ? (
        <div className="panel__empty">Not a git repository.</div>
      ) : (
        <>
          {/* branch + remote actions */}
          <div className="git__bar">
            <button className="git__branchbtn" onClick={() => setBranchMenu((v) => !v)} title="Switch branch">
              <span className="branch-dot" />
              {current?.name ?? "—"}
              {current && (current.ahead > 0 || current.behind > 0) && (
                <span className="git__ab">
                  {current.behind > 0 && <>↓{current.behind}</>}
                  {current.ahead > 0 && <>↑{current.ahead}</>}
                </span>
              )}
              <span className="git__caret">▾</span>
            </button>
            <div className="git__remote">
              <button title="Pull" onClick={() => void git.pull()}>↓</button>
              <button title="Push" onClick={() => void git.push()}>↑</button>
              <button title="Fetch" onClick={() => void git.fetch()}>⟳</button>
              <button title="Stash changes" onClick={() => void git.stash("")}>⤓</button>
              <button title="Pop stash" onClick={() => void git.stashPop()}>⤒</button>
              <button title="History" onClick={() => openPanel("history")}>≡</button>
            </div>
          </div>

          {inMerge && (
            <div className="git__merge-banner">
              <span>Merging — resolve conflicts, then commit</span>
              <button onClick={() => void git.mergeAbort()}>Abort</button>
            </div>
          )}

          {branchMenu && (
            <BranchMenu
              branches={branches}
              onPick={(b) => { setBranchMenu(false); void git.checkout(b); }}
              onCreate={(n) => { setBranchMenu(false); void git.createBranch(n); }}
              onMerge={(b) => { setBranchMenu(false); void git.merge(b); }}
            />
          )}

          {/* commit box */}
          <div className="git__commit">
            <textarea
              className="git__msg"
              placeholder="Commit message (⌘↵ to commit)"
              value={message}
              rows={2}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                  e.preventDefault();
                  void doCommit();
                }
              }}
            />
            <button
              className="git__commitbtn"
              disabled={!message.trim() || staged.length === 0}
              onClick={() => void doCommit()}
            >
              Commit {staged.length > 0 && `(${staged.length})`}
            </button>
          </div>

          {entries.length === 0 && stashes.length === 0 && (
            <div className="panel__empty">No changes.</div>
          )}

          {conflicts.length > 0 && (
            <div className="git__section">
              <div className="git__section-head git__section-head--conflict">
                Merge Conflicts<span className="git__section-count">{conflicts.length}</span>
              </div>
              {conflicts.map((e) => (
                <div className="git__conflict" key={"c" + e.path} title={e.path}>
                  <span className="git__name" onClick={() => openFileDiff(e.path)}>{basename(e.path)}</span>
                  <span className="git__conflict-acts">
                    <button title="Accept current (ours)" onClick={() => void git.resolveOurs(e.path)}>ours</button>
                    <button title="Accept incoming (theirs)" onClick={() => void git.resolveTheirs(e.path)}>theirs</button>
                  </span>
                  <span className="git__badge s-conflicted">!</span>
                </div>
              ))}
            </div>
          )}

          {stashes.length > 0 && (
            <div className="git__section">
              <div className="git__section-head" onClick={() => setShowStashes((v) => !v)} style={{ cursor: "pointer" }}>
                Stashes<span className="git__section-count">{stashes.length}</span>
                <span className="git__section-act">{showStashes ? "▾" : "▸"}</span>
              </div>
              {showStashes &&
                stashes.map((s, i) => (
                  <div className="git__stash" key={i} title={s}>
                    <span className="git__stash-msg">{s.replace(/^stash@\{\d+\}:\s*/, "")}</span>
                    <span className="git__stash-acts">
                      <button title="Apply" onClick={() => void git.stashApply(i)}>↥</button>
                      <button title="Drop" onClick={() => void git.stashDrop(i)}>×</button>
                    </span>
                  </div>
                ))}
            </div>
          )}

          {staged.length > 0 && (
            <Section
              title="Staged Changes"
              count={staged.length}
              action={{ glyph: "−", title: "Unstage all", run: () => { void git.unstageAll(); bumpGit(); } }}
            >
              {staged.map((e) => (
                <Row
                  key={"s" + e.path}
                  entry={e}
                  kind={e.staged!}
                  folder={folder}
                  onOpen={() => openFileDiff(e.path)}
                  actions={[{ glyph: "−", title: "Unstage", run: () => void git.unstage(e.path) }]}
                />
              ))}
            </Section>
          )}

          {unstaged.length > 0 && (
            <Section
              title="Changes"
              count={unstaged.length}
              action={{ glyph: "+", title: "Stage all", run: () => void git.stageAll() }}
            >
              {unstaged.map((e) => (
                <Row
                  key={"u" + e.path}
                  entry={e}
                  kind={e.unstaged!}
                  folder={folder}
                  onOpen={() => openFileDiff(e.path)}
                  actions={[
                    { glyph: "↩", title: "Discard", run: () => void git.discard(e.path) },
                    { glyph: "+", title: "Stage", run: () => void git.stage(e.path) },
                  ]}
                />
              ))}
            </Section>
          )}
        </>
      )}
    </aside>
  );
}

function Head({ onClose }: { onClose: () => void }) {
  return (
    <div className="panel__head">
      <span className="panel__title">Source Control</span>
      <span className="panel__close" onClick={onClose} title="Close">×</span>
    </div>
  );
}

function Section({
  title, count, action, children,
}: {
  title: string;
  count: number;
  action: { glyph: string; title: string; run: () => void };
  children: React.ReactNode;
}) {
  return (
    <div className="git__section">
      <div className="git__section-head">
        {title}
        <span className="git__section-count">{count}</span>
        <button className="git__section-act" title={action.title} onClick={action.run}>
          {action.glyph}
        </button>
      </div>
      {children}
    </div>
  );
}

function Row({
  entry, kind, folder, onOpen, actions,
}: {
  entry: GitEntry;
  kind: GitStatusKind;
  folder: string;
  onOpen: () => void;
  actions: { glyph: string; title: string; run: () => void }[];
}) {
  return (
    <div className="git__row" title={entry.path}>
      <span className="git__name" onClick={onOpen}>{basename(entry.path)}</span>
      <span className="git__dir" onClick={onOpen}>{relDir(folder, entry.path)}</span>
      <span className="git__rowacts">
        {actions.map((a) => (
          <button key={a.glyph} title={a.title} onClick={(e) => { e.stopPropagation(); a.run(); }}>
            {a.glyph}
          </button>
        ))}
      </span>
      <span className={`git__badge s-${kind}`}>{LABEL[kind]}</span>
    </div>
  );
}

function BranchMenu({
  branches, onPick, onCreate, onMerge,
}: {
  branches: BranchInfo[];
  onPick: (b: string) => void;
  onCreate: (name: string) => void;
  onMerge: (b: string) => void;
}) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (creating) inputRef.current?.focus(); }, [creating]);

  return (
    <div className="branchmenu">
      <div className="branchmenu__head">Branches</div>
      {branches.map((b) => (
        <div key={b.name} className={"branchmenu__row" + (b.current ? " is-current" : "")}>
          <span className="branchmenu__name" onClick={() => !b.current && onPick(b.name)}>
            {b.current && <span className="branch-dot" />}
            {b.name}
          </span>
          {!b.current && (
            <button className="branchmenu__merge" title={`Merge ${b.name} into current`} onClick={() => onMerge(b.name)}>
              merge
            </button>
          )}
        </div>
      ))}
      {creating ? (
        <form
          className="branchmenu__create"
          onSubmit={(e) => { e.preventDefault(); if (name.trim()) onCreate(name.trim()); }}
        >
          <input ref={inputRef} value={name} placeholder="new-branch" onChange={(e) => setName(e.target.value)} />
        </form>
      ) : (
        <button className="branchmenu__new" onClick={() => setCreating(true)}>+ New branch…</button>
      )}
    </div>
  );
}

function relDir(folder: string, path: string): string {
  let rel = path.startsWith(folder) ? path.slice(folder.length) : path;
  rel = rel.replace(/^[\\/]/, "");
  return rel.slice(0, rel.length - basename(rel).length).replace(/[\\/]$/, "");
}
