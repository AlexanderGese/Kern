// src/hooks/useKeymap.ts — global keyboard shortcuts, data-driven from the
// keybinding registry (src/keybindings.ts) with persisted user overrides.
// Capture phase so we intercept before Monaco hijacks ⌘P / ⌘⇧P etc.
import { useEffect } from "react";
import { useStore } from "../store/useStore";
import { KEYBINDINGS, comboFromEvent, effectiveCombo } from "../keybindings";

export function useKeymap() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = useStore.getState();

      // Escape closes overlays (not a rebindable action).
      if (e.key === "Escape" && !e.metaKey && !e.ctrlKey) {
        if (s.paletteOpen) s.closePalette();
        else if (s.prompt) {
          /* prompt handles its own escape */
        } else if (
          ["about", "addons", "history", "search", "extensions", "runner", "settings", "problems"].includes(s.panel)
        )
          s.closePanel();
        else if (s.diffPath) s.openDiff(null);
        return;
      }

      const combo = comboFromEvent(e);
      if (!combo || !combo.includes("mod")) return; // only mod-combos are global

      for (const b of KEYBINDINGS) {
        if (effectiveCombo(b.id, b.default) === combo) {
          e.preventDefault();
          e.stopPropagation();
          b.run();
          return;
        }
      }
    };

    window.addEventListener("keydown", onKey, { capture: true });
    return () => window.removeEventListener("keydown", onKey, { capture: true });
  }, []);
}
