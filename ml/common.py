"""Shared constants and loaders for the ML pipeline. Runs on the VM only (python: ~/mlenv/bin/python).

Data layout on the VM (DATA_DIR, default ~/data):
  raw/                      original CSVs from the challenge repo (read-only)
  tx.parquet                cleaned transactions (built by export_customers.py)
  customers/{id}.json       per-customer transactions for the app  (+ customers/index.json)
  ml/<feature>/{id}.json    per-customer model outputs
  global/*.json             dataset-wide outputs (map, tribes, benchmarks, model cards ...)
"""
import os

DATA_DIR = os.environ.get("DATA_DIR", os.path.expanduser("~/data"))
RAW = os.path.join(DATA_DIR, "raw")
PARQUET = os.path.join(DATA_DIR, "tx.parquet")
CUSTOMERS_DIR = os.path.join(DATA_DIR, "customers")
ML_DIR = os.path.join(DATA_DIR, "ml")
GLOBAL_DIR = os.path.join(DATA_DIR, "global")

AS_OF = "2026-09-30"          # last day in the data == "today" everywhere in the product (a Wednesday)
DATA_START = "2024-10-01"
YEAR1 = ("2024-10-01", "2025-09-30")
YEAR2 = ("2025-10-01", "2026-09-30")

PURCHASE_CATEGORIES = ["Groceries", "Restaurants", "Transportation", "Entertainment",
                       "Health", "Home & Tech", "Lifestyle", "Travel"]
INCOME_TYPES = ["salary", "other_income", "investment_withdrawal"]


def is_tail_cohort(customer_id: str) -> bool:
    """CUST05001..CUST05100 are a separate irregular-income cohort; keep them out of model fitting."""
    return customer_id > "CUST05000"


def load_tx():
    """Whole transaction table as a polars DataFrame, sorted by (customer_id, idx)."""
    import polars as pl
    return pl.read_parquet(PARQUET)


def out_dir(*parts: str) -> str:
    p = os.path.join(DATA_DIR, *parts)
    os.makedirs(p, exist_ok=True)
    return p


# ---------------------------------------------------------------- additive helpers (ML-A)
import json as _json

DOMAIN_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "app", "shared", "domain.json")
FEATURES_PARQUET = os.path.join(DATA_DIR, "features", "features.parquet")   # long: one row per (customer, window)
CACHE_DIR = os.path.join(DATA_DIR, "cache")                                   # survives bin/sync --delete
WINDOWS = {"y1": YEAR1, "y2": YEAR2, "full": (DATA_START, AS_OF), "l90": ("2026-07-01", AS_OF)}  # l90 = last 3 calendar months


def load_domain() -> dict:
    with open(DOMAIN_PATH) as f:
        return _json.load(f)


def age_band(age: int, domain: dict | None = None) -> str:
    d = domain or load_domain()
    for b in d["ageBands"]:
        if b["min"] <= age <= b["max"]:
            return b["key"]
    return d["ageBands"][-1]["key"]


def add_basket_column(tx, domain: dict | None = None):
    """Add `basket` (must_regular / must_irregular / everyday / saving / transfer / income) to a polars tx frame,
    implementing domain.json basketRules, including the Home & Tech big-purchase rule (per-customer median over the
    rows passed in; pass all of a customer's history up to the as-of date)."""
    import polars as pl
    d = domain or load_domain()
    r = d["basketRules"]
    bp = r["bigPurchase"]
    ht_med = (tx.filter((pl.col("type") == "purchase") & (pl.col("category") == "Home & Tech"))
                .group_by("customer_id").agg(pl.col("amount").abs().median().alias("_ht_med")))
    tx = tx.join(ht_med, on="customer_id", how="left")
    # purchases: big-purchase rule, mcc overrides, category default (evaluated top to bottom)
    chain = pl.when(pl.lit(False)).then(pl.lit(None, dtype=pl.Utf8))
    for cat, rule in r["purchases"].items():
        is_cat = (pl.col("type") == "purchase") & (pl.col("category") == cat)
        if "bigPurchase" in rule:
            big = pl.col("amount").abs() >= pl.max_horizontal(pl.lit(bp["minAmount"]), pl.col("_ht_med").fill_null(0) * bp["medianMultiple"])
            chain = chain.when(is_cat & big).then(pl.lit(rule["bigPurchase"]))
        for mcc, b in rule.get("mcc", {}).items():
            cond = is_cat & (pl.col("mcc") == mcc)
            chain = chain.when(cond).then(pl.lit(b))
        chain = chain.when(is_cat).then(pl.lit(rule["default"]))
    for t, b in r["byType"].items():
        chain = chain.when(pl.col("type") == t).then(pl.lit(b))
    expr = chain.otherwise(pl.lit(None, dtype=pl.Utf8))
    return tx.with_columns(expr.alias("basket")).drop("_ht_med")


def _clean(o):
    import math
    import numpy as np
    if isinstance(o, dict):
        return {k: _clean(v) for k, v in o.items()}
    if isinstance(o, (list, tuple)):
        return [_clean(v) for v in o]
    if isinstance(o, (np.floating,)):
        o = float(o)
    if isinstance(o, (np.integer,)):
        return int(o)
    if isinstance(o, (np.bool_,)):
        return bool(o)
    if isinstance(o, float):
        if math.isnan(o) or math.isinf(o):
            return None
        return round(o, 4) if abs(o) < 10 else round(o, 2)
    return o


def write_json(path: str, obj) -> None:
    """Write JSON atomically with NaN -> null and sensible rounding (euros 2 dp, small ratios 4 dp)."""
    os.makedirs(os.path.dirname(path), exist_ok=True)
    tmp = path + ".tmp"
    with open(tmp, "w") as f:
        _json.dump(_clean(obj), f, separators=(",", ":"), ensure_ascii=False)
    os.replace(tmp, path)


def main_ids(customers: list[str]) -> list[str]:
    return [c for c in customers if not is_tail_cohort(c)]
