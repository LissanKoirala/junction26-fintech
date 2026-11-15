"""Unusual-for-you radar (ML-A step 4). Idempotent.

Personal normal = the customer's own YEAR-1 purchases (2024-10..2025-09). Every purchase of the last 12 months
(YEAR 2) is described by personalised features (amount vs own category distribution, own hour/weekday habits, how
rare the category is for them, gap since the previous purchase in the category vs their usual gap). One Isolation
Forest is fitted on these personalised features across all main-cohort customers; score = percentile of the
anomaly score (0..1). Reasons are computed from the same features.

Validation: synthetic injection on held-out customers (copies of real year-2 purchases with a 3-6x amount, a rare
hour for that customer, or a rarely used category), ROC AUC vs (a) a global, non-personal amount percentile and
(b) the personal amount z-score alone.

Writes ml/anomalies/{id}.json (MlAnomalies) for all 5,100 customers, global/modelcard-anomalies.json
usage: ~/mlenv/bin/python ml/a_anomalies.py
"""
import os, time
from datetime import date, timedelta
import numpy as np
import polars as pl
from joblib import Parallel, delayed
from sklearn.ensemble import IsolationForest
from sklearn.metrics import roc_auc_score
from common import DATA_DIR, GLOBAL_DIR, AS_OF, YEAR1, YEAR2, load_tx, load_domain, add_basket_column, out_dir, write_json, is_tail_cohort

t0 = time.time()
D = load_domain()
CL = {k: v["label"] for k, v in D["categories"].items()}
WD = ["", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
ASOF = date.fromisoformat(AS_OF)
Y1S, Y1E, Y2S = date.fromisoformat(YEAR1[0]), date.fromisoformat(YEAR1[1]), date.fromisoformat(YEAR2[0])
FEATS = ["amt_z", "hour_rar", "wd_rar", "cat_rar", "gap_lr"]

tx = load_tx()
tx = tx.with_columns(pl.int_range(pl.len()).over("customer_id").alias("i"))     # index into CustomerData.tx
tx = add_basket_column(tx, D)
P = (tx.filter(pl.col("type") == "purchase")
     .with_columns(pl.col("amount").abs().alias("amt"), pl.col("time").str.slice(0, 2).cast(pl.Int32).alias("hour"),
                   pl.col("date").dt.weekday().alias("wd"))
     .with_columns(pl.col("amt").log().alias("lamt"))
     .sort(["customer_id", "category", "ts"])
     .with_columns((pl.col("date") - pl.col("date").shift(1)).over(["customer_id", "category"]).dt.total_days().alias("gap"))
     .sort(["customer_id", "idx"]))
h1 = P.filter(pl.col("date") <= Y1E)
n1 = h1.group_by("customer_id").agg(pl.len().alias("n1"), pl.col("lamt").median().alias("lmed_all"),
                                     ((pl.col("lamt") - pl.col("lamt").median()).abs().median() * 1.4826).alias("lmad_all"))
cat1 = h1.group_by(["customer_id", "category"]).agg(
    pl.len().alias("nc"), pl.col("lamt").median().alias("lmed"), ((pl.col("lamt") - pl.col("lamt").median()).abs().median() * 1.4826).alias("lmad"),
    pl.col("amt").median().alias("amt_med"), pl.col("gap").median().alias("gap_med"))
hr1 = h1.group_by(["customer_id", "hour"]).agg(pl.len().alias("nh"))
wd1 = h1.group_by(["customer_id", "wd"]).agg(pl.len().alias("nw"))

S = (P.filter(pl.col("date") >= Y2S).join(n1, on="customer_id", how="left").join(cat1, on=["customer_id", "category"], how="left")
     .join(hr1, on=["customer_id", "hour"], how="left").join(wd1, on=["customer_id", "wd"], how="left")
     .with_columns(pl.col("nc").fill_null(0), pl.col("nh").fill_null(0), pl.col("nw").fill_null(0), pl.col("n1").fill_null(0)))


def personal(S):
    few = pl.col("nc") < 5
    return S.with_columns(
        # amount vs own category distribution (fallback: all own purchases); MAD floor 0.15 in log space (~15%)
        ((pl.col("lamt") - pl.when(few).then(pl.col("lmed_all")).otherwise(pl.col("lmed")))
         / pl.max_horizontal(pl.when(few).then(pl.col("lmad_all")).otherwise(pl.col("lmad")).fill_null(0.5), pl.lit(0.15))).fill_null(0).alias("amt_z"),
        (pl.col("amt") / pl.when(few).then(pl.col("lmed_all").exp()).otherwise(pl.col("amt_med"))).alias("ratio"),
        (-((pl.col("nh") + 0.5) / (pl.col("n1") + 0.5 * 19)).log()).alias("hour_rar"),
        (-((pl.col("nw") + 0.5) / (pl.col("n1") + 0.5 * 7)).log()).alias("wd_rar"),
        (-((pl.col("nc") + 0.5) / (pl.col("n1") + 0.5 * 8)).log()).alias("cat_rar"),
        (pl.col("gap").fill_null(365).add(1) / pl.col("gap_med").fill_null(30).add(1)).log().alias("gap_lr"),
        ((pl.col("nh") + 0.5) / (pl.col("n1") + 0.5 * 19)).alias("p_hour"),
        ((pl.col("nw") + 0.5) / (pl.col("n1") + 0.5 * 7)).alias("p_wd"),
    )


S = personal(S)
is_main = ~pl.col("customer_id").str.slice(4).cast(pl.Int32).gt(5000)
Smain = S.filter(is_main)
Xm = Smain.select(FEATS).to_numpy()
rng = np.random.default_rng(3)
cust_main = Smain["customer_id"].unique().sort().to_numpy()
hold = set(rng.choice(cust_main, size=len(cust_main) // 5, replace=False))
train_mask = ~np.isin(Smain["customer_id"].to_numpy(), list(hold))
fit_idx = rng.choice(np.where(train_mask)[0], size=min(300_000, int(train_mask.sum())), replace=False)
iforest = IsolationForest(n_estimators=300, max_samples=4096, random_state=0, n_jobs=32).fit(Xm[fit_idx])


def robust(Xf):
    """Per-customer robust score: one-sided surprises beyond what a uniform habit would give. Amount dominates on purpose
    (a big amount is what matters to the person); hour / category / gap / weekday rarity add to it."""
    a, h, w, c, g = (Xf[:, j] for j in range(5))
    return (np.clip(a, 0, None) + 0.6 * np.clip(h - np.log(19), 0, None) + 0.6 * np.clip(c - np.log(8), 0, None)
            + 0.3 * np.clip(g - np.log(3), 0, None) + 0.2 * np.clip(w - np.log(7), 0, None))


ref_scores = np.sort(robust(Xm[fit_idx]))
to_pct = lambda raw: np.searchsorted(ref_scores, raw) / len(ref_scores)
print(f"IF fitted on {len(fit_idx):,} purchases ({time.time()-t0:.1f}s)")

# ------------------------------------------------------------------ validation by injection on held-out customers
H = Smain.filter(pl.col("customer_id").is_in(list(hold))).sample(n=20_000, seed=1)
inj_parts = []
third = H.height // 3
a = H.slice(0, third).with_columns((pl.col("amt") * pl.lit(rng.uniform(3, 6, third))).alias("amt"))
# rare hour: the customer's least used hour in year 1 (hours 05-23)
grid = n1.select("customer_id").join(pl.DataFrame({"hour": list(range(5, 24))}, schema={"hour": pl.Int32}), how="cross")
rare_hour = (grid.join(hr1, on=["customer_id", "hour"], how="left").with_columns(pl.col("nh").fill_null(0))
             .sort(["customer_id", "nh"]).group_by("customer_id").first().select("customer_id", pl.col("hour").alias("rare_hour")))
b = (H.slice(third, third).join(rare_hour, on="customer_id", how="left")
     .with_columns(pl.col("rare_hour").fill_null(23).cast(pl.Int32).alias("hour")).drop("rare_hour"))
c = H.slice(2 * third, third)
# rarely used category: move to the customer's least used category (amount unchanged)
least = (cat1.sort("nc").group_by("customer_id").first().select("customer_id", pl.col("category").alias("rare_cat")))
c = c.join(least, on="customer_id", how="left").with_columns(pl.col("rare_cat").fill_null(pl.col("category")).alias("category")).drop("rare_cat")
inj = pl.concat([a, b, c], how="diagonal_relaxed").with_columns(pl.col("amt").log().alias("lamt"))
inj = inj.drop(["nc", "lmed", "lmad", "amt_med", "gap_med", "nh", "nw"] + FEATS + ["ratio", "p_hour", "p_wd"])
inj = (inj.join(cat1, on=["customer_id", "category"], how="left").join(hr1, on=["customer_id", "hour"], how="left")
       .join(wd1, on=["customer_id", "wd"], how="left").with_columns(pl.col("nc").fill_null(0), pl.col("nh").fill_null(0), pl.col("nw").fill_null(0)))
inj = personal(inj)
normal = H
y = np.r_[np.zeros(normal.height), np.ones(inj.height)]
Xv = np.vstack([normal.select(FEATS).to_numpy(), inj.select(FEATS).to_numpy()])
s_model = robust(Xv)
s_if = -iforest.score_samples(Xv)
# baseline a: global (not personal) amount percentile within category
glob = Smain.filter(~pl.col("customer_id").is_in(list(hold))).group_by("category").agg(pl.col("amt").sort().alias("srt"))
gmap = {r["category"]: np.array(r["srt"]) for r in glob.to_dicts()}
allv = pl.concat([normal.select("category", "amt"), inj.select("category", "amt")])
s_glob = np.array([np.searchsorted(gmap[c], v) / len(gmap[c]) for c, v in zip(allv["category"], allv["amt"])])
s_amtz = np.abs(Xv[:, 0])
auc = {"model": float(roc_auc_score(y, s_model)), "global_amount": float(roc_auc_score(y, s_glob)), "personal_amount_z": float(roc_auc_score(y, s_amtz)),
       "isolation_forest": float(roc_auc_score(y, s_if))}
by_type = {}
for name, sl in [("amount x3-6", slice(0, third)), ("rare hour", slice(third, 2 * third)), ("rare category", slice(2 * third, inj.height))]:
    yy = np.r_[np.zeros(normal.height), np.ones(sl.stop - sl.start)]
    idx = np.r_[np.arange(normal.height), normal.height + np.arange(sl.start, sl.stop)]
    by_type[name] = {"model": float(roc_auc_score(yy, s_model[idx])), "global_amount": float(roc_auc_score(yy, s_glob[idx])),
                     "isolation_forest": float(roc_auc_score(yy, s_if[idx]))}
print("AUC", auc, by_type)

# ------------------------------------------------------------------ score everyone + per-customer files
S = S.with_columns(pl.Series("score", to_pct(robust(S.select(FEATS).to_numpy()))))
weekly = (P.filter(pl.col("date") > ASOF - timedelta(days=7 * 104))
          .with_columns(((pl.lit(ASOF) - pl.col("date")).dt.total_days() // 7).alias("b"))
          .group_by(["customer_id", "b", "category"]).agg(pl.col("amt").sum().alias("s")))
odir = out_dir("ml", "anomalies")
METHOD = ("Personal normal learned from your own purchases in Oct 2024-Sep 2025 (amount per category, hours, weekdays, category mix, "
          "gap between purchases); per-customer robust score = amount z-score above your own median (MAD-scaled) plus weighted rarity of hour, category, gap and weekday; "
          "score = share of ordinary purchases that look less unusual (0..1). Weeks: robust z-score of weekly spend vs your own year-1 weeks.")


def reasons(r):
    out = []
    lab = CL.get(r["category"], r["category"]).lower()
    if r["ratio"] is not None and r["ratio"] >= 2:
        ref = f"your usual {lab} purchase" if r["nc"] >= 5 else "your typical purchase"
        out.append(f"{r['ratio']:.0f}x {ref}" if r["ratio"] >= 2.5 else f"{r['ratio']:.1f}x {ref}")
    if r["nc"] < 3:
        out.append(f"you rarely buy {lab} ({int(r['nc'])} times in the year before)")
    if r["p_hour"] < 0.03:
        out.append(f"unusual hour for you ({r['hour']:02d}:00)")
    if r["p_wd"] < 0.07:
        out.append(f"rare day for you ({WD[r['wd']]})")
    if r["gap"] is not None and r["gap_med"] is not None and r["gap"] >= max(30, 3 * r["gap_med"]):
        out.append(f"first {lab} purchase in {int(r['gap'])} days")
    return out or ["unusual combination of amount, time and category for you"]


def build_chunk(cids, Ssub, Wsub):
    sub = Ssub.partition_by("customer_id", as_dict=True)
    wk = Wsub.partition_by("customer_id", as_dict=True)
    n = 0
    for cid in cids:
        s = sub.get((cid,), Ssub.clear()).sort("score", descending=True)
        # list only material purchases: at least the customer's typical purchase, or 2x the usual for the category
        top = s.filter((pl.col("amt") >= pl.max_horizontal(pl.lit(10.0), pl.col("lmed_all").exp().fill_null(10.0)))
                       | (pl.col("ratio") >= 2)).head(30).to_dicts()
        txs = []
        for r in top:
            t = {"i": int(r["i"]), "date": str(r["date"]), "time": r["time"], "category": r["category"], "amount": round(r["amount"], 2),
                 "score": round(float(r["score"]), 3), "reasons": reasons(r), "basket": r["basket"]}
            if r["category"] in ("Health", "Home & Tech") and r["amt"] >= 150 and (r["ratio"] or 0) >= 3:
                t["suggestedBasket"] = "must_irregular"
            txs.append(t)
        w = wk.get((cid,), Wsub.clear())
        tot = w.group_by("b").agg(pl.col("s").sum()).sort("b")
        full = pl.DataFrame({"b": list(range(104))}).join(tot, on="b", how="left").fill_null(0)
        vals = full["s"].to_numpy()  # b=0 latest week
        base = vals[52:]             # year-1 weeks
        typ = float(np.median(base)); sc = max(float(np.median(np.abs(base - typ))) * 1.4826, 0.15 * typ, 10.0)
        catmed = (w.filter(pl.col("b") >= 52).group_by("category").agg((pl.col("s").sum() / 52).alias("m")))
        cm = dict(zip(catmed["category"], catmed["m"]))
        weeks = []
        for b in range(52):
            z = (vals[b] - typ) / sc
            if z >= 2:
                wc = w.filter(pl.col("b") == b)
                drv = sorted([{"category": c, "delta": round(v - cm.get(c, 0), 2)} for c, v in zip(wc["category"], wc["s"])], key=lambda x: -x["delta"])[:3]
                weeks.append({"weekStart": str(ASOF - timedelta(days=7 * b + 6)), "spend": round(float(vals[b]), 2), "typical": round(typ, 2),
                              "z": round(float(z), 2), "drivers": [d for d in drv if d["delta"] > 0]})
        weeks = sorted(weeks, key=lambda x: -x["z"])[:8]
        l30 = s.filter((pl.col("date") > ASOF - timedelta(days=30)) & (pl.col("score") >= 0.95))
        doc = {"id": cid, "asOf": AS_OF, "transactions": txs, "weeks": weeks,
               "last30Days": {"count": l30.height, "total": round(float(l30["amt"].sum()), 2) if l30.height else 0.0},
               "method": METHOD, "threshold": 0.95,
               "note": "Personal normal is thin for customers with few purchases in the first year." if (top and top[0]["n1"] < 50) else None}
        write_json(os.path.join(odir, f"{cid}.json"), doc)
        n += 1
    return n


cids = S["customer_id"].unique().sort().to_list()
KEEP = ["customer_id", "i", "date", "time", "category", "amount", "amt", "score", "basket", "ratio", "nc", "p_hour", "p_wd", "hour", "wd", "gap", "gap_med", "lmed_all", "n1"]
S_small = S.select(KEEP)
chunks = [list(c) for c in np.array_split(np.array(cids), 64)]
done = sum(Parallel(n_jobs=32)(delayed(build_chunk)(c, S_small.filter(pl.col("customer_id").is_in(c)), weekly.filter(pl.col("customer_id").is_in(c))) for c in chunks))
print(f"wrote {done} anomaly files ({time.time()-t0:.1f}s)")

# "ships" only if it beats every baseline, including the Isolation Forest on the same features
ships = auc["model"] > max(auc["global_amount"], auc["personal_amount_z"], auc["isolation_forest"]) + 0.01
write_json(os.path.join(GLOBAL_DIR, "modelcard-anomalies.json"), {
    "key": "anomalies", "name": "Unusual for you",
    "purpose": "Flag the purchases that are unusual for this particular person, with a plain reason, so surprises are spotted early.",
    "method": METHOD + " Reasons are computed from the features. Large unusual Health / Home & tech purchases are suggested as Surprise musts.",
    "trainedOn": f"{len(fit_idx):,} year-2 purchases of {len(cust_main) - len(hold)} main-cohort customers (personal normals from year 1)",
    "split": f"Time split (normal from {YEAR1[0]}..{YEAR1[1]}, scored {YEAR2[0]}..{YEAR2[1]}); validation on {len(hold)} held-out customers "
             f"with {inj.height:,} injected anomalies vs {normal.height:,} real purchases.",
    "metrics": [
        {"label": "ROC AUC, injected anomalies", "model": auc["model"], "baseline": auc["global_amount"], "baselineName": "global amount percentile (not personal)", "unit": "", "better": "higher"},
        {"label": "ROC AUC, injected anomalies", "model": auc["model"], "baseline": auc["personal_amount_z"], "baselineName": "personal amount z-score only", "unit": "", "better": "higher"},
        {"label": "ROC AUC, injected anomalies", "model": auc["model"], "baseline": auc["isolation_forest"], "baselineName": "Isolation Forest on the same personal features", "unit": "", "better": "higher"},
    ] + [{"label": f"ROC AUC, {k}", "model": v["model"], "baseline": v["global_amount"], "baselineName": "global amount percentile", "unit": "", "better": "higher"} for k, v in by_type.items()],
    "verdict": "ships" if ships else "experimental",
    "caveats": ["No labelled fraud or surprise events exist in the data; validation uses synthetic injected anomalies, which shows the detector finds "
                "what it was built to find, not that every flag matters to the person.",
                "The benchmark is partly circular: the injected anomalies are built from the same three signals the score uses (amount against "
                "the personal normal, unusual hour, rarely used category), and the amount-only baselines cannot see hour or category by "
                "construction. Read the AUC as proof that the mechanism works, not as real-world accuracy.",
                "It does not beat an Isolation Forest on the same features on this benchmark; it is used because every flag comes with a plain reason.",
                "Hours in the data are 05-23 and amounts are smooth, so real unusual events are mostly large amounts.",
                "A per-customer robust score was chosen over an Isolation Forest on the same personalised features: the forest over-weighted rare hours and categories (tiny purchases at 06:00) and was weaker on amount spikes; its AUC is reported alongside."],
    "validation": {"auc": auc, "byType": by_type},
    "trainedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "trainSeconds": round(time.time() - t0, 1)})
