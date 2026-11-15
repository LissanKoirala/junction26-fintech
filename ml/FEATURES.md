# ML-A feature store (`ml/a_features.py`)

All files are on the VM under `DATA_DIR/features/` (default `~/data/features/`). Build: `~/mlenv/bin/python ml/a_features.py` (about 3 s).
Only data on or before the as-of date 2026-09-30 is used. Baskets follow `app/shared/domain.json` (`common.add_basket_column`,
including the Home & Tech big-purchase rule with each customer's own median Home & Tech purchase).

## features.parquet: one row per (customer_id, window)

| window | dates | months |
|---|---|---|
| `y1` | 2024-10-01 .. 2025-09-30 | 12 |
| `y2` | 2025-10-01 .. 2026-09-30 (the "last 12 months") | 12 |
| `full` | 2024-10-01 .. 2026-09-30 | 24 |
| `l90` | 2026-07-01 .. 2026-09-30 (last 3 calendar months) | 3 |

Units: `_m` = euros (or counts) **per month** (window total / window months). Shares and rates are **fractions 0..1** here (the JSON
outputs show them as 0-100 %). Spend is positive euros.

| column | meaning |
|---|---|
| `income_salary_m`, `income_other_m`, `income_m` | salary, other income, their sum |
| `invest_withdraw_m`, `invest_m` | investment withdrawals, investment deposits |
| `housing_m` | housing payments per month (cash flow; months with no payment count as 0) |
| `housing_level` | median housing payment: the typical monthly rent (robust to the missing-month data artefact) |
| `housing_share` | `housing_level / income_m` |
| `utilities_m`, `utilities_share` | utilities per month and as share of income |
| `sweep_m`, `sweep_share` | salary-sweep transfers out, and their share of income |
| `purchases_m`, `n_purchases_m`, `median_ticket` | card purchases: euros/month, count/month, median purchase |
| `spend_<cat>_m`, `n_<cat>_m`, `share_<cat>` | per purchase category (`groceries, restaurants, transportation, entertainment, health, home_tech, lifestyle, travel`): euros/month, count/month, share of purchases |
| `basket_must_regular_m`, `basket_must_irregular_m`, `basket_everyday_m` | the three baskets (housing and utilities are in must_regular) |
| `share_must_regular`, `share_must_irregular`, `share_everyday` | shares of the three-basket total |
| `spend_total_m`, `must_m` | three-basket total; must_regular + must_irregular |
| `everyday_to_income`, `purchases_to_income` | everyday extras / income; card purchases / income |
| `small_n_m`, `small_total_m`, `small_count_share` | purchases under 10 €: count/month, euros/month, share of purchase count |
| `weekend_share`, `evening_share`, `late_share` | share of purchase euros on Sat-Sun, from 18:00, from 21:00 |
| `payday_burn` | share of everyday-extras euros spent on salary day + the next 4 days (uniform spending would give about 0.16) |
| `volatility`, `everyday_volatility` | coefficient of variation of monthly purchases / everyday extras across the window's months |
| `savings_rate` | (balance change per month + investment deposits - withdrawals) / income |
| `balance_change_rate` | balance change per month / income |
| `investing_rate` | investment deposits / income |
| `start_balance`, `end_balance`, `balance_change`, `avg_balance` | balance at the day before the window, at its end, the difference, average end-of-day balance |
| `min_balance` | lowest balance including intraday dips |
| `days_below_zero`, `below_zero_share` | calendar days whose intraday low was below zero, and the share of days |
| `buffer_months` | `end_balance / must_m` |
| `n_tx_m` | all transactions per month |

## Other tables

- `monthly.parquet`: (customer_id, month) for all 24 months: `salary, other_income, housing, utilities, invest_deposit, invest_withdraw, sweep,
  purchases, n_purchases, spend_<cat>, basket_<basket>, month_end_balance, month_low` (euros in that calendar month).
- `daily.parquet`: (customer_id, date) for every calendar day: `close` (end-of-day balance, carried forward) and `low` (intraday low, including the
  previous close).
- `customers.parquet`: `customer_id, age, postal_code, age_band (domain.json), cohort (main/tail), has_sweep, has_housing, has_invest`.
- `map.parquet` (written by `a_map.py`): `customer_id, x, y, tribe, fit, w0..wK-1` (soft tribe mix).
