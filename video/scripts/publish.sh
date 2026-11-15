#!/usr/bin/env bash
# Copies the two videos, clips, stills and the viewing page to the demo server's /video/ folder.
# Run on the server:  scripts/publish.sh <out dir>   (default ~/vidout/final)
set -euo pipefail
OUT=${1:-$HOME/vidout/final}
HERE=$(cd "$(dirname "$0")/.." && pwd)
DEST=/srv/vara/video
sudo mkdir -p "$DEST/clips" "$DEST/stills"
sudo cp "$OUT/vara-pitch.mp4" "$OUT/vara-demo.mp4" "$DEST/"
sudo rm -f "$DEST/vara-pitch-short.mp4"   # the old short cut, replaced by vara-demo.mp4
sudo cp "$OUT"/videos/[0-9][0-9]-*.mp4 "$DEST/clips/"
sudo cp "$OUT"/stills/[0-9][0-9]-*-final.png "$DEST/stills/"
sudo cp "$HERE/site/index.html" "$DEST/index.html"
sudo chmod -R a+rX "$DEST"
du -sh "$DEST"
