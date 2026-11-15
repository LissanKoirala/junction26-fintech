# The fourteen slides

Each slide is its own clip in `videos/` (1920 × 1080, 30 frames a second, with sound) and ends on a complete,
still frame. `vara-pitch.mp4` is all fourteen joined (5 min 18 s). `vara-pitch-short.mp4` is slides 01, 04,
07, 08 and 14 (1 min 50 s) for places with a time limit.

| # | Clip | Starts at | Length | What plays | What it is |
|---|---|---|---|---|---|
| 01 | `01-s01-opening.mp4` | 0:00 | 15 s | Aino, 21, two weeks from payday, wants new sneakers. The balance a bank app shows against what she can afford. | Illustration, with the demo customer's figures |
| 02 | `02-s02-data.mp4` | 0:15 | 24 s | The dataset in three numbers, then: 69% dipped below zero, 80% of 18 to 24 year olds, 96% of dips in the last days before payday. | Challenge dataset, synthetic |
| 03 | `03-s03-insight.mp4` | 0:39 | 20 s | A typical purchase is 39 €; the deepest dip is 5.9 of them. A 5% trim removes 72% of days below zero if the money stays, 15% if it does not. | Challenge dataset, synthetic |
| 04 | `04-s04-meet.mp4` | 0:59 | 18 s | Recording: Vara opens inside the S-mobiili shell on "Safe to spend until Sunday 37 €". | Live app recording |
| 05 | `05-s05-chat.mp4` | 1:17 | 30 s | Recording: "Can I afford new sneakers this month?", the answer as cards, "How I got this". Beside it: model asks, engine computes, guard checks. | Live app recording, waiting time shortened |
| 06 | `06-s06-coach.mp4` | 1:47 | 24 s | Three recordings: the What-if slider, the weekly check-in story, the switch from English to Finnish. | Live app recording |
| 07 | `07-s07-crave-idea.mp4` | 2:11 | 19 s | The idea of Crave mode in four steps, and the motto. | Concept |
| 08 | `08-s08-crave-live.mp4` | 2:30 | 49 s | Recording, uncut: craving, generated shop, basket, checkout, pay sheet with the chime, "nothing ships", inbox, Crave pot. | Live app recording |
| 09 | `09-s09-crave-honest.mp4` | 3:19 | 24 s | The five guard rails, next to the simulated pay sheet and the Stripe test-mode sheet. | Live app screenshots |
| 10 | `10-s10-models.mp4` | 3:43 | 26 s | The eight models as a table: each against its strongest simple baseline, with its verdict. | Model cards |
| 11 | `11-s11-insights.mp4` | 4:09 | 18 s | Recording: the insights site for the judges, from the findings to the model table. | Live site recording |
| 12 | `12-s12-fit.mp4` | 4:27 | 22 s | Recording: baskets, a savings goal handed to Säästäjä, connect another bank. Beside it: how Vara fits S-mobiili. | Live app recording, hand-offs are mocks |
| 13 | `13-s13-criteria.mp4` | 4:49 | 20 s | The five judging criteria and one answer to each. | Summary |
| 14 | `14-s14-close.mp4` | 5:09 | 9 s | The motto and where to open the prototype. | Close |

## Sound

- A narrator on every slide (a synthetic voice; the lines are in `narration.json`).
- On slide 08 the three sounds are the app's own, rendered from its code and placed where the app plays
  them: a pop when the product goes into the basket, the pay chime on the tick, coins when the money lands in
  the pot. The narrator says one line at the start and one after the reveal, and nothing in between, so the
  chime is heard on its own.
- No music.

## Where the footage comes from

`scripts/record-app.mjs` drives the live prototype in a phone-sized browser and captures it frame by frame;
`src/timeline.json` holds the time of every tap and screen change, and the slides take their timing from it.
The demo customer is synthetic ("Aino" is a fictional name), the date is fixed at 30 September 2026, and
nothing was edited inside the recordings except one cut of 4.4 seconds of waiting for the answer on slide 05,
which its badge states.
