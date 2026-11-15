# Sources for every figure in the deck

All figures describe the synthetic dataset provided for the Junction 2026 S-Pankki challenge
(`hackjunction/Junction-2026-S-pankki`), not S-Pankki's real customers. They are computed by
`insights/eda.py` and the `ml/` scripts in this repository and published on the insights site
(`/insights/` on the demo server), where each has its chart, definition and caveats.

| Slide | Figure | Where it comes from |
|---|---|---|
| 02 | 3.6 million transactions (3 626 755), 5 100 customers, 24 months | Insights: "One account, every transaction, two years" |
| 02 | 69% of customers dipped below zero at least once in two years | Insights: "Seven in ten customers dip below zero" |
| 02 | 80% of 18–24-year-olds dipped below zero at least once | Insights: "Young adults run closest to the edge" (age table) |
| 02 | 96% of the dips bottom out 20 or more days after payday | Insights: summary and "Below zero" |
| 03 | A typical everyday-extras purchase is 39 € (median of each customer's median) | Insights: "A craving costs 39 €" |
| 03 | The deepest dip in two years is the size of 5.9 typical purchases (median overdrawn customer) | Same section |
| 03 | A 5% trim kept as a cushion: 72% fewer days below zero; kept only until the next payday: 15% | Insights: "A small trim only counts if the money is kept" |
| 04 | Safe to spend until Sunday 37 €; 64 € a week until payday on 15 Oct; 137 € in total | The app's Today screen for the demo customer, data as of 30 September 2026 |
| 08, 09 | Shop "Hallo Stride", product "Court Low Leather" at 119,95 €, which fits the 137 € free until payday | The live Crave flow for the craving "new sneakers" (invented shop and brand), as recorded |
| 10 | Crystal ball: 14-day error 340 € vs 373 € (8.7% better) | Model card `forecast`; baseline: own 182-day average × days × a fitted ratio |
| 10 | Early warning: PR AUC 0.800 vs 0.768; ROC AUC 0.967 vs 0.963 | Model card `risk`; baseline: logistic regression on the same features |
| 10 | Money Map: silhouette 0.114 vs 0.071 | Model card `tribes`; baseline: k-means on a Gaussian with the same covariance |
| 10 | Two Futures: on par with a one-feature rule (1.204 vs 1.219, within noise) | Model card `twins` |
| 10 | Unusual for you: 0.889 vs 0.901, the baseline wins | Model card `anomalies`; baseline: Isolation Forest on the same features |
| 10 | Habit detector: 3.6% of series flagged vs 3.1% on 13-week block-shuffled data | Model card `habits` |
| 10 | TransactionGPT: next category 45.1% vs 36.7% | Model card `txgpt`; baseline: LightGBM on the same context |
| 10 | First-home readiness: AUC 0.782 vs 0.732, within fold-to-fold noise | Model card `home`; baseline: one feature (buffer) |
| 12 | 30 requests per 5 minutes per visitor; 2 000 AI calls a day | `app/server/llm.ts` rate limits on the public endpoint |

Model verdicts ("Ships" for two, "Experimental" for six) come from a rule in each model's code and were
re-checked by an independent verification pass; the rule is stated at the top of the models section of the
insights site.

## Footage and sound

- Recordings and screenshots: made from the live prototype by `scripts/record-app.mjs`; event times in
  `src/timeline.json`. The Crave recording uses the simulated pay sheet; the screenshot labelled
  "Stripe test mode" shows Stripe's own wallet button on the same sheet (test keys: no card is charged).
- Sounds in the Crave recording are the app's own, synthesised by `app/src/features/crave/sfx.ts` and
  rendered to audio files by the recorder. No third-party audio is used.
- Narration: ElevenLabs text to speech from `narration.json`.
