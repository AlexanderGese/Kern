// src/components/MarkdownPreview.tsx — live markdown preview pane.
import { useEffect, useState } from "react";
import { marked } from "marked";
import { useStore, activeTab } from "../store/useStore";

export function MarkdownPreview() {
  const tab = useStore(activeTab);
  const [html, setHtml] = useState("");

  useEffect(() => {
    if (!tab) return;
    Promise.resolve(marked.parse(tab.content, { gfm: true, breaks: true }))
      .then((h) => setHtml(h as string))
      .catch(() => setHtml(""));
  }, [tab?.content]);

  return <div className="mdpreview" dangerouslySetInnerHTML={{ __html: html }} />;
}
