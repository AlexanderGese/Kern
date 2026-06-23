// src/components/SettingsPanel.tsx — consolidated Settings (⌘,):
// Editor settings · Keybindings editor · Backup (export/import).
import { useEffect, useState } from "react";
import { useStore, FONT_CHOICES, type EditorSettings } from "../store/useStore";
import { THEME_NAMES, THEME_ACCENTS, themeLabel, type ThemeName } from "../themes/monaco-themes";
import { KEYBINDINGS, comboFromEvent, effectiveCombo, prettyCombo } from "../keybindings";

type Section = "editor" | "keys" | "backup";

export function SettingsPanel() {
  const close = useStore((s) => s.closePanel);
  const [section, setSection] = useState<Section>("editor");

  return (
    <div className="modal-overlay" onMouseDown={close}>
      <div className="modal modal--xwide" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <span className="modal__title">Settings</span>
          <span className="modal__close" onClick={close}>×</span>
        </div>
        <div className="ext">
          <div className="ext__rail">
            <Rail label="Editor" active={section === "editor"} onClick={() => setSection("editor")} />
            <Rail label="Keybindings" active={section === "keys"} onClick={() => setSection("keys")} />
            <Rail label="Backup" active={section === "backup"} onClick={() => setSection("backup")} />
          </div>
          <div className="ext__list">
            {section === "editor" && <EditorSettingsView />}
            {section === "keys" && <KeybindingsView />}
            {section === "backup" && <BackupView />}
          </div>
        </div>
      </div>
    </div>
  );
}

function Rail({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <div className={"ext__catrow" + (active ? " is-active" : "")} onClick={onClick}>{label}</div>
  );
}

function EditorSettingsView() {
  const theme = useStore((s) => s.theme);
  const setTheme = useStore((s) => s.setTheme);
  const e = useStore((s) => s.editor);
  const set = useStore((s) => s.setEditorSetting);
  const toggle = (k: keyof EditorSettings) => set(k, !e[k] as never);

  return (
    <>
      <section className="addon-group">
        <h3 className="addon-group__title">Appearance</h3>
        <Row label="Color theme">
          <div className="theme-select">
            <span className="theme-select__swatch" style={{ background: THEME_ACCENTS[theme] }} />
            <select className="setting-select" value={theme} onChange={(ev) => setTheme(ev.target.value as ThemeName)}>
              {THEME_NAMES.map((t: ThemeName) => (
                <option key={t} value={t}>{themeLabel(t)}</option>
              ))}
            </select>
          </div>
        </Row>
        <Row label="Font family">
          <select className="setting-select" value={e.fontFamily} onChange={(ev) => set("fontFamily", ev.target.value)}>
            {FONT_CHOICES.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
        </Row>
        <Row label="Font size">
          <Stepper value={`${e.fontSize}px`} onDec={() => set("fontSize", Math.max(8, e.fontSize - 1))} onInc={() => set("fontSize", Math.min(32, e.fontSize + 1))} />
        </Row>
        <Row label="Line height">
          <Stepper value={e.lineHeight.toFixed(2)} onDec={() => set("lineHeight", Math.max(1.1, +(e.lineHeight - 0.05).toFixed(2)))} onInc={() => set("lineHeight", Math.min(2.4, +(e.lineHeight + 0.05).toFixed(2)))} />
        </Row>
        <Row label="Tab size">
          <div className="stepper">
            {[2, 4, 8].map((n) => <button key={n} className={e.tabSize === n ? "is-on" : ""} onClick={() => set("tabSize", n)}>{n}</button>)}
          </div>
        </Row>
      </section>

      <section className="addon-group">
        <h3 className="addon-group__title">Behavior</h3>
        <Toggle label="Auto-save" desc="Save automatically after a short delay" on={e.autoSave} onClick={() => toggle("autoSave")} />
        {e.autoSave && (
          <Row label="Auto-save delay">
            <Stepper value={`${e.autoSaveDelay}ms`} onDec={() => set("autoSaveDelay", Math.max(200, e.autoSaveDelay - 200))} onInc={() => set("autoSaveDelay", Math.min(5000, e.autoSaveDelay + 200))} />
          </Row>
        )}
        <Toggle label="Format on save" desc="Run the language formatter when you save" on={e.formatOnSave} onClick={() => toggle("formatOnSave")} />
        <Toggle label="Minimap" desc="Code overview on the right edge" on={e.minimap} onClick={() => toggle("minimap")} />
        <Toggle label="Word wrap" on={e.wordWrap} onClick={() => toggle("wordWrap")} />
        <Toggle label="Font ligatures" on={e.ligatures} onClick={() => toggle("ligatures")} />
        <Toggle label="Relative line numbers" on={e.relativeLineNumbers} onClick={() => toggle("relativeLineNumbers")} />
        <Toggle label="Cursor blink" on={e.cursorBlink} onClick={() => toggle("cursorBlink")} />
      </section>
    </>
  );
}

function KeybindingsView() {
  const keymap = useStore((s) => s.keymap);
  const setKeybinding = useStore((s) => s.setKeybinding);
  const resetKeybinding = useStore((s) => s.resetKeybinding);
  const resetAll = useStore((s) => s.resetAllKeybindings);
  const [recording, setRecording] = useState<string | null>(null);

  useEffect(() => {
    if (!recording) return;
    const onKey = (ev: KeyboardEvent) => {
      ev.preventDefault();
      ev.stopPropagation();
      if (ev.key === "Escape") {
        setRecording(null);
        return;
      }
      const combo = comboFromEvent(ev);
      if (!combo) return; // bare modifier; keep waiting
      setKeybinding(recording, combo);
      setRecording(null);
    };
    window.addEventListener("keydown", onKey, { capture: true });
    return () => window.removeEventListener("keydown", onKey, { capture: true });
  }, [recording, setKeybinding]);

  return (
    <>
      <div className="keys__head">
        <span className="addon-group__title" style={{ margin: 0 }}>Keybindings</span>
        <button className="keys__resetall" onClick={resetAll}>Reset all</button>
      </div>
      {KEYBINDINGS.map((b) => {
        const combo = effectiveCombo(b.id, b.default);
        const overridden = keymap[b.id] !== undefined;
        return (
          <div className="keys__row" key={b.id}>
            <span className="keys__label">{b.label}</span>
            <button
              className={"keys__combo" + (recording === b.id ? " is-recording" : "")}
              onClick={() => setRecording(b.id)}
            >
              {recording === b.id ? "press keys… (Esc to cancel)" : prettyCombo(combo)}
            </button>
            {overridden && (
              <button className="keys__reset" title="Reset to default" onClick={() => resetKeybinding(b.id)}>↺</button>
            )}
          </div>
        );
      })}
    </>
  );
}

function BackupView() {
  const exportConfig = useStore((s) => s.exportConfig);
  const importConfig = useStore((s) => s.importConfig);
  const toast = useStore((s) => s.toast);
  const [text, setText] = useState("");

  return (
    <section className="addon-group">
      <h3 className="addon-group__title">Export / Import</h3>
      <p className="about__credits about__dim">
        Your full configuration — settings, keybindings, extensions, runner, and projects.
      </p>
      <div className="backup__actions">
        <button className="prompt__btn prompt__btn--primary" onClick={() => { setText(exportConfig()); toast("success", "Exported below — copy it somewhere safe"); }}>
          Export config
        </button>
        <button className="prompt__btn" onClick={() => { if (importConfig(text)) toast("success", "Config imported"); else toast("error", "Invalid config JSON"); }}>
          Import from box
        </button>
      </div>
      <textarea className="backup__box" spellCheck={false} value={text} placeholder="Paste a config JSON here to import…" onChange={(ev) => setText(ev.target.value)} />
    </section>
  );
}

// ── small primitives ────────────────────────────────────────────────────────
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="setting-row"><span>{label}</span>{children}</div>;
}
function Stepper({ value, onDec, onInc }: { value: string; onDec: () => void; onInc: () => void }) {
  return (
    <div className="stepper">
      <button onClick={onDec}>−</button>
      <span>{value}</span>
      <button onClick={onInc}>+</button>
    </div>
  );
}
function Toggle({ label, desc, on, onClick }: { label: string; desc?: string; on: boolean; onClick: () => void }) {
  return (
    <div className="addon-row">
      <div className="addon-row__info">
        <div className="addon-row__name">{label}</div>
        {desc && <div className="addon-row__desc">{desc}</div>}
      </div>
      <button className={"toggle" + (on ? " is-on" : "")} role="switch" aria-checked={on} onClick={onClick}>
        <span className="toggle__knob" />
      </button>
    </div>
  );
}
