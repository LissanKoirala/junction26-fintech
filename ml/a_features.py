"""Per-customer behaviour feature store (ML-A step 1). Idempotent.

Writes (DATA_DIR):
  features/features.parquet     one row per (customer_id, window); windows y1, y2, full, l90 (see common.WINDOWS)
  features/monthly.parquet      one row per (customer_id, month): income, spend per category / basket, month-end balance
  features/daily.parquet        one row per (customer_id, date): end-of-day close and intraday low (calendar complete)
  features/customers.parquet    customer_id, age, age_band, cohort, has_sweep, has_housing, has_invest
Columns are documented in ml/FEATURES.md.

usage: ~/mlenv/bin/python ml/a_features.py
"""
import os, time
from datetime import date, timedelta
import polars as pl
from common import (RAW, AS_OF, DATA_START, WINDOWS, PURCHASE_CATEGORIES, load_tx, load_domain, add_basket_column,
                    age_band, out_dir, is_tail_cohort)

t0 = time.time()
D = load_domain()
FEAT = out_dir("features")
SMALL = D["smallPurchaseThreshold"]
CAT_KEY = {c: c.lower().replace(" & ", "_").replace(" ", "_") for c in PURCHASE_CATEGORIES}  # "Home & Tech" -> home_tech


def d(s: str) -> date:
    return date.fromisoformat(s)


tx = load_tx().filter(pl.col("date") <= d(AS_OF))
tx = add_basket_column(tx, D)
tx = tx.with_columns(pl.col("date").dt.weekday().alias("wd"), pl.col("time").str.slice(0, 2).cast(pl.Int32).alias("hour"),
                     (-pl.col("amount")).alias("out"))

# ---- payday burn flag: purchase within salary day .. salary day + 4 (5 days)
sal = (tx.filter(pl.col("type") == "salary").select("customer_id", pl.col("date").alias("sal_date"))
         .unique().sort(["customer_id", "sal_date"]))
tx = tx.sort(["customer_id", "date"]).join_asof(sal, left_on="date", right_on="sal_date", by="customer_id", strategy="backward")
tx = tx.with_columns(((pl.col("date") - pl.col("sal_date")).dt.total_days() <= 4).fill_null(False).alias("burn")).sort(["customer_id", "idx"])

# ---- daily calendar panel (close + intraday low)
days = pl.date_range(d(DATA_START), d(AS_OF), "1d", eager=True).alias("date")
ids = tx.select("customer_id").unique().sort("customer_id")
opening = tx.group_by("customer_id").agg((pl.col("balance").first() - pl.col("amount").first()).alias("opening"))
day = tx.group_by(["customer_id", "date"]).agg(pl.col("balance").last().alias("close_tx"), pl.col("balance").min().alias("low_tx"))
panel = (ids.join(pl.DataFrame(days), how="cross").join(day, on=["customer_id", "date"], how="left")
         .join(opening, on="customer_id").sort(["customer_id", "date"]))
panel = panel.with_columns(pl.col("close_tx").forward_fill().over("customer_id").alias("close"))
panel = panel.with_columns(pl.col("close").fill_null(pl.col("opening")))
panel = panel.with_columns(pl.col("close").shift(1).over("customer_id").fill_null(pl.col("opening")).alias("prev_close"))
panel = panel.with_columns(pl.min_horizontal("prev_close", pl.col("low_tx").fill_null(pl.col("close"))).alias("low"))
daily = panel.select("customer_id", "date", pl.col("close").round(2), pl.col("low").round(2), "opening")
daily.drop("opening").write_parquet(os.path.join(FEAT, "daily.parquet"))
print(f"daily panel {daily.height:,} rows ({time.time()-t0:.1f}s)")

# ---- monthly table
tx = tx.with_columns(pl.col("date").dt.truncate("1mo").alias("month"))
pur = tx.filter(pl.col("type") == "purchase")
monthly = (tx.group_by(["customer_id", "month"]).agg(
    pl.col("amount").filter(pl.col("type") == "salary").sum().alias("salary"),
    pl.col("amount").filter(pl.col("type") == "other_income").sum().alias("other_income"),
    pl.col("out").filter(pl.col("type") == "housing_payment").sum().alias("housing"),
    pl.col("out").filter(pl.col("type") == "utilities_payment").sum().alias("utilities"),
    pl.col("out").filter(pl.col("type") == "investment_deposit").sum().alias("invest_deposit"),
    pl.col("amount").filter(pl.col("type") == "investment_withdrawal").sum().alias("invest_withdraw"),
    pl.col("out").filter(pl.col("type") == "salary_sweep").sum().alias("sweep"),
    pl.col("out").filter(pl.col("type") == "purchase").sum().alias("purchases"),
    pl.col("type").filter(pl.col("type") == "purchase").len().alias("n_purchases"),
    *[pl.col("out").filter((pl.col("type") == "purchase") & (pl.col("category") == c)).sum().alias(f"spend_{k}") for c, k in CAT_KEY.items()],
    *[pl.col("out").filter(pl.col("basket") == b).sum().alias(f"basket_{b}") for b in ["must_regular", "must_irregular", "everyday"]],
))
ids_m = ids.join(pl.DataFrame(pl.date_range(d(DATA_START), d(AS_OF), "1mo", eager=True).alias("month")), how="cross")
monthly = ids_m.join(monthly, on=["customer_id", "month"], how="left").fill_null(0)
mend = (daily.with_columns(pl.col("date").dt.truncate("1mo").alias("month")).group_by(["customer_id", "month"])
        .agg(pl.col("close").last().alias("month_end_balance"), pl.col("low").min().alias("month_low")))
monthly = monthly.join(mend, on=["customer_id", "month"], how="left").sort(["customer_id", "month"])
monthly.write_parquet(os.path.join(FEAT, "monthly.parquet"))
print(f"monthly {monthly.height:,} rows ({time.time()-t0:.1f}s)")


# ---- window features
def window_features(name: str, start: str, end: str) -> pl.DataFrame:
    s, e = d(start), d(end)
    n_days = (e - s).days + 1
    months = n_days / 30.4375
    w = tx.filter(pl.col("date").is_between(s, e))
    p = w.filter(pl.col("type") == "purchase")
    agg = w.group_by("customer_id").agg(
        (pl.col("amount").filter(pl.col("type") == "salary").sum() / months).alias("income_salary_m"),
        (pl.col("amount").filter(pl.col("type") == "other_income").sum() / months).alias("income_other_m"),
        (pl.col("amount").filter(pl.col("type") == "investment_withdrawal").sum() / months).alias("invest_withdraw_m"),
        (pl.col("out").filter(pl.col("type") == "housing_payment").sum() / months).alias("housing_m"),
        # typical monthly rent: median payment (robust to the missing-month artefact in the data)
        pl.col("out").filter(pl.col("type") == "housing_payment").median().alias("housing_level"),
        (pl.col("out").filter(pl.col("type") == "utilities_payment").sum() / months).alias("utilities_m"),
        (pl.col("out").filter(pl.col("type") == "investment_deposit").sum() / months).alias("invest_m"),
        (pl.col("out").filter(pl.col("type") == "salary_sweep").sum() / months).alias("sweep_m"),
        *[(pl.col("out").filter(pl.col("basket") == b).sum() / months).alias(f"basket_{b}_m") for b in ["must_regular", "must_irregular", "everyday"]],
        (pl.len() / months).alias("n_tx_m"),
    )
    pagg = p.group_by("customer_id").agg(
        (pl.col("out").sum() / months).alias("purchases_m"),
        (pl.len() / months).alias("n_purchases_m"),
        pl.col("out").median().alias("median_ticket"),
        *[(pl.col("out").filter(pl.col("category") == c).sum() / months).alias(f"spend_{k}_m") for c, k in CAT_KEY.items()],
        *[(pl.col("out").filter(pl.col("category") == c).len() / months).alias(f"n_{k}_m") for c, k in CAT_KEY.items()],
        (pl.col("out").filter(pl.col("out") < SMALL).len() / months).alias("small_n_m"),
        (pl.col("out").filter(pl.col("out") < SMALL).sum() / months).alias("small_total_m"),
        (pl.col("out").filter(pl.col("wd") >= 6).sum() / pl.col("out").sum()).alias("weekend_share"),
        (pl.col("out").filter(pl.col("hour") >= 18).sum() / pl.col("out").sum()).alias("evening_share"),
        (pl.col("out").filter(pl.col("hour") >= 21).sum() / pl.col("out").sum()).alias("late_share"),
        (pl.col("out").filter((pl.col("basket") == "everyday") & pl.col("burn")).sum()
         / pl.col("out").filter(pl.col("basket") == "everyday").sum()).alias("payday_burn"),
        pl.col("burn").filter(pl.col("sal_date").is_not_null()).len().alias("_has_sal_rows"),
    )
    mon = monthly.filter(pl.col("month").is_between(s.replace(day=1), e))
    vol = mon.group_by("customer_id").agg(
        (pl.col("purchases").std() / pl.col("purchases").mean()).alias("volatility"),
        (pl.col("basket_everyday").std() / pl.col("basket_everyday").mean()).alias("everyday_volatility"))
    dw = daily.filter(pl.col("date").is_between(s, e))
    bal = dw.group_by("customer_id").agg(
        pl.col("low").min().alias("min_balance"),
        (pl.col("low") < 0).sum().alias("days_below_zero"),
        pl.col("close").last().alias("end_balance"),
        pl.col("close").mean().alias("avg_balance"),
    )
    startb = (daily.filter(pl.col("date") == s - timedelta(days=1)).select("customer_id", pl.col("close").alias("start_balance"))
              if s > d(DATA_START) else opening.rename({"opening": "start_balance"}))
    f = (ids.join(agg, on="customer_id", how="left").join(pagg, on="customer_id", how="left").join(vol, on="customer_id", how="left")
         .join(bal, on="customer_id", how="left").join(startb, on="customer_id", how="left"))
    num = [c for c, t in f.schema.items() if t.is_numeric() and c not in ("weekend_share", "evening_share", "late_share", "payday_burn",
                                                                            "volatility", "everyday_volatility", "median_ticket")]
    f = f.with_columns([pl.col(c).fill_null(0) for c in num])
    f = f.with_columns(
        (pl.col("income_salary_m") + pl.col("income_other_m")).alias("income_m"),
        (pl.col("end_balance") - pl.col("start_balance")).alias("balance_change"),
        (pl.col("basket_must_regular_m") + pl.col("basket_must_irregular_m") + pl.col("basket_everyday_m")).alias("spend_total_m"),
        (pl.col("basket_must_regular_m") + pl.col("basket_must_irregular_m")).alias("must_m"),
    )
    inc = pl.when(pl.col("income_m") > 0).then(pl.col("income_m")).otherwise(None)
    f = f.with_columns(
        (pl.col("housing_level") / inc).alias("housing_share"),
        (pl.col("utilities_m") / inc).alias("utilities_share"),
        (pl.col("purchases_m") / inc).alias("purchases_to_income"),
        (pl.col("basket_everyday_m") / inc).alias("everyday_to_income"),
        (pl.col("invest_m") / inc).alias("investing_rate"),
        ((pl.col("balance_change") / months + pl.col("invest_m") - pl.col("invest_withdraw_m")) / inc).alias("savings_rate"),
        (pl.col("balance_change") / months / inc).alias("balance_change_rate"),
        (pl.col("sweep_m") / inc).alias("sweep_share"),
        (pl.col("end_balance") / pl.when(pl.col("must_m") > 0).then(pl.col("must_m")).otherwise(None)).alias("buffer_months"),
        (pl.col("days_below_zero") / n_days).alias("below_zero_share"),
        (pl.col("small_n_m") / pl.when(pl.col("n_purchases_m") > 0).then(pl.col("n_purchases_m")).otherwise(None)).alias("small_count_share"),
        *[(pl.col(f"spend_{k}_m") / pl.when(pl.col("purchases_m") > 0).then(pl.col("purchases_m")).otherwise(None)).alias(f"share_{k}")
          for k in CAT_KEY.values()],
        *[(pl.col(f"basket_{b}_m") / pl.when(pl.col("spend_total_m") > 0).then(pl.col("spend_total_m")).otherwise(None)).alias(f"share_{b}")
          for b in ["must_regular", "must_irregular", "everyday"]],
    )
    return f.drop("_has_sal_rows").with_columns(pl.lit(name).alias("window"), pl.lit(start).alias("window_start"),
                                                pl.lit(end).alias("window_end"), pl.lit(round(months, 3)).alias("months"))


feats = pl.concat([window_features(n, s, e) for n, (s, e) in WINDOWS.items()], how="diagonal_relaxed")
first = ["customer_id", "window", "window_start", "window_end", "months"]
feats = feats.select(first + sorted(c for c in feats.columns if c not in first))
feats.write_parquet(os.path.join(FEAT, "features.parquet"))

cust = pl.read_csv(os.path.join(RAW, "tx_customers_junction.csv"), encoding="utf8-lossy", schema_overrides={"customer_postal_code": pl.Utf8})
cust = cust.rename({c: c.lstrip("﻿") for c in cust.columns})
types = tx.group_by("customer_id").agg(
    (pl.col("type") == "salary_sweep").any().alias("has_sweep"), (pl.col("type") == "housing_payment").any().alias("has_housing"),
    (pl.col("type") == "investment_deposit").any().alias("has_invest"))
cust = (cust.select("customer_id", pl.col("customer_age").alias("age"), pl.col("customer_postal_code").alias("postal_code"))
        .join(types, on="customer_id", how="left")
        .with_columns(pl.col("age").map_elements(lambda a: age_band(a, D), return_dtype=pl.Utf8).alias("age_band"),
                      pl.col("customer_id").map_elements(lambda c: "tail" if is_tail_cohort(c) else "main", return_dtype=pl.Utf8).alias("cohort")))
cust.write_parquet(os.path.join(FEAT, "customers.parquet"))
print(f"features {feats.shape} -> {FEAT} ({time.time()-t0:.1f}s)")
a = feats.filter((pl.col("customer_id") == "CUST04754") & (pl.col("window") == "y2")).to_dicts()[0]
print({k: (round(v, 3) if isinstance(v, float) else v) for k, v in a.items()})
