#!/usr/bin/env bash
# Joins the numbered slide clips into one video and checks the result.
#   scripts/finish.sh <out dir with videos/NN-*.mp4>      (default ~/vidout/final)
# Writes <out>/vara-pitch.mp4 and <out>/verification.json. Needs ffmpeg and ffprobe.
set -euo pipefail
OUT=${1:-$HOME/vidout/final}
cd "$OUT"
ls videos/[0-9][0-9]-*.mp4 >/dev/null
: > concat.txt
for f in videos/[0-9][0-9]-*.mp4; do echo "file '$PWD/$f'" >> concat.txt; done
# Re-encode rather than stream-copy: clip boundaries then carry no timestamp gaps in the audio.
ffmpeg -hide_banner -loglevel error -y -f concat -safe 0 -i concat.txt \
  -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p -r 30 -g 60 \
  -c:a aac -b:a 192k -ar 48000 -ac 2 -movflags +faststart vara-pitch.mp4
python3 - <<'PY'
import json, subprocess, glob, os
def probe(p):
    j = json.loads(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration,size:stream=codec_name,codec_type,width,height,r_frame_rate,pix_fmt,sample_rate,channels", "-of", "json", p]))
    v = next(s for s in j["streams"] if s["codec_type"] == "video"); a = next((s for s in j["streams"] if s["codec_type"] == "audio"), None)
    return {"file": os.path.basename(p), "seconds": round(float(j["format"]["duration"]), 2), "bytes": int(j["format"]["size"]), "video": f'{v["codec_name"]} {v["width"]}x{v["height"]} {v["r_frame_rate"]} {v["pix_fmt"]}', "audio": f'{a["codec_name"]} {a["sample_rate"]} Hz {a["channels"]} ch' if a else None}
clips = [probe(p) for p in sorted(glob.glob("videos/[0-9][0-9]-*.mp4"))]
full = probe("vara-pitch.mp4")
loud = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", "vara-pitch.mp4", "-af", "ebur128=peak=true", "-f", "null", "-"], capture_output=True, text=True).stderr
tail = loud[loud.rfind("Summary:"):]
num = lambda key: float(tail.split(key)[1].split()[0]) if key in tail else None
full["integrated_lufs"] = num("I:"); full["true_peak_db"] = num("Peak:")
decode = subprocess.run(["ffmpeg", "-v", "error", "-i", "vara-pitch.mp4", "-f", "null", "-"], capture_output=True, text=True).stderr.strip()
ok = (all(c["video"].startswith("h264 1920x1080 30/1 yuv420p") and c["audio"] for c in clips) and full["video"].startswith("h264 1920x1080 30/1 yuv420p")
      and abs(full["seconds"] - sum(c["seconds"] for c in clips)) < 1.0 and not decode)
json.dump({"ok": ok, "full": full, "clips": clips, "clips_total_seconds": round(sum(c["seconds"] for c in clips), 2), "decode_errors": decode[:500]}, open("verification.json", "w"), indent=2)
print("OK" if ok else "CHECK FAILED", full)
PY
