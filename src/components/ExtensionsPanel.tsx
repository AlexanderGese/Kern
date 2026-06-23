// src/components/ExtensionsPanel.tsx — the Extensions / plugins page (⌘⇧E).
// Curated catalog + your own added entries (dev window). Enabling theme/feature
// extensions applies a real effect; others are enable/disable flags with an
// install hint. Includes quick access to the Code Runner config.
import { useMemo, useState } from "react";
import { useStore, type ExtItem } from "../store/useStore";
import { CATALOG, CATEGORIES, EXT_THEME, EXT_FEATURE } from "../extensions/catalog";
import type { ThemeName } from "../themes/monaco-themes";

const FEATURE_ADDON_EXT: Record<string, string> = {
  "feat.vim": "vim",
  "feat.blame": "blame",
  "pack.markdown": "markdown",
};

export function ExtensionsPanel() {
  const close = useStore((s) => s.closePanel);
  const openPanel = useStore((s) => s.openPanel);
  const enabled = useStore((s) => s.extEnabled);
  const custom = useStore((s) => s.extCustom);
  const toggleExt = useStore((s) => s.toggleExt);
  const addCustomExt = useStore((s) => s.addCustomExt);
  const removeCustomExt = useStore((s) => s.removeCustomExt);
  const setTheme = useStore((s) => s.setTheme);
  const setEditorSetting = useStore((s) => s.setEditorSetting);
  const toggleAddon = useStore((s) => s.toggleAddon);

  const [cat, setCat] = useState<string>("All");
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);

  const all = useMemo(() => [...CATALOG, ...custom], [custom]);
  const counts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const e of all) m[e.category] = (m[e.category] ?? 0) + 1;
    return m;
  }, [all]);

  const visible = useMemo(() => {
    const q = query.toLowerCase();
    return all.filter(
      (e) =>
        (cat === "All" || e.category === cat) &&
        (!q || (e.name + " " + e.description).toLowerCase().includes(q)),
    );
  }, [all, cat, query]);

  const onToggle = (e: ExtItem) => {
    const turningOn = !enabled.has(e.id);
    toggleExt(e.id);
    // Real effects for built-in mappings.
    if (turningOn && EXT_THEME[e.id]) setTheme(EXT_THEME[e.id] as ThemeName);
    else if (EXT_FEATURE[e.id]) setEditorSetting(EXT_FEATURE[e.id] as never, turningOn as never);
    else if (FEATURE_ADDON_EXT[e.id]) {
      const cur = useStore.getState().addons.has(FEATURE_ADDON_EXT[e.id]);
      if (cur !== turningOn) toggleAddon(FEATURE_ADDON_EXT[e.id]);
    }
  };

  return (
    <div className="modal-overlay" onMouseDown={close}>
      <div className="modal modal--xwide" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <span className="modal__title">Extensions</span>
          <span className="ext__headright">
            <button className="ext__runnerlink" onClick={() => openPanel("runner")}>Code Runner ▸</button>
            <span className="modal__close" onClick={close}>×</span>
          </span>
        </div>

        <div className="ext">
          <div className="ext__rail">
            <input
              className="ext__search"
              placeholder="Search extensions…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <CatRow label="All" count={all.length} active={cat === "All"} onClick={() => setCat("All")} />
            {CATEGORIES.map((c) => (
              <CatRow key={c} label={c} count={counts[c] ?? 0} active={cat === c} onClick={() => setCat(c)} />
            ))}
            <button className="ext__add" onClick={() => setAdding(true)}>+ Add extension…</button>
          </div>

          <div className="ext__list">
            {adding && (
              <AddForm
                onCancel={() => setAdding(false)}
                onAdd={(e) => { addCustomExt(e); setAdding(false); setCat("Custom"); }}
              />
            )}
            {visible.length === 0 && !adding && <div className="panel__empty">No extensions match.</div>}
            {visible.map((e) => (
              <div className="ext__row" key={e.id}>
                <div className="ext__info">
                  <div className="ext__name">
                    {e.name}
                    <span className="ext__cat">{e.category}</span>
                    {e.custom && (
                      <span className="ext__remove" title="Remove" onClick={() => removeCustomExt(e.id)}>remove</span>
                    )}
                  </div>
                  <div className="ext__desc">{e.description}</div>
                  {e.install && <div className="ext__install"><code>{e.install}</code></div>}
                </div>
                <button
                  className={"toggle" + (enabled.has(e.id) ? " is-on" : "")}
                  onClick={() => onToggle(e)}
                  role="switch"
                  aria-checked={enabled.has(e.id)}
                >
                  <span className="toggle__knob" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function CatRow({ label, count, active, onClick }: { label: string; count: number; active: boolean; onClick: () => void }) {
  return (
    <div className={"ext__catrow" + (active ? " is-active" : "")} onClick={onClick}>
      {label}
      <span className="ext__catcount">{count}</span>
    </div>
  );
}

function AddForm({ onAdd, onCancel }: { onAdd: (e: ExtItem) => void; onCancel: () => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [install, setInstall] = useState("");
  const submit = () => {
    if (!name.trim()) return;
    onAdd({
      id: "custom." + name.trim().toLowerCase().replace(/\s+/g, "-"),
      name: name.trim(),
      description: description.trim() || "Custom extension",
      category: "Custom",
      install: install.trim() || undefined,
      custom: true,
    });
  };
  return (
    <div className="ext__addform">
      <div className="ext__addtitle">Add a custom extension</div>
      <input className="ext__addfield" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
      <input className="ext__addfield" placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
      <input className="ext__addfield" placeholder="Install command (optional)" value={install} onChange={(e) => setInstall(e.target.value)} />
      <div className="ext__addactions">
        <button className="prompt__btn" onClick={onCancel}>Cancel</button>
        <button className="prompt__btn prompt__btn--primary" onClick={submit}>Add</button>
      </div>
    </div>
  );
}
