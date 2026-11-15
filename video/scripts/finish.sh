#!/usr/bin/env bash
# Joins the slide clips into the two submission videos and checks them.
#   scripts/finish.sh <out dir with videos/NN-*.mp4 and videos/d04-meet.mp4>      (default ~/vidout/final)
# Writes <out>/vara-pitch.mp4 (all fourteen slides; must be under 5:00), <out>/vara-demo.mp4 (the product demo:
# d04-meet, the demo's version of slide 04 with its own opening line, then 05, 07, 08 and 14; must be under 2:00)
# and <out>/verification.json. Exits non-zero if a check fails or a video is too long. Needs ffmpeg and ffprobe.
set -euo pipefail
OUT=${1:-$HOME/vidout/final}
cd "$OUT"
DEMO=(videos/d04-meet.mp4 videos/05-*.mp4 videos/07-*.mp4 videos/08-*.mp4 videos/14-*.mp4)
ls videos/[0-9][0-9]-*.mp4 "${DEMO[@]}" >/dev/null
rm -f vara-pitch-short.mp4 concat-short.txt   # the old short cut, replaced by the demo video
join() {  # join <list file> <output>: re-encode rather than stream-copy, so clip boundaries carry no timestamp gaps in the audio
  ffmpeg -hide_banner -loglevel error -y -f concat -safe 0 -i "$1" \
    -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p -r 30 -g 60 \
    -c:a aac -b:a 192k -ar 48000 -ac 2 -movflags +faststart "$2"
}
: > concat.txt
for f in videos/[0-9][0-9]-*.mp4; do echo "file '$PWD/$f'" >> concat.txt; done
join concat.txt vara-pitch.mp4
: > concat-demo.txt
for f in "${DEMO[@]}"; do echo "file '$PWD/$f'" >> concat-demo.txt; done
join concat-demo.txt vara-demo.mp4
DEMO_FILES="${DEMO[*]}" python3 - <<'PY'
import json, subprocess, glob, os, sys
PITCH_LIMIT, DEMO_LIMIT = 300, 120   # submission limits in seconds: each video must be shorter
def probe(p):
    j = json.loads(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration,size:stream=codec_name,codec_type,width,height,r_frame_rate,pix_fmt,sample_rate,channels", "-of", "json", p]))
    v = next(s for s in j["streams"] if s["codec_type"] == "video"); a = next((s for s in j["streams"] if s["codec_type"] == "audio"), None)
    return {"file": os.path.basename(p), "seconds": round(float(j["format"]["duration"]), 2), "bytes": int(j["format"]["size"]), "video": f'{v["codec_name"]} {v["width"]}x{v["height"]} {v["r_frame_rate"]} {v["pix_fmt"]}', "audio": f'{a["codec_name"]} {a["sample_rate"]} Hz {a["channels"]} ch' if a else None}
def loudness(d, p):
    loud = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", p, "-af", "ebur128=peak=true", "-f", "null", "-"], capture_output=True, text=True).stderr
    tail = loud[loud.rfind("Summary:"):]
    num = lambda key: float(tail.split(key)[1].split()[0]) if key in tail else None
    d["integrated_lufs"] = num("I:"); d["true_peak_db"] = num("Peak:")
    d["decode_errors"] = subprocess.run(["ffmpeg", "-v", "error", "-i", p, "-f", "null", "-"], capture_output=True, text=True).stderr.strip()[:500]
good = lambda c: c["video"].startswith("h264 1920x1080 30/1 yuv420p") and bool(c["audio"])
clips = [probe(p) for p in sorted(glob.glob("videos/[0-9][0-9]-*.mp4"))]
demo_clips = [probe(p) for p in os.environ["DEMO_FILES"].split()]
pitch, demo = probe("vara-pitch.mp4"), probe("vara-demo.mp4")
loudness(pitch, "vara-pitch.mp4"); loudness(demo, "vara-demo.mp4")
problems = []
if len(clips) != 14: problems.append(f"expected 14 numbered clips, found {len(clips)}")
for c in clips + demo_clips + [pitch, demo]:
    if not good(c): problems.append(f"{c['file']}: not h264 1920x1080 30 fps yuv420p with audio ({c['video']}, {c['audio']})")
for v, parts in ((pitch, clips), (demo, demo_clips)):
    if abs(v["seconds"] - sum(c["seconds"] for c in parts)) >= 1.0: problems.append(f"{v['file']}: {v['seconds']} s, but its clips add up to {sum(c['seconds'] for c in parts):.2f} s")
    if v["decode_errors"]: problems.append(f"{v['file']}: decode errors")
if pitch["seconds"] >= PITCH_LIMIT: problems.append(f"vara-pitch.mp4 is {pitch['seconds']} s: the pitch video must be under {PITCH_LIMIT} s")
if demo["seconds"] >= DEMO_LIMIT: problems.append(f"vara-demo.mp4 is {demo['seconds']} s: the demo video must be under {DEMO_LIMIT} s")
ok = not problems
json.dump({"ok": ok, "problems": problems, "limits_seconds": {"pitch": PITCH_LIMIT, "demo": DEMO_LIMIT}, "pitch": pitch, "demo": demo,
           "clips": clips, "demo_clips": demo_clips, "clips_total_seconds": round(sum(c["seconds"] for c in clips), 2)}, open("verification.json", "w"), indent=2)
print(f"pitch {pitch['seconds']} s (limit < {PITCH_LIMIT}), demo {demo['seconds']} s (limit < {DEMO_LIMIT})")
if not ok:
    print("CHECK FAILED:\n  " + "\n  ".join(problems), file=sys.stderr); sys.exit(1)
print("OK")
PY
