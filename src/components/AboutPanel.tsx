// src/components/AboutPanel.tsx — About + quick Settings + credits (§12).
import { useEffect, useState } from "react";
import { getVersion } from "@tauri-apps/api/app";
import { useStore, FONT_CHOICES } from "../store/useStore";
import { THEME_NAMES, THEME_ACCENTS, themeLabel, type ThemeName } from "../themes/monaco-themes";

export function AboutPanel() {
  const close = useStore((s) => s.closePanel);
  const theme = useStore((s) => s.theme);
  const setTheme = useStore((s) => s.setTheme);
  const editor = useStore((s) => s.editor);
  const setEditorSetting = useStore((s) => s.setEditorSetting);
  const [version, setVersion] = useState("0.1.0");

  useEffect(() => {
    getVersion().then(setVersion).catch(() => {});
  }, []);

  return (
    <div className="modal-overlay" onMouseDown={close}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <span className="modal__title">About &amp; Settings</span>
          <span className="modal__close" onClick={close}>×</span>
        </div>

        <div className="modal__body">
          <div className="about__hero">
            <img className="about__icon" src="/icon.png" alt="Kern" />
            <div>
              <div className="about__name">Kern</div>
              <div className="about__ver">v{version}</div>
              <div className="about__tag">Get to the Kern of things.</div>
            </div>
          </div>

          <section className="addon-group">
            <h3 className="addon-group__title">Theme</h3>
            <div className="setting-row">
              <span>Color theme</span>
              <div className="theme-select">
                <span className="theme-select__swatch" style={{ background: THEME_ACCENTS[theme] }} />
                <select
                  className="setting-select"
                  value={theme}
                  onChange={(ev) => setTheme(ev.target.value as ThemeName)}
                >
                  {THEME_NAMES.map((t) => (
                    <option key={t} value={t}>{themeLabel(t)}</option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          <section className="addon-group">
            <h3 className="addon-group__title">Editor</h3>
            <div className="setting-row">
              <span>Font family</span>
              <select
                className="setting-select"
                value={editor.fontFamily}
                onChange={(e) => setEditorSetting("fontFamily", e.target.value)}
              >
                {FONT_CHOICES.map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </div>
            <div className="setting-row">
              <span>Font size</span>
              <div className="stepper">
                <button onClick={() => setEditorSetting("fontSize", Math.max(8, editor.fontSize - 1))}>−</button>
                <span>{editor.fontSize}px</span>
                <button onClick={() => setEditorSetting("fontSize", Math.min(32, editor.fontSize + 1))}>+</button>
              </div>
            </div>
            <div className="setting-row">
              <span>Line height</span>
              <div className="stepper">
                <button onClick={() => setEditorSetting("lineHeight", Math.max(1.1, +(editor.lineHeight - 0.05).toFixed(2)))}>−</button>
                <span>{editor.lineHeight.toFixed(2)}</span>
                <button onClick={() => setEditorSetting("lineHeight", Math.min(2.4, +(editor.lineHeight + 0.05).toFixed(2)))}>+</button>
              </div>
            </div>
            <div className="setting-row">
              <span>Tab size</span>
              <div className="stepper">
                {[2, 4, 8].map((n) => (
                  <button
                    key={n}
                    className={editor.tabSize === n ? "is-on" : ""}
                    onClick={() => setEditorSetting("tabSize", n)}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section className="addon-group">
            <h3 className="addon-group__title">Built with</h3>
            <p className="about__credits">
              Tauri 2 · React · Monaco · Zustand · git2 · tokio. Fonts: JetBrains
              Mono (SIL OFL). All dependencies under permissive licenses — see
              <code> THIRD_PARTY_LICENSES.md</code>.
            </p>
            <p className="about__credits about__dim">
              Settings persist to <code>com.kern.app/settings.json</code>. Press
              <span className="kbd">⌘⇧P</span> for all commands.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
