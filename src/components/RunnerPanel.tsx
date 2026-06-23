// src/components/RunnerPanel.tsx — configure the code runner per language.
import { useState } from "react";
import { useStore, DEFAULT_RUNNER } from "../store/useStore";
import { runActiveFile } from "../runner";

export function RunnerPanel() {
  const close = useStore((s) => s.closePanel);
  const runner = useStore((s) => s.runner);
  const setRunnerCmd = useStore((s) => s.setRunnerCmd);
  const [newLang, setNewLang] = useState("");

  const langs = Object.keys(runner).sort();

  return (
    <div className="modal-overlay" onMouseDown={close}>
      <div className="modal modal--wide" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <span className="modal__title">Code Runner</span>
          <span className="modal__close" onClick={close}>×</span>
        </div>
        <div className="modal__body">
          <p className="runner__hint">
            Per-language run commands. Placeholders:
            <code>$file</code> <code>$dir</code> <code>$fileBasename</code> <code>$fileBasenameNoExt</code>.
            Run the active file from the palette (<span className="kbd">Run File</span>) or the ▶ in the path bar.
          </p>

          {langs.map((lang) => (
            <div className="runner__row" key={lang}>
              <span className="runner__lang">{lang}</span>
              <input
                className="runner__cmd"
                value={runner[lang]}
                spellCheck={false}
                onChange={(e) => setRunnerCmd(lang, e.target.value)}
              />
              {DEFAULT_RUNNER[lang] && runner[lang] !== DEFAULT_RUNNER[lang] && (
                <button className="runner__reset" title="Reset to default" onClick={() => setRunnerCmd(lang, DEFAULT_RUNNER[lang])}>
                  ↺
                </button>
              )}
            </div>
          ))}

          <form
            className="runner__addrow"
            onSubmit={(e) => {
              e.preventDefault();
              const l = newLang.trim().toLowerCase();
              if (l && !runner[l]) {
                setRunnerCmd(l, 'echo "configure me" "$file"');
                setNewLang("");
              }
            }}
          >
            <input
              className="runner__cmd"
              placeholder="add language id (e.g. kotlin)…"
              value={newLang}
              onChange={(e) => setNewLang(e.target.value)}
            />
            <button className="prompt__btn prompt__btn--primary" type="submit">Add</button>
          </form>

          <button className="runner__runbtn" onClick={() => { close(); void runActiveFile(); }}>
            ▶ Run current file
          </button>
        </div>
      </div>
    </div>
  );
}
