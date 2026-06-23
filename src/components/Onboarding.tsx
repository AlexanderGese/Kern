// src/components/Onboarding.tsx — a short first-launch tour. Shows once (the
// "onboarded" flag persists); reopen anytime via the palette ("Help: Tour").
import { useStore } from "../store/useStore";
import { openFolderDialog } from "../actions";
import { prettyCombo, effectiveCombo, KEYBINDINGS } from "../keybindings";

function combo(id: string): string {
  const b = KEYBINDINGS.find((k) => k.id === id);
  return b ? prettyCombo(effectiveCombo(id, b.default)) : "";
}

const STEPS: { icon: string; title: string; desc: string; id?: string }[] = [
  { icon: "⌘", title: "Command Palette", desc: "Every action lives here — search and run anything.", id: "palette.commands" },
  { icon: "findfile", title: "Go to File", desc: "Jump to any file by fuzzy name.", id: "palette.files" },
  { icon: "tree", title: "Open a Folder or Project", desc: "Start by opening a folder. Save it as a Project to reopen instantly." },
  { icon: "git", title: "Source Control", desc: "Stage, commit, push/pull, branches, stash, conflicts, diffs.", id: "panel.git" },
  { icon: "run", title: "Run & Terminal", desc: "Run the current file, or open a real terminal.", id: "view.terminal" },
  { icon: "gear", title: "Settings & Keybindings", desc: "Themes, fonts, and fully-rebindable shortcuts.", id: "panel.settings" },
];

export function Onboarding() {
  const open = useStore((s) => s.onboardingOpen);
  const finish = useStore((s) => s.finishOnboarding);
  if (!open) return null;

  return (
    <div className="modal-overlay onb-overlay" onMouseDown={finish}>
      <div className="onb" onMouseDown={(e) => e.stopPropagation()}>
        <div className="onb__head">
          <img className="onb__icon" src="/icon.png" alt="Kern" />
          <div>
            <div className="onb__title">Welcome to Kern</div>
            <div className="onb__tag">Get to the Kern of things. Here's the gist:</div>
          </div>
        </div>

        <div className="onb__grid">
          {STEPS.map((s) => (
            <div className="onb__step" key={s.title}>
              <span className="onb__glyph">{glyph(s.icon)}</span>
              <div className="onb__step-main">
                <div className="onb__step-title">
                  {s.title}
                  {s.id && <span className="onb__key">{combo(s.id)}</span>}
                </div>
                <div className="onb__step-desc">{s.desc}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="onb__actions">
          <button className="onb__btn" onClick={() => { finish(); void openFolderDialog(); }}>
            Open a folder…
          </button>
          <button className="onb__btn onb__btn--primary" onClick={finish}>
            Start editing
          </button>
        </div>
        <div className="onb__foot">
          Tip: press <span className="kbd">{combo("palette.commands")}</span> any time to find a command.
          Reopen this from the palette → “Help: Tour”.
        </div>
      </div>
    </div>
  );
}

function glyph(k: string): string {
  switch (k) {
    case "⌘": return "⌘";
    case "findfile": return "⌕";
    case "tree": return "▸";
    case "git": return "⎇";
    case "run": return "▶";
    case "gear": return "⚙";
    default: return "•";
  }
}
