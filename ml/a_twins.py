"""Two Futures: money twins from a year ago (ML-A step 3). Idempotent.

For customer c, the query is c's YEAR-2 behaviour (2025-10..2026-09). Candidates are other main-cohort customers'
YEAR-1 behaviour (2024-10..2025-09) with comparable income. Their YEAR-2 is "what happened next". Euros are scaled
by income ratio (this customer's monthly income / twin's year-1 monthly income).

Validation (time split): held-out 20% of customers; query = their YEAR-1 features, twins = training customers'
YEAR-1 features, prediction = median twin YEAR-2 outcome; target = the held-out customer's own YEAR-2 balance change
relative to income. Compared with the population mean and with "same as last year" persistence.

Writes ml/twins/{id}.json (MlTwins) for main-cohort customers, global/modelcard-twins.json
usage: ~/mlenv/bin/python ml/a_twins.py [CUST...]
"""
import os, sys, time
import numpy as np
import polars as pl
from joblib import Parallel, delayed
from scipy.stats import spearmanr
from common import DATA_DIR, GLOBAL_DIR, AS_OF, YEAR1, YEAR2, out_dir, write_json, is_tail_cohort
from a_dict import label, unit, disp

t0 = time.time()
K = 100
MATCH = ["income_m", "housing_share", "everyday_to_income", "purchases_to_income", "savings_rate", "investing_rate",
         "buffer_months", "below_zero_share", "share_restaurants", "share_groceries", "share_entertainment", "share_lifestyle",
         "share_travel", "share_transportation", "share_everyday", "small_count_share", "payday_burn", "volatility",
         "weekend_share", "sweep_share", "utilities_share"]
LOG = {"income_m", "buffer_months"}
WEIGHT = {"income_m": 2.0, "savings_rate": 1.5, "everyday_to_income": 1.5, "buffer_months": 1.5, "housing_share": 1.5}
SHOW_MATCH = ["income_m", "housing_share", "everyday_to_income", "savings_rate", "buffer_months", "share_restaurants"]
CHANGE_CATS = ["spend_groceries_m", "spend_restaurants_m", "spend_transportation_m", "spend_entertainment_m", "spend_health_m",
               "spend_home_tech_m", "spend_lifestyle_m", "spend_travel_m", "basket_everyday_m", "invest_m"]
DIFF = [("spend_restaurants_m", True), ("spend_entertainment_m", True), ("spend_lifestyle_m", True), ("spend_travel_m", True),
        ("spend_home_tech_m", True), ("spend_transportation_m", True), ("basket_everyday_m", True), ("basket_must_irregular_m", True),
        ("small_total_m", True), ("invest_m", True), ("payday_burn", False),
        ("weekend_share", False), ("n_purchases_m", False)]
DIFF_KEYS = [k for k, _ in DIFF]
EURO = dict(DIFF)

F = pl.read_parquet(os.path.join(DATA_DIR, "features", "features.parquet"))
main = lambda df: df.filter(~pl.col("customer_id").str.slice(4).cast(pl.Int32).gt(5000)).sort("customer_id")
Y1 = main(F.filter(pl.col("window") == "y1"))
Y2 = main(F.filter(pl.col("window") == "y2"))
ids = Y1["customer_id"].to_list()
assert ids == Y2["customer_id"].to_list()
n = len(ids)

M = pl.read_parquet(os.path.join(DATA_DIR, "features", "monthly.parquet")).filter(pl.col("customer_id").is_in(ids)).sort(["customer_id", "month"])
MEB = M["month_end_balance"].to_numpy().reshape(n, 24)             # months Oct 2024 .. Sep 2026
open_bal = Y1["start_balance"].to_numpy()
y1_end = MEB[:, 11]                                                 # 2025-09-30
path_y2 = MEB[:, 11:24] - y1_end[:, None]                           # months 0..12 of the follow-up year (raw euros)


def mat(df):
    X = df.select(MATCH).to_numpy().astype(float)
    for j, k in enumerate(MATCH):
        if k in LOG:
            X[:, j] = np.log1p(np.clip(X[:, j], 0, None))
    return X


X1, X2 = mat(Y1), mat(Y2)
pool = np.vstack([X1, X2])
lo, hi = np.nanpercentile(pool, 1, 0), np.nanpercentile(pool, 99, 0)
med = np.nanmedian(pool, 0)
mu = np.nanmean(np.clip(pool, lo, hi), 0); sd = np.nanstd(np.clip(pool, lo, hi), 0) + 1e-9
w = np.array([WEIGHT.get(k, 1.0) for k in MATCH])
Z = lambda X: (np.clip(np.where(np.isnan(X), med, X), lo, hi) - mu) / sd * w
Z1, Z2 = Z(X1), Z(X2)
inc1 = Y1["income_m"].to_numpy(); inc2 = Y2["income_m"].to_numpy()
bc2 = Y2["balance_change"].to_numpy(); bc1 = Y1["balance_change"].to_numpy()
r2 = bc2 / np.maximum(inc1, 1)     # twins' outcome: year-2 balance change in months of (year-1) income
y1v = {k: Y1[k].to_numpy().astype(float) for k in set(CHANGE_CATS + DIFF_KEYS)}
y2v = {k: Y2[k].to_numpy().astype(float) for k in set(CHANGE_CATS + DIFF_KEYS)}


def neighbours(zq, incq, cand_idx, Zc, incc, k=K, exclude=None):
    ratio = incc / max(incq, 1)
    ok = (ratio > 0.75) & (ratio < 1.33)
    if exclude is not None:
        ok &= cand_idx != exclude
    if ok.sum() < 2 * k:   # widen the income band if needed
        ok = (ratio > 0.5) & (ratio < 2.0) & ((cand_idx != exclude) if exclude is not None else True)
    sel = np.where(ok)[0]
    d = np.sqrt(((Zc[sel] - zq) ** 2).sum(1))
    o = np.argsort(d)[:k]
    return cand_idx[sel[o]], d[o]


# ------------------------------------------------------------------ validation
t_val = time.time()
rng = np.random.default_rng(7)
perm = rng.permutation(n)
test, train = perm[: n // 5], perm[n // 5:]
pred, persist, actual, inIQR = [], [], [], []
for i in test:
    nb, _ = neighbours(Z1[i], inc1[i], train, Z1[train], inc1[train])
    o = r2[nb]
    pred.append(np.median(o)); actual.append(r2[i]); persist.append(bc1[i] / max(inc1[i], 1))
    q1, q3 = np.percentile(o, [25, 75]); inIQR.append(q1 <= r2[i] <= q3)
pred, actual, persist = map(np.array, (pred, actual, persist))
pop = np.full_like(actual, np.mean(r2[train]))
pop_med = np.full_like(actual, np.median(r2[train]))   # the fair constant for an absolute-error metric
# one-feature baseline: median outcome by decile of the year-1 savings rate, fitted on the training customers
sr1 = Y1["savings_rate"].to_numpy()
qs = np.quantile(sr1[train], np.linspace(0, 1, 11))
dec = np.clip(np.searchsorted(qs, sr1, side="right") - 1, 0, 9)
med_by = {k: float(np.median(r2[train][dec[train] == k])) for k in range(10)}
one_feature = np.array([med_by[int(k)] for k in dec[test]])
mae = lambda p: float(np.mean(np.abs(p - actual)))
val = {"mae_twins": mae(pred), "mae_pop": mae(pop), "mae_median": mae(pop_med), "mae_one_feature": mae(one_feature), "mae_persist": mae(persist),
       "rho_twins": float(spearmanr(pred, actual)[0]), "rho_persist": float(spearmanr(persist, actual)[0]),
       "iqr_coverage": float(np.mean(inIQR)), "n_test": int(len(test))}
print("validation", {k: round(v, 3) for k, v in val.items()}, f"({time.time()-t_val:.1f}s)")

# ------------------------------------------------------------------ per customer
GROUPS = [("built", "Built a buffer"), ("held", "Held steady"), ("slipped", "Slipped")]
all_idx = np.arange(n)
months_y2 = [str(m) for m in M["month"].unique().sort().to_list()]
rand_d = float(np.median(np.sqrt(((Z2[rng.integers(0, n, 2000)] - Z1[rng.integers(0, n, 2000)]) ** 2).sum(1))))


def q(a, p):
    return float(np.percentile(a, p)) if len(a) else None


def build(i):
    i = int(i)
    cid = ids[i]
    nb, dist = neighbours(Z2[i], inc2[i], all_idx, Z1, inc1, exclude=i)
    scale = inc2[i] / np.maximum(inc1[nb], 1)
    o = r2[nb]
    t1, t2 = np.percentile(o, [100 / 3, 200 / 3])
    gidx = {"built": nb[o >= t2], "held": nb[(o >= t1) & (o < t2)], "slipped": nb[o < t1]}
    gscale = {g: inc2[i] / np.maximum(inc1[v], 1) for g, v in gidx.items()}
    groups = []
    for g, lab in GROUPS:
        v, s = gidx[g], gscale[g]
        P = path_y2[v] * s[:, None]
        path = [{"month": m, "p25": q(P[:, m], 25), "p50": q(P[:, m], 50), "p75": q(P[:, m], 75)} for m in range(13)]
        changes = []
        for k in CHANGE_CATS:
            a1, a2 = y1v[k][v], y2v[k][v]
            dm = float(np.median((a2 - a1) * s))
            base = float(np.median(a1 * s))
            changes.append({"key": k, "label": label(k) if k != "invest_m" else "Investing", "deltaMonthly": dm,
                            "deltaPct": (100 * dm / base) if base > 1 else 0.0})
        changes.sort(key=lambda c: -abs(c["deltaMonthly"]))
        groups.append({"key": g, "label": lab, "n": int(len(v)), "bufferChange": float(np.median(P[:, 12])) if len(v) else 0,
                       "path": path, "changes": changes[:6]})
    # differences built vs slipped in what they did during the follow-up year
    diffs = []
    b, sl = gidx["built"], gidx["slipped"]
    for k in DIFF_KEYS:
        allv = y2v[k][nb] * (scale if EURO[k] else 1)
        bv = y2v[k][b] * (gscale["built"] if EURO[k] else 1)
        sv = y2v[k][sl] * (gscale["slipped"] if EURO[k] else 1)
        bv, sv = bv[~np.isnan(bv)], sv[~np.isnan(sv)]
        if len(bv) < 10 or len(sv) < 10:
            continue
        sdv = np.nanstd(allv) + 1e-9
        mb, ms = float(np.median(bv)), float(np.median(sv))
        eff = (mb - ms) / sdv
        if abs(eff) < 0.3 or (EURO[k] and abs(mb - ms) < 5):
            continue
        diffs.append((abs(eff), k, mb, ms))
    diffs.sort(reverse=True)
    differences = []
    for _, k, mb, ms in diffs[:4]:
        lb, u = label(k), unit(k)
        bd, sdisp = disp(k, mb), disp(k, ms)
        if u == "€/month":
            more = "less" if bd < sdisp else "more"
            ins = f"Twins who built a buffer spent about {abs(bd - sdisp):.0f} € a month {more} on {lb.lower()} than twins who slipped."
        elif u == "%":
            ins = f"{lb}: {bd:.0f}% for twins who built a buffer vs {sdisp:.0f}% for twins who slipped."
        else:
            ins = f"{lb}: {bd:.0f} {u} for twins who built a buffer vs {sdisp:.0f} for twins who slipped."
        if k == "invest_m":
            ins = f"Twins who built a buffer {'invested' if bd > sdisp else 'invested less, about'} {abs(bd - sdisp):.0f} € a month {'more' if bd > sdisp else ''} than twins who slipped.".replace("  ", " ")
        differences.append({"key": k, "label": lb if k != "invest_m" else "Investing", "built": bd, "slipped": sdisp,
                            "unit": u, "insight": ins})
    matched = [{"feature": k, "label": label(k), "yours": disp(k, Y2[k][i]), "twinsMedian": disp(k, float(np.nanmedian(Y1[k].to_numpy()[nb]))),
                "unit": unit(k)} for k in SHOW_MATCH if Y2[k][i] is not None]
    past = [{"month": m - 12, "balance": float(MEB[i, 11 + m])} for m in range(13)]
    md = float(np.median(dist))
    doc = {"id": cid, "asOf": AS_OF, "nTwins": int(len(nb)),
           "window": {"yours": list(YEAR2), "theirs": list(YEAR1), "followUp": list(YEAR2)},
           "matchedOn": matched, "groups": groups, "differences": differences,
           "you": {"balance": float(MEB[i, 23]), "pastPath": past},
           "quality": {"medianDistance": md, "randomPairDistance": rand_d,
                       "note": f"Twins are {md / rand_d:.0%} as far from you as a random customer would be (lower = closer match). "
                               f"Matched on {len(MATCH)} behaviour features with income within about ±25%."},
           "caveat": ("Correlation in synthetic data, not causal advice: these are other customers whose habits a year ago looked like yours "
                      "today, and what happened to them next. Your own future depends on your choices and circumstances."),
           "monthlyIncome": float(inc2[i])}
    return cid, doc


only = set(sys.argv[1:])
todo = [i for i in range(n) if not only or ids[i] in only]
odir = out_dir("ml", "twins")


def run(chunk):
    for i in chunk:
        cid, doc = build(i)
        write_json(os.path.join(odir, f"{cid}.json"), doc)
    return len(chunk)


chunks = np.array_split(np.array(todo), 64)
done = sum(Parallel(n_jobs=32)(delayed(run)(c) for c in chunks if len(c)))
print(f"wrote {done} twins files ({time.time()-t0:.1f}s)")

if not only:
    best_base = min(val["mae_median"], val["mae_one_feature"], val["mae_persist"])
    better = val["mae_twins"] < 0.9 * best_base   # "ships" only with a >=10% error cut against the strongest baseline
    write_json(os.path.join(GLOBAL_DIR, "modelcard-twins.json"), {
        "key": "twins", "name": "Two Futures (money twins)",
        "purpose": "Show what happened next to customers whose habits a year ago looked like yours today.",
        "method": f"k={K} nearest neighbours on {len(MATCH)} standardised, weighted behaviour features (shares, rates, log income), "
                  "candidates restricted to monthly income within about ±25% (widened to 0.5-2x if needed); twins split into terciles of their "
                  "following-year balance change relative to income; euros scaled by income ratio.",
        "trainedOn": f"{n} main-cohort customers; matching window {YEAR1[0]}..{YEAR1[1]}, outcome window {YEAR2[0]}..{YEAR2[1]}",
        "split": f"Customer hold-out 80/20 (seed 7, n_test={val['n_test']}) with a time split: held-out customers' YEAR-1 features only, "
                 "target = their own YEAR-2 balance change / YEAR-1 monthly income. Caveat: twins' outcomes and the target share the same calendar year.",
        "metrics": [
            {"label": "MAE of year-2 balance change (months of income)", "model": val["mae_twins"], "baseline": val["mae_median"],
             "baselineName": "population median", "unit": "months of income", "better": "lower"},
            {"label": "MAE vs a one-feature rule", "model": val["mae_twins"], "baseline": val["mae_one_feature"],
             "baselineName": "median outcome by decile of last year's savings rate", "unit": "months of income", "better": "lower"},
            {"label": "MAE vs persistence", "model": val["mae_twins"], "baseline": val["mae_persist"],
             "baselineName": "same change as last year", "unit": "months of income", "better": "lower"},
            {"label": "Spearman correlation with actual", "model": val["rho_twins"], "baseline": val["rho_persist"],
             "baselineName": "same change as last year", "unit": "", "better": "higher"},
            {"label": "Actual outcome inside twins' interquartile range", "model": val["iqr_coverage"], "baseline": 0.5,
             "baselineName": "nominal 50%", "unit": "share", "better": "higher"},
        ],
        "verdict": "ships" if better else ("experimental" if val["mae_twins"] < best_base else "not_better_than_baseline"),
        "caveats": ["Correlation in synthetic data, not causal advice.",
                    "Groups are terciles inside each customer's own 100 twins, so 'built' and 'slipped' are relative to similar people.",
                    "Opening balances in the data are synthetic; balance change is measured, not the level."],
        "validation": val, "trainedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "trainSeconds": round(time.time() - t0, 1)})
