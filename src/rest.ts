// src/rest.ts — a tiny .http REST client. Parses the request block at the cursor
// and runs it through the Rust http_request command, showing the response in the
// output dock.
import { invoke } from "@tauri-apps/api/core";
import { useStore, activeTab } from "./store/useStore";
import { getEditor } from "./editorBridge";

interface ParsedRequest {
  method: string;
  url: string;
  headers: [string, string][];
  body: string | null;
}

interface HttpResponse {
  status: number;
  status_text: string;
  headers: [string, string][];
  body: string;
  time_ms: number;
}

/** Split a .http file into request blocks (separated by lines starting with ###). */
function blockAtLine(text: string, line: number): string | null {
  const lines = text.split(/\r?\n/);
  let start = 0;
  const bounds: [number, number][] = [];
  for (let i = 0; i < lines.length; i++) {
    if (/^###/.test(lines[i])) {
      bounds.push([start, i]);
      start = i + 1;
    }
  }
  bounds.push([start, lines.length]);
  const block = bounds.find(([a, b]) => line - 1 >= a && line - 1 < b) ?? bounds[0];
  return block ? lines.slice(block[0], block[1]).join("\n") : null;
}

function parse(block: string): ParsedRequest | null {
  const lines = block.split(/\r?\n/);
  let i = 0;
  while (i < lines.length && (lines[i].trim() === "" || /^(#|\/\/)/.test(lines[i].trim()) || /^###/.test(lines[i]))) i++;
  if (i >= lines.length) return null;
  const reqLine = lines[i].trim();
  const m = reqLine.match(/^([A-Za-z]+)\s+(\S+)/);
  if (!m) return null;
  const method = m[1].toUpperCase();
  const url = m[2];
  i++;
  const headers: [string, string][] = [];
  for (; i < lines.length; i++) {
    const l = lines[i];
    if (l.trim() === "") {
      i++;
      break;
    }
    const h = l.match(/^([^:]+):\s*(.*)$/);
    if (h) headers.push([h[1].trim(), h[2].trim()]);
  }
  const body = lines.slice(i).join("\n").trim();
  return { method, url, headers, body: body || null };
}

export async function sendRequest() {
  const s = useStore.getState();
  const tab = activeTab(s);
  const ed = getEditor();
  if (!tab || !ed) return;
  const line = ed.getPosition()?.lineNumber ?? 1;
  const block = blockAtLine(tab.content, line);
  const req = block ? parse(block) : null;
  if (!req) {
    s.toast("error", "No request found (expected: METHOD url)");
    return;
  }
  s.clearOutput();
  s.setOutputOpen(true);
  s.appendOutput({ line: `${req.method} ${req.url}`, stream: "meta" });
  try {
    const res = await invoke<HttpResponse>("http_request", { req });
    s.appendOutput({
      line: `← ${res.status} ${res.status_text}  ·  ${res.time_ms}ms`,
      stream: res.status < 400 ? "meta" : "stderr",
    });
    for (const [k, v] of res.headers) s.appendOutput({ line: `${k}: ${v}`, stream: "stdout" });
    s.appendOutput({ line: "", stream: "stdout" });
    let body = res.body;
    const ct = res.headers.find(([k]) => k.toLowerCase() === "content-type")?.[1] ?? "";
    if (ct.includes("json")) {
      try {
        body = JSON.stringify(JSON.parse(res.body), null, 2);
      } catch {
        /* leave raw */
      }
    }
    for (const l of body.split("\n")) s.appendOutput({ line: l, stream: "stdout" });
  } catch (e) {
    s.appendOutput({ line: `request failed: ${e}`, stream: "stderr" });
  }
}
