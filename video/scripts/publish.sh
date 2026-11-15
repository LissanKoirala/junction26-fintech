#!/usr/bin/env bash
# Copies the two version 2 videos, their posters and the viewing page to the demo server's /video/ folder,
# and removes version 1's per-slide clips and stills from it.
# Run on the server:  scripts/publish.sh <out dir>   (default ~/vidout/v2, as written by scripts/finish-v2.sh)
set -euo pipefail
OUT=${1:-$HOME/vidout/v2}
HERE=$(cd "$(dirname "$0")/.." && pwd)
DEST=/srv/vara/video
for f in vara-demo.mp4 vara-pitch.mp4 poster-demo.jpg poster-pitch.jpg verification.json; do
  [ -f "$OUT/$f" ] || { echo "missing $OUT/$f (run scripts/finish-v2.sh first)" >&2; exit 1; }
done
python3 -c "import json,sys; v=json.load(open(sys.argv[1])); sys.exit(0 if v['ok'] else 1)" "$OUT/verification.json" \
  || { echo "verification.json says the videos failed their checks; not publishing" >&2; exit 1; }
sudo mkdir -p "$DEST"
sudo cp "$OUT/vara-demo.mp4" "$OUT/vara-pitch.mp4" "$OUT/poster-demo.jpg" "$OUT/poster-pitch.jpg" "$DEST/"
sudo cp "$HERE/site/index.html" "$DEST/index.html"
sudo rm -rf "$DEST/clips" "$DEST/stills" "$DEST/vara-pitch-short.mp4"   # version 1's per-slide clips and stills
sudo chmod -R a+rX "$DEST"
du -sh "$DEST"; ls -la "$DEST"
