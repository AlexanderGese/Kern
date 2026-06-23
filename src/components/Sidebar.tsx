// src/components/Sidebar.tsx — the file tree (§5.6, §6.1) with a right-click
// context menu (new/rename/delete) and live refresh via treeRev.
import { useCallback, useEffect, useMemo, useState } from "react";
import { useStore } from "../store/useStore";
import { fsApi, type FileEntry, type GitStatusKind } from "../ipc";
import { openPath } from "../actions";
import { newFile, newFolder, renamePath, deletePath } from "../fsActions";

const INDENT = 12;

interface Menu {
  x: number;
  y: number;
  entry: FileEntry | null; // null = root background
}

export function Sidebar() {
  const folder = useStore((s) => s.folder);
  const treeRev = useStore((s) => s.treeRev);
  const [root, setRoot] = useState<FileEntry | null>(null);
  const [menu, setMenu] = useState<Menu | null>(null);

  const reload = useCallback(async () => {
    if (!folder) {
      setRoot(null);
      return;
    }
    try {
      setRoot(await fsApi.listDir(folder, 1));
    } catch (e) {
      console.error("listDir failed", e);
    }
  }, [folder]);

  useEffect(() => {
    void reload();
  }, [reload, treeRev]);

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    window.addEventListener("click", close);
    window.addEventListener("blur", close);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("blur", close);
    };
  }, [menu]);

  if (!folder) {
    return (
      <aside className="sidebar">
        <div className="sidebar__empty">
          No folder open.
          <br />
          <button onClick={() => void pickAndOpen()}>Open folder…</button>
        </div>
      </aside>
    );
  }

  const onRootContext = (e: React.MouseEvent) => {
    e.preventDefault();
    setMenu({ x: e.clientX, y: e.clientY, entry: null });
  };

  return (
    <aside className="sidebar" onContextMenu={onRootContext}>
      <div className="sidebar__header">
        <span>{root?.name ?? "…"}</span>
        <span className="sidebar__actions-grp">
          <span className="sidebar__action" title="New file" onClick={() => void newFile(folder)}>＋</span>
          <span className="sidebar__action" title="Open folder" onClick={() => void pickAndOpen()}>⌕</span>
        </span>
      </div>
      {root?.children?.map((child) => (
        <TreeNode key={child.path} entry={child} depth={0} onContext={setMenu} />
      ))}

      {menu && <ContextMenu menu={menu} folder={folder} onClose={() => setMenu(null)} />}
    </aside>
  );
}

async function pickAndOpen() {
  const picked = await fsApi.pickFolder();
  if (picked) useStore.getState().setFolder(picked);
}

function TreeNode({
  entry,
  depth,
  onContext,
}: {
  entry: FileEntry;
  depth: number;
  onContext: (m: Menu) => void;
}) {
  const expanded = useStore((s) => s.expanded);
  const toggleExpand = useStore((s) => s.toggleExpand);
  const activePath = useStore((s) => s.activePath);
  const gitStatuses = useStore((s) => s.gitStatuses);
  const treeRev = useStore((s) => s.treeRev);
  const [children, setChildren] = useState<FileEntry[] | null>(entry.children ?? null);
  const isOpen = expanded.has(entry.path);
  const status = useMemo(() => statusFor(entry, gitStatuses), [entry, gitStatuses]);

  useEffect(() => {
    if (entry.isDir && isOpen) {
      fsApi
        .listDir(entry.path, 1)
        .then((d) => setChildren(d.children ?? []))
        .catch((e) => console.error(e));
    }
  }, [entry.isDir, entry.path, isOpen, treeRev]);

  const onClick = () => {
    if (entry.isDir) toggleExpand(entry.path);
    else void openPath(entry.path);
  };

  return (
    <>
      <div
        className={"tree-row" + (!entry.isDir && activePath === entry.path ? " is-active" : "")}
        style={{ paddingLeft: 10 + depth * INDENT }}
        onClick={onClick}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onContext({ x: e.clientX, y: e.clientY, entry });
        }}
        title={entry.name}
      >
        <span
          className={
            "tree-row__chevron" + (entry.isDir ? (isOpen ? " is-open" : "") : " is-leaf")
          }
        >
          ›
        </span>
        <span className="tree-row__name">{entry.name}</span>
        {status && <span className={`tree-row__git s-${status}`}>{badge(status)}</span>}
      </div>
      {entry.isDir &&
        isOpen &&
        children?.map((c) => (
          <TreeNode key={c.path} entry={c} depth={depth + 1} onContext={onContext} />
        ))}
    </>
  );
}

function ContextMenu({ menu, folder, onClose }: { menu: Menu; folder: string; onClose: () => void }) {
  const e = menu.entry;
  const targetDir = e ? (e.isDir ? e.path : e.path.replace(/[\\/][^\\/]*$/, "")) : folder;
  const items: { label: string; run: () => void; danger?: boolean }[] = [
    { label: "New File…", run: () => void newFile(targetDir) },
    { label: "New Folder…", run: () => void newFolder(targetDir) },
  ];
  if (e) {
    items.push({ label: "Rename…", run: () => void renamePath(e.path) });
    items.push({ label: "Delete…", run: () => void deletePath(e.path), danger: true });
  }
  return (
    <div className="ctxmenu" style={{ left: menu.x, top: menu.y }} onClick={(ev) => ev.stopPropagation()}>
      {items.map((it) => (
        <div
          key={it.label}
          className={"ctxmenu__item" + (it.danger ? " is-danger" : "")}
          onClick={() => {
            onClose();
            it.run();
          }}
        >
          {it.label}
        </div>
      ))}
    </div>
  );
}

function statusFor(entry: FileEntry, statuses: Map<string, GitStatusKind>): GitStatusKind | null {
  if (entry.isDir) return null;
  return statuses.get(entry.path) ?? null;
}

function badge(s: GitStatusKind): string {
  switch (s) {
    case "modified": return "M";
    case "added": return "A";
    case "new": return "U";
    case "deleted": return "D";
    case "renamed": return "R";
    case "conflicted": return "!";
  }
}
