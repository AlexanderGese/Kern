// src/components/DBPanel.tsx — minimal SQLite explorer. Lists tables and runs
// queries against a .sqlite/.db file via the sqlite3 CLI.
import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useStore, activeTab } from "../store/useStore";

export function DBPanel() {
  const close = useStore((s) => s.closePanel);
  const tab = useStore(activeTab);
  const guess = tab && /\.(db|sqlite|sqlite3)$/i.test(tab.path) ? tab.path : "";
  const [path, setPath] = useState(guess);
  const [tables, setTables] = useState<string[]>([]);
  const [sql, setSql] = useState("");
  const [cols, setCols] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [err, setErr] = useState("");

  const loadTables = async (p: string) => {
    setErr("");
    try {
      setTables(await invoke<string[]>("db_tables", { path: p }));
    } catch (e) {
      setErr(String(e));
      setTables([]);
    }
  };

  useEffect(() => {
    if (path) void loadTables(path);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const run = async (query: string) => {
    setErr("");
    setSql(query);
    try {
      const json = await invoke<string>("db_query", { path, sql: query });
      const parsed: Record<string, unknown>[] = JSON.parse(json);
      setRows(parsed);
      setCols(parsed.length ? Object.keys(parsed[0]) : []);
    } catch (e) {
      setErr(String(e));
      setRows([]);
      setCols([]);
    }
  };

  return (
    <div className="modal-overlay" onMouseDown={close}>
      <div className="modal modal--wide" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <span className="modal__title">Database</span>
          <span className="modal__close" onClick={close}>×</span>
        </div>
        <div className="modal__body db-body">
          <div className="db-toolbar">
            <input
              className="db-path"
              placeholder="/path/to/file.sqlite"
              value={path}
              onChange={(e) => setPath(e.target.value)}
            />
            <button className="db-btn" onClick={() => void loadTables(path)}>Connect</button>
          </div>
          {err && <div className="db-err">{err}</div>}
          <div className="db-main">
            <div className="db-tables">
              {tables.map((t) => (
                <div key={t} className="db-table" onClick={() => void run(`SELECT * FROM "${t}" LIMIT 200;`)}>
                  {t}
                </div>
              ))}
              {!tables.length && <div className="db-empty">No tables</div>}
            </div>
            <div className="db-query">
              <textarea
                className="db-sql"
                placeholder="SELECT …  (⌘⏎ to run)"
                value={sql}
                onChange={(e) => setSql(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") void run(sql);
                }}
              />
              <div className="db-results">
                {cols.length > 0 && (
                  <table>
                    <thead>
                      <tr>{cols.map((c) => <th key={c}>{c}</th>)}</tr>
                    </thead>
                    <tbody>
                      {rows.slice(0, 500).map((r, i) => (
                        <tr key={i}>{cols.map((c) => <td key={c}>{String(r[c] ?? "")}</td>)}</tr>
                      ))}
                    </tbody>
                  </table>
                )}
                {cols.length > 0 && <div className="db-count">{rows.length} row(s)</div>}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
