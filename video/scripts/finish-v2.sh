#!/usr/bin/env bash
# Version 2: normalises the two rendered videos and checks them.
#   scripts/finish-v2.sh <out dir>        (default ~/vidout/v2; reads <out>/raw/demo-v2.mp4 and <out>/raw/pitch-v2.mp4
#                                          from scripts/render-v2.mjs)
# Writes <out>/vara-demo.mp4, <out>/vara-pitch.mp4, poster-demo.jpg, poster-pitch.jpg (audio normalised to -16 LUFS, true peak under -1 dBTP, picture
# copied untouched) and <out>/verification.json. Exits non-zero with a clear message if the demo is 120 s or longer,
# the pitch 300 s or longer, either is not h264 1920x1080 30 fps yuv420p with stereo AAC, the loudness is off target,
# or the file has decode errors. Needs ffmpeg and ffprobe.
set -euo pipefail
#   ONLY=demo|pitch scripts/finish-v2.sh <out dir>   finishes and checks one film alone (verification-<film>.json)
OUT=${1:-$HOME/vidout/v2}
ONLY=${ONLY:-}
cd "$OUT"
IDS="demo-v2 pitch-v2"; [ -n "$ONLY" ] && IDS="$ONLY-v2"
for id in $IDS; do [ -f "raw/$id.mp4" ] || { echo "FAIL: missing $OUT/raw/$id.mp4 (run scripts/render-v2.mjs first)" >&2; exit 1; }; done

norm() {  # norm <in> <out>: two-pass EBU R128 loudness normalisation, linear (no dynamic compression)
  local in=$1 out=$2 TARGET="I=-16:TP=-1.5:LRA=20"
  local m; m=$(ffmpeg -hide_banner -nostats -i "$in" -vn -af "loudnorm=$TARGET:print_format=json" -f null - 2>&1 | sed -n '/^{/,/^}/p')
  local get; get() { python3 -c "import json,sys; print(json.loads(sys.argv[1])[sys.argv[2]])" "$m" "$1"; }
  ffmpeg -hide_banner -loglevel error -y -i "$in" -map 0:v:0 -map 0:a:0 -c:v copy \
    -af "loudnorm=$TARGET:measured_I=$(get input_i):measured_TP=$(get input_tp):measured_LRA=$(get input_lra):measured_thresh=$(get input_thresh):offset=$(get target_offset):linear=true,aresample=48000" \
    -c:a aac -b:a 256k -ar 48000 -ac 2 -movflags +faststart "$out"
}
[ "$ONLY" = pitch ] || norm raw/demo-v2.mp4 vara-demo.mp4
[ "$ONLY" = demo ] || norm raw/pitch-v2.mp4 vara-pitch.mp4

# posters for the viewing page: the finished shop (end of d2) and the Crave mode title (end of p4), from the plans
poster_at() { python3 -c "import json,sys; p=json.load(open(sys.argv[1])); s=next(k for k in p['scenes'] if k['id']==sys.argv[2]); print(round(s['start']+s['length']-0.4,2))" "$1" "$2" 2>/dev/null || echo 10; }
[ "$ONLY" = pitch ] || ffmpeg -v error -y -ss "$(poster_at demo-v2-plan.json d2)" -i vara-demo.mp4 -frames:v 1 -q:v 3 poster-demo.jpg
[ "$ONLY" = demo ] || ffmpeg -v error -y -ss "$(poster_at pitch-v2-plan.json p4)" -i vara-pitch.mp4 -frames:v 1 -q:v 3 poster-pitch.jpg

ONLY="$ONLY" python3 - <<'PY'
import json, os, subprocess, sys
ONLY = os.environ.get("ONLY") or ""
LIMITS = {k: v for k, v in {"vara-demo.mp4": 120, "vara-pitch.mp4": 300}.items() if not ONLY or ONLY in k}   # each video must be shorter than this, in seconds
def probe(p):
    j = json.loads(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration,size:stream=codec_name,codec_type,width,height,r_frame_rate,pix_fmt,sample_rate,channels", "-of", "json", p]))
    v = next(s for s in j["streams"] if s["codec_type"] == "video"); a = next((s for s in j["streams"] if s["codec_type"] == "audio"), None)
    d = {"file": p, "seconds": round(float(j["format"]["duration"]), 3), "bytes": int(j["format"]["size"]),
         "video": f'{v["codec_name"]} {v["width"]}x{v["height"]} {v["r_frame_rate"]} {v["pix_fmt"]}',
         "audio": f'{a["codec_name"]} {a["sample_rate"]} Hz {a["channels"]} ch' if a else None}
    loud = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", p, "-af", "ebur128=peak=true", "-f", "null", "-"], capture_output=True, text=True).stderr
    tail = loud[loud.rfind("Summary:"):]
    num = lambda key: float(tail.split(key)[1].split()[0]) if key in tail else None
    d["integrated_lufs"] = num("I:"); d["true_peak_dbtp"] = num("Peak:")
    d["decode_errors"] = subprocess.run(["ffmpeg", "-v", "error", "-i", p, "-f", "null", "-"], capture_output=True, text=True).stderr.strip()[:500]
    return d
res, problems = {}, []
for f, limit in LIMITS.items():
    d = res[f] = probe(f)
    if d["seconds"] >= limit: problems.append(f"{f} is {d['seconds']} s: it must be under {limit} s")
    if d["video"] != "h264 1920x1080 30/1 yuv420p": problems.append(f"{f}: video is {d['video']}, expected h264 1920x1080 30/1 yuv420p")
    if not d["audio"] or not d["audio"].startswith("aac") or not d["audio"].endswith("2 ch"): problems.append(f"{f}: audio is {d['audio']}, expected stereo AAC")
    if d["integrated_lufs"] is None or abs(d["integrated_lufs"] + 16) > 1.0: problems.append(f"{f}: integrated loudness {d['integrated_lufs']} LUFS, expected -16 ± 1")
    if d["true_peak_dbtp"] is None or d["true_peak_dbtp"] >= -1.0: problems.append(f"{f}: true peak {d['true_peak_dbtp']} dBTP, must be under -1")
    if d["decode_errors"]: problems.append(f"{f}: decode errors: {d['decode_errors'][:200]}")
ok = not problems
json.dump({"ok": ok, "problems": problems, "limits_seconds": {"demo": 120, "pitch": 300}, "demo": res.get("vara-demo.mp4"), "pitch": res.get("vara-pitch.mp4")},
          open(f"verification-{ONLY}.json" if ONLY else "verification.json", "w"), indent=2)
for f, d in res.items(): print(f"{f}: {d['seconds']} s, {d['video']}, {d['audio']}, {d['integrated_lufs']} LUFS, true peak {d['true_peak_dbtp']} dBTP")
if not ok:
    print("FAIL:\n  " + "\n  ".join(problems), file=sys.stderr); sys.exit(1)
print("OK")
PY
