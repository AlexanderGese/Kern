// src/components/Welcome.tsx — start page shown when no file is open: recent
// projects, quick actions, and tips.
import { useStore } from "../store/useStore";
import { openFolderDialog } from "../actions";
import { createProjectFromFolder, openProject } from "../projects";
import { basename } from "../lang";

export function Welcome() {
  const projects = useStore((s) => s.projects);

  return (
    <div className="welcome">
      <div className="welcome__inner">
        <div className="welcome__brand">
          <img className="welcome__mark" src="/icon.png" alt="Kern" />
          <div>
            <div className="welcome__name">Kern</div>
            <div className="welcome__tag">Get to the Kern of things.</div>
          </div>
        </div>

        <div className="welcome__cols">
          <div className="welcome__col">
            <div className="welcome__h">Start</div>
            <button className="welcome__action" onClick={() => void openFolderDialog()}>
              <span className="welcome__ai">⌕</span> Open Folder…
            </button>
            <button className="welcome__action" onClick={() => void createProjectFromFolder()}>
              <span className="welcome__ai">＋</span> New Project…
            </button>
            <button className="welcome__action" onClick={() => useStore.getState().openPalette("commands")}>
              <span className="welcome__ai">⌘</span> Command Palette
            </button>
            <button className="welcome__action" onClick={() => useStore.getState().openPanel("settings")}>
              <span className="welcome__ai">⚙</span> Settings
            </button>
          </div>

          <div className="welcome__col welcome__col--wide">
            <div className="welcome__h">Projects</div>
            {projects.length === 0 ? (
              <div className="welcome__empty">
                No projects yet. Open a folder, then “New Project…” to save it for
                instant re-opening from <span className="kbd">⌘⇧P</span>.
              </div>
            ) : (
              <div className="welcome__projects">
                {projects.map((p) => (
                  <button key={p.id} className="welcome__project" onClick={() => void openProject(p)}>
                    <span className="welcome__dot" style={{ background: p.color }} />
                    <span className="welcome__pinfo">
                      <span className="welcome__pname">{p.name}</span>
                      <span className="welcome__pmeta">{p.description || basename(p.path)}</span>
                    </span>
                    <span className="welcome__pago">{ago(p.lastOpened)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ago(epoch: number): string {
  const diff = (Date.now() - epoch) / 1000;
  if (diff < 60) return "now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}
