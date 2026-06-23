// src/components/SearchPanel.tsx — project-wide search & replace (modal).
import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "../store/useStore";
import { searchApi, type SearchMatch } from "../ipc";
import { openAt } from "../actions";
import { basename } from "../lang";

export function SearchPanel() {
  const folder = useStore((s) => s.folder);
  const close = useStore((s) => s.closePanel);
  const toast = useStore((s) => s.toast);
  const [query, setQuery] = useState("");
  const [replace, setReplace] = useState("");
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [results, setResults] = useState<SearchMatch[]>([]);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => inputRef.current?.focus(), []);

  useEffect(() => {
    if (!folder || query.trim().length < 2) {
      setResults([]);
      return;
    }
    const id = window.setTimeout(() => {
      setBusy(true);
      searchApi
        .search(folder, query, caseSensitive)
        .then(setResults)
        .catch(() => setResults([]))
        .finally(() => setBusy(false));
    }, 250);
    return () => window.clearTimeout(id);
  }, [folder, query, caseSensitive]);

  const grouped = useMemo(() => {
    const map = new Map<string, SearchMatch[]>();
    for (const m of results) {
      if (!map.has(m.path)) map.set(m.path, []);
      map.get(m.path)!.push(m);
    }
    return [...map.entries()];
  }, [results]);

  const doReplaceAll = async () => {
    if (!query || !grouped.length) return;
    let total = 0;
    for (const [path] of grouped) {
      try {
        total += await searchApi.replaceInFile(path, query, replace);
      } catch {
        /* skip */
      }
    }
    toast("success", `Replaced ${total} occurrence${total === 1 ? "" : "s"} in ${grouped.length} file(s)`);
    setResults([]);
    useStore.getState().bumpGit();
  };

  return (
    <div className="modal-overlay" onMouseDown={close}>
      <div className="modal modal--wide" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <span className="modal__title">Search</span>
          <span className="modal__close" onClick={close}>×</span>
        </div>
        <div className="modal__body">
          <div className="search__inputs">
            <input
              ref={inputRef}
              className="search__field"
              placeholder="Search across files…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <input
              className="search__field"
              placeholder="Replace…"
              value={replace}
              onChange={(e) => setReplace(e.target.value)}
            />
            <div className="search__row">
              <label className="search__opt">
                <input type="checkbox" checked={caseSensitive} onChange={(e) => setCaseSensitive(e.target.checked)} />
                Match case
              </label>
              <span className="search__count">
                {busy ? "searching…" : results.length ? `${results.length} matches · ${grouped.length} files` : ""}
              </span>
              <button className="search__replace" disabled={!results.length} onClick={() => void doReplaceAll()}>
                Replace All
              </button>
            </div>
          </div>

          <div className="search__results">
            {grouped.map(([path, matches]) => (
              <div className="search__group" key={path}>
                <div className="search__file">{basename(path)} <span className="search__filecount">{matches.length}</span></div>
                {matches.slice(0, 50).map((m, i) => (
                  <div
                    className="search__hit"
                    key={i}
                    onClick={() => { openAt(m.path, m.line, m.col); close(); }}
                  >
                    <span className="search__ln">{m.line}</span>
                    <span className="search__text">{m.text.trim()}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
