#!/usr/bin/env python3
"""Narration for the deck, made with ElevenLabs (same narrator voice and settings as the Edge-Care deck).

  ELEVENLABS_API_KEY=... python3 scripts/narrate.py <out dir> [--only id,id]

Reads narration.json. For each line writes <out>/n-<id>.mp3 (as returned) and <out>/n-<id>.m4a
(loudness-matched to -16 LUFS, true peak -1.5 dB), then <out>/narration.json with the measured seconds.
An existing mp3 is reused: delete it to re-voice that line. Only the narration text is sent to ElevenLabs.
Needs ffmpeg and ffprobe on PATH. Standard library only.
"""
import json, os, pathlib, subprocess, sys, time, urllib.error, urllib.request

VOICE = "O4fnkotIypvedJqBp4yb"
MODEL = "eleven_multilingual_v2"
SETTINGS = {"stability": 0.5, "similarity_boost": 0.75, "style": 0.15, "speed": 1.12}

root = pathlib.Path(__file__).resolve().parent.parent
out = pathlib.Path(sys.argv[1]).expanduser()
out.mkdir(parents=True, exist_ok=True)
only = sys.argv[sys.argv.index("--only") + 1].split(",") if "--only" in sys.argv else None
lines = json.loads((root / "narration.json").read_text())
key = os.environ.get("ELEVENLABS_API_KEY", "")

def seconds(path):
    return float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", str(path)]))

results = []
for line in lines:
    mp3, m4a = out / f"n-{line['id']}.mp3", out / f"n-{line['id']}.m4a"
    if (only is None or line["id"] in only) and not mp3.exists():
        if not key:
            sys.exit("ELEVENLABS_API_KEY is not set")
        req = urllib.request.Request(
            f"https://api.elevenlabs.io/v1/text-to-speech/{VOICE}?output_format=mp3_44100_128",
            data=json.dumps({"text": line["text"], "model_id": MODEL, "voice_settings": SETTINGS}).encode(),
            headers={"xi-api-key": key, "Content-Type": "application/json"},
        )
        for attempt in range(4):
            try:
                with urllib.request.urlopen(req, timeout=120) as r:
                    mp3.write_bytes(r.read())
                break
            except urllib.error.HTTPError as e:
                if attempt == 3:
                    sys.exit(f"ElevenLabs refused line {line['id']}: {e.code} {e.read().decode()[:300]}")
                time.sleep(3)
        if m4a.exists():
            m4a.unlink()
    if mp3.exists() and not m4a.exists():
        subprocess.check_call(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(mp3), "-af", "loudnorm=I=-16:TP=-1.5:LRA=11", "-ar", "48000", "-c:a", "aac", "-b:a", "192k", str(m4a)])
    if m4a.exists():
        results.append({**line, "file": m4a.name, "seconds": round(seconds(m4a), 2)})
        print(f"{line['id']:14s} {results[-1]['seconds']:6.2f} s", flush=True)
(out / "narration.json").write_text(json.dumps(results, indent=2, ensure_ascii=False) + "\n")
print("total", round(sum(r["seconds"] for r in results), 1), "s")
