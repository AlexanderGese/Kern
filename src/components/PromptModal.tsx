// src/components/PromptModal.tsx — the input dialog driven by src/prompt.ts.
import { useEffect, useRef, useState } from "react";
import { useStore } from "../store/useStore";
import { submitPrompt } from "../prompt";

export function PromptModal() {
  const req = useStore((s) => s.prompt);
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (req) {
      setValue(req.initial ?? "");
      setTimeout(() => inputRef.current?.select(), 20);
    }
  }, [req]);

  if (!req) return null;

  return (
    <div className="modal-overlay" onMouseDown={() => submitPrompt(null)}>
      <div className="prompt" onMouseDown={(e) => e.stopPropagation()}>
        <div className="prompt__title">{req.title}</div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submitPrompt(value.trim() || null);
          }}
        >
          <input
            ref={inputRef}
            className="prompt__input"
            placeholder={req.placeholder}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.preventDefault();
                submitPrompt(null);
              }
            }}
          />
          <div className="prompt__actions">
            <button type="button" className="prompt__btn" onClick={() => submitPrompt(null)}>
              Cancel
            </button>
            <button type="submit" className="prompt__btn prompt__btn--primary">
              OK
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
