# Vara: shared project brief and contracts

Read this whole file before you write anything. It is the agreement between all agents working on this repo.

## 1. What we are building

**Vara** is an AI personal economic trainer for S-Pankki (S-Bank, Finland), built for the Junction 2026 hackathon
challenge "Personal Economic Trainer". It is a mobile-first web app that lives inside a mock of the bank's S-mobiili
app. People chat with their own transaction data, see what is safe to spend, run what-if scenarios, and get a weekly
coaching check-in. Several machine-learning models trained on the full dataset power the insights.

Judging, 20% each: impact on financial literacy (pedagogy) · originality of AI integration · clarity of the mobile UX ·
feasibility · potential to integrate into S-mobiili. The submission deadline is today around 16:00, so working software
beats ambitious half-finished software.

The sponsor's pedagogical frame, which must be visible everywhere: all spending falls into **three baskets**:
1. mandatory and regular (rent) → we call it **Fixed musts**
2. mandatory and irregular (a broken washing machine) → **Surprise musts**
3. everyday spending that slips through your fingers (coffees) → **Everyday extras**

Core idea of the demo: **"your balance is not your budget."** The default demo customer (CUST04754, alias Aino, 21)
has 1,743.50 € on the account on 30 Sep 2026, but rent of about 1,295 € is due within days.

Target user: young adults 18-30. UI language: English. The coach answers in whatever language the user writes
(Finnish, Swedish, English). Coach name: **Vara** (Finnish: "means, reserve"; "onko varaa?" = "can I afford it?").

## 2. How to work in this repo (important: two machines)

- **Local machine** (`/home/lissan/fin-junction`, where your file tools work) holds the source code and is the source
  of truth. It is tiny: 1 CPU, almost no free disk. **Never run npm, node, python, builds, tests or installs locally.**
- **The VM** (32 vCPU, 125 GB RAM) runs everything. The local tree is mirrored to `~/proj` on the VM.
  - `bin/vm '<command>'` syncs local → VM, then runs the command in `~/proj` on the VM (env from `~/proj/.env` loaded,
    `DATA_DIR=~/data`). Example: `bin/vm 'cd app && npx tsc --noEmit && npm test'`.
  - `bin/vmx '<command>'` runs on the VM without syncing (logs, status, long jobs).
  - `bin/sync` only syncs. `bin/pull <vm-path> <local-path>` copies a file back from the VM.
  - `bin/npm-add [-D] <pkgs>` is the ONLY way to add npm dependencies (it is serialised across agents and pulls
    package.json back). Never edit dependency lists by hand. Add as few dependencies as you can.
  - Python on the VM: `~/mlenv/bin/python` (duckdb, polars, pandas, numpy, scipy, scikit-learn, lightgbm, umap-learn,
    shap, hdbscan, ruptures, torch CPU, matplotlib). Install more with `~/.local/bin/uv pip install --python ~/mlenv/bin/python <pkg>`.
  - Long jobs: start them in tmux on the VM (`tmux new-session -d -s <name> '<cmd> 2>&1 | tee ~/logs/<name>.log'`) and
    poll the log with `bin/vmx`, so a dropped SSH connection does not kill them.
- The dev server already runs on the VM in tmux session `dev` (`npm run dev`: Vite on 5173 + API on 8787, both
  hot-reload after every sync). Log: `bin/vmx 'tail -40 ~/dev.log'`. Restart only if needed:
  `bin/vmx "tmux kill-session -t dev; tmux new-session -d -s dev 'cd ~/proj/app && set -a && . ../.env && set +a && export DATA_DIR=\$HOME/data && npm run dev 2>&1 | tee ~/dev.log'"`.
- Public URL (Caddy, HTTPS): **https://vara-junction26.swedencentral.cloudapp.azure.com** (`/api/*` → API, rest → Vite).
- Toolchain is new: TypeScript 7, Vite 8, React 19, Tailwind 4, Hono 4, zod 4, vitest 5, `@anthropic-ai/sdk` 1.x (kept for
  the Claude rollback path; the default language model is Google Gemini through its REST API, `app/server/gemini.ts`).
  Do not assume older APIs; when something fails, read the package's own types or README in `node_modules` on the VM.
- **File ownership.** Other agents are editing this repo at the same time. Only create or edit files inside the paths
  your brief gives you. If you need a change elsewhere, say so in your final report instead of making it.
- Do not run `git commit`. Do not touch `.vm/`, `.env`, `bin/`, the Caddy config or the Azure setup.
- Language model: Gemini by default (`GEMINI_API_KEY`; models `GEMINI_MODEL` for the coach and check-in,
  `GEMINI_CRAVE_MODEL` for Crave shops, each a comma-separated fallback chain). `LLM_PROVIDER=anthropic` switches back
  to Claude via Runware (`RUNWARE_API_KEY`, `VARA_MODEL`, `CRAVE_MODEL`). Crave product photos always use Runware
  (`CRAVE_IMAGE_MODEL`, default `bfl:flux@3-image-klein`).
- Secrets: the keys are the env vars `GEMINI_API_KEY` and `RUNWARE_API_KEY` on the VM. Never print them, never write
  them into a file in the repo, never send them to the browser.
- Honesty rules: never invent data, merchant names or metrics. If a model does not beat its baseline, say so in its
  model card. Report failures and skipped work plainly in your final message.

## 3. Verified facts about the data (independently re-checked)

- 3,626,755 transactions, 5,100 customers, exactly one account each, 2024-10-01 … 2026-09-30 (24 full months).
  **"Today" is 2026-09-30, a Wednesday**, everywhere in the product (`asOf`). Never use the real clock.
- Per-transaction fields: date, time (hours 05-23, no timezone), category (15 values), type (8 values), signed amount
  (expenses negative), running balance (exact), merchant id (opaque, 515 merchants), MCC (36 codes; null for
  non-purchases and about 5% of purchases). Customer fields: age (18-90) and postal code (Helsinki region). Nothing else.
- Category ↔ type is 1:1: purchases = Groceries, Restaurants, Transportation, Entertainment, Health, Home & Tech,
  Lifestyle, Travel; Utilities = utilities_payment; Housing = housing_payment; Salary; Other Income; Invest Deposit;
  Invest Withdraw; Salary Sweep.
- **No merchant names and no free text.** Label purchases by merchant type from the MCC (see `app/shared/domain.json`).
  MCC is cosmetic in this synthetic data (amounts do not differ by MCC inside a category) but it is what lets us
  answer "taxis" (4121).
- No card subscriptions exist. Recurring items are identified by type only:
  - salary: exactly one per month for main-cohort customers; 79% on the 15th, 20% on days 26-31, about 1% other days.
  - housing_payment: at most one per month, on day 1-8; amount varies about ±5% around the customer's level (up to
    ±10% month to month). 218 customers have none; many have missing months (a data artefact: never call it missed rent).
  - utilities_payment: about 3 per month on random days, median about 50 €; budget it as a monthly total.
  - investment_deposit: 1,500 customers, monthly, 1-5 days after salary, about 10% of salary.
  - salary_sweep: 264 customers move about 90% of salary out right after payday (their spending is mostly invisible:
    this is our multi-bank / PSD2 story).
- CUST05001-CUST05100 ("tail" cohort) have irregular income and some absurd amounts. Exclude them from model fitting
  and from peer statistics; the app must still not crash on them.
- 3,526 customers go below zero at some point (89,398 rows), so overdraft prediction has plenty of positives.
- Purchase amounts scale per customer; groceries are about 64 € per trip for almost everyone. Seasonality is weak.
  The data is synthetic and smooth: validate every model against a naive baseline.
- Mortgage files (`~/data/raw/mtg_*.csv`): 200 applications (150 approved, 50 rejected with reasons) linked to
  main-cohort customers, plus 3,452 negotiation events. Small: treat anything learned from them as illustrative.

## 4. Data layout on the VM (`DATA_DIR=~/data`)

| Path | Content | Type |
|---|---|---|
| `raw/*.csv` | original challenge files, read-only | |
| `tx.parquet` | all transactions: idx, customer_id, date, time, category, type, amount, balance, merchant_id, mcc, ts | |
| `customers/{id}.json`, `customers/index.json` | per-customer transactions for the app | `CustomerData`, `CustomerIndexRow[]` in `app/shared/types.ts` |
| `ml/<kind>/{id}.json` | per-customer model outputs; kinds: profile, twins, anomalies, habits, home (ML-A); forecast, risk, txgpt (ML-B) | `app/shared/ml/typesA.ts`, `typesB.ts` |
| `global/<name>.json` | dataset-wide outputs: map, tribes, peers, benchmarks, modelcard-<key> | same files |

API (already working, `app/server/index.ts`): `GET /api/health`, `/api/customers`, `/api/customer/:id`,
`/api/ml/:kind/:id` (404 until produced), `/api/global/:name`. Chat: `POST /api/chat` (SSE, `app/shared/chat.ts`).

Per-customer ML files should exist for **every main-cohort customer** where feasible, and at minimum for the featured
personas in `app/shared/personas.ts`. Write JSON with plain numbers rounded sensibly (euros to 2 decimals).

## 5. Domain rules

`app/shared/domain.json` is the single source of truth for: basket rules, basket names and colours, category labels
and icons, MCC labels, age bands and the COICOP mapping for benchmarks. TypeScript imports it; Python `json.load`s it.

Statistics Finland benchmarks (verified): Household Budget Survey 2022, PxWeb API v1 at
`https://pxdata.stat.fi/PxWeb/api/v1/en/StatFin/ktutk/14q4.px` (by age of reference person) and `14ph.px` (household
type), content code `kulukk_kt_hk_1_1` (EUR per household per month, current prices); COICOP codes have no dots in
the API (`111` = 11.1, `042` = 04.2). Compare housing on "04 minus 04.2" (04.2 is imputed, non-cash owner rent).
Inflate with CPI table `khi/15b5.px` (2025=100), factor = average of Nov 2025-Oct 2026 over the 2022 average.
Always show: "Source: Statistics Finland, Household Budget Survey 2022, price-adjusted" and that figures are per
household. Licence CC BY 4.0.

Shared balance simulator: specified in the comment above `SimParams` in `app/shared/engine/api.ts`. The TypeScript
engine and `ml/b_forecast.py` must implement the same algorithm.

## 6. Product structure

- **S-mobiili shell** (mock, static except Vara): bottom tabs Koti · S-Etukortti · Maksu (centre "+") · Pankki · Minä,
  chat-bubble icon top right. Vara appears as a card on Koti and in Pankki; tapping it (or the chat bubble) opens the
  Vara space. Minä holds the demo-customer switcher (featured personas + any customer id).
- **Vara space**, four sections: **Today** (safe to spend this week, early warning, upcoming musts, three baskets,
  weekly check-in card, suggested questions) · **Chat** (generative UI: answers arrive as interactive cards, each with
  a "How I got this" drawer; push-to-talk) · **What-if** (sliders, savings projection, live balance forecast) ·
  **You** (Money Map and tribe, Two Futures, habits, unusual-for-you, first-home readiness, model cards).
- Full-screen flows opened from cards: Weekly check-in (swipeable stories), Baskets explorer (drill down, move a
  transaction to another basket), Savings goal with a mock hand-off to S-Pankki's existing Säästäjä product,
  Connect another bank (PSD2 mock).

## 7. Design rules (from S Group's real design system, verified)

- Tokens are in `app/src/styles/tokens.css` (Tailwind 4 `@theme`): mint screen background `green-100` (#EBF7EC), white
  cards, bold `green-700` (#007841) titles, `ink` body text, `ink-muted` secondary text, pill buttons (dark green with
  white text, or light `green-300` with `green-900` text), thin outlined icons (lucide, stroke 1.5), 16px page gutter,
  12-16px between cards, card radius 16px, soft shadows only. Light theme only.
- Do not use red/green traffic lights for ordinary spending; red (#B70000) is for errors and real warnings only.
  Basket colours come from domain.json.
- Money: Finnish format `1 234,56 €` (space thousands separator, comma decimal, non-breaking space before €); negative
  with a real minus `−12,90 €`. Dates `d.M.yyyy` or "Wed 30 Sep". Use `Intl.NumberFormat("fi-FI")`.
- Tone: warm, plain, concrete, never moralising; small steps are praised; always a next step. Short sentences.
- Every screen carries a small footer or badge somewhere: "Junction 2026 concept · not an official S-Pankki product".
  Do not use S-Pankki's logo files or fonts (the fonts are licensed to S Group only; we use Schibsted Grotesk).
- Mobile first: design for 390×844. On wide screens show the app inside a centred phone-width column (max 430px).
- Charts: load the `dataviz` skill before writing any chart. Build charts as small custom SVG components (d3-scale and
  d3-shape are installed); no chart library.
- Existing S-mobiili features we hand off to rather than rebuild: **Säästäjä** (automatic micro-saving of a fixed
  0.50-5 € per card purchase, plus goal-based saving), **Bonus ja ostot** (purchase breakdown for S Group stores),
  **Kuitit** (receipts), the virtual assistant behind the chat bubble.

## 8. Demo personas

See `app/shared/personas.ts`. Default: CUST04754 (Aino, 21). Aliases are invented for the demo; the UI should say
"demo customer" somewhere near the switcher.
