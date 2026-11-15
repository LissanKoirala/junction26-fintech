"""Build tx.parquet and the per-customer JSON files the app reads. Idempotent.

usage: ~/mlenv/bin/python ml/export_customers.py
"""
import json, os, time
import polars as pl
from common import RAW, PARQUET, CUSTOMERS_DIR, AS_OF, is_tail_cohort

t0 = time.time()
tx = pl.read_csv(os.path.join(RAW, "tx_junction_transactions.csv"), encoding="utf8-lossy",
                 schema_overrides={"mcc_code": pl.Utf8, "merchant_id": pl.Utf8, "tx_timestamp": pl.Utf8, "tx_date": pl.Utf8})
tx = tx.rename({c: c.lstrip("﻿") for c in tx.columns})
tx = tx.with_row_index("idx").select(
    pl.col("idx").cast(pl.Int64),
    pl.col("customer_id"),
    pl.col("tx_date").str.to_date("%Y-%m-%d").alias("date"),
    pl.col("tx_timestamp").str.slice(8, 8).alias("time"),          # "03OCT24:09:04:04" -> "09:04:04"
    pl.col("category"),
    pl.col("transaction_type").alias("type"),
    pl.col("tx_amount_eur").cast(pl.Float64).alias("amount"),
    pl.col("balance_after_eur").cast(pl.Float64).alias("balance"),
    pl.col("merchant_id"),
    pl.col("mcc_code").alias("mcc"),
).sort(["customer_id", "idx"])
tx = tx.with_columns((pl.col("date").cast(pl.Utf8) + " " + pl.col("time")).str.to_datetime("%Y-%m-%d %H:%M:%S").alias("ts"))
tx.write_parquet(PARQUET, compression="zstd")
print(f"parquet: {tx.height:,} rows, {tx['customer_id'].n_unique():,} customers, "
      f"{tx['date'].min()}..{tx['date'].max()}  ({time.time()-t0:.1f}s)")

cust = pl.read_csv(os.path.join(RAW, "tx_customers_junction.csv"), encoding="utf8-lossy",
                   schema_overrides={"customer_postal_code": pl.Utf8})
cust = cust.rename({c: c.lstrip("﻿") for c in cust.columns})
meta = {r["customer_id"]: r for r in cust.to_dicts()}

os.makedirs(CUSTOMERS_DIR, exist_ok=True)
index = []
for (cid,), g in tx.group_by(["customer_id"], maintain_order=True):
    m = meta[cid]
    rows = g.select(["date", "time", "category", "type", "amount", "balance", "merchant_id", "mcc"]).to_dicts()
    txs = [{"i": i, "date": str(r["date"]), "time": r["time"], "category": r["category"], "type": r["type"],
            "amount": round(r["amount"], 2), "balance": round(r["balance"], 2),
            "merchantId": r["merchant_id"], "mcc": r["mcc"]} for i, r in enumerate(rows)]
    types = set(g["type"].unique().to_list())
    sal = g.filter(pl.col("type") == "salary")["amount"]
    doc = {"id": cid, "age": int(m["customer_age"]), "postalCode": m["customer_postal_code"],
           "cohort": "tail" if is_tail_cohort(cid) else "main",
           "hasSalarySweep": "salary_sweep" in types, "hasHousing": "housing_payment" in types,
           "asOf": AS_OF, "tx": txs}
    with open(os.path.join(CUSTOMERS_DIR, f"{cid}.json"), "w") as f:
        json.dump(doc, f, separators=(",", ":"))
    index.append({"id": cid, "age": doc["age"], "postalCode": doc["postalCode"], "cohort": doc["cohort"],
                  "hasSalarySweep": doc["hasSalarySweep"], "hasHousing": doc["hasHousing"], "nTx": len(txs),
                  "medianSalary": round(float(sal.median()), 2) if sal.len() else None,
                  "endBalance": txs[-1]["balance"]})
with open(os.path.join(CUSTOMERS_DIR, "index.json"), "w") as f:
    json.dump(index, f, separators=(",", ":"))
print(f"wrote {len(index):,} customer files + index.json ({time.time()-t0:.1f}s)")
