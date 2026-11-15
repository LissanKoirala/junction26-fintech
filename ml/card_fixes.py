"""Apply the honesty fixes to the model cards whose models must not be re-run. Idempotent.

Why this exists: an independent verification (Junction 2026) found that several model cards compared against weak
baselines. The fixes are made in the model scripts themselves (a_map.py, a_home.py, b_risk.py, b_forecast.py), so the
code stays the source of truth, but re-running those scripts would either retrain heavy models (forecast, early warning)
or risk changing outputs that were hand-edited on disk (the tribe texts written by a_map.py). This script recomputes
only the new baselines, with the same code or the same computation as the model scripts, from the same data and the
saved models (no retraining), and rewrites the affected card fields:

  tribes    silhouette baseline = k-means on a Gaussian with the same covariance (no clusters), k-range caveat
  home      single-feature baseline (buffer only, same CV folds), caveat on the final_* application terms
  risk      baselines = one hand-made feature, and a logistic regression on all model features; verdict rule
  forecast  strongest point baseline (182-day average x days x a ratio fitted on training rows); trailing pinball dropped

usage: ~/mlenv/bin/python ml/card_fixes.py [tribes home risk forecast]   (default: all)
"""
import json
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import DATA_DIR, GLOBAL_DIR, RAW, write_json, is_tail_cohort  # noqa: E402


def load(key):
    return json.load(open(os.path.join(GLOBAL_DIR, f"modelcard-{key}.json")))


def save(key, card):
    write_json(os.path.join(GLOBAL_DIR, f"modelcard-{key}.json"), card)
    print(f"== {key}: verdict {card['verdict']}")
    for m in card["metrics"]:
        extra = " [on par]" if m.get("onPar") else ""
        print(f"   {m['label']}: {m['model']:.4f} vs {m['baseline']:.4f} ({m['baselineName']}){extra}")


# ------------------------------------------------------------------ tribes (same transform as a_map.py)
def tribes():
    import polars as pl
    from sklearn.cluster import KMeans
    from sklearn.metrics import silhouette_score
    MAP_FEATURES = ["share_groceries", "share_restaurants", "share_transportation", "share_entertainment", "share_health",
                    "share_home_tech", "share_lifestyle", "share_travel", "share_everyday", "share_must_irregular",
                    "small_count_share", "weekend_share", "evening_share", "payday_burn", "volatility", "savings_rate",
                    "investing_rate", "housing_share", "purchases_to_income", "below_zero_share", "buffer_months", "sweep_share",
                    "n_purchases_m"]
    LOG_FEATURES = {"buffer_months", "n_purchases_m"}
    F = pl.read_parquet(os.path.join(DATA_DIR, "features", "features.parquet")).filter(pl.col("window") == "y2").sort("customer_id")
    main = np.array([not is_tail_cohort(c) for c in F["customer_id"].to_list()])
    X = F.select(MAP_FEATURES).to_numpy().astype(float)[main]
    for j, k in enumerate(MAP_FEATURES):
        if k in LOG_FEATURES:
            X[:, j] = np.sign(X[:, j]) * np.log1p(np.abs(X[:, j]))
    lo, hi = np.nanpercentile(X, 1, axis=0), np.nanpercentile(X, 99, axis=0)
    X = np.clip(X, lo, hi)
    X = np.where(np.isnan(X), np.nanmedian(X, axis=0), X)
    Z = (X - X.mean(0)) / (X.std(0) + 1e-9)
    card = load("tribes")
    K = int(card["metrics"][0]["label"].split("k=")[1].rstrip(")"))
    rng = np.random.default_rng(0)
    sil_idx = rng.choice(len(Z), size=min(5000, len(Z)), replace=False)
    check = float(silhouette_score(Z[sil_idx], KMeans(K, n_init=4, random_state=0).fit_predict(Z)[sil_idx]))
    ev = {e["k"]: e for e in card["evidence"]}
    assert abs(check - ev[K]["silhouette"]) < 1e-3, f"transform does not reproduce a_map.py ({check} vs {ev[K]['silhouette']})"
    rand_sil = card["validation"]["randomPartitionSilhouette"] if card.get("validation") else card["metrics"][0]["baseline"]
    G = np.random.default_rng(1).multivariate_normal(Z.mean(0), np.cov(Z.T), len(Z))
    gauss_sil = float(silhouette_score(G[sil_idx], KMeans(K, n_init=4, random_state=0).fit_predict(G)[sil_idx]))
    card["metrics"][0].update(baseline=round(gauss_sil, 4), baselineName="k-means on a Gaussian with the same covariance (no clusters)")
    cands = [e for e in card["evidence"] if 5 <= e["k"] <= 8]
    best = card["metrics"][0]["model"]
    new = [f"Even data with no clusters at all (a Gaussian with the same covariance) gives a silhouette of {gauss_sil:.2f} with k={K}, so the "
           f"structure beyond that is modest. A random partition ({rand_sil:.2f}) would be a straw man.",
           f"The number of tribes was limited to {min(e['k'] for e in cands)}-{max(e['k'] for e in cands)} for storytelling; k={K} scored best in that range. "
           f"k=4 scores higher ({ev[4]['silhouette']:.2f}) but was outside it."]
    base = [c for c in card["caveats"] if not c.startswith(("Even data with no clusters", "The number of tribes was limited"))]
    card["caveats"] = base[:1] + new + base[1:]
    card["validation"] = {"randomPartitionSilhouette": rand_sil, "gaussianSilhouette": gauss_sil, "kRange": [5, 8]}
    assert abs(best - ev[K]["silhouette"]) < 1e-9
    save("tribes", card)


# ------------------------------------------------------------------ first home (same data and folds as a_home.py)
def home():
    import polars as pl
    from sklearn.linear_model import LogisticRegression
    from sklearn.metrics import roc_auc_score
    from sklearn.model_selection import RepeatedStratifiedKFold
    from sklearn.pipeline import make_pipeline
    from sklearn.preprocessing import StandardScaler
    m = pl.read_csv(os.path.join(RAW, "mtg_tx_customer_link_and_final_mtg_infio.csv"), encoding="utf8-lossy")
    m = m.rename({c: c.lstrip("﻿") for c in m.columns}).rename({"lfinal_loan_to_value": "ltv"})
    F1 = pl.read_parquet(os.path.join(DATA_DIR, "features", "features.parquet")).filter(pl.col("window") == "y1")
    BEH = ["income_m", "end_balance", "savings_rate", "buffer_months", "below_zero_share", "everyday_to_income", "invest_m", "housing_share"]
    x = m.join(F1.select(["customer_id"] + BEH), on="customer_id", how="left").with_columns(
        (pl.col("final_collateral_value_eur") / pl.col("final_requested_loan_eur")).alias("collateral_cover"),
        (pl.col("final_requested_loan_eur") / (pl.col("income_m") * 12)).alias("loan_to_income"),
        pl.col("income_m").log().alias("log_income"),
        (pl.col("final_decision") == "approved").cast(pl.Int32).alias("y"))
    MODEL_F = ["ltv", "collateral_cover", "loan_to_income", "log_income", "buffer_months", "below_zero_share", "savings_rate"]
    X = x.select(MODEL_F).to_numpy().astype(float)
    X = np.where(np.isnan(X), np.nanmedian(X, 0), X)
    X[:, 4] = np.log1p(np.clip(X[:, 4], 0, None))
    y = x["y"].to_numpy()
    lr = make_pipeline(StandardScaler(), LogisticRegression(C=0.5, max_iter=2000))
    one = make_pipeline(StandardScaler(), LogisticRegression(C=0.5, max_iter=2000))
    aucs, baucs = [], []
    for tr, te in RepeatedStratifiedKFold(n_splits=5, n_repeats=20, random_state=0).split(X, y):
        aucs.append(roc_auc_score(y[te], lr.fit(X[tr], y[tr]).predict_proba(X[te])[:, 1]))
        baucs.append(roc_auc_score(y[te], one.fit(X[tr][:, [4]], y[tr]).predict_proba(X[te][:, [4]])[:, 1]))
    card = load("home")
    cv = card["validation"]
    assert abs(np.mean(aucs) - cv["lr_auc"]) < 1e-4, "does not reproduce a_home.py (card values are rounded to 4 places)"
    cv.update(buffer_only_auc=float(np.mean(baucs)), buffer_only_auc_sd=float(np.std(baucs)))
    rows = [r for r in card["metrics"] if not r["baselineName"].startswith("one feature")]
    card["metrics"] = [{"label": "CV ROC AUC (logistic)", "model": cv["lr_auc"], "baseline": cv["buffer_only_auc"],
                        "baselineName": "one feature: buffer (months of spending on the account)", "unit": "", "better": "higher"}] + rows
    new = [f"The buffer alone (one feature, same folds) reaches CV AUC {cv['buffer_only_auc']:.2f} against {cv['lr_auc']:.2f} for all seven "
           f"features; the difference is smaller than the fold-to-fold spread ({cv['lr_auc_sd']:.2f}).",
           "Not verified: whether the application terms (the final_* fields: loan-to-value, collateral, loan size) were recorded after the "
           "decision and so partly encode it. If they do, the terms-only AUC overstates what is knowable before applying."]
    base = [c for c in card["caveats"] if not c.startswith(("The buffer alone", "Not verified: whether the application terms"))]
    card["caveats"] = base[:2] + new + base[2:]
    save("home", card)


# ------------------------------------------------------------------ early warning (b_risk.py functions, saved model)
def risk():
    import b_data as B
    import b_risk as R
    card = load("risk")
    mt, mtu = card["validation"]["testAll"], card["validation"]["testUnseenCustomers"]
    if R.LR_ALL not in mt or R.SINGLE not in mt:
        df = B.build_table()
        d = R.prep(df, "risk_tp")
        tr = d[(d.split == "train") & ~d.unseen]
        te = d[d.split == "test"].reset_index(drop=True)
        y, un = te.risk_tp.values, te.unseen.values
        assert len(te) == mt["LightGBM (isotonic-calibrated)"]["n"], "test rows differ from the card"
        single = -te.bal_rel.values
        lra = R.lr_all(tr, te, "risk_tp")
        mt[R.SINGLE] = R.metrics_block(y, single, 0.0)
        mt[R.LR_ALL] = R.metrics_block(y, lra, 0.5)
        mtu[R.LR_ALL] = R.metrics_block(y[un], lra[un])
    thr = mt["LightGBM (isotonic-calibrated)"]["threshold"]
    card["metrics"] = R.card_metrics(mt, mtu)
    card["verdict"] = R.card_verdict(card["metrics"])
    card["caveats"] = R.card_caveats(mt, thr, min(0.15, thr), card["verdict"])
    card["evidence"]["comparison"] = [dict(method=k, **{kk: v[kk] for kk in ("rocAuc", "prAuc", "brier") if kk in v}) for k, v in mt.items()]
    save("risk", card)


# ------------------------------------------------------------------ crystal ball (b_forecast.py functions, saved models)
def forecast():
    import lightgbm as lgb
    import b_data as B
    import b_forecast as F
    card = load("forecast")
    df = B.build_table()
    L = F.long_table(df)
    te = L[L.split == "test"].reset_index(drop=True)
    models = {qn: lgb.Booster(model_file=os.path.join(F.MODEL_DIR, f"forecast_{qn}.txt")) for qn in F.QN}
    for mm in models.values():
        mm.best_iteration = 0
    P = F.predict(models, te)
    ratio = F.fit_ratio(L)
    ev = F.evaluate(te, P, ratio)
    un = te.unseen.values
    evu = F.evaluate(te[un].reset_index(drop=True), P[un], ratio)
    old = {r["horizon"]: r["model"] for r in card["evidence"]["maeByHorizon"]}
    for r in ev["maeByHorizon"]:
        assert abs(r["model"] - old[r["horizon"]]) < 0.01, "saved models do not reproduce the card"
    card["metrics"] = F.card_metrics(ev, card["validation"]["overdraftBacktest"])
    card["verdict"] = "ships" if all(m["model"] < m["baseline"] for m in card["metrics"]) else "experimental"
    card["caveats"] = F.card_caveats(card["metrics"])
    card["evidence"].update(pinball=ev["pinball"], maeByHorizon=ev["maeByHorizon"], baselineRatio=ratio)
    card["validation"]["unseenCustomers"]["maeByHorizon"] = evu["maeByHorizon"]
    save("forecast", card)


if __name__ == "__main__":
    todo = sys.argv[1:] or ["tribes", "home", "risk", "forecast"]
    for k in todo:
        {"tribes": tribes, "home": home, "risk": risk, "forecast": forecast}[k]()
