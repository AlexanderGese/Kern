# Third-Party Licenses

Kern bundles and builds upon open-source software. All dependencies are under
permissive licenses (MIT, Apache-2.0, BSD, Zlib, MPL-2.0, Unicode, ISC, CC0).
No copyleft (GPL/LGPL-linked) code is statically included. This file summarizes
attributions; full license texts for each package are available in their
respective source repositories.

---

## Bundled fonts

- **JetBrains Mono** — © The JetBrains Mono Project Authors.
  Licensed under the SIL Open Font License 1.1.
  Full text: [`licenses/JetBrainsMono-OFL.txt`](licenses/JetBrainsMono-OFL.txt).

---

## Frontend (npm, production dependencies)

| Package | License |
| --- | --- |
| react | MIT |
| react-dom | MIT |
| zustand | MIT |
| monaco-editor | MIT |
| @monaco-editor/react | MIT |
| @tauri-apps/api | Apache-2.0 OR MIT |
| @tauri-apps/plugin-dialog | MIT OR Apache-2.0 |
| @tauri-apps/plugin-opener | MIT OR Apache-2.0 |
| @tauri-apps/plugin-store | MIT OR Apache-2.0 |

---

## Backend (Rust crates)

The compiled application links ~507 Rust crates (direct + transitive). License
distribution:

| Count | License |
| --- | --- |
| 237 | MIT OR Apache-2.0 |
| 119 | MIT |
| 49 | Apache-2.0 OR MIT |
| 22 | MIT/Apache-2.0 |
| 18 | Unicode-3.0 |
| 17 | Zlib OR Apache-2.0 OR MIT |
| 5 | MPL-2.0 |
| 5 | Apache-2.0 WITH LLVM-exception OR Apache-2.0 OR MIT |
| 4 | Unlicense OR MIT |
| 3 | ISC |
| 3 | Apache-2.0/MIT |
| 2 | Apache-2.0 |
| 2 | BSD-3-Clause |
| 1 | CC0-1.0 (notify) |
| — | other permissive combinations |

### Notable crates

| Crate | License |
| --- | --- |
| tauri / tauri-build | Apache-2.0 OR MIT |
| wry | Apache-2.0 OR MIT |
| tao | Apache-2.0 |
| webkit2gtk | MIT |
| git2 / libgit2-sys | MIT OR Apache-2.0 |
| tokio | MIT |
| tokio-tungstenite | MIT |
| notify | CC0-1.0 |
| serde / serde_json | MIT OR Apache-2.0 |
| futures-util | MIT OR Apache-2.0 |

---

## Regenerating

- npm: `npx license-checker --production --json`
- Rust: `cargo metadata --format-version 1` (or `cargo install cargo-about && cargo about generate about.hbs` for full texts)
