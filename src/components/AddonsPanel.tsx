// src/components/AddonsPanel.tsx — the Addons / Extensions page (⌘⇧X).
// Some addons are real (they toggle editor features or report installed language
// servers); a few are clearly-marked "coming soon" scaffolds for later.
import { useEffect, useState, type ReactNode } from "react";
import { useStore, type EditorSettings } from "../store/useStore";
import { THEME_NAMES } from "../themes/monaco-themes";
import { lspApi } from "../ipc";

interface FeatureAddon {
  key: keyof EditorSettings;
  name: string;
  desc: string;
}

const FEATURE_ADDONS: FeatureAddon[] = [
  { key: "minimap", name: "Minimap", desc: "Code overview on the right edge" },
  { key: "ligatures", name: "Font Ligatures", desc: "Combine ->, =>, != into glyphs" },
  { key: "wordWrap", name: "Word Wrap", desc: "Wrap long lines to the viewport" },
  { key: "relativeLineNumbers", name: "Relative Line Numbers", desc: "Distance from the cursor line" },
  { key: "cursorBlink", name: "Cursor Blink", desc: "Blinking caret" },
];

const COMING_SOON = [
  { id: "vim", name: "Vim Mode", desc: "Modal editing keybindings" },
  { id: "blame", name: "Git Blame", desc: "Inline last-commit annotations on hover" },
  { id: "format-on-save", name: "Format on Save", desc: "Run the formatter when you save" },
  { id: "copilot", name: "AI Completions", desc: "Inline AI suggestions" },
];

const LSP_CATALOG: { lang: string; name: string; install: string }[] = [
  { lang: "python", name: "Pyright (Python)", install: "npm i -g pyright" },
  { lang: "typescript", name: "TypeScript Language Server", install: "npm i -g typescript-language-server typescript" },
  { lang: "rust", name: "rust-analyzer", install: "rustup component add rust-analyzer" },
  { lang: "go", name: "gopls (Go)", install: "go install golang.org/x/tools/gopls@latest" },
  { lang: "c", name: "clangd (C/C++)", install: "apt install clangd  ·  brew install llvm" },
];

export function AddonsPanel() {
  const close = useStore((s) => s.closePanel);
  const editor = useStore((s) => s.editor);
  const setEditorSetting = useStore((s) => s.setEditorSetting);
  const addons = useStore((s) => s.addons);
  const toggleAddon = useStore((s) => s.toggleAddon);
  const setTheme = useStore((s) => s.setTheme);
  const theme = useStore((s) => s.theme);
  const [available, setAvailable] = useState<string[] | null>(null);

  useEffect(() => {
    lspApi.availableLanguages().then(setAvailable).catch(() => setAvailable([]));
  }, []);

  return (
    <div className="modal-overlay" onMouseDown={close}>
      <div className="modal modal--wide" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <span className="modal__title">Addons</span>
          <span className="modal__close" onClick={close}>×</span>
        </div>

        <div className="modal__body">
          <Group title="Themes">
            <div className="addon-themes">
              {THEME_NAMES.map((t) => (
                <button
                  key={t}
                  className={"addon-theme" + (theme === t ? " is-on" : "")}
                  data-theme={t}
                  onClick={() => setTheme(t)}
                >
                  <span className="addon-theme__swatch" />
                  {t[0].toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
          </Group>

          <Group title="Editor Features">
            {FEATURE_ADDONS.map((a) => (
              <AddonRow
                key={a.key}
                name={a.name}
                desc={a.desc}
                on={Boolean(editor[a.key])}
                onToggle={() => setEditorSetting(a.key, !editor[a.key] as never)}
              />
            ))}
          </Group>

          <Group title="Language Servers">
            {LSP_CATALOG.map((s) => {
              const installed = available?.includes(s.lang);
              return (
                <div className="addon-row" key={s.lang}>
                  <div className="addon-row__info">
                    <div className="addon-row__name">{s.name}</div>
                    <div className="addon-row__desc">
                      {installed ? "Detected on PATH" : <code>{s.install}</code>}
                    </div>
                  </div>
                  <span className={"addon-status" + (installed ? " is-on" : "")}>
                    {available === null ? "…" : installed ? "installed" : "not found"}
                  </span>
                </div>
              );
            })}
          </Group>

          <Group title="Coming Soon">
            {COMING_SOON.map((a) => (
              <AddonRow
                key={a.id}
                name={a.name}
                desc={a.desc}
                on={addons.has(a.id)}
                soon
                onToggle={() => toggleAddon(a.id)}
              />
            ))}
          </Group>
        </div>
      </div>
    </div>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="addon-group">
      <h3 className="addon-group__title">{title}</h3>
      {children}
    </section>
  );
}

function AddonRow({
  name,
  desc,
  on,
  onToggle,
  soon,
}: {
  name: string;
  desc: string;
  on: boolean;
  onToggle: () => void;
  soon?: boolean;
}) {
  return (
    <div className="addon-row">
      <div className="addon-row__info">
        <div className="addon-row__name">
          {name}
          {soon && <span className="addon-row__soon">soon</span>}
        </div>
        <div className="addon-row__desc">{desc}</div>
      </div>
      <button
        className={"toggle" + (on ? " is-on" : "")}
        onClick={onToggle}
        role="switch"
        aria-checked={on}
      >
        <span className="toggle__knob" />
      </button>
    </div>
  );
}
