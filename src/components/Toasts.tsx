// src/components/Toasts.tsx — transient notifications for git/op results.
import { useStore } from "../store/useStore";

export function Toasts() {
  const toasts = useStore((s) => s.toasts);
  const dismiss = useStore((s) => s.dismissToast);
  if (toasts.length === 0) return null;
  return (
    <div className="toasts">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast--${t.kind}`} onClick={() => dismiss(t.id)}>
          <span className="toast__dot" />
          <span className="toast__msg">{t.msg}</span>
        </div>
      ))}
    </div>
  );
}
