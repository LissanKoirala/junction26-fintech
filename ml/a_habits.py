"""Habit detector (ML-A step 5): recent sustained shifts in weekly spending. Idempotent.

Series per customer (104 rolling 7-day weeks ending on the as-of date): weekly spend and weekly count for each of the
8 purchase categories, small purchases (< 10 EUR) count and spend, and all everyday extras spend.
Detector: vectorised scan for the most recent single change point inside the last 52 weeks; the "after" segment must
hold >= 6 weeks; "before" = the 26 weeks preceding it. Statistic = Welch t. A shift is reported only if
|t| exceeds a threshold calibrated on 4-week block-shuffled copies of the same series (at most 1% of shuffled series
flagged), Cohen's d >= 0.8, relative change >= 20% and a minimum absolute change. Confidence = 1 - empirical p-value of
|t| under the shuffle null.

How many flags are chance depends on the null: the same detector is also run on copies with 8- and 13-week blocks
shuffled (longer blocks keep more of the real structure, so they flag more). All three are reported; the result is
sensitive to the block length, so the verdict is "experimental" unless the real rate is 3x every null.

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
TARGET_FP = 0.01    # per series, measured on the block-shuffled null (see below); ~19 series per customer
BLOCK = 4           # weeks per block in the block-shuffle null the threshold is calibrated on
BLOCKS = (4, 8, 13)  # block lengths reported (all divide NW = 104); the result depends on this choice
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
# Nulls of "no sustained change", all built from the real series:
#   weeks  = every week shuffled independently (destroys all structure in time; too easy to beat when weeks are correlated)
#   blocks = B-week blocks shuffled (keeps runs up to B weeks). The threshold is calibrated on 4-week blocks. Longer blocks
#            (8, 13 weeks) keep more of the real autocorrelation but also more of any real shift, and they flag far more:
#            the share of flags that could be chance is not pinned down by this test, so all three are reported.
rng = np.random.default_rng(11)
Xm = X[main]
Xs = np.take_along_axis(Xm, np.argsort(rng.random(Xm.shape), axis=-1), -1)
order = np.argsort(rng.random(Xm.shape[:-1] + (NW // BLOCK,)), axis=-1)
bidx = (order[..., :, None] * BLOCK + np.arange(BLOCK)).reshape(Xm.shape[:-1] + (NW,))
Xb = np.take_along_axis(Xm, bidx, -1)
nts, _, nbb, nba, ndd = scan(Xs)
bts, btc, bbb, bba, bdd = scan(Xb)
null_abs = np.sort(np.abs(bts).ravel())
thr = None
for cand in np.arange(2.0, 14.0, 0.1):
    if passes(bts, bbb, bba, bdd, is_count, cand).mean() <= TARGET_FP:
        thr = float(cand); break
if thr is None:
    thr = 14.0
fp_block = float(passes(bts, bbb, bba, bdd, is_count, thr).mean())
fp_weeks = float(passes(nts, nbb, nba, ndd, is_count, thr).mean())
fp_rate = fp_block
real_mask = passes(ts, bb, ba, dd, is_count, thr)
det_rate = float(real_mask[main].mean())
fp_rate_cust = float(passes(bts, bbb, bba, bdd, is_count, thr).any(1).mean())
fp_weeks_cust = float(passes(nts, nbb, nba, ndd, is_count, thr).any(1).mean())
det_rate_cust = float(real_mask[main].any(1).mean())
chance_lo, chance_hi = fp_weeks / max(det_rate, 1e-9), fp_block / max(det_rate, 1e-9)
print(f"threshold |t|>={thr:.1f}: false positives {fp_weeks:.4f} (weeks shuffled) / {fp_block:.4f} (4-week blocks) per series; "
      f"real detection {det_rate:.4f}/series ({det_rate_cust:.3f} of customers vs {fp_rate_cust:.3f} on block null) ({time.time()-t0:.1f}s)")


def block_null(B, seed):
    """Same detector and threshold on B-week block-shuffled copies of the main-cohort series -> (per series, per customer)."""
    r = np.random.default_rng(seed)
    o = np.argsort(r.random(Xm.shape[:-1] + (NW // B,)), axis=-1)
    idx = (o[..., :, None] * B + np.arange(B)).reshape(Xm.shape[:-1] + (NW,))
    t_, _, b_, a_, d_ = scan(np.take_along_axis(Xm, idx, -1))
    p = passes(t_, b_, a_, d_, is_count, thr)
    return float(p.mean()), float(p.any(1).mean())


NULLS = {}
for B in BLOCKS:
    s, c = (fp_block, fp_rate_cust) if B == BLOCK else block_null(B, 100 + B)
    NULLS[B] = {"series": s, "customers": c, "chanceShare": s / max(det_rate, 1e-9), "customerChance": c / max(det_rate_cust, 1e-9),
                "ratio": det_rate / max(s, 1e-9), "customerRatio": det_rate_cust / max(c, 1e-9)}
    print(f"  {B:>2}-week blocks: {s:.4f}/series ({NULLS[B]['ratio']:.1f}x), {c:.3f} of customers ({NULLS[B]['customerRatio']:.1f}x)")
N4, N8, N13 = NULLS[4], NULLS[8], NULLS[13]
# "ships" only if the real data beats every null 3x, per series and per customer; "experimental" if it beats the
# calibration null (4-week blocks) 1.5x per series; otherwise not better than chance.
if all(v["ratio"] >= 3 and v["customerRatio"] >= 3 for v in NULLS.values()):
    VERDICT = "ships"
elif N4["ratio"] >= 1.5:
    VERDICT = "experimental"
else:
    VERDICT = "not_better_than_baseline"
CHANCE_SHARE = min(1.0, N8["chanceShare"])  # per-customer files: the middle reading (8-week blocks)
conf = 1 - (len(null_abs) - np.searchsorted(null_abs, np.abs(ts))) / len(null_abs)

odir = out_dir("ml", "habits")
METHOD = (f"Weekly series (104 weeks). Most recent change point in the last {SEARCH} weeks (new level must hold >= {MIN_AFTER} weeks, "
          f"compared with the {BEFORE} weeks before); reported when Welch |t| >= {thr:.1f} (calibrated so that at most {TARGET_FP:.0%} of "
          f"{BLOCK}-week block-shuffled series are flagged), Cohen's d >= 0.8 and change >= 20%.")
weekstarts = [str(ASOF - timedelta(days=7 * (NW - 1 - j) + 6)) for j in range(NW)]
# structure the shuffles cannot reproduce: share of change points in a week that contains the 1st of a month
MONTH_START = np.array([any((date.fromisoformat(w) + timedelta(days=k)).day == 1 for k in range(7)) for w in weekstarts])
ms_real = float(MONTH_START[tcp[main][real_mask[main]]].mean())
ms_null = float(MONTH_START[btc[passes(bts, bbb, bba, bdd, is_count, thr)]].mean())
ms_weeks = float(MONTH_START[NW - SEARCH: NW - MIN_AFTER + 1].mean())
print(f"change points in a month-start week: real {ms_real:.2f}, 4-week block null {ms_null:.2f}, share of such weeks {ms_weeks:.2f}")
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
                                                   "falsePositiveRate": fp_rate, "chanceShare": round(CHANCE_SHARE, 3),
                                                   "chanceShareRange": [round(min(1.0, N4["chanceShare"]), 3), round(min(1.0, N13["chanceShare"]), 3)]})
    n += 1
print(f"wrote {n} habit files ({time.time()-t0:.1f}s)")

write_json(os.path.join(GLOBAL_DIR, "modelcard-habits.json"), {
    "key": "habits", "name": "Habit detector",
    "purpose": "Notice when a spending habit has really changed (and stayed changed), so small wins are praised and slips caught early.",
    "method": METHOD,
    "trainedOn": f"{int(main.sum())} main-cohort customers x {NS} weekly series, {weekstarts[0]}..{AS_OF}",
    "split": "No target labels. The same detector is run on shuffled copies of the real series, where no sustained change exists by "
             f"construction: weeks shuffled independently, and blocks of {', '.join(str(b) for b in BLOCKS[:-1])} or {BLOCKS[-1]} weeks shuffled "
             f"(longer blocks keep more of the real week-to-week structure). The threshold is calibrated on the {BLOCK}-week copy; the other "
             "block lengths are reported because the result depends on that choice.",
    "metrics": [
        # strongest null first (the overview and the chat quote metrics[0])
        *[{"label": "Series flagged", "model": det_rate, "baseline": NULLS[B]["series"], "baselineName": f"same detector on {B}-week block-shuffled series",
           "unit": "share", "better": "higher"} for B in sorted(BLOCKS, reverse=True)],
        {"label": "Series flagged", "model": det_rate, "baseline": fp_weeks, "baselineName": "same detector on week-shuffled series", "unit": "share", "better": "higher"},
        *[{"label": "Customers with at least one habit", "model": det_rate_cust, "baseline": NULLS[B]["customers"], "baselineName": f"{B}-week block-shuffled series",
           "unit": "share", "better": "higher"} for B in BLOCKS[:2]],
    ],
    "verdict": VERDICT,
    "caveats": [f"How many flagged shifts could be chance depends on the null, and this test does not pin it down: about {N4['chanceShare']:.0%} with "
                f"{BLOCK}-week blocks shuffled, {N8['chanceShare']:.0%} with 8-week blocks and {N13['chanceShare']:.0%} with 13-week blocks "
                f"({chance_lo:.0%} with single weeks shuffled, a null that is too easy). The block length was chosen by hand.",
                f"Per customer, {det_rate_cust:.0%} have at least one flagged shift, against {N4['customers']:.0%} on {BLOCK}-week block-shuffled series "
                f"and {N8['customers']:.0%} on 8-week blocks: about {round(10 * min(1, N4['customerChance']))} in 10 customers with a flag could have one "
                "by chance even on the most lenient block null. A flag is a prompt for a question, not a finding about the person.",
                f"There is real structure the shuffles do not reproduce: {ms_real:.0%} of real change points fall in a week that contains the 1st of "
                f"a month, against {ms_weeks:.0%} of the weeks searched and {ms_null:.0%} on the {BLOCK}-week block null. What share of the flags it "
                "accounts for is not known.",
                "A change point is a statistical shift, not a confirmed intention; the coach phrases it as a question."],
    "validation": {"threshold_t": thr, "fp_rate_series_blocks": fp_block, "fp_rate_series_weeks": fp_weeks, "fp_rate_customers_weeks": fp_weeks_cust,
                   "chance_share_range": [chance_lo, chance_hi], "block_weeks": BLOCK, "fp_rate_series": fp_rate, "detection_rate_series": det_rate, "fp_rate_customers": fp_rate_cust,
                   "detection_rate_customers": det_rate_cust, "n_customers": int(main.sum()),
                   "byBlockLength": {str(B): v for B, v in NULLS.items()},
                   "monthStartShare": {"real": ms_real, "blockNull": ms_null, "weeks": ms_weeks}},
    "trainedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "trainSeconds": round(time.time() - t0, 1)})
