#!/usr/bin/env bash
# Kern one-line installer (Linux x86_64).
#
#   curl -fsSL https://raw.githubusercontent.com/AlexanderGese/Kern/main/scripts/curl-install.sh | bash
#
# Downloads the prebuilt binary (with the web frontend embedded — works offline)
# from the latest GitHub release and registers Kern as a desktop app with icon.
set -euo pipefail

REPO="AlexanderGese/Kern"
RAW="https://raw.githubusercontent.com/$REPO/main"
REL="https://github.com/$REPO/releases/latest/download"

BIN_DIR="$HOME/.local/bin"
APPS_DIR="$HOME/.local/share/applications"
ICONS="$HOME/.local/share/icons/hicolor"
BIN="$BIN_DIR/kern"

arch="$(uname -m)"
if [ "$arch" != "x86_64" ]; then
  echo "Kern: prebuilt binaries are x86_64 only (yours: $arch)."
  echo "Build from source instead: https://github.com/$REPO#install"
  exit 1
fi

say() { printf "\033[36m==>\033[0m %s\n" "$*"; }

say "Downloading Kern binary…"
mkdir -p "$BIN_DIR"
curl -fSL --progress-bar "$REL/kern-linux-x86_64" -o "$BIN"
chmod +x "$BIN"

say "Installing icons…"
mkdir -p "$ICONS/32x32/apps" "$ICONS/128x128/apps" "$ICONS/256x256/apps"
curl -fsSL "$RAW/src-tauri/icons/32x32.png"      -o "$ICONS/32x32/apps/kern.png"   || true
curl -fsSL "$RAW/src-tauri/icons/128x128.png"    -o "$ICONS/128x128/apps/kern.png" || true
curl -fsSL "$RAW/src-tauri/icons/128x128@2x.png" -o "$ICONS/256x256/apps/kern.png" || true

say "Installing desktop launcher…"
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

say "Done — launch \"Kern\" from your app menu, or run: $BIN"
case ":$PATH:" in
  *":$BIN_DIR:"*) ;;
  *) echo "    (add $BIN_DIR to your PATH to run 'kern' from a terminal)";;
esac
