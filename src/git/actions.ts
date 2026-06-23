// src/git/actions.ts — git mutations wrapped with toasts + a refresh bump so the
// SCM panel, tree badges, and gutter all re-read after every operation.
import { gitApi } from "../ipc";
import { useStore } from "../store/useStore";

function repo(): string | null {
  return useStore.getState().folder;
}

async function run(label: string, fn: (repo: string) => Promise<string | void>, ok?: string) {
  const r = repo();
  if (!r) return;
  const s = useStore.getState();
  try {
    const out = await fn(r);
    s.toast("success", ok ?? `${label} ✓${out ? " — " + firstLine(out) : ""}`);
  } catch (e) {
    s.toast("error", `${label} failed: ${firstLine(String(e))}`);
  } finally {
    useStore.getState().bumpGit();
  }
}

function firstLine(s: string): string {
  const l = s.trim().split("\n").find(Boolean) ?? s.trim();
  return l.length > 120 ? l.slice(0, 117) + "…" : l;
}

export const git = {
  stage: (path: string) => run("Stage", (r) => gitApi.stage(r, path), "Staged"),
  unstage: (path: string) => run("Unstage", (r) => gitApi.unstage(r, path), "Unstaged"),
  stageAll: () => run("Stage all", (r) => gitApi.stageAll(r), "Staged all"),
  unstageAll: () => run("Unstage all", (r) => gitApi.unstageAll(r), "Unstaged all"),
  discard: (path: string) => run("Discard", (r) => gitApi.discard(r, path), "Discarded changes"),
  commit: (message: string) => run("Commit", (r) => gitApi.commit(r, message)),
  push: () => run("Push", (r) => gitApi.push(r)),
  pull: () => run("Pull", (r) => gitApi.pull(r)),
  fetch: () => run("Fetch", (r) => gitApi.fetch(r)),
  checkout: (branch: string) => run(`Checkout ${branch}`, (r) => gitApi.checkout(r, branch)),
  createBranch: (name: string) => run(`Branch ${name}`, (r) => gitApi.createBranch(r, name)),
  merge: (branch: string) => run(`Merge ${branch}`, (r) => gitApi.merge(r, branch)),
  mergeAbort: () => run("Abort merge", (r) => gitApi.mergeAbort(r), "Merge aborted"),
  stash: (message: string) => run("Stash", (r) => gitApi.stash(r, message), "Stashed changes"),
  stashPop: () => run("Stash pop", (r) => gitApi.stashPop(r), "Popped stash"),
  stashApply: (index: number) => run("Stash apply", (r) => gitApi.stashApply(r, index)),
  stashDrop: (index: number) => run("Stash drop", (r) => gitApi.stashDrop(r, index), "Dropped stash"),
  resolveOurs: (path: string) => run("Accept current", (r) => gitApi.resolveOurs(r, path), "Kept your version"),
  resolveTheirs: (path: string) => run("Accept incoming", (r) => gitApi.resolveTheirs(r, path), "Took incoming version"),
};
