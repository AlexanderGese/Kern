// src/components/MarkdownPreview.tsx — live markdown preview with Mermaid
// diagrams and KaTeX math.
import { useEffect, useRef, useState } from "react";
import { Marked } from "marked";
import katex from "katex";
import "katex/dist/katex.min.css";
import { useStore, activeTab } from "../store/useStore";

// A fresh Marked instance with our extensions (mermaid code fences + $math$).
function makeMarked() {
  const m = new Marked({ gfm: true, breaks: true });
  m.use({
    renderer: {
      code(token: any) {
        if (token.lang === "mermaid") {
          return `<div class="mermaid">${token.text}</div>`;
        }
        return false as any; // fall through to default
      },
    },
    extensions: [
      mathExtension("blockMath", /^\$\$([\s\S]+?)\$\$/, true),
      mathExtension("inlineMath", /^\$([^\n$]+?)\$/, false),
    ],
  });
  return m;
}

function mathExtension(name: string, rule: RegExp, display: boolean) {
  return {
    name,
    level: display ? "block" : "inline",
    start(src: string) {
      return src.indexOf("$");
    },
    tokenizer(src: string) {
      const m = rule.exec(src);
      if (m) return { type: name, raw: m[0], text: m[1].trim() };
      return undefined;
    },
    renderer(token: any) {
      try {
        return katex.renderToString(token.text, { displayMode: display, throwOnError: false });
      } catch {
        return token.raw;
      }
    },
  } as any;
}

const md = makeMarked();

export function MarkdownPreview() {
  const tab = useStore(activeTab);
  const [html, setHtml] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!tab) return;
    Promise.resolve(md.parse(tab.content))
      .then((h) => setHtml(h as string))
      .catch(() => setHtml(""));
  }, [tab?.content]);

  // Render any mermaid blocks after the HTML lands.
  useEffect(() => {
    const el = ref.current;
    if (!el || !el.querySelector(".mermaid")) return;
    let cancelled = false;
    import("mermaid")
      .then(({ default: mermaid }) => {
        if (cancelled) return;
        mermaid.initialize({ startOnLoad: false, theme: "dark", securityLevel: "loose" });
        mermaid.run({ nodes: el.querySelectorAll<HTMLElement>(".mermaid") }).catch(() => {});
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [html]);

  return <div className="mdpreview" ref={ref} dangerouslySetInnerHTML={{ __html: html }} />;
}
