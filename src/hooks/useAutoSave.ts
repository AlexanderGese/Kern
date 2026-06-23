// src/hooks/useAutoSave.ts — debounced auto-save of the active file when the
// "auto-save" editor setting is on.
import { useEffect } from "react";
import { useStore, activeTab, isDirty } from "../store/useStore";
import { saveActive } from "../actions";

export function useAutoSave() {
  const autoSave = useStore((s) => s.editor.autoSave);
  const delay = useStore((s) => s.editor.autoSaveDelay);
  const tab = useStore(activeTab);
  const dirty = tab ? isDirty(tab) : false;

  useEffect(() => {
    if (!autoSave || !tab || !dirty) return;
    const id = window.setTimeout(() => void saveActive(), Math.max(200, delay));
    return () => window.clearTimeout(id);
  }, [autoSave, delay, dirty, tab?.path, tab?.content]);
}
