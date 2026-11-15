# Presenter notes

Two ways to use the deck:

- **Play it.** `vara-pitch.mp4`, the pitch video, is the whole pitch with a narrator, 4 min 55 s.
  `vara-demo.mp4`, the demo video, is 1 min 53 s of the product: the one number (slide 04, opening with "This is
  Vara, a personal economic trainer inside S-mobiili. It starts with one number: what's safe to spend, after
  rent, bills and a cushion."), chat, Crave mode and its live run, the close.
- **Present over it.** The fourteen clips in `videos/` each end on a complete, still frame. Mute the player,
  play a clip, talk, and move on when you are ready. The narrator's lines below are a script you can say
  yourself.

Slide 08 is the one to keep the sound on for: the pay chime is the moment of the pitch.

## Slide by slide

**01 · Meet Aino (15 s).** "Meet Aino. She's twenty-one, payday is two weeks away, and she really wants new
sneakers. Her banking app shows what she has. It doesn't show what she can afford."
If asked: Aino is a fictional name for one synthetic customer in the challenge data (age 21, the app's date is
fixed at 30 September 2026).

**02 · She is not alone (23 s).** "She's not alone. In the challenge data, three point six million transactions from five
thousand one hundred customers, seven in ten dipped below zero at least once in two years. Among eighteen to
twenty-four-year-olds, it's eight in ten. Almost always in the last days before payday."
If asked: 69% overall, 80% for ages 18 to 24, and 96% of dips reach their lowest point 20 or more days after
payday. The data is synthetic; the challenge describes it as modelled on real S-Bank data. The 69% includes
the first month, where the synthetic opening balances put more accounts below zero than later months.

**03 · The dips are small (20 s).** "And the dips are small. A typical everyday purchase is thirty-nine euros. The deepest dip in two
years is the size of six of them. So this isn't a maths problem. It's about the moment, and whether the money
is still there when the dip would have come."
If asked: the 72% is what a 5% trim (about 44 € a month) removes when the saved money is kept and builds up
as a cushion over the two years; kept only until the next payday it removes 15%. It is a replay of the data
with everything else unchanged, not a prediction. That gap is the argument for
Crave mode: the money has to stay somewhere.

**04 · Meet Vara (16 s).** "So we built Vara, a personal economic trainer inside S-mobiili. It starts with one
number: what's safe to spend, after rent, bills and a cushion."
If asked: 37 € until Sunday, 64 € a week until payday on 15 October, 137 € in total. The number comes from a
deterministic engine, not from the language model.

**05 · Chat with your money (23 s).** "Ask it anything, in plain words. Answers arrive as cards, built from
your own transactions, and every number shows how it was worked out. The language model never does the
arithmetic. An engine does, and a guard checks every figure before it reaches you."
If asked: Claude Opus 5.5 calls tools in the engine; the guard compares every figure in the answer with the
engine's results. The public endpoint is limited to 30 requests per 5 minutes per visitor and 2 000 AI calls
a day. The recording cuts 4.1 seconds of waiting for the answer; the badge on the slide says so.

**06 · A coach that comes to you (20 s).** "What-if lets you try a decision before you make it. Every week,
Vara checks in first, with the story of your week. And it works in English and in Finnish."

**07 · Crave mode (19 s).** "But advice doesn't stop a craving. So we tried something else. Crave mode. Tell
Vara what you want, and it builds a shop for it on the spot. You hunt, you fill the basket, you check out.
Nothing ships. The money goes to your savings instead."

**08 · Crave mode, live (46 s).** "Here it is, live. New sneakers." … (let it play) … "The thrill of buying.
And the money is still hers."
If asked: the shop "Hallo Stride" and its brands are invented by the model (Claude Haiku 5.5) for the craving;
no real shop or brand is shown. The recording is uncut and uses the simulated pay sheet.

**09 · Honest by design (26 s).** "Crave mode is honest by design. You opt in, and every screen says nothing
ships. It never sets aside more than is free until payday, and you can release the money and buy it for real
at any time. In this prototype the money movement is simulated, and the wallet button at checkout comes from
Stripe, in test mode. No card is charged."
If asked: the cap is the 137 € that is free until payday, not the 37 € for this week. The order emails
arrive in an in-app inbox; no real email is sent. The wallet button is Stripe's own element in test mode; we
have not completed a wallet payment on a real phone.

**10 · Eight models, tested honestly (25 s).** "Behind the coach are eight machine-learning models trained on
the challenge data, from a balance forecast and an overdraft early warning to a small transformer that reads
account history like text. We tested each one against the strongest simple baseline we could find. Two
clearly win, and ship. Six are labelled experimental, and the app says so."
If asked: the forecast's error on 14-day spending is 340 € against 373 € for the baseline; the early
warning's PR AUC is 0.800 against 0.768 (its ROC AUC gain is small: 0.967 against 0.963). For "Unusual for
you" the simple baseline wins (ROC AUC 0.889 against 0.901), and the app says so.

**11 · Written up for the judges (16 s).** "It's all written up for the judges on a separate insights site:
eleven findings, every model card, and the limits of what this data can tell."
The site is at `/insights/` on the demo address.

**12 · Built to fit S-mobiili (19 s).** "Vara is built to fit S-mobiili. It lives inside the app's shell,
hands savings goals to Säästäjä, and can read other banks through an open-banking mock. One engine, one
guarded chat endpoint, two languages. And it's live today."
If asked: the Säästäjä hand-off and the other-bank connection are mocks; nothing leaves the prototype.

**13 · Five criteria (18 s).** "Five criteria. Financial literacy: every answer shows its working. Original
AI: a shop that sells nothing. A clear mobile experience, in two languages. Feasible: it's running now. And
made for S-mobiili."

**14 · Close (9 s).** "Vara. Helping you save money, a craving at a time."

## Good to know before you present

- Vara is a Junction 2026 concept, not an official S-Pankki product; every slide's footer says so.
- All money movement is simulated. Stripe runs in test mode only and the app refuses live keys.
- Every figure on the slides is traced in `SOURCES.md`.
- Not shown in the video: the Shopping Lab storefront experiment (linked from the Crave intro in the app),
  the baskets explorer, peer benchmarks, voice input in use, and the individual model screens on the You tab.
- The closing slide carries no team names.
