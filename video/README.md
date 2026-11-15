# Vara pitch deck (Remotion)

Fourteen slides, each a separate Remotion composition, rendered to numbered 1920 × 1080, 30 fps MP4s and
joined into two narrated videos: the pitch video `vara-pitch.mp4` (all fourteen, 4 min 55 s) and the demo
video `vara-demo.mp4` (1 min 53 s: slide 04 with its own opening line, then 05, 07, 08 and 14). Modelled on the team's Edge-Care deck: entrance-only motion, every clip ends
on a complete still frame, a narrator on every slide, live recordings of the prototype in device frames.

Live: https://vara-junction26.swedencentral.cloudapp.azure.com/video/

| Path | What it is |
|---|---|
| `DECK.md` | The slide-by-slide spec, the rules, and the only figures the deck may use |
| `narration.json` | Narrator lines (source text) |
| `src/deck.ts` | Slide order, ids and lengths; `extras` holds the demo's version of slide 04 (`d04-meet`) |
| `src/kit.tsx`, `src/theme.ts` | Shared components and the app's colours |
| `src/slides/*.tsx` | The slides |
| `src/timeline.json` | Event times inside each live recording (made by the recorder) |
| `public/live/` | Recordings of the live prototype (no sound) |
| `public/shots/` | Screenshots of the live prototype |
| `public/audio/` | Narration (`n-*.m4a`) and the app's own sounds (`chime.m4a` …) |
| `scripts/record-app.mjs` | Records the prototype with Playwright and renders the app's sounds |
| `scripts/narrate.py` | Voices `narration.json` with ElevenLabs |
| `scripts/render-all.mjs` | Renders clips (the fourteen numbered, plus `d04-meet.mp4`), or stills of chosen frames |
| `scripts/finish.sh` | Joins the clips into `vara-pitch.mp4` and `vara-demo.mp4` and verifies them (fails if the pitch is 5:00 or longer, or the demo 2:00 or longer) |
| `scripts/publish.sh` | Copies the result to the demo server's `/video/` |
| `site/index.html` | The viewing page |
| `videos/`, `stills/`, `vara-pitch.mp4`, `vara-demo.mp4` | The rendered result |
| `PRESENTER-NOTES.md`, `SLIDES.md`, `SOURCES.md` | For presenting: what plays when, and where every figure comes from |

## Rebuild

Needs Node.js 22, ffmpeg and ffprobe, and glibc 2.35 or newer (Remotion's encoder). The team renders on the
project's Azure VM, never on the small development machine.

```sh
npm ci
node scripts/render-all.mjs --out ~/vidout/final          # all 14 clips and d04-meet, a few minutes on 32 cores
node scripts/render-all.mjs --only s05-chat --frames 45,240,-1 --out ~/vidout/check   # quick stills
scripts/finish.sh ~/vidout/final                           # vara-pitch.mp4, vara-demo.mp4 + verification.json
scripts/publish.sh ~/vidout/final                          # on the demo server only
```

Narration: `ELEVENLABS_API_KEY=… python3 scripts/narrate.py <out dir>` voices any line whose MP3 is missing
(delete one to re-voice it), loudness-matches everything to −16 LUFS and writes the measured lengths. Copy
the `.m4a` files to `public/audio/` and the JSON to `src/narration.json`. Only the narration text is sent.

Recordings: `cd app && node ../video/scripts/record-app.mjs` (see the header of that file) against the
live prototype; then `scripts/prepare-sounds.sh` for the app's sounds.

## What is real and what is not

- Product footage is recorded from the live prototype with the synthetic demo customer ("Aino" is a
  fictional name). Where a wait for the AI was shortened, the slide's badge says so.
- The pay chime is the app's own sound, synthesised in `app/src/features/crave/sfx.ts`; no third-party audio.
- The narrator is a synthetic voice.
- Every figure is from the challenge's synthetic dataset or the app's model cards: see `SOURCES.md`.
- Vara is a Junction 2026 concept, not an official S-Pankki product. No S-Pankki logo or font is used.
