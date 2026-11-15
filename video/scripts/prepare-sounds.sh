#!/usr/bin/env bash
# Converts the app's own synthesised sounds (WAV, rendered from app/src/features/crave/sfx.ts by
# scripts/record-app.mjs) to AAC for the slides. Short sounds are peak-levelled, not loudness-matched:
# the pay chime peaks at -5 dBFS so it sits just under the narrator (-16 LUFS), the others at -10 dBFS.
#   scripts/prepare-sounds.sh <dir with chime.wav [pop.wav coins.wav]> <out dir>
set -euo pipefail
SRC=${1:?dir with the wav files}; OUT=${2:?out dir}; mkdir -p "$OUT"
level() { # file target-peak-dB
  local peak; peak=$(ffmpeg -hide_banner -nostats -i "$1" -af volumedetect -f null - 2>&1 | awk '/max_volume/{print $5}')
  awk -v p="$peak" -v t="$2" 'BEGIN{printf "%.2f", t - p}'
}
for pair in chime:-5 pop:-10 coins:-10; do
  name=${pair%%:*}; target=${pair##*:}
  [ -f "$SRC/$name.wav" ] || continue
  gain=$(level "$SRC/$name.wav" "$target")
  ffmpeg -hide_banner -loglevel error -y -i "$SRC/$name.wav" -af "volume=${gain}dB,apad=pad_dur=0.25" -ar 48000 -ac 2 -c:a aac -b:a 192k "$OUT/$name.m4a"
  echo "$name.m4a gain ${gain} dB"
done
