"""Early warning (MlRisk): P(balance goes below zero before the next payday), LightGBM + isotonic calibration + SHAP.

Rows: (customer, weekly cut-off) from b_data.build_table(), main cohort, balance >= 0 at the cut-off (rows already below
zero are trivially positive and are excluded from fitting and evaluation). Target: the intraday balance goes below zero
on any day strictly after the cut-off and before the ACTUAL next salary. Also a 14-day variant.
usage: ~/mlenv/bin/python ml/b_risk.py
"""
import os
import sys
import time

import numpy as np
import pandas as pd

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import b_data as B  # noqa: E402
from b_forecast import LABELS, PERSONAS, unseen  # noqa: E402
from common import CACHE_DIR, GLOBAL_DIR, ML_DIR, write_json  # noqa: E402

T0 = time.time()
FEATS = B.COMMON + ["to_payday_base", "to_payday_wk_exp", "to_payday_post_pay", "to_payday_fri_sat"]
LABELS = dict(LABELS, to_payday_base="Own normal spend until payday", to_payday_wk_exp="Expected spend until payday (weekday pattern)",
              to_payday_post_pay="Post-payday days before payday", to_payday_fri_sat="Fridays and Saturdays before payday")
FORBIDDEN = {"risk_tp", "risk_14", "pay_act"} | {c for c in [] if c}


def log(*a):
    print(f"[{time.time()-T0:6.1f}s]", *a, flush=True)


def eur(v):
    s = f"{abs(v):,.0f}".replace(",", " ")
    return ("−" if v < 0 else "") + s + " €"


def pct(v):
    return f"{abs(v) * 100:.0f}%"


def reason(f, v, contrib, row=None):
    """Plain-language label for a SHAP driver, with the actual value (row: the full feature row for context)."""
    row = row if row is not None else {}
    if f == "rent_due":
        return (f"Rent of about {eur(v)} is still to come before payday", eur(v)) if v > 0 else ("This month's rent is already paid", "paid")
    if f == "fixed_due":
        return f"Fixed payments of about {eur(v)} are still to come before payday", eur(v)
    if f == "bal":
        return f"Your balance is {eur(v)}", eur(v)
    if f == "bal_after_fixed":
        rent = float(row.get("rent_due", 0) or 0)
        if rent > 0:
            return f"After rent of about {eur(rent)} and other fixed payments still to come before payday, about {eur(v)} is left", eur(v)
        return f"After the fixed payments still to come before payday, about {eur(v)} is left", eur(v)
    if f == "bal_rel":
        return f"What is left after fixed payments covers about {max(v, 0):.1f}x your usual spending until payday", f"{v:.1f}x"
    if f == "pace":
        dsp = float(row.get("dsp", 99) or 99)
        if dsp <= 3:
            return f"Payday was only {int(dsp)} day{'s' if dsp != 1 else ''} ago, so little has been spent yet", f"{v*100:.0f}% of usual"
        d = v - 1
        return (f"You have spent {pct(d)} {'more' if d >= 0 else 'less'} than usual since payday", f"{v*100:.0f}% of usual")
    if f in ("r7", "r14", "r30"):
        n = f[1:]
        d = v - 1
        return f"Your spending in the last {n} days is {pct(d)} {'above' if d >= 0 else 'below'} your normal", f"{v*100:.0f}% of normal"
    if f == "dtp":
        return f"Payday is {int(v)} days away", f"{int(v)} days"
    if f == "dsp":
        return (f"Payday was {int(v)} days ago", f"{int(v)} days") if v < 99 else ("No recent salary", "none")
    if f == "days_to_rent":
        return (f"Rent is due in about {int(v)} days", f"{int(v)} days") if v < 99 else ("No rent due before payday", "none")
    if f == "dip_rate":
        return f"{pct(v)} of your past pay cycles went below zero", pct(v)
    if f == "prev_cycle_dip":
        return ("Your balance went below zero in the last pay cycle", "yes") if v > 0 else ("Your balance stayed above zero in the last pay cycle", "no")
    if f == "cycle_dipped":
        return ("You have already been below zero this pay cycle", "yes") if v > 0 else ("You have not been below zero this pay cycle", "no")
    if f == "days_below182":
        return f"{int(v)} days below zero in the last 6 months", f"{int(v)} days"
    if f == "min_low30":
        return f"Your lowest balance in the last 30 days was {eur(v)}", eur(v)
    if f == "min_low_prev_cycle":
        return f"Your lowest balance last pay cycle was {eur(v)}", eur(v)
    if f == "bal_same_phase_prev":
        return f"At this point last pay cycle your balance was {eur(v)}", eur(v)
    if f == "buffer":
        return f"Your balance equals about {v:.1f} months of spending", f"{v:.1f} months"
    if f == "housing_share":
        return f"Rent takes about {pct(v)} of your salary", pct(v)
    if f == "burn":
        return f"{pct(v)} of your spending happens in the 5 days after payday", pct(v)
    if f == "vol":
        return f"Your monthly spending swings by about {pct(v)}", pct(v)
    if f == "income":
        return f"Your salary is about {eur(v)} a month", eur(v)
    if f == "housing_typ":
        return f"Your rent is about {eur(v)} a month", eur(v)
    if f == "cycle_spend":
        return f"You have spent {eur(v)} since payday", eur(v)
    if f in ("m7", "m14", "m30", "m90", "m182"):
        return f"You spend about {eur(v)} a day (last {f[1:]} days)", f"{eur(v)}/day"
    if f in ("util_exp",):
        return f"About {eur(v)} of utility bills are expected before payday", eur(v)
    if f == "invest_due":
        return (f"An investment of about {eur(v)} is still to go out", eur(v)) if v > 0 else ("No investment transfer due before payday", "none")
    if f in ("to_payday_base", "to_payday_wk_exp"):
        return f"Your usual spending until payday is about {eur(v)}", eur(v)
    return f"{LABELS.get(f, f)}: {v:.2f}", f"{v:.2f}"


def prep(df, target):
    d = df[(df.bal >= 0) & df[target].notna()].copy()
    d["end"] = np.where(target == "risk_tp", d.pay_act, d.t + 14)
    d["unseen"] = d.customer_id.map(unseen)
    d["split"] = "none"
    d.loc[(d.t <= B.TRAIN_END) & (d.end <= B.TRAIN_END), "split"] = "train"
    d.loc[(d.t >= B.VAL_START) & (d.t <= B.VAL_END) & (d.end <= B.VAL_END), "split"] = "val"
    d.loc[(d.t >= B.TEST_START) & (d.t <= B.TEST_END) & (d.end <= B.ASOF_I), "split"] = "test"
    return d


def metrics_block(y, p, thr=None):
    from sklearn.metrics import average_precision_score, roc_auc_score
    out = dict(rocAuc=float(roc_auc_score(y, p)), prAuc=float(average_precision_score(y, p)), n=int(len(y)), positives=int(y.sum()))
    if p.min() >= 0 and p.max() <= 1:
        out["brier"] = float(np.mean((p - y) ** 2))
    if thr is not None:
        a = p >= thr
        tp = (a & (y == 1)).sum()
        out.update(threshold=float(thr), precision=float(tp / max(a.sum(), 1)), recall=float(tp / max((y == 1).sum(), 1)), alertRate=float(a.mean()))
    return out


def train_one(d, target, name):
    import lightgbm as lgb
    from sklearn.isotonic import IsotonicRegression
    tr = d[(d.split == "train") & ~d.unseen]
    va = d[(d.split == "val") & ~d.unseen]
    assert not (set(FEATS) & FORBIDDEN)
    params = dict(objective="binary", learning_rate=0.05, num_leaves=63, min_data_in_leaf=200, feature_fraction=0.8,
                  bagging_fraction=0.8, bagging_freq=1, lambda_l2=1.0, num_threads=30, verbose=-1, seed=1)
    m = lgb.train(params, lgb.Dataset(tr[FEATS], tr[target]), 1500, valid_sets=[lgb.Dataset(va[FEATS], va[target])],
                  callbacks=[lgb.early_stopping(50, verbose=False)])
    m.save_model(os.path.join(CACHE_DIR, "b_models", f"risk_{name}.txt"))
    raw_va = m.predict(va[FEATS], num_iteration=m.best_iteration)
    iso = IsotonicRegression(out_of_bounds="clip", y_min=0.001, y_max=0.999).fit(raw_va, va[target])
    log(name, "train", len(tr), "val", len(va), "best iter", m.best_iteration)
    return m, iso


def curves(y, p):
    from sklearn.metrics import precision_recall_curve, roc_curve
    fpr, tpr, _ = roc_curve(y, p)
    idx = np.unique(np.linspace(0, len(fpr) - 1, 50).astype(int))
    roc = [dict(fpr=float(fpr[i]), tpr=float(tpr[i])) for i in idx]
    pr_, rc_, _ = precision_recall_curve(y, p)
    idx = np.unique(np.linspace(0, len(pr_) - 1, 50).astype(int))
    pr = [dict(recall=float(rc_[i]), precision=float(pr_[i])) for i in idx]
    order = np.argsort(-p, kind="stable")
    dec = np.array_split(order, 10)
    lift = [dict(decile=i + 1, rate=float(y[ix].mean()), meanPredicted=float(p[ix].mean()), n=int(len(ix))) for i, ix in enumerate(dec)]
    return roc, pr, lift


def baselines(tr, te, target):
    from sklearn.linear_model import LogisticRegression
    from sklearn.pipeline import make_pipeline
    from sklearn.preprocessing import StandardScaler
    f3 = ["bal_rel", "dip_rate", "pace"]
    clip = lambda X: X.assign(bal_rel=X.bal_rel.clip(-5, 20), pace=X.pace.clip(0, 5))  # noqa: E731
    lr = make_pipeline(StandardScaler(), LogisticRegression(max_iter=1000)).fit(clip(tr[f3]), tr[target])
    return {
        "Dipped in the previous cycle": te.prev_cycle_dip.values.astype(float),
        "Rule: balance minus fixed payments still to come < 0": (te.bal_after_fixed.values < 0).astype(float),
        "Rule score: -(balance minus fixed payments)": -te.bal_after_fixed.values,
        "Logistic regression (balance vs spend to payday, dip rate, pace)": lr.predict_proba(clip(te[f3]))[:, 1],
        # one hand-made feature already carries the 3-feature regression
        SINGLE: -te.bal_rel.values,
        LR_ALL: lr_all(tr, te, target),
    }, lr


SINGLE = "Single feature: -(balance after fixed payments / usual spend to payday)"
LR_ALL = "Logistic regression on all features"


def lr_all(tr, te, target):
    """Logistic regression on the same features as the model (inf -> NaN -> 0, clipped at the training p1/p99, standardised)."""
    from sklearn.linear_model import LogisticRegression
    from sklearn.pipeline import make_pipeline
    from sklearn.preprocessing import StandardScaler
    X = lambda Z: Z[FEATS].replace([np.inf, -np.inf], np.nan).fillna(0).clip(-1e6, 1e6)  # noqa: E731
    qs = X(tr).quantile([0.01, 0.99])
    cl = lambda Z: X(Z).clip(qs.iloc[0], qs.iloc[1], axis=1)  # noqa: E731
    m = make_pipeline(StandardScaler(), LogisticRegression(max_iter=3000, C=1.0)).fit(cl(tr), tr[target])
    return m.predict_proba(cl(te))[:, 1]


def card_metrics(mt, mt_unseen):
    """Card rows, strongest simple baseline first (the overview and the chat quote metrics[0])."""
    L = "LightGBM (isotonic-calibrated)"
    metrics = [
        dict(label="ROC AUC (test, Jul-Aug 2026)", model=mt[L]["rocAuc"], baseline=mt[LR_ALL]["rocAuc"], baselineName="logistic regression on the same features", unit="", better="higher"),
        dict(label="PR AUC (test)", model=mt[L]["prAuc"], baseline=mt[LR_ALL]["prAuc"], baselineName="logistic regression on the same features", unit="", better="higher"),
        dict(label="Brier score (test)", model=mt[L]["brier"], baseline=mt[LR_ALL]["brier"], baselineName="logistic regression on the same features", unit="", better="lower"),
        dict(label="ROC AUC (test)", model=mt[L]["rocAuc"], baseline=mt[SINGLE]["rocAuc"], baselineName="one feature: what is left after fixed payments vs usual spend to payday", unit="", better="higher"),
        dict(label="ROC AUC (test)", model=mt[L]["rocAuc"], baseline=mt["Dipped in the previous cycle"]["rocAuc"], baselineName="dipped in the previous cycle", unit="", better="higher"),
        dict(label="Brier score (test)", model=mt[L]["brier"], baseline=mt["Base rate (constant)"]["brier"], baselineName="base rate", unit="", better="lower"),
        dict(label="ROC AUC, customers never seen in training", model=mt_unseen[L]["rocAuc"], baseline=mt_unseen[LR_ALL]["rocAuc"], baselineName="logistic regression on the same features", unit="", better="higher"),
    ]
    if "Simulator (calibrated bootstrap, same rows)" in mt:
        metrics.append(dict(label="Brier score vs the balance simulator (same rows)", model=mt["LightGBM on the simulator's rows"]["brier"],
                            baseline=mt["Simulator (calibrated bootstrap, same rows)"]["brier"], baselineName="calibrated bootstrap simulator", unit="", better="lower"))
    return metrics


def card_verdict(metrics):
    """'ships' only if every row is better AND the gain over the logistic regression on the same features is material on
    the ranking of rare positives (PR AUC +0.02) and on calibration (Brier at least 5% lower); ROC AUC alone is near its ceiling."""
    better = all((m["model"] > m["baseline"]) if m["better"] == "higher" else (m["model"] < m["baseline"]) for m in metrics)
    pr, br = metrics[1], metrics[2]
    material = pr["model"] - pr["baseline"] >= 0.02 and br["model"] <= 0.95 * br["baseline"]
    return "ships" if better and material else "experimental"


def card_caveats(mt, thr, elevated, verdict):
    L = "LightGBM (isotonic-calibrated)"
    why = ("It ships on that PR AUC and calibration gain, which is what the alert threshold uses; the ROC AUC gain alone would not justify it."
           if verdict == "ships" else "That gain is too small to call it more than experimental.")
    return [
        f"A single hand-made feature (what is left after fixed payments, relative to usual spending until payday) already reaches ROC AUC "
        f"{mt[SINGLE]['rocAuc']:.3f}. The model adds {mt[L]['rocAuc'] - mt[LR_ALL]['rocAuc']:+.3f} ROC AUC and {mt[L]['prAuc'] - mt[LR_ALL]['prAuc']:+.3f} "
        f"PR AUC over a logistic regression on the same {len(FEATS)} features, and lowers the Brier score from {mt[LR_ALL]['brier']:.4f} to "
        f"{mt[L]['brier']:.4f}. " + why,
        "Target uses the intraday balance between the cut-off and the actual next salary; synthetic opening balances (Oct 2024) never enter a target.",
        f"Alert threshold {thr:.2f} chosen to maximise F1 on the validation period; 'elevated' starts at {elevated:.2f}.",
        "Probabilities are calibrated on Apr-Jun 2026 and checked on Jul-Aug 2026 (see reliability).",
        "Explanations are SHAP attributions of the uncalibrated model in log-odds; correlated features (balance, balance after fixed payments) share credit.",
        "Salary-sweep customers: the model only sees this account.",
        "Tail (irregular-income) customers are not scored.",
    ]


def main():
    import shap
    df = B.build_table()
    log("rows", df.shape)
    res = {}
    for target, name in [("risk_tp", "to_payday"), ("risk_14", "14d")]:
        d = prep(df, target)
        m, iso = train_one(d, target, name)
        va = d[(d.split == "val") & ~d.unseen]
        pva = iso.predict(m.predict(va[FEATS], num_iteration=m.best_iteration))
        # alert threshold: maximise F1 on the validation period
        ths = np.linspace(0.05, 0.95, 91)
        f1 = []
        for th in ths:
            a = pva >= th
            tp = (a & (va[target].values == 1)).sum()
            pr, rc = tp / max(a.sum(), 1), tp / max(va[target].sum(), 1)
            f1.append(2 * pr * rc / max(pr + rc, 1e-9))
        thr = float(ths[int(np.argmax(f1))])
        te = d[d.split == "test"].reset_index(drop=True)
        y = te[target].values
        raw = m.predict(te[FEATS], num_iteration=m.best_iteration)
        p = iso.predict(raw)
        tr = d[(d.split == "train") & ~d.unseen]
        bl, lr = baselines(tr, te, target)
        base_rate = float(tr[target].mean())
        mt = {"LightGBM (isotonic-calibrated)": metrics_block(y, p, thr), "LightGBM raw": metrics_block(y, raw, thr)}
        for k, v in bl.items():
            mt[k] = metrics_block(y, v, 0.5 if v.max() <= 1 else 0.0)
        mt["Base rate (constant)"] = dict(brier=float(np.mean((base_rate - y) ** 2)))
        un = te.unseen.values
        mt_unseen = {"LightGBM (isotonic-calibrated)": metrics_block(y[un], p[un], thr),
                     "Logistic regression (3 features)": metrics_block(y[un], bl["Logistic regression (balance vs spend to payday, dip rate, pace)"][un]),
                     LR_ALL: metrics_block(y[un], bl[LR_ALL][un])}
        if name == "to_payday":
            od = pd.read_parquet(os.path.join(CACHE_DIR, "b_od_backtest.parquet"))
            j = te[["customer_id", "t"]].reset_index().merge(od, on=["customer_id", "t"])
            if len(j):
                jy = j.y.values
                mt["Simulator (calibrated bootstrap, same rows)"] = metrics_block(jy, j.sim_cal.values, thr)
                mt["LightGBM on the simulator's rows"] = metrics_block(jy, p[j["index"].values], thr)
        for k, v in mt.items():
            log(name, k, {kk: round(vv, 4) if isinstance(vv, float) else vv for kk, vv in v.items()})
        roc, pr, lift = curves(y, p)
        rel = []
        edges = np.linspace(0, 1, 11)
        for b in range(10):
            mm = (p >= edges[b]) & ((p < edges[b + 1]) if b < 9 else (p <= 1))
            if mm.sum():
                rel.append(dict(bin=f"{edges[b]:.1f}-{edges[b+1]:.1f}", predicted=float(p[mm].mean()), observed=float(y[mm].mean()), n=int(mm.sum())))
        res[name] = dict(d=d, m=m, iso=iso, thr=thr, te=te, p=p, y=y, mt=mt, mt_unseen=mt_unseen, roc=roc, pr=pr, lift=lift, rel=rel,
                         base_rate=base_rate, n_tr=len(tr), n_va=len(va))

    # ------------------------------------------------------------ SHAP + per-customer files (to_payday model is the primary)
    R = res["to_payday"]
    m, iso, thr = R["m"], R["iso"], R["thr"]
    expl = shap.TreeExplainer(m)
    te_s = R["te"].sample(min(20000, len(R["te"])), random_state=0)
    sv_te = expl.shap_values(te_s[FEATS])
    sv_te = sv_te[1] if isinstance(sv_te, list) else sv_te
    mabs = np.abs(sv_te).mean(axis=0)
    fi = sorted(zip(FEATS, mabs), key=lambda x: -x[1])[:15]

    now = df[(df.t == B.ASOF_I)].reset_index(drop=True)
    raw_now = m.predict(now[FEATS], num_iteration=m.best_iteration)
    p_now = iso.predict(raw_now)
    p_now = np.where(now.bal.values < 0, 1.0, p_now)
    p14_now = res["14d"]["iso"].predict(res["14d"]["m"].predict(now[FEATS], num_iteration=res["14d"]["m"].best_iteration))
    p14_now = np.where(now.bal.values < 0, 1.0, p14_now)
    sv_now = expl.shap_values(now[FEATS])
    sv_now = sv_now[1] if isinstance(sv_now, list) else sv_now
    base_now = float(p_now.mean())
    ranks = pd.Series(p_now).rank(pct=True).values * 100
    elevated = min(0.15, thr)

    # weekly track record: cut-offs asOf-7k with a known outcome (all after the training period)
    hist_rows = df[((B.ASOF_I - df.t) % 7 == 0) & (df.t < B.ASOF_I) & (df.t > B.TRAIN_END) & df.risk_tp.notna() & (df.pay_act <= B.ASOF_I) & (df.pay_act > 0)].copy()
    hist_rows["p"] = np.where(hist_rows.bal < 0, 1.0, iso.predict(m.predict(hist_rows[FEATS], num_iteration=m.best_iteration)))
    hist = {cid: g.sort_values("t").tail(12) for cid, g in hist_rows.groupby("customer_id")}

    odir = os.path.join(ML_DIR, "risk")
    os.makedirs(odir, exist_ok=True)
    order = sorted(range(len(now)), key=lambda i: (now.customer_id[i] not in PERSONAS, now.customer_id[i]))
    for i in order:
        cid = now.customer_id[i]
        pr_ = float(p_now[i])
        sv = sv_now[i]
        drivers = []
        row = now.iloc[i]
        seen_low = set()
        for j in np.argsort(-np.abs(sv)):
            if len(drivers) >= 6:
                break
            f = FEATS[j]
            v = float(now[f][i])
            if f in ("min_low30", "min_low_prev_cycle"):
                if round(v) in seen_low:
                    continue
                seen_low.add(round(v))
            lab, disp = reason(f, v, sv[j], row)
            drivers.append(dict(feature=f, label=lab, value=v, display=disp, contribution=float(sv[j]), direction="raises" if sv[j] > 0 else "lowers"))
        h = hist.get(cid)
        out = dict(id=cid, asOf=B.i2s(B.ASOF_I), horizonDays=int(max(1, now.dtp[i] - 1)), probability=pr_,
                   level="high" if pr_ >= thr else "elevated" if pr_ >= elevated else "low", baseRate=base_now,
                   percentile=float(round(ranks[i], 1)), drivers=drivers,
                   history=[] if h is None else [dict(date=B.i2s(r.t), probability=float(r.p), wentNegative=bool(r.risk_tp > 0)) for r in h.itertuples()],
                   target="to_payday", probability14d=float(p14_now[i]), alertThreshold=thr)
        if now.bal[i] < 0:
            out["note"] = "The balance is already below zero today."
        elif now.has_sweep[i] > 0:
            out["note"] = "Most of the salary moves to another account right after payday; the model only sees this account."
        write_json(os.path.join(odir, f"{cid}.json"), out)
    log("risk files", len(now))

    # ------------------------------------------------------------ model card
    mt = R["mt"]
    L = "LightGBM (isotonic-calibrated)"
    metrics = card_metrics(mt, R["mt_unseen"])
    verdict = card_verdict(metrics)
    R14 = res["14d"]
    card = dict(
        key="risk", name="Early warning: below zero before payday",
        purpose="Estimates the chance that the balance goes below zero before the next salary arrives, and says why.",
        method=f"LightGBM binary classifier on {len(FEATS)} features known at the weekly cut-off (balance, fixed payments still to come, "
               "spending pace vs own normal, past dips, buffer, rent share, payday burn, volatility); isotonic calibration fitted on the "
               "validation period; SHAP TreeExplainer attributions turned into plain-language reasons.",
        trainedOn=f"{R['n_tr']:,} (customer, weekly cut-off) rows 2025-01-01..2026-03-31, CUST00001-05000 minus a 10% never-seen hold-out; "
                  "rows already below zero at the cut-off excluded",
        split="Time split by cut-off date AND outcome window: train cut-offs <= 2026-03-31 whose next salary is also by 2026-03-31; "
              "validation 2026-04..06 (early stopping, isotonic calibration, alert threshold); test cut-offs 2026-07-01..2026-08-31. "
              "10% of customers are never used for fitting and are reported separately.",
        metrics=metrics, verdict=verdict,
        caveats=card_caveats(mt, thr, elevated, verdict),
        trainedAt=time.strftime("%Y-%m-%dT%H:%M:%S"),
        trainSeconds=round(time.time() - T0, 1),
        validation=dict(testAll=mt, testUnseenCustomers=R["mt_unseen"], variant14d=dict(testAll=R14["mt"], testUnseenCustomers=R14["mt_unseen"], threshold=R14["thr"], reliability=R14["rel"]),
                        leakageChecks=LEAKAGE, leakageCheckResult=_leak()),
        evidence=dict(reliability=R["rel"], roc=R["roc"], pr=R["pr"], liftByDecile=R["lift"], baseRate=R["base_rate"], testPositiveRate=float(R["y"].mean()),
                      featureImportance=[dict(feature=f, label=LABELS.get(f, f), meanAbsShap=float(v)) for f, v in fi],
                      threshold=dict(value=thr, precision=mt[L]["precision"], recall=mt[L]["recall"], alertRate=mt[L]["alertRate"]),
                      comparison=[dict(method=k, **{kk: v[kk] for kk in ("rocAuc", "prAuc", "brier") if kk in v}) for k, v in mt.items()],
                      params=dict(objective="binary", numLeaves=63, learningRate=0.05, bestIteration=int(m.best_iteration), features=len(FEATS)),
                      splits=dict(train=dict(cutoffs="2025-01-01..2026-03-31", rows=R["n_tr"]), val=dict(cutoffs="2026-04-01..2026-06-30", rows=R["n_va"]),
                                  test=dict(cutoffs="2026-07-01..2026-08-31", rows=int(len(R["te"])), unseenCustomerRows=int(R["te"].unseen.sum())))),
    )
    write_json(os.path.join(GLOBAL_DIR, "modelcard-risk.json"), card)
    log("done; verdict", card["verdict"])


def _leak():
    import json
    p = os.path.join(CACHE_DIR, "b_leakage.json")
    return json.load(open(p)) if os.path.exists(p) else None


LEAKAGE = [
    "Automated check (b_data.leakage_check): features recomputed for 40 random customers x 3 cut-offs with every array position after the cut-off overwritten by random garbage; all values must be identical.",
    "Feature list asserted to exclude target-derived columns (risk_tp, risk_14, pay_act: the actual next salary date is used only for the target).",
    "Days-to-payday is the PREDICTED payday from salary history up to the cut-off (port of the app's rule), never the actual one.",
    "Purged split: a training row is used only if its whole outcome window ends before the validation period starts; same for validation vs test.",
    "Calibration and threshold fitted on validation, metrics reported on test only; 10% of customers held out of fitting entirely.",
]

if __name__ == "__main__":
    main()
