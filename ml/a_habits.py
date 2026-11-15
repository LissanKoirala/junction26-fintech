"""Habit detector (ML-A step 5): recent sustained shifts in weekly spending. Idempotent.

Series per customer (104 rolling 7-day weeks ending on the as-of date): weekly spend and weekly count for each of the
8 purchase categories, small purchases (< 10 EUR) count and spend, and all everyday extras spend.
Detector: vectorised scan for the most recent single change point inside the last 52 weeks; the "after" segment must
hold >= 6 weeks; "before" = the 26 weeks preceding it. Statistic = Welch t. A shift is reported only if
|t| exceeds a threshold calibrated on time-shuffled copies of the same series (target false-positive rate 0.5% per series),
Cohen's d >= 0.8, relative change >= 20% and a minimum absolute change. Confidence = 1 - empirical p-value of |t|
under the shuffle null.

Writes ml/habits/{id}.json (MlHabits) for all 5,100 customers, global/modelcard-habits.json
usage: ~/mlenv/bin/python ml/a_habits.py
"""
import os, time
from datetime import date, timedelta
import numpy as np
import polars as pl
from common import DATA_DIR, GLOBAL_DIR, AS_OF, PURCHASE_CATEGORIES, load_tx, load_domain, add_basket_column, out_dir, write_json, is_tail_cohort

t0 = time.time()
D = load_domain()
CL = {k: v["label"] for k, v in D["categories"].items()}
ASOF = date.fromisoformat(AS_OF)
NW, MIN_AFTER, BEFORE, SEARCH = 104, 6, 26, 52
TARGET_FP = 0.005   # per series; ~19 series per customer
SMALL = D["smallPurchaseThreshold"]

tx = add_basket_column(load_tx(), D)
P = (tx.filter((pl.col("type") == "purchase") & (pl.col("date") > ASOF - timedelta(days=7 * NW)))
     .with_columns(pl.col("amount").abs().alias("amt"), ((pl.lit(ASOF) - pl.col("date")).dt.total_days() // 7).alias("b")))
ids = tx["customer_id"].unique().sort().to_list()
cidx = {c: i for i, c in enumerate(ids)}
NC = len(ids)

SERIES = []  # (key, label, metric, category filter expr)
for c in PURCHASE_CATEGORIES:
    k = c.lower().replace(" & ", "_").replace(" ", "_")
    SERIES.append((f"{k}_spend", CL[c], "weekly_spend", pl.col("category") == c, "amt"))
    SERIES.append((f"{k}_count", CL[c], "weekly_count", pl.col("category") == c, "n"))
SERIES.append(("small_count", "Small purchases", "weekly_count", pl.col("amt") < SMALL, "n"))
SERIES.append(("small_spend", "Small purchases", "weekly_spend", pl.col("amt") < SMALL, "amt"))
SERIES.append(("everyday_spend", "All everyday extras", "weekly_spend", pl.col("basket") == "everyday", "amt"))
NS = len(SERIES)

X = np.zeros((NC, NS, NW))
ticket = np.zeros((NC, NS))
for s, (key, lab, metric, filt, val) in enumerate(SERIES):
    g = P.filter(filt).group_by(["customer_id", "b"]).agg(pl.col("amt").sum().alias("amt"), pl.len().alias("n"))
    ci = np.array([cidx[c] for c in g["customer_id"]])
    X[ci, s, NW - 1 - g["b"].to_numpy()] = g[val].to_numpy()
    tk = P.filter(filt).group_by("customer_id").agg(pl.col("amt").median())
    ticket[[cidx[c] for c in tk["customer_id"]], s] = tk["amt"].to_numpy()
print(f"series {X.shape} ({time.time()-t0:.1f}s)")


def scan(X):
    """X (..., NW) -> best |t| split in the last SEARCH weeks with >= MIN_AFTER weeks after. Returns t, tstat, before, after, d."""
    best_t = np.zeros(X.shape[:-1]); best_s = np.full(X.shape[:-1], NW - MIN_AFTER)
    bb = np.zeros(X.shape[:-1]); ba = np.zeros(X.shape[:-1]); bd = np.zeros(X.shape[:-1])
    for t in range(NW - SEARCH, NW - MIN_AFTER + 1):
        pre, post = X[..., t - BEFORE:t], X[..., t:]
        m1, m2 = pre.mean(-1), post.mean(-1)
        v1, v2 = pre.var(-1, ddof=1), post.var(-1, ddof=1)
        se = np.sqrt(v1 / pre.shape[-1] + v2 / post.shape[-1]) + 1e-9
        ts = (m2 - m1) / se
        d = (m2 - m1) / (np.sqrt((v1 + v2) / 2) + 1e-9)
        upd = np.abs(ts) > np.abs(best_t)
        best_t = np.where(upd, ts, best_t); best_s = np.where(upd, t, best_s)
        bb = np.where(upd, m1, bb); ba = np.where(upd, m2, ba); bd = np.where(upd, d, bd)
    return best_t, best_s.astype(int), bb, ba, bd


def passes(ts, bb, ba, d, metric_is_count, thr):
    rel = np.abs(ba - bb) / np.maximum(bb, 1e-9)
    absmin = np.where(metric_is_count, 0.5, 3.0)
    return (np.abs(ts) >= thr) & (np.abs(d) >= 0.8) & (rel >= 0.2) & (np.abs(ba - bb) >= absmin) & (np.maximum(bb, ba) > 0)


is_count = np.array([s[2] == "weekly_count" for s in SERIES])[None, :]
main = np.array([not is_tail_cohort(c) for c in ids])
ts, tcp, bb, ba, dd = scan(X)
# shuffle null: permute each series in time (destroys any sustained shift, keeps the distribution)
rng = np.random.default_rng(11)
Xs = X[main].copy()
for _ in range(1):
    idx = np.argsort(rng.random(Xs.shape), axis=-1)
    Xs = np.take_along_axis(Xs, idx, -1)
nts, _, nbb, nba, ndd = scan(Xs)
null_abs = np.sort(np.abs(nts).ravel())
# threshold: smallest |t| such that the shuffled false-positive rate (all filters) <= TARGET_FP
thr = None
for cand in np.arange(2.0, 12.0, 0.1):
    fp = passes(nts, nbb, nba, ndd, is_count, cand).mean()
    if fp <= TARGET_FP:
        thr = float(cand); break
fp_rate = float(passes(nts, nbb, nba, ndd, is_count, thr).mean())
real_mask = passes(ts, bb, ba, dd, is_count, thr)
det_rate = float(real_mask[main].mean())
fp_rate_cust = float(passes(nts, nbb, nba, ndd, is_count, thr).any(1).mean())
det_rate_cust = float(real_mask[main].any(1).mean())
print(f"threshold |t|>={thr:.1f}: shuffled FP {fp_rate:.4f}/series ({fp_rate_cust:.3f} of customers); real detection {det_rate:.4f}/series "
      f"({det_rate_cust:.3f} of customers) ({time.time()-t0:.1f}s)")
conf = 1 - (len(null_abs) - np.searchsorted(null_abs, np.abs(ts))) / len(null_abs)

odir = out_dir("ml", "habits")
METHOD = (f"Weekly series (104 weeks). Most recent change point in the last {SEARCH} weeks (new level must hold >= {MIN_AFTER} weeks, "
          f"compared with the {BEFORE} weeks before); reported when Welch |t| >= {thr:.1f} (calibrated on time-shuffled series to a "
          f"{fp_rate:.1%} false-positive rate), Cohen's d >= 0.8 and change >= 20%.")
weekstarts = [str(ASOF - timedelta(days=7 * (NW - 1 - j) + 6)) for j in range(NW)]
n = 0
for ci, cid in enumerate(ids):
    hs = []
    for s in np.where(real_mask[ci])[0]:
        key, lab, metric, _, _ = SERIES[s]
        t = int(tcp[ci, s]); weeks = NW - t
        before, after = float(bb[ci, s]), float(ba[ci, s])
        direction = "up" if after > before else "down"
        per_month = (before - after) * 52 / 12
        impact = per_month * (ticket[ci, s] if metric == "weekly_count" else 1)
        status = "slipping" if direction == "up" else ("new_habit" if weeks >= 12 else "forming")
        hs.append({"key": key, "category": lab, "metric": metric, "direction": direction, "since": weekstarts[t], "weeks": weeks,
                   "before": round(before, 2), "after": round(after, 2), "changePct": round(100 * (after - before) / max(before, 1e-9), 1),
                   "monthlyImpact": round(float(impact), 2), "confidence": round(float(conf[ci, s]), 3), "status": status,
                   "series": [{"weekStart": weekstarts[j], "value": round(float(X[ci, s, j]), 2)} for j in range(NW - 40, NW)]})
    # one entry per category: keep the stronger of spend / count
    best = {}
    for h in sorted(hs, key=lambda h: (-h["confidence"], -abs(h["monthlyImpact"]))):
        best.setdefault(h["category"], h)
    out = sorted(best.values(), key=lambda h: (-h["confidence"] * abs(h["monthlyImpact"])))[:5]
    write_json(os.path.join(odir, f"{cid}.json"), {"id": cid, "asOf": AS_OF, "habits": out, "method": METHOD,
                                                   "falsePositiveRate": fp_rate})
    n += 1
print(f"wrote {n} habit files ({time.time()-t0:.1f}s)")

write_json(os.path.join(GLOBAL_DIR, "modelcard-habits.json"), {
    "key": "habits", "name": "Habit detector",
    "purpose": "Notice when a spending habit has really changed (and stayed changed), so small wins are praised and slips caught early.",
    "method": METHOD,
    "trainedOn": f"{int(main.sum())} main-cohort customers x {NS} weekly series, {weekstarts[0]}..{AS_OF}",
    "split": "No target labels. The threshold is calibrated on time-shuffled copies of the same series (the null of 'no sustained change'); "
             "detections on real series are compared with that null rate.",
    "metrics": [
        {"label": "Series flagged", "model": det_rate, "baseline": fp_rate, "baselineName": "same detector on shuffled series (false-positive rate)", "unit": "share", "better": "higher"},
        {"label": "Customers with at least one habit", "model": det_rate_cust, "baseline": fp_rate_cust, "baselineName": "shuffled series", "unit": "share", "better": "higher"},
    ],
    "verdict": "ships" if det_rate > 3 * fp_rate else ("experimental" if det_rate > 1.5 * fp_rate else "not_better_than_baseline"),
    "caveats": [f"Roughly {fp_rate / max(det_rate, 1e-9):.0%} of flagged shifts could be chance (shuffled false-positive rate / real detection rate).",
                "Weekly spending in this synthetic data is noisy and mostly stationary, so genuine habit changes are rare.",
                "A change point is a statistical shift, not a confirmed intention; the coach phrases it as a question."],
    "validation": {"threshold_t": thr, "fp_rate_series": fp_rate, "detection_rate_series": det_rate, "fp_rate_customers": fp_rate_cust,
                   "detection_rate_customers": det_rate_cust},
    "trainedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "trainSeconds": round(time.time() - t0, 1)})
