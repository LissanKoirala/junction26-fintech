# Vara pitch deck: slide spec

Fourteen slides, each its own Remotion composition (1920 × 1080, 30 fps), rendered to one MP4 per slide and
joined into one full video. Modelled on the Edge-Care deck (`/home/lissan/Desktop/EdgeCare-Pitch`, read its
`src/slides/*.tsx` for the level of craft expected): calm, editorial, entrance-only motion, a narrator on
every slide, live product recordings in device frames.

The project: **Vara**, a personal economic trainer for S-mobiili, built for the Junction 2026 S-Pankki challenge
("build an AI experience that lets people chat with their own money", synthetic transaction dataset; judged
20% each on financial literacy, originality of AI integration, mobile UX clarity, feasibility, S-mobiili
integration potential). Motto, from the team: **"Helping you save money, a craving at a time."**

## Rules for every slide

- Use `src/kit.tsx` and `src/theme.ts` (read both fully first). Colours only from `C`. Font is `sans`
  (Schibsted Grotesk, the app's font). Add to the kit only if several slides need it; otherwise keep helpers
  in your own slide file.
- Wrap each slide in `<Slide n={…} sources={[…]}>`. It draws the footer ("Vara · Junction 2026 concept · not an
  official S-Pankki product", sources, slide number). Keep content inside x 96…1824 and above y 1000.
- Entrance-only motion: things arrive (use `<In>`, `useIn`, `useProgress`, `CountUp`), nothing leaves or fades
  out, and the last 2 seconds of every slide are a complete, still frame. No flashing, no bouncing, no
  continuous loops except very slow ambient drift (`useAmbient`). Stagger entrances to follow the narration:
  an element should arrive when the narrator mentions it (narration timings below; narration starts at 0.8 s).
- Text sizes on the 1920 × 1080 frame: headlines 60–76 px, body 26–34 px, nothing under 22 px except the
  footer. Short lines. Sentence case. No exclamation marks. Numbers in the Finnish style the app uses:
  `39 €`, `89,90 €`, `3,6 million` is NOT used: write "3.6 million" in English prose and `5 100` for counts.
- Each slide plays its narration with `<Sound src="n-<id>.m4a" at={s(0.8)} />` (files in `public/audio`,
  measured lengths in `src/narration.json`). Never show the narration as subtitles; the slide's own text
  should carry the same message in fewer words.
- Provenance: every product recording or screenshot carries `<Badge kind="live" />` or `<Badge kind="still" />`
  near it; every number from the dataset is on a slide with `<Badge kind="data" />` or names its source in
  `sources`; drawings carry `<Badge kind="illustration" />` when they could be mistaken for the product.
- Facts: use ONLY the figures in "Facts" below, exactly as written. Do not round differently, do not invent
  numbers, comparisons, quotes, user counts or outcomes. If a figure you want is not here, leave it out.
- Brand: no S-Pankki logo, no S Group logo, no S-Pankki fonts. Naming S-Pankki and S-mobiili in text is fine.
  No Apple logo and no "Apple Pay" wording in anything we draw (a live recording or screenshot of the app
  may contain Stripe's own wallet button; that is fine). Say "phone wallet" / "wallet sheet".
- People: Aino is a fictional name for a synthetic customer. Never show a photo or a realistic face;
  if you draw a person, make it a simple faceless figure or just use her initial in a disc.
- Live recordings: `<Phone width={…}><LiveClip src="today.mp4" at={s(1)} to={…} /></Phone>`. A clip shows its
  first frame until `at`, plays, then holds its last frame. Take all times from `src/timeline.json` (import it;
  do not hard-code event times): `clipFrame(at, t)` gives the slide frame at which source second `t` shows.
  Recordings have no sound. Phone recordings are 780 × 1688; show phones 360–430 px wide so the UI is readable.
- Check your work by rendering stills on the Azure VM (see "How to render") and looking at them. A slide is
  done when its stills at the key moments and its final frame are clean: no overlap, no clipped text, nothing
  outside the safe area, entrances in step with the narration.

## Facts (the only figures allowed)

Dataset (synthetic, provided for the challenge; figures from our insights site, `/insights/`):
- 3 626 755 transactions ("3.6 million"), 5 100 customers, 24 months (October 2024 to September 2026).
- 69% of customers dipped below zero at least once in two years ("seven in ten").
- 96% of the dips bottom out 20 or more days after payday.
- Ages 18–24: 80% dipped below zero at least once ("eight in ten"); only 61% of the balance they see on payday
  is actually free; housing takes 39% of their salary.
- The median customer makes 14 everyday-extras purchases a month, typically 39 € each.
- For the median customer who went below zero, the deepest dip of two years is the size of 5.9 typical
  purchases ("about six").
- A 5% trim of everyday extras is about 44 € a month for the median customer. Kept as a cushion, it removes
  72% of the days below zero. Kept only until the next payday, it removes 15%.
- Fixed musts take 57% of salary; everyday extras are 30%. The three baskets are "Fixed musts",
  "Surprise musts" and "Everyday extras".

Demo customer (synthetic; "Aino" is a fictional name; age 21; data as of 30 September 2026):
- Today screen: "Safe to spend until Sunday 37 €", "64 € a week until payday on 15 Oct · 137 € in total",
  status "A bit tight".
- Crave demo: craving "new sneakers" → invented shop "Hallo Stride" → product "VELLAN Aero Glide 2", 89,90 €.
  The checkout says: "Checked against your safe-to-spend: 137 € is free until payday, so this fits."
  (Use the amounts actually visible in the recording if they differ.)

Product:
- Chat: Claude (Opus 5.5, through the Runware API) with tool calls into a deterministic engine written in
  TypeScript; a guard checks the figures in every answer against the engine's results; answers are cards
  with charts; every number can show how it was worked out. Push-to-talk voice input. English and Finnish.
- Public endpoint is rate limited (30 requests per 5 minutes per visitor; 2 000 AI calls a day in total).
- What-if simulator; weekly check-in stories; peer benchmarks; baskets explorer; savings goal with a
  hand-off to Säästäjä (S-Pankki's savings service: the hand-off is a mock); connect another bank (PSD2 mock).
- Crave mode: opt-in; a "Crave mode · nothing ships" pill on every screen; generated shop (Claude Haiku 5.5,
  invented shop and brands only); basket and checkout; pay sheet with a synthesised chime; the amount is capped
  by safe-to-spend; reveal screen; in-app inbox with order emails (no real emails are sent); Crave pot;
  "Release the money and buy it for real". All money movement is simulated in the prototype. Checkout can
  use the phone's real wallet sheet through Stripe in TEST mode: no card is charged.
- Eight models, each with a model card and a verdict:
  | App name | What it does | Verdict | Model vs strongest simple baseline |
  |---|---|---|---|
  | Crystal ball | balance forecast with a range | Ships | 14-day error 340 € vs 373 € (8.7% better) |
  | Early warning | overdraft risk, with reasons | Ships | PR AUC 0.800 vs 0.768 (ROC AUC 0.967 vs 0.963) |
  | Money Map | customers on one map, "tribes" | Experimental | silhouette 0.114 vs 0.071 |
  | Two Futures | what happened next to people like you | Experimental | on par with a one-feature rule |
  | Unusual for you | personal anomaly radar | Experimental | 0.889 vs 0.901: the baseline wins |
  | Habit detector | a change that has stuck | Experimental | 3.6% flagged vs 3.1% on shuffled data |
  | TransactionGPT | small transformer over account history | Experimental | next category 45.1% vs 36.7% |
  | First-home readiness | how ready for a mortgage | Experimental | AUC 0.782 vs 0.732, within noise |
- Live: https://vara-junction26.swedencentral.cloudapp.azure.com (short form on slides:
  `vara-junction26.swedencentral.cloudapp.azure.com`), insights at `/insights/`.

## Slides

Narration text is in `narration.json`; lengths in seconds are given here.

**01 · s01-opening · 15 s · Story.tsx `S01Opening`** — narration `opening` (10.0 s): "Meet Aino. She's
twenty-one, payday is two weeks away, and she really wants new sneakers. Her banking app shows what she has.
It doesn't show what she can afford."
Dark (deep green) slide. Left: eyebrow "Meet Aino", headline "Her bank shows what she **has**. Not what she
can **afford**." Right: an illustration, not the product: a simple faceless figure or an "A" disc, three
small facts arriving with the narration ("21 years old", "Payday in 15 days", "Wants: new sneakers" with a
drawn sneaker or bag icon). Badge: illustration. Mention "Aino is a fictional customer · synthetic data".

**02 · s02-data · 24 s · Story.tsx `S02Data`** — narration `data` (19.2 s): "She's not alone. In the challenge
data, three point six million transactions from five thousand one hundred customers, seven in ten dipped
below zero at least once in two years. Among eighteen to twenty-four-year-olds, it's eight in ten. Almost
always in the last days before payday."
Light slide. Eyebrow "The data". Headline "Seven in ten dipped below zero." Show: dataset line (3.6 million
transactions · 5 100 customers · 24 months), then two big proportion visuals built from dots or bars
(69% all customers, 80% ages 18–24), then a simple pay-cycle strip (30 days, payday at the left, the last
ten days highlighted) with "96% of dips bottom out 20+ days after payday". Badge: data.
Sources: "Challenge dataset (synthetic), our analysis: /insights/".

**03 · s03-insight · 20 s · Story.tsx `S03Insight`** — narration `insight` (15.3 s): "And the dips are small. A
typical everyday purchase is thirty-nine euros. The deepest dip in two years is the size of six of them. So
this isn't a maths problem. It's about the moment, and whether the money is still there when the dip would
have come."
Light slide. Eyebrow "The insight". Headline "The dips are small. The **moment** is the problem." Visual:
six purchase tokens of "39 €" stacking up to equal "the deepest dip in two years" (5.9, drawn as five full
tokens and one almost full). Then a two-bar comparison: "A 5% trim, kept as a cushion: 72% fewer days below
zero" vs "kept only until payday: 15%". Closing line arriving last: "Skipping a purchase is not enough. The
money has to stay." Badge: data. Sources as slide 02.

**04 · s04-meet · 18 s · Product.tsx `S04Meet`** — narration `meet` (9.6 s): "So we built Vara, a personal
economic trainer inside S-mobiili. It starts with one number: what's safe to spend, after rent, bills and a
cushion."
Light slide. Left: Sprout mark, eyebrow "Meet Vara", headline "One number first: what is **safe to spend**."
Three short points arriving with the narration (inside S-mobiili · after rent, bills and a cushion · until
payday, week by week). Right: phone with `today.mp4` (home shell → Vara → Today). Badge: live.

**05 · s05-chat · 30 s · Product.tsx `S05Chat`** — narration `chat` (16.0 s): "Ask it anything, in plain words.
Answers arrive as cards, built from your own transactions, and every number shows how it was worked out. The
language model never does the arithmetic. An engine does, and a guard checks every figure before it reaches
you."
Light slide. Phone with `chat.mp4` (start the clip at about 1 s so typing is seen; the clip is longer than
the narration: let it play through). Beside it, eyebrow "Chat with your money", headline "Answers arrive as
**cards**, with the working shown." Then a small three-step diagram arriving at the "language model never
does the arithmetic" line: "Your question → Claude picks a tool → Engine computes → Guard checks every
figure → Card". Mention push-to-talk voice as a small point. Badge: live (if the recording had its waiting
time cut, the badge text must be "Live app recording · synthetic data · waiting time shortened": the
timeline's `cut` list tells you).

**06 · s06-coach · 24 s · Product.tsx `S06Coach`** — narration `coach` (8.9 s): "What-if lets you try a decision
before you make it. Every week, Vara checks in first, with the story of your week. And it works in English
and in Finnish."
Light slide (tinted background `C.screen` is fine). Three phones side by side, each with a label above:
"What-if" (`whatif.mp4`), "Weekly check-in" (`checkin.mp4`), "English and Finnish" (`finnish.mp4`). Start
them one after another in step with the three sentences of the narration, then let each play out; all three
end held. Headline "A coach that **comes to you**." Badge: live.

**07 · s07-crave-idea · 19 s · Crave.tsx `S07CraveIdea`** — narration `crave-idea` (14.6 s): "But advice doesn't
stop a craving. So we tried something else. Crave mode. Tell Vara what you want, and it builds a shop for it
on the spot. You hunt, you fill the basket, you check out. Nothing ships. The money goes to your savings
instead."
Dark slide: the deck's big idea. Eyebrow "Crave mode". Headline "Helping you save money, **a craving at a
time**." A five-step path arriving with the narration, each an icon disc and two or three words:
"Say the craving" → "A shop appears" → "Hunt and fill the basket" → "Check out" → "Nothing ships: the money
lands in savings". Show `<CravePill />`. No recording here (the next slide is the live run).

**08 · s08-crave-live · about 54 s (set from the recording) · Crave.tsx `S08CraveLive`** — narration
`crave-live-a` (2.5 s) at the start: "Here it is, live. New sneakers."; `crave-live-b` (3.3 s) once the reveal
screen is showing: "The thrill of buying. And the money is still hers."
Light or tinted slide. One large phone (about 430 px wide, centred or left of centre) playing `crave.mp4`
start to finish. Beside it a vertical list of the steps ("The craving", "A generated shop", "Basket",
"Checkout", "Pay", "Nothing ships: money to the Crave pot", "Order emails, in the app"), each lighting up
when its event time in `timeline.json` is reached (labels: `shop-visible`, `added`/`basket`, `checkout`,
`sheet-open`, `tick`, `reveal`, `inbox`, `pot`). The app's own pay chime plays exactly at the `tick` event:
`<Sound src="chime.m4a" at={clipFrame(at, tickTime)} />` (and `pop.m4a` at `added` if it exists; the audio
files in `public/audio` tell you what exists). Keep quiet around the chime: no narration within 2 s of it.
The slide length = clip length + 2.5 s of hold; change `seconds` for `s08-crave-live` in `src/deck.ts`
(the only line of that file you may edit). Badge: live.

**09 · s09-crave-honest · 24 s · Crave.tsx `S09CraveHonest`** — narration `crave-honest` (19.6 s): "Crave mode is
honest by design. You opt in, and every screen says nothing ships. It never sets aside more than is safe to
spend, and you can release the money and buy it for real at any time. In this prototype the money movement
is simulated, and checkout can use a real wallet sheet in Stripe's test mode. No card is charged."
Light slide. Eyebrow "Honest by design". Headline "It only works if you are **in on it**." Left: four or
five points arriving with the narration (Opt-in · Every screen says nothing ships · Never more than is safe
to spend · Release the money any time · Prototype: money movement is simulated; Stripe test mode, no card
charged). Right: two phone stills side by side: `shots/pay-sim.png` (label "Simulated pay sheet, synthesised
chime") and `shots/pay-wallet.png` (label "Real wallet sheet · Stripe test mode"); or `shots/pot.png` if a
third fits. Badge: still.

**10 · s10-models · 26 s · Models.tsx `S10Models`** — narration `models` (21.7 s): "Behind the coach are eight
machine-learning models trained on the challenge data, from a balance forecast and an overdraft early
warning to a small transformer that reads account history like text. We tested each one against the
strongest simple baseline we could find. Two clearly win, and ship. Six are labelled experimental, and the
app says so."
Light slide. Eyebrow "Eight models". Headline "Tested against the **strongest simple baseline**." Main
visual: the table from "Facts" as eight rows arriving in order (ships first), each with name, one-line
purpose, the comparison and a verdict chip ("Ships" green, "Experimental" amber). At "Two clearly win…" the
two shipped rows get a highlight; at "Six are labelled experimental…" the chips of the six pulse once
(entrance only: a ring that settles). A phone with `models.mp4` at the right if there is room; otherwise
leave the recording out and use `shots/models.png`. Badge: model.
Sources: "Model cards in the app and on /insights/ · each re-checked independently".

**11 · s11-insights · 18 s · Product.tsx `S11Insights`** — narration `insights` (8.9 s): "It's all written up for
the judges on a separate insights site: seven findings, every model card, and the limits of what this data
can tell."
Light slide. `<Browser width≈1180>` with `insights.mp4` playing. Beside or under it: eyebrow "For the judges",
headline "Every figure, **written up**.", three chips arriving with the narration: "Seven findings",
"Eight model cards", "What this data cannot tell". Show the address `…/insights/`. Badge: live
("Live site recording · synthetic data").

**12 · s12-fit · 22 s · Product.tsx `S12Fit`** — narration `fit` (15.3 s): "Vara is built to fit S-mobiili. It
lives inside the app's shell, hands savings goals to Säästäjä, and can read other banks through an
open-banking mock. One engine, one guarded chat endpoint, two languages. And it's live today."
Light slide. Left: phone with `more.mp4` (baskets → goal with Säästäjä → connect a bank). Right: eyebrow
"Built to fit S-mobiili", headline "A feature, **not a research project**." and a compact architecture strip
arriving with the narration: "S-mobiili shell" · "Säästäjä hand-off (mock)" · "Other banks via PSD2 (mock)"
then "One engine · one guarded, rate-limited chat endpoint · English and Finnish" then "Live today" with the
address. Badge: live.

**13 · s13-criteria · 20 s · Story.tsx `S13Criteria`** — narration `criteria` (14.9 s): "Five criteria. Financial
literacy: every answer shows its working. Original AI: a shop that sells nothing. A clear mobile experience,
in two languages. Feasible: it's running now. And made for S-mobiili."
Light slide. Eyebrow "The five criteria". Headline "What we were asked for, and what we built." Five rows or
cards arriving one per sentence: criterion on the left (Financial literacy · Originality of AI integration ·
Mobile UX clarity · Feasibility · S-mobiili integration potential), our answer on the right (Every answer
shows its working; three baskets; honest model cards · Crave mode: a generated shop that sells nothing;
answers as cards from tool calls · One number first; cards, not walls of text; English and Finnish · Live
today; a deterministic engine; a guarded, rate-limited endpoint · Lives in the S-mobiili shell; Säästäjä
and PSD2 hand-offs (mocks)).

**14 · s14-close · 9 s · Story.tsx `S14Close`** — narration `close` (3.3 s): "Vara. Helping you save money, a
craving at a time."
Dark slide. Large Sprout mark, "Vara", the motto "Helping you save money, a craving at a time.", the two
addresses (app and `/insights/`), and the line "Junction 2026 concept · not an official S-Pankki product ·
all data synthetic". No names (the team adds its credits itself).

## How to render (on the Azure VM only)

This Linode machine is tiny: never run node, npm or ffmpeg here. From `/home/lissan/fin-junction`:

- `bin/vm '<cmd>'` copies the local tree to `~/proj` on the VM and runs the command there (`bin/vmx` runs
  without copying). The copy deletes anything on the VM under `~/proj` that does not exist locally, so
  render outputs go outside it.
- Typecheck: `bin/vm 'cd ~/proj/video && npx tsc --noEmit'`
- Stills of chosen frames (fast): `bin/vm 'cd ~/proj/video && node scripts/render-all.mjs --only s05-chat --frames 45,240,-1 --out ~/vidout/<your name>'`
  then copy one here: `bin/pull 'vidout/<your name>/stills/05-s05-chat-f0045.png' <folder in your scratchpad>/`
  and open it with the Read tool. `-1` is the last frame.
- A full clip: same command without `--frames` (writes `videos/NN-id.mp4` and `stills/NN-id-final.png`).
- Use your own `--out` folder so parallel renders do not overwrite each other.
