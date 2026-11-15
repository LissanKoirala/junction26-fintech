# How we made the Vara videos: a playbook for the next project

Written on 15 November 2026, after the second version of the two-minute demo video
(`vara-demo.mp4`, 1:50) was judged "the best ever" by the project owner. The first version was
rejected as "boring and slow and NO wow factor whatsoever". This file records what changed between
the two, and how to get there directly next time.

It covers a hackathon-style product video built with Remotion: a narrated film cut from recordings
of a live prototype, with kinetic type, music, effects and a few data visuals. The sources it
refers to are in this folder (`V2.md`, `src/v2/`, `scripts/`).

## The short version

1. **Agree the script before building anything.** Words first, approval, then pictures.
2. **Open on the feeling and the why, not on the product.** Then show what was built.
3. **One idea per screen, cut continuously.** No slide that holds while the narrator finishes.
4. **Show the wow moment happening for real**, at real speed, with a stopwatch reading true times.
5. **Drive every timing and every figure from data files**, never from numbers typed into a scene.
6. **Music from the first frame, effects on the beats that matter**, and one deliberate silence.
7. **Check by looking**: contact sheets of every second, read by someone other than the builder.

## What went wrong the first time

The first version was fourteen narrated slides: a title, a line of narration, a still hold, the
next slide. No music. The most original feature arrived at 2:16. Each slide carried several facts.
It was accurate and it was dull.

The owner's corrections, in their words, are the brief for any future video:

- "emphasis our cravings portion and demo how an website gets built instantly on the fly"
- "remove the akward gaps in between the sentences and slides"
- "add background music and effects to build momentum"
- "dont make slides/features too dense for one slide"
- "start with the thrill start with the why and then show what we did"
- "be super engertic about it and show the plot twist kinda animation"
- "make it seem like it feels like the actual experience, no need to keep pointing out the customer
  knows its fake as it defeats the purpose, its already implied"
- "it should be clear in the demo that it uses the whatever gemini feature it is"

## Story

The order that worked, for a two-minute film:

| Part | Seconds | What happens |
|---|---|---|
| The feeling | 0–14 | "You know the feeling." Scroll, compare, buy, the rush; then the parcel, thrill gone, money gone. Ends on a question. |
| The build | 14–37 | Meet the person. She asks; the product builds something live while a stopwatch runs. The technology is named on screen. |
| Variety | 37–43 | Three more examples in a row, fast, to prove it was not a one-off. |
| The experience | 43–60 | The user does the thing: hunt, basket, checkout, pay. One reassuring number on screen. |
| The twist | 60–73 | A stop, the words PLOT TWIST, the reveal, the money pouring into the pot. |
| The way out | 73–80 | One line that removes the obvious objection (it is reversible). |
| What is underneath | 80–104 | The rest of the product in three beats, then one or two data visuals. |
| Motto | 104–110 | Name, motto, address. |

Rules that came out of it:

- **The first ten seconds contain no product name.** They contain a feeling the viewer recognises.
- **The plot twist needs a set-up that plays it straight.** The run before it has to look like a
  real purchase. Disclaimers go in small labels at the foot of the frame, said once in the
  narration at most, never as a running commentary.
- **Name the technology where it acts.** "Built live by Gemini · streaming structured output" sat
  next to the phone while the shop appeared. A credits slide at the end does not do this job.
- **The longer film is the same story with the evidence put back**, not a different story. The
  pitch (3:53) adds the data, the argument, the guard rails, the fit and the criteria around the
  same centre.

## Script

- **Budget speech, not length.** For a 2:00 limit, cap narration at about 95 seconds; ours came to
  89 seconds, leaving about 20 seconds of picture-only time for the build, the pay chime and the
  twist. Those seconds are where the film breathes.
- **170–190 words a minute** read as energetic without sounding rushed.
- **Short sentences, many full stops.** "The hunt. The scroll. The basket. The checkout." gives the
  editor four cuts.
- **Say round, true things.** The owner wanted "almost instantly" for a build that took 15 seconds
  at the time. We kept the phrase and showed the true times on a stopwatch beside it; then the
  build was made faster (2.5 seconds to the first product, 8.8 to complete), which is the better
  fix.
- **Write the final text into one contract file** (`V2.md`) that every builder reads, with the
  scene ids, and revise it there. Scene ids (`d1`…`d8`, `p1`…`p12`) are then the common language
  for audio, edit and review.

## Voice, music and effects

- **Voice:** ElevenLabs `eleven_multilingual_v2`, stability 0.25, style 0.6, similarity 0.75,
  speaker boost on, speed 1.15, with the previous scene's text passed as context so the scenes
  sound like one session. The first pass at stability 0.38 and style 0.35 was flat. Up to three
  takes per scene, chosen by measured pace and a transcript check.
- **Word timings** come from the service's character timings and are saved per scene
  (`audio.json`: sentences and words). Everything in the edit hangs off them.
- **Respell names** the voice gets wrong and transcribe to check ("Ess-mobeelee" for S-mobiili).
- **Fix pace with a tempo filter that keeps pitch** (rubberband), up to about 12 %, and scale the
  timings to match.
- **Trim silence**: no more than about 60 ms at either end of a line, pauses inside a line under
  0.3 seconds. The one exception is deliberate: a 0.44 second pause before "plot twist".
- **Music:** one bed for the whole film at a fixed tempo (120 beats a minute), with breaks and
  lifts at known times, so cuts can land on bars. Duck it under speech; let it rise in the
  picture-only seconds.
- **Effects, a small kit used consistently:** whoosh on scene changes, riser into a reveal, impact
  on a number landing, tick for laps, pop for chips, and three made for the twist: a tape-stop in
  the pause, a slam on the word, coins pouring for the money. The app's own sounds (basket pop, pay
  chime, coins) are placed where the app plays them.
- **Loudness:** −16 LUFS integrated, true peak under −1 dBTP, checked by script.
- **Budget:** a full voicing of both films used under 7,000 characters. Running out of credits
  mid-retake cost us time; check the balance before starting.

## Footage of the live product

- **Record the real thing with a script** (`scripts/record-v2.mjs`): a phone-sized browser, captured
  frame by frame, writing the time of every event (submitted, first product, shop complete, added
  to basket, pay sheet, tick, coins) to `footage.json`. The edit reads those events; nothing is
  aligned by eye.
- **One continuous hero take** for the central flow, plus short clips for the variety montage.
- **Record on the deployed build, with a fresh browser profile**, and read the server log to
  confirm what actually produced the take (which model, any fallback). Write that into the JSON.
- **Gate every take by looking at it.** We rejected five takes of six: an empty shop, a product
  named after a real product line, and three with generated shoe photos carrying three side
  stripes. Rejections found real defects in the product, which were then fixed.
- **Mark what must not be shown.** A take can pass with a bad stretch if the JSON carries an
  `avoid` list of time ranges and the frame picker in the kit refuses to draw any frame inside
  them. Enforce it in the kit, not in each scene.
- **Human pacing.** Let the first screen fill before scrolling; scroll slowly enough to read.
- **Re-record after any visible change to the product.** A clip from before a change, under a
  caption describing the product after it, is a false statement. We gated the on-screen credit on a
  field in the data so it could not appear over older footage.

## Edit

- **Timing is data.** Scene lengths come from the narration; holds are keyed to words; laps and
  counters come from footage events; shop names, prices and build times are read from JSON. When
  the footage changed, a price changed from 129,90 € to 129,00 € and every drawn figure followed.
- **No dead air between sentences.** A picture-only hold is allowed only where something is
  happening on screen: the build (about 2 seconds), the pay moment (about 2), the twist (about 3).
- **Play the wow moment at real speed** when it is fast enough, with a running clock, and label
  speed only where footage is faster than about 1.05×.
- **One phrase per screen, large**, two or three words, with the key word in the accent colour.
  The phone sits beside the words, never under them.
- **Every count-up must land.** A number that is still counting when the scene cuts shows a wrong
  value on the last frame. Ours showed "10%" for a 15% figure. Rule: the final value rests on
  screen for at least half a second.
- **Start visuals a few frames before their sentence**, because the first third of a second of an
  animated chart is nearly empty.
- **Keep small labels apart.** Source labels, the concept footer and a visual's caption must never
  touch; drop the least important while a visual is up.
- **The product's own screens can spoil the story.** Our app honestly says "Nothing ships" on its
  intro and checkout screens, which gave the twist away a minute early in readable text. The
  independent reviewer caught it. The fix was a soft blur over those rows, keyed to the take's
  events and applied once in the phone-video layer, with the parts the viewer must read kept sharp.
- **A credit names what is on screen at that moment.** "Function calling" belongs over the chat,
  not over a title card; a card marked "Ships" must not sit beside the words "6 experimental".
- **Known trap in Remotion:** footage that should freeze late in a scene can run on into later
  source frames. Ours ran from the inbox into the app's own reveal screen and gave the twist away.
  Hold frames explicitly and check the frame before every reveal.

## Data visuals

- Built as separate components that take no props, fill the frame on a transparent background,
  scale their beats to the length of the `<Sequence>` they are given, and state their shortest
  useful duration (4 to 5.5 seconds each).
- Each draws its own model name and status tag, so the edit adds nothing.
- Figures come from a data file with a `_sources` section naming where each number was computed.
- A 3D scatter of all customers that rises, orbits and then finds one person was the strongest
  single visual. Label any axis that is not the model's own output for what it really is.

## Checks before anyone else sees it

- `scripts/finish-v2.sh` fails the build if a film is over its limit (120 and 300 seconds), and
  reports loudness, peak, codec and decode errors.
- **Contact sheets**: one frame a second for the short film, one every 1.5 seconds for the long
  one, tiled five across with the time burned in. The reviewer reads every tile. This found the
  cut-off count-up, a chip crediting photos to the wrong model, "Almost instantly" beside a
  15-second clock, and a credit over footage it did not describe.
- A transcript of the final audio compared with the script.
- An independent reviewer who did not build the film, given the files and the rules, not the
  builder's conclusions.
- Nobody in this pipeline can listen. Loudness, pace and pitch range are measured; whether the
  voice sounds right is a question for a person, asked early.

## Honesty and brand rules that kept us out of trouble

- A footer on every frame saying what this is (a hackathon concept, not the bank's product).
- "Prototype: money movement is simulated" wherever money appears to move.
- "Aino is a fictional customer · synthetic data" wherever the person appears.
- No logo of the bank, the phone maker or the model provider is drawn; the model is named in plain
  text. A real wallet button appears only inside a recording of the live app.
- No real shop or brand name in any frame, including generated photos that resemble a real
  product.
- Credit each part to what made it: the text to the language model, the photos to the image model,
  the numbers to the engine, the predictions to the trained models.

## Who did what

One orchestrator held the contract, the gates and the publishing; builders worked in parallel with
clear ownership of files:

| Role | Owns | Delivers |
|---|---|---|
| Recorder | `scripts/record-v2.mjs`, `public/v2/live/`, `footage.json`, `facts.json` | Takes with event times and what produced them |
| Audio | `narration-v2.json`, `public/v2/audio/`, `audio.json` | Voice with word timings, music, effects |
| Visuals | `src/v2/ml/` | Self-contained animated charts |
| Editor | `src/v2/`, `scripts/render-v2.mjs`, `scripts/finish-v2.sh` | The compositions and the renders |
| Slides | `src/slides2/`, `scripts/build-pptx.py` | Slides from the same kit |
| Verifier | nothing | An independent report |

Hand-overs replace files whole and atomically, with the same names and JSON shapes, so the editor
can re-render without changes. Interim renders are cheap (see below), so render after each
delivery and put the result at a stable preview address for the owner.

## Machines and timings

- Render on a real machine. The working machine here was too small to run Node or ffmpeg, so
  everything ran on a cloud VM over a sync script; outputs live outside the synced tree.
- On that VM the two-minute film renders in about 63 seconds (about 2.5 minutes with checks and
  sheets) and the four-minute film in about 2 minutes (about 3.5 with checks). The full final of
  both with the transcript check takes about 10 minutes.
- Keep one preview folder with fixed file names and overwrite it; tell the viewer to add `?v=N`
  if the browser shows the old file.

## Slides from the same work

A PowerPoint file was needed at short notice. Each slide's final frame was rendered from its
Remotion composition as a 1920 × 1080 JPEG at quality 85 and placed full-bleed with
`python-pptx`, with the narration as speaker notes. Eighteen slides came to 2 MB and rebuild in
about a minute when footage changes. No embedded video; no speed labels on stills.

## Checklist for the next one

- [ ] Length limits known and written into the finish script
- [ ] Script approved by the owner before any scene is built
- [ ] Opens on a feeling; product name after ten seconds
- [ ] One hero take of the wow moment at real speed, with true times from data
- [ ] The technology named on screen where it acts
- [ ] Speech at most 80 % of the limit; picture-only seconds spent on three moments
- [ ] Music from frame one; effects kit; one deliberate silence
- [ ] Every figure and timing read from JSON
- [ ] Every count-up rests on its final value
- [ ] Footage recorded on the build the film describes; credits gated on the data
- [ ] Contact sheets read end to end; transcript checked; independent review
- [ ] A person has listened to it
