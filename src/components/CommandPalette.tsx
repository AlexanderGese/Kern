// src/components/CommandPalette.tsx — fuzzy command list + Go-to-File (§6.5).
// Keyboard nav, Esc to close, overlay style.
import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "../store/useStore";
import { allCommands, fuzzyScore } from "../commands";
import { fsApi, type FileEntry } from "../ipc";
import { openPath } from "../actions";
import { basename } from "../lang";

interface Row {
  key: string;
  title: string;
  hint?: string;
  sub?: string;
  run: () => void;
}

export function CommandPalette() {
  const open = useStore((s) => s.paletteOpen);
  const mode = useStore((s) => s.paletteMode);
  const close = useStore((s) => s.closePalette);
  const folder = useStore((s) => s.folder);

  const [query, setQuery] = useState("");
  const [sel, setSel] = useState(0);
  const [files, setFiles] = useState<FileEntry[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset on open; in file mode, fetch a deep flat listing once.
  useEffect(() => {
    if (!open) return;
    setQuery("");
    setSel(0);
    inputRef.current?.focus();
    if (mode === "files" && folder) {
      fsApi
        .listDir(folder, 8)
        .then((root) => setFiles(flattenFiles(root)))
        .catch((e) => console.error(e));
    }
  }, [open, mode, folder]);

  const rows: Row[] = useMemo(() => {
    if (mode === "commands") {
      const cmds = allCommands();
      return rank(query, cmds, (c) => c.title + " " + (c.keywords ?? "")).map((c) => ({
        key: c.id,
        title: c.title,
        hint: c.hint,
        run: () => {
          c.run();
          afterRun();
        },
      }));
    }
    return rank(query, files, (f) => f.path).map((f) => ({
      key: f.path,
      title: f.name,
      sub: relSub(folder, f.path),
      run: () => {
        void openPath(f.path);
        afterRun();
      },
    }));

    function afterRun() {
      // Commands like "Go to File…" reopen the palette in another mode; only
      // close if it's still open in the same mode.
      const st = useStore.getState();
      if (st.paletteOpen && st.paletteMode === mode) st.closePalette();
    }
  }, [query, mode, files, folder]);

  useEffect(() => {
    if (sel >= rows.length) setSel(rows.length ? rows.length - 1 : 0);
  }, [rows.length, sel]);

  if (!open) return null;

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setSel((s) => Math.min(s + 1, rows.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSel((s) => Math.max(s - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      rows[sel]?.run();
    }
  };

  return (
    <div className="palette-overlay" onMouseDown={close}>
      <div className="palette" onMouseDown={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          className="palette__input"
          placeholder={mode === "files" ? "Go to file…" : "Type a command…"}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSel(0);
          }}
          onKeyDown={onKey}
        />
        <div className="palette__list">
          {rows.length === 0 ? (
            <div className="palette__empty">No matches</div>
          ) : (
            rows.slice(0, 200).map((r, i) => (
              <div
                key={r.key}
                className={"palette__row" + (i === sel ? " is-active" : "")}
                onMouseEnter={() => setSel(i)}
                onClick={() => r.run()}
              >
                <span>{r.title}</span>
                {r.sub && <span className="hint">{r.sub}</span>}
                {r.hint && <span className="hint">{r.hint}</span>}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function rank<T>(query: string, items: T[], key: (t: T) => string): T[] {
  if (!query)
    return items.slice(0, 400);
  return items
    .map((it) => ({ it, score: fuzzyScore(query, key(it)) }))
    .filter((x) => x.score >= 0)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.it);
}

function flattenFiles(root: FileEntry): FileEntry[] {
  const out: FileEntry[] = [];
  const walk = (e: FileEntry) => {
    if (e.isDir) e.children?.forEach(walk);
    else out.push(e);
  };
  root.children?.forEach(walk);
  return out;
}

function relSub(folder: string | null, path: string): string {
  if (folder && path.startsWith(folder)) {
    const rel = path.slice(folder.length).replace(/^[\\/]/, "");
    const dir = rel.slice(0, rel.length - basename(rel).length).replace(/[\\/]$/, "");
    return dir;
  }
  return "";
}
