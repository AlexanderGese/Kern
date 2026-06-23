#!/usr/bin/env bash
# Kern — proper per-user install (Linux). Builds the app (frontend + binary) and
# registers it as a desktop application with an icon.
#
# NOTE: `cargo install kern-code` does NOT work for the GUI — crates.io can't
# carry the bundled web frontend, so that binary renders a black window. Use
# this script (or the .deb/.rpm from the GitHub Releases) instead.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

BIN_DIR="$HOME/.local/bin"
APPS_DIR="$HOME/.local/share/applications"
ICONS="$HOME/.local/share/icons/hicolor"
BIN="$BIN_DIR/kern"

echo "==> Installing JS deps"
command -v pnpm >/dev/null || { echo "pnpm is required (npm i -g pnpm)"; exit 1; }
pnpm install --frozen-lockfile || pnpm install

echo "==> Building Kern (frontend + release binary)"
CI=false pnpm tauri build --no-bundle

echo "==> Installing binary -> $BIN"
mkdir -p "$BIN_DIR"
install -m755 src-tauri/target/release/kern "$BIN"

echo "==> Installing icons"
for s in 32x32 128x128; do
  mkdir -p "$ICONS/$s/apps"
  cp "src-tauri/icons/$s.png" "$ICONS/$s/apps/kern.png"
done
mkdir -p "$ICONS/256x256/apps"
cp "src-tauri/icons/128x128@2x.png" "$ICONS/256x256/apps/kern.png"

echo "==> Installing desktop launcher"
mkdir -p "$APPS_DIR"
cat > "$APPS_DIR/Kern.desktop" <<DESK
[Desktop Entry]
Type=Application
Name=Kern
GenericName=Code Editor
Comment=Get to the Kern of things.
Exec=$BIN %F
Icon=kern
Terminal=false
Categories=Development;TextEditor;IDE;Utility;
Keywords=code;editor;text;programming;developer;
StartupWMClass=kern
MimeType=text/plain;text/x-python;text/x-csrc;application/json;text/markdown;
DESK
chmod +x "$APPS_DIR/Kern.desktop"

update-desktop-database "$APPS_DIR" 2>/dev/null || true
gtk-update-icon-cache -f -t "$ICONS" 2>/dev/null || true

echo "==> Done. Launch from your app menu (search \"Kern\") or run: kern"
case ":$PATH:" in *":$BIN_DIR:"*) ;; *) echo "   (add $BIN_DIR to your PATH to run 'kern' from a terminal)";; esac
