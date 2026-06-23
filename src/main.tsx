import React from "react";
import ReactDOM from "react-dom/client";
import "./monacoSetup";
import App from "./App";
import "./themes/tokens.css";
import "./styles/global.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// Tell the Rust side the frontend rendered — if this never fires, the backend
// knows the embedded assets are missing (cargo-install build) and downloads
// the frontend, then reloads. (See src-tauri/src/frontend.rs.)
import("@tauri-apps/api/core")
  .then(({ invoke }) => invoke("frontend_ready"))
  .catch(() => {});
