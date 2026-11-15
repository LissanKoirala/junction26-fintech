# Vara videos (Remotion)

Two narrated films for the Junction 2026 submission, version 2 (the brief and the approved script are in `V2.md`):

- `vara-demo.mp4`, the demo video (1:50): Crave mode live, a shop built from nothing for one craving, the hunt,
  the pay sheet and the twist, then the Gemini coach and the models underneath.
- `vara-pitch.mp4`, the pitch video (3:53): the thrill first, then why (the problem in the challenge data), then what
  we built: Crave mode live, the twist, why it is honest, the Gemini coach and the eight models, and how it fits S-mobiili.

Each is ONE continuous Remotion composition (`demo-v2`, `pitch-v2`, 1920 × 1080, 30 fps) with its own mix: narration,
an original music bed that ducks under the voice and stops dead for the pay chime, effects on the cuts, and the
app's own sounds on the recording's events. Version 1 (fourteen slides, `src/slides/`, `src/deck.ts`,
`scripts/render-all.mjs`, `scripts/finish.sh`) is still in the project and still renders, but is no longer published.

Live: https://vara-junction26.swedencentral.cloudapp.azure.com/video/

| Path | What it is |
|---|---|
| `V2.md` | The brief: rules (pace, density, honesty), who owns what, the approved script scene by scene |
| `SOURCES.md` | The only facts and figures the videos may use, and where each comes from |
| `DECK.md` | Version 1's fourteen-slide deck (kept for its figures; its stack lines predate the app's switch to Gemini) |
| `vara-slides.pptx` | The pitch as a PowerPoint deck, linked from the viewing page and copied by `publish.sh` |
| `narration-v2.json` | The approved narration lines (source text) |
| `src/v2/audio.json` | Narration files with sentence and word times, the music bed (tempo, sections), the effects |
| `src/v2/footage.json`, `src/v2/facts.json` | The live recordings' event times, and the measured build times |
| `src/v2/credits.json` | The on-screen model credits (the shop's text by Gemini, the photos by a separate image model, the coach): one place to change the wording |
| `src/v2/mlslot.tsx`, `src/v2/ml/` | Slots that place the model visuals (VIZ's components in `ml/`) full frame on their sentences |
| `src/v2/twist.tsx` | The cold open, the hunt and pay ritual, and the plot twist |
| `src/v2/timeline.ts` | Where each scene sits: derived from the narration (lines 0.2 s apart; the silent pay beat) |
| `src/v2/data.ts` | Typed loaders for the three JSON files; music-only holds; tightening of long pauses |
| `src/v2/kit.tsx`, `acts.tsx`, `proofs.tsx` | Building blocks: phone take at a stated speed, stopwatch, chips, kinetic type, labels |
| `src/v2/Demo.tsx`, `src/v2/Pitch.tsx` | The two films |
| `src/v2/Mix.tsx` | Narration, music placement and ducking, riser, impact, final hit |
| `public/v2/live/`, `public/v2/audio/` | The version 2 recordings, narration, music and effects |
| `public/live/`, `public/audio/` | Version 1 recordings (reused for the coach and the models) and the app's own sounds |
| `scripts/render-v2.mjs` | Renders the two compositions, stills, single audio stems, and writes each film's plan |
| `scripts/finish-v2.sh` | Normalises the audio to −16 LUFS and checks both files (fails on a limit or format problem) |
| `scripts/publish.sh` | Copies the two films, their posters, the slides and `site/index.html` to the demo server's `/video/` |
| `PRESENTER-NOTES.md` | The two scripts as voiced, scene by scene, with start times, and the honesty notes |
| `site/index.html` | The viewing page: both films, their lengths, the slides download, the honest notes |

## Rebuild

Needs Node.js 22, ffmpeg and ffprobe, and glibc 2.35 or newer (Remotion's encoder). The team renders on the
project's Azure VM (32 cores: both films in about four minutes), never on the small development machine.

```sh
npm ci
npx tsc --noEmit
node scripts/render-v2.mjs --out ~/vidout/v2                       # raw/demo-v2.mp4, raw/pitch-v2.mp4 (+ plans)
node scripts/render-v2.mjs --only demo-v2 --at 5,14.5 --out ~/vidout/check   # quick stills at chosen seconds
node scripts/render-v2.mjs --stem vo --out ~/vidout/v2              # optional: narration / music stems for level checks
scripts/finish-v2.sh ~/vidout/v2                                   # vara-demo.mp4, vara-pitch.mp4, posters, verification.json
scripts/publish.sh ~/vidout/v2                                     # on the demo server only
```

Changing a line: re-voice it (AUDIO's `scripts/narrate-v2.py`, which rewrites `src/v2/audio.json`), then render again:
every scene length, cut and on-screen word follows the new timings. Changing the recording: re-record with
`scripts/record-v2.mjs` (it rewrites `src/v2/footage.json` and `facts.json`); cuts inside the take are defined by
its event labels, never by seconds. Source ranges listed under a clip's `avoid` in `footage.json` (for example a
frame resembling a real trademark) are never shown: every take cuts across them.

## What is real and what is not

- Product footage is recorded from the live prototype with the synthetic demo customer ("Aino" is a
  fictional name). The shop builds are real and uncached; every sped-up stretch is labelled "×N speed", and the
  build stopwatch always shows the true elapsed time ("First product" = the take's `shop-open` event, "Shop complete"
  = `shop-visible`, both counted from `submitted`). Money movement in the prototype is simulated.
- The shop's text is written live by Gemini (Gemini 3.5 Flash-Lite, streaming structured output); its photos come
  from a separate image model; the coach answers with Gemini and function calling, and the weekly check-in is written
  by Gemini with structured output. Each credit appears on screen only over footage recorded on the Gemini app
  (`model` in `footage.json` / `timeline.json`). The eight ML models are the team's own, trained on the challenge data.
- "Waiting time shortened" appears only while the footage on screen crosses a cut the recording itself made
  (`cut` in `timeline.json`).
- The pay chime is the app's own sound, synthesised in `app/src/features/crave/sfx.ts`; no third-party audio.
- The narrator is a synthetic voice; the music and the effects are original generated audio.
- Every figure is from the challenge's synthetic dataset or the app's model cards: see `SOURCES.md`.
- Vara is a Junction 2026 concept, not an official S-Pankki product. No S-Pankki logo or font is used.
