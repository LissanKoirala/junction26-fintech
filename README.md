# Vara

**Saving money, a craving at a time.**

Vara is an AI money trainer concept for S-mobiili, built for the S-Pankki
"Personal Economic Trainer" challenge at Junction 2026. It lets people chat with
their own money, see what is safe to spend before payday, and try decisions
before they make them.

> Junction 2026 concept. Not an official S-Pankki product. All data is the
> synthetic dataset provided for the challenge.

## What is in the app

- **Today**: one number, safe to spend this week (balance minus the rent, bills,
  groceries and savings still due before payday).
- **Chat with Vara**: answers arrive as cards with charts. The model picks tools
  and writes the words; every figure is computed by the engine, never by the model.
- **What-if simulator**: try a change and see what it does to the weeks ahead.
- **Weekly check-in**: a short proactive story about the week.
- **Three baskets**: fixed musts, surprise musts, everyday extras.
- **Crave mode**: when you feel like buying something, Vara generates a shop for
  it with a full checkout. Nothing ships; the money goes to your savings instead.
  Opt-in, clearly labelled and reversible.
- **Shopping Lab**: a separate page inside Crave mode (`#/crave/lab`) embeds
  real-product storefronts, with Gemini-backed imports for other merchant URLs.
  Its checkout and savings pot are simulated and separate from the wallet.
- **Machine-learning features**: money map, two futures, unusual-for-you radar,
  habit detector, balance forecast, overdraft early warning with reasons,
  first-home readiness. Each one is reported against a naive baseline.

## Repository layout

| Path | What it is |
|---|---|
| `app/` | The mobile web app: React + Vite front end (`src/`), Hono API server (`server/`), shared engine and types (`shared/`) |
| `shopping-lab/` | Standalone mobile shopping demo: retailer storefronts, Gemini discovery, live catalogue imports, and simulated savings checkout |
| `ml/` | Python pipelines that train the models and write per-customer outputs and model cards |
| `insights/` | The judges' insights site: `eda.py` computes every statistic from the raw data, `build.py` renders the page |
| `design/` | Moodboard for the visual direction |
| `docs/CONTRACTS.md` | Data contracts between the engine, the models and the UI |

## Running it

The dataset is not in this repository. Download it from the challenge repository
(`hackjunction/Junction-2026-S-pankki`) and point `DATA_DIR` at it.

```bash
# app
cd app && npm install
GEMINI_API_KEY=... RUNWARE_API_KEY=... DATA_DIR=~/data npm run dev   # Gemini for text, Runware for Crave photos

# models (Python 3.11+, see ml/FEATURES.md)
bash ml/a_run_all.sh

# insights site
python insights/eda.py && python insights/build.py
```

## Shopping Lab

The standalone shopping demo is documented in [shopping-lab/README.md](shopping-lab/README.md), with an [embedding contract](shopping-lab/docs/INTEGRATION.md) for the S-mobiili app. It runs on its own origin or port (5174 is recommended alongside the existing app), with a separate Gemini backend secret and catalogue cache.

Hosted demo: [Vara Shopping Lab](https://vara-shopping-lab.lissanartist.chatgpt.site/).

Open **Crave mode → Open Shopping Lab**, or navigate directly to `#/crave/lab`.
The app page embeds the hosted demo; its complete source lives in `shopping-lab/`.
Deploy the updated main app to make the new route available on the Azure host.

## Data and credits

- Synthetic transaction dataset by S-Pankki / Junction for the challenge.
- Household spending benchmarks: Statistics Finland, Household Budget Survey (CC BY 4.0).
- Typeface: Schibsted Grotesk (OFL).
