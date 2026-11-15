# Vara slides, version 2

Built the way the owner's Edge-Care deck was built (one Remotion composition per slide, entrances only, every
slide ending on a complete still frame), with the v2 look and the v2 pitch narration. The rules are the same as for
the version 2 videos: one idea per slide, about ten words at most outside a phone or chart, and the honesty labels.

## Deliverables (on the VM; render outputs never go under `~/proj`)

| File | What it is |
|---|---|
| `~/vidout/slides/vara-slides.pptx` (copy: `video/vara-slides.pptx`) | **The deck.** 18 slides, 16:9, about 2 MB. Each slide is one full-bleed picture of the slide's final frame. The speaker notes hold that slide's narration lines and its honesty notes. Opens in PowerPoint, Keynote, Google Slides and LibreOffice. |
| `~/vidout/slides2/videos/NN-id.mp4` | Optional: one narrated clip per slide (1920 × 1080, 30 fps, h264 + AAC). The slide builds while its narration plays, then holds. Advance by hand. |
| `~/vidout/slides2/vara-slides.mp4` | Optional: the 18 clips joined (about 4:43). |
| `~/vidout/slides2/stills/`, `sheet-final.jpg`, `sheet-mid.jpg`, `manifest.json` | Check images and slide timings. |

## How to present

- **From the .pptx:** present it like any deck and talk over it. The notes hold the narration text, so you can read
  it or speak around it.
- **From the clips:** play each clip and let the narration run. Advance once it has finished: the last frame holds
  for as long as you need. Slide 10 opens on the pay chime alone, so stay quiet until "Order confirmed".

## Slides

| # | Id | On the slide | Narration |
|---|---|---|---|
| 01 | v01-rush | "The rush." · "Then the parcel." · "Thrill gone. Money gone." The shop take plays and fades to grey. | p1 |
| 02 | v02-seven-in-ten | 69% and a grid of 100 dots · 3.6 million transactions · 5 100 customers | p2, sentence 1 |
| 03 | v03-young-payday | 80% aged 18–24 · 96% of dips just before payday, with a pay-cycle strip | p2, sentences 2–3 |
| 04 | v04-tiny-dips | One 39 € purchase, then ×5.9 = the deepest dip | p2, sentences 4–6 |
| 05 | v05-keep-the-money | "A craving problem." · "Trim everyday extras by 5%, and…" · "If the saved money stays put: 72%" / "If it is spent by payday: 15%" fewer days below zero · the replay disclaimer | p3 |
| 06 | v06-crave-mode | Crossed-out pie chart · "We don't fight the craving. We feed it." · **Crave mode** | p4 |
| 07 | v07-built-live | The hero build in real time · "Built live by Gemini · streaming structured output" · true-time stopwatch with the "First product" and "Shop complete" laps (from the take's events) | p5, up to "real retailer" |
| 08 | v08-any-craving | Three montage shops with their cravings and true build times | p5, from "Sushi" |
| 09 | v09-checkout | "The hunt. The basket. The checkout." · "137 € free until payday" chip (read from footage.json) | p6 |
| 10 | v10-plot-twist | Pay, the chime alone, then PLOT TWIST · "Nothing ships." · the price counting into the savings pot | p7, up to "Crave pot" |
| 11 | v11-kept-the-money | "She got the hit. She kept the money." · "Reversible, any time" | rest of p7, then p8 |
| 12 | v12-coach | "Built on Gemini · function calling" · "Never does the maths." · Engine computes · Guard checks | p9 |
| 13 | v13-money-map | The 3D Money Map, then Two Futures (VIZ's visuals) | p10, sentences 1–3 |
| 14 | v14-forecast-warning | Forecast, then early warning | p10, sentence 4 |
| 15 | v15-scorecard | 8 models: 2 ship, 6 experimental | p10, sentences 5–7 |
| 16 | v16-s-mobiili | "Built for S-mobiili" · One engine · One guarded endpoint · Open banking (mock) | p11, sentences 1–4 |
| 17 | v17-criteria | Five criteria, five ticks | p11, sentences 5–8 |
| 18 | v18-motto | Vara · "Helping you save money, a craving at a time." · demo address | p12 |

## Data and rebuilding

Everything on a slide is read from files, never typed in:
- Narration and cue times: `src/v2/audio.json`.
- Footage and prices: `src/v2/footage.json` and `src/timeline.json`.
- Credits: `src/v2/credits.json`.
- Figures: `DECK.md`.

The source is in `src/slides2/` and the entry point is `src/slides2/index.tsx`.

Rebuild after new footage (from `/home/lissan/fin-junction`):
```
bin/vm 'cd ~/proj/video && node scripts/render-slides2.mjs --jpeg ~/vidout/slides/jpg && ~/pptxenv/bin/python scripts/build-pptx.py ~/vidout/slides/jpg ~/vidout/slides/vara-slides.pptx'
bin/pull 'vidout/slides/vara-slides.pptx' video/vara-slides.pptx
bin/vmx 'cd ~/proj/video && node scripts/render-slides2.mjs'            # optional: all clips, the joined video and the sheets
```

`--stills` renders only the final and mid-build PNGs. In the clips and check stills, a red "PROVISIONAL" mark sits on
any slide whose footage was built before the Gemini switch (`build.server.model` in footage.json) or whose narration
does not match the approved text. On slide 12 the mark is cleared by setting `CHAT_REDONE = true` in `coach.tsx`.
The .pptx stills are rendered clean: no provisional marks and no speed labels.
