// src/update.ts — self-update wiring (checks GitHub releases, replaces binary).
import { invoke } from "@tauri-apps/api/core";
import { useStore } from "./store/useStore";

interface UpdateInfo {
  current: string;
  latest: string;
  update_available: boolean;
}

export async function checkForUpdates(explicit = false) {
  const s = useStore.getState();
  try {
    const info = await invoke<UpdateInfo>("check_update");
    if (info.update_available) {
      s.toast("info", `Kern v${info.latest} is available (you have v${info.current}). Run “Kern: Update Now”.`);
    } else if (explicit) {
      s.toast("success", `Kern is up to date (v${info.current}).`);
    }
  } catch (e) {
    if (explicit) s.toast("error", `Update check failed: ${String(e).slice(0, 80)}`);
  }
}

export async function updateNow() {
  const s = useStore.getState();
  s.toast("info", "Downloading the latest Kern…");
  try {
    const msg = await invoke<string>("self_update");
    s.toast("success", msg);
  } catch (e) {
    s.toast("error", `Update failed: ${String(e).slice(0, 120)}`);
  }
}
