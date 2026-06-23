// src/hooks/useRunner.ts — wire the runner's output/exit event listeners.
import { useEffect } from "react";
import { installRunnerListeners } from "../runner";

export function useRunner() {
  useEffect(() => {
    let dispose: (() => void) | undefined;
    installRunnerListeners().then((d) => (dispose = d));
    return () => dispose?.();
  }, []);
}
