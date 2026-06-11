"""
Briefcase Descent - pywebview desktop shell.

Hosts the WebGL game (web/dist) in a native window and exposes a tiny Python API
for high-score persistence and fullscreen. All gameplay and rendering run inside
the webview; Python is only the shell + packaging target.

Run (after building the web app):
    cd web && npm install && npm run build
    cd .. && python app.py

Linux note: the default WebKitGTK backend can fall back to *software* WebGL on
weak machines, where the volumetric pass struggles. For reliable GPU-accelerated
WebGL2, prefer the Qt/Chromium backend:
    pip install PyQt6 PyQt6-WebEngine
    BD_GUI=qt python app.py
Windows uses the EdgeChromium (WebView2) backend automatically - no extra deps.
"""

import json
import os
import sys
from pathlib import Path

import webview

APP_NAME = "BriefcaseDescent"
ROOT = Path(__file__).resolve().parent
# PyInstaller unpacks bundled data into sys._MEIPASS at runtime.
BASE = Path(getattr(sys, "_MEIPASS", ROOT))
INDEX = BASE / "web" / "dist" / "index.html"


def data_dir() -> Path:
    """Per-user writable dir for the high-score file."""
    if sys.platform.startswith("win"):
        root = Path(os.environ.get("APPDATA", Path.home() / "AppData" / "Roaming"))
    elif sys.platform == "darwin":
        root = Path.home() / "Library" / "Application Support"
    else:
        root = Path(os.environ.get("XDG_DATA_HOME", Path.home() / ".local" / "share"))
    d = root / APP_NAME
    d.mkdir(parents=True, exist_ok=True)
    return d


class Api:
    """Exposed to JS as window.pywebview.api.* (wired up in M7)."""

    def __init__(self) -> None:
        self._window = None
        self._score_file = data_dir() / "scores.json"

    def bind(self, window) -> None:
        self._window = window

    def load_score(self) -> dict:
        try:
            return json.loads(self._score_file.read_text())
        except (OSError, ValueError):
            return {"best": 0}

    def save_score(self, best) -> bool:
        try:
            best = int(best)
        except (TypeError, ValueError):
            return False
        data = self.load_score()
        if best > data.get("best", 0):
            data["best"] = best
            self._score_file.write_text(json.dumps(data))
        return True

    def toggle_fullscreen(self) -> None:
        if self._window:
            self._window.toggle_fullscreen()

    def quit(self) -> None:
        if self._window:
            self._window.destroy()


def main() -> None:
    if not INDEX.exists():
        sys.exit(
            f"Built web app not found at {INDEX}\n"
            "Build it first:  cd web && npm install && npm run build"
        )

    api = Api()
    window = webview.create_window(
        "Briefcase Descent",
        url=str(INDEX),
        width=1100,
        height=720,
        min_size=(640, 480),
        background_color="#05060a",
        js_api=api,
    )
    api.bind(window)

    gui = os.environ.get("BD_GUI") or None  # 'qt' on Linux for Chromium WebGL
    webview.start(gui=gui, debug=bool(os.environ.get("BD_DEBUG")))


if __name__ == "__main__":
    main()
