// src/components/HistoryPanel.tsx — commit history / log (modal).
import { useEffect, useState } from "react";
import { useStore } from "../store/useStore";
import { gitApi, type CommitInfo } from "../ipc";

export function HistoryPanel() {
  const folder = useStore((s) => s.folder);
  const close = useStore((s) => s.closePanel);
  const gitRev = useStore((s) => s.gitRev);
  const [commits, setCommits] = useState<CommitInfo[] | null>(null);

  useEffect(() => {
    if (!folder) return;
    gitApi.log(folder, 100).then(setCommits).catch(() => setCommits([]));
  }, [folder, gitRev]);

  return (
    <div className="modal-overlay" onMouseDown={close}>
      <div className="modal modal--wide" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <span className="modal__title">Commit History</span>
          <span className="modal__close" onClick={close}>×</span>
        </div>
        <div className="modal__body">
          {commits === null ? (
            <div className="panel__empty">Loading…</div>
          ) : commits.length === 0 ? (
            <div className="panel__empty">No commits yet.</div>
          ) : (
            <div className="log">
              {commits.map((c) => (
                <div className="log__row" key={c.hash}>
                  <span className="log__graph">●</span>
                  <div className="log__main">
                    <div className="log__summary">{c.summary || "(no message)"}</div>
                    <div className="log__meta">
                      <span className="log__hash">{c.short}</span>
                      <span className="log__author">{c.author}</span>
                      <span className="log__time">{fmt(c.time)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function fmt(epoch: number): string {
  const d = new Date(epoch * 1000);
  const now = Date.now();
  const diff = (now - d.getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86400 * 30) return `${Math.floor(diff / 86400)}d ago`;
  return d.toLocaleDateString();
}
