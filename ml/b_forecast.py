"""Crystal ball (MlForecast): LightGBM quantile model of variable spending + calibrated bootstrap balance fan.

  1a. quantile model of purchases+utilities spend over 7d / 14d / 30d / to next payday (q 0.1..0.9), one LightGBM per
      quantile with the horizon as a feature; target = spend / (own 182-day daily mean x horizon days) so quantiles are
      scale-free. Baselines: trailing-90-day average x days; empirical quantiles of own past same-length windows.
  1b. numpy port of the TS bootstrap simulator (mulberry32 bit-exact), `scale` calibrated per customer so the median
      simulated spend to payday equals the quantile model's median. Writes ml/forecast/{id}.json.
  1c. backtest of the simulator's overdraft probability over past cut-offs (reliability, Brier vs baselines).
usage: ~/mlenv/bin/python ml/b_forecast.py
"""
import json
import os
import sys
import time

import numpy as np
import pandas as pd

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import b_data as B  # noqa: E402
from common import CACHE_DIR, GLOBAL_DIR, ML_DIR, write_json  # noqa: E402

T0 = time.time()
HN = ["7d", "14d", "to_payday", "30d"]
HCODE = {h: i for i, h in enumerate(HN)}
QS = B.Q
QN = [f"p{int(q*100)}" for q in QS]
FEATS = B.COMMON + ["hz"] + B.HFEAT + ["lm_rel", "wk_rel"]
PERSONAS = ["CUST04754", "CUST01408", "CUST03861", "CUST01349", "CUST00651", "CUST04375"]
MODEL_DIR = os.path.join(CACHE_DIR, "b_models")
os.makedirs(MODEL_DIR, exist_ok=True)


def log(*a):
    print(f"[{time.time()-T0:6.1f}s]", *a, flush=True)


def unseen(cid):
    return int(cid[4:]) % 10 == 7  # 10% of customers never used for fitting (reported separately)


def long_table(df):
    parts = []
    for hn in HN:
        p = df[["ci", "customer_id", "t", "risk_tp", "pay_act"] + B.COMMON].copy()
        for f in B.HFEAT + ["y"] + [f"emp{int(q*100)}" for q in QS]:
            p[f] = df[f"{hn}_{f}"].values
        p["hz"] = HCODE[hn]
        p["hn"] = hn
        parts.append(p)
    L = pd.concat(parts, ignore_index=True)
    L["lm_rel"] = L["lm"] / L["base"]
    L["wk_rel"] = L["wk_exp"] / L["base"]
    L["ratio"] = L["y"] / L["base"]
    L["end"] = L["t"] + L["h"]
    L["unseen"] = L["customer_id"].map(unseen)
    L["split"] = "none"
    L.loc[(L.t <= B.TRAIN_END) & (L.end <= B.TRAIN_END), "split"] = "train"
    L.loc[(L.t >= B.VAL_START) & (L.t <= B.VAL_END) & (L.end <= B.VAL_END), "split"] = "val"
    L.loc[(L.t >= B.TEST_START) & (L.t <= B.TEST_END) & (L.end <= B.ASOF_I), "split"] = "test"
    return L


def pinball(y, q, a):
    d = y - q
    return np.mean(np.maximum(a * d, (a - 1) * d))


def train_quantiles(L):
    import lightgbm as lgb
    tr = L[(L.split == "train") & ~L.unseen]
    va = L[(L.split == "val") & ~L.unseen]
    rng = np.random.default_rng(0)
    if len(tr) > 1_400_000:
        tr = tr.iloc[rng.choice(len(tr), 1_400_000, replace=False)]
    log("train rows", len(tr), "val rows", len(va))
    models, info = {}, {}
    if "--retrain" not in sys.argv and all(os.path.exists(os.path.join(MODEL_DIR, f"forecast_{qn}.txt")) for qn in QN):
        for qn in QN:
            m = lgb.Booster(model_file=os.path.join(MODEL_DIR, f"forecast_{qn}.txt"))
            m.best_iteration = 0  # file holds exactly the early-stopped trees
            models[qn] = m
            info[qn] = m.current_iteration()
        log("loaded saved quantile models", info)
        return models, info
    for q, qn in zip(QS, QN):
        path = os.path.join(MODEL_DIR, f"forecast_{qn}.txt")
        params = dict(objective="quantile", alpha=q, learning_rate=0.05, num_leaves=63, min_data_in_leaf=200,
                      feature_fraction=0.8, bagging_fraction=0.8, bagging_freq=1, lambda_l2=1.0, num_threads=30,
                      verbose=-1, seed=1)
        dtr = lgb.Dataset(tr[FEATS], tr["ratio"].clip(0, 20))
        dva = lgb.Dataset(va[FEATS], va["ratio"].clip(0, 20), reference=dtr)
        m = lgb.train(params, dtr, 800, valid_sets=[dva], callbacks=[lgb.early_stopping(50, verbose=False)])
        m.save_model(path)
        models[qn] = m
        info[qn] = m.best_iteration
        log("quantile", q, "best iter", m.best_iteration)
    return models, info


def predict(models, X):
    P = np.column_stack([models[qn].predict(X[FEATS], num_iteration=models[qn].best_iteration) for qn in QN])
    P = np.sort(np.clip(P, 0, None), axis=1)  # no quantile crossing
    return P * X["base"].values[:, None]


def fit_ratio(L):
    """One-parameter baseline: own 182-day daily average x days x the median ratio actual / that, fitted per horizon on
    the training rows. The model's target is exactly this ratio, so this is the strongest naive point forecast."""
    tr = L[(L.split == "train") & ~L.unseen]
    return {hn: float(np.median((tr[tr.hn == hn].y / tr[tr.hn == hn].base).dropna())) for hn in HN}


def evaluate(L, P, ratio=None):
    out = {"pinball": [], "coverage": [], "maeByHorizon": []}
    rows = []
    for hn in HN:
        m = (L.hn == hn).values
        y = L.y.values[m]
        tr = (L.m90.values[m] * L.h.values[m])
        emp = L[[f"emp{int(q*100)}" for q in QS]].values[m]
        for j, q in enumerate(QS):
            # no trailing-average column: one point forecast used for every quantile is not a quantile forecast
            out["pinball"].append(dict(horizon=hn, quantile=q, model=pinball(y, P[m, j], q), baselineEmpirical=pinball(y, emp[:, j], q)))
        cov_m = np.mean((y >= P[m, 0]) & (y <= P[m, 4]))
        cov_e = np.mean((y >= emp[:, 0]) & (y <= emp[:, 4]))
        out["coverage"].append(dict(horizon=hn, nominal=0.8, model=cov_m, baseline=cov_e,
                                    cov50Model=np.mean((y >= P[m, 1]) & (y <= P[m, 3])),
                                    cov50Baseline=np.mean((y >= emp[:, 1]) & (y <= emp[:, 3]))))
        out["maeByHorizon"].append(dict(horizon=hn, model=np.mean(np.abs(y - P[m, 2])), baselineTrailing=np.mean(np.abs(y - tr)),
                                        baselineEmpirical=np.mean(np.abs(y - emp[:, 2])), meanActual=np.mean(y), n=int(m.sum())))
        if ratio is not None:
            out["maeByHorizon"][-1]["baselineRatio"] = float(np.mean(np.abs(y - L.base.values[m] * ratio[hn])))
        rows.append(hn)
    return out


def card_metrics(ev_all, od_stats):
    """Card rows, strongest simple baseline first (the overview and the chat quote metrics[0])."""
    mae = {r["horizon"]: r for r in ev_all["maeByHorizon"]}
    cov = {r["horizon"]: r for r in ev_all["coverage"]}
    pin = pd.DataFrame(ev_all["pinball"]).groupby("horizon")[["model", "baselineEmpirical"]].mean()
    metrics = []
    for hn in ["14d", "to_payday"]:
        metrics.append(dict(label=f"MAE of median spend, {hn}", model=mae[hn]["model"], baseline=mae[hn]["baselineRatio"],
                            baselineName="own 182-day average x days x a ratio fitted on training rows", unit="EUR", better="lower"))
        metrics.append(dict(label=f"MAE of median spend, {hn}", model=mae[hn]["model"], baseline=mae[hn]["baselineTrailing"],
                            baselineName="own trailing-90-day average x days", unit="EUR", better="lower"))
        metrics.append(dict(label=f"Mean pinball loss (5 quantiles), {hn}", model=float(pin.loc[hn, "model"]), baseline=float(pin.loc[hn, "baselineEmpirical"]),
                            baselineName="empirical quantiles of own past windows (last 182 days)", unit="EUR", better="lower"))
        metrics.append(dict(label=f"Coverage error of the 10-90% band, {hn} (|coverage - 80%|)", model=abs(cov[hn]["model"] - 0.8) * 100,
                            baseline=abs(cov[hn]["baseline"] - 0.8) * 100, baselineName="empirical quantiles of own past windows", unit="pp", better="lower"))
    metrics.append(dict(label="Brier score, overdraft before payday (simulator, calibrated scale)", model=od_stats["brierSimCalibrated"],
                        baseline=od_stats["brierBaseRate"], baselineName="training-period base rate", unit="", better="lower"))
    metrics.append(dict(label="Brier score, overdraft before payday (simulator, calibrated scale)", model=od_stats["brierSimCalibrated"],
                        baseline=od_stats["brierSameAsLastCycle"], baselineName="same as last cycle (0/1)", unit="", better="lower"))
    return metrics


def card_caveats(metrics):
    g = {m["label"]: 1 - m["model"] / m["baseline"] for m in metrics if m["baselineName"].startswith("own 182-day")}
    return [
        f"Against the strongest point baseline (own 182-day average x days x one ratio fitted on training rows) the median forecast is "
        f"{g['MAE of median spend, 14d']:.1%} more accurate over 14 days and {g['MAE of median spend, to_payday']:.1%} to payday; against the "
        "trailing 90-day average the gain looks larger. Most of the value is in the calibrated range, not the median.",
        "Synthetic data: spending is smooth and seasonality weak, so baselines are already decent.",
        "Spend = card purchases + utility bills; salary, rent and investing are placed as fixed events on their expected dates.",
        "The overdraft probability counts paths that go below zero before the predicted payday; the outcome is whether the real balance went below zero before the real next salary.",
        "Historical backtest of the simulator places rent on its expected day and a pending investment on day 1 (as the app does approximately).",
        "Salary-sweep customers: only spending visible in this account is forecast.",
        "Tail (irregular-income) customers get the unscaled simulator with a note.",
    ]


# ------------------------------------------------------------------ simulator (bit-exact port of shared/engine/simulate.ts)
M32 = np.uint64(0xFFFFFFFF)


def mulberry32(seed, n):
    k = np.arange(1, n + 1, dtype=np.uint64)
    a = (np.uint64(seed) + k * np.uint64(0x6D2B79F5)) & M32
    t = a
    t = ((t ^ (t >> np.uint64(15))) * (t | np.uint64(1))) & M32
    t2 = ((t ^ (t >> np.uint64(7))) * (t | np.uint64(61))) & M32
    t = (t ^ ((t + t2) & M32)) & M32
    return ((t ^ (t >> np.uint64(14))) & M32).astype(np.float64) / 4294967296.0


def r2(x):
    x = np.asarray(x, dtype=np.float64)
    return np.sign(x) * np.floor(np.abs(x) * 100 + 0.5 + 1e-9) / 100


def sim_paths(ci, fixed_events, days=35, n_paths=1000, seed=42, H=182):
    """Returns (spend[n_paths, days], fixed[days+1], dates) at scale 1, with the TS draw order."""
    a = B.load_arrays()
    asof = B.ASOF_I
    h0 = asof - H + 1
    dayTotal = a["var"][ci, h0: asof + 1]  # H values
    first = int(a["first_day"][ci])
    pools = {w: [d for d in range(H) if h0 + d >= first and B.wday(h0 + d) == w] for w in range(1, 8)}
    alld = [d for w in range(1, 8) for d in pools[w]]
    u = mulberry32(seed, n_paths * days).reshape(n_paths, days)
    spend = np.zeros((n_paths, days))
    for k in range(1, days + 1):
        p = pools[B.wday(asof + k)] or alld
        if p:
            idx = np.floor(u[:, k - 1] * len(p)).astype(int)
            spend[:, k - 1] = dayTotal[np.array(p)[idx]]
    fixed = np.zeros(days + 1)
    for ev in fixed_events:
        k = (pd.Timestamp(ev["date"]).date() - B.D0).days - asof
        if 1 <= k <= days:
            fixed[k] += ev["amount"]
    return spend, fixed


def sim_result(start, spend, fixed, scale, payday_k, days=35):
    n = spend.shape[0]
    flows = fixed[None, 1:] - spend * scale
    bal = np.empty((n, days + 1))
    bal[:, 0] = start
    bal[:, 1:] = start + np.cumsum(flows, axis=1)
    # TS accumulates sequentially; cumsum is sequential too
    pk = max(0, min(days + 1, payday_k))
    od = (bal[:, :pk] < 0).any(axis=1) if pk > 0 else np.zeros(n, bool)
    qs = np.quantile(bal, [0.1, 0.25, 0.5, 0.75, 0.9], axis=0)
    return bal, qs, float(np.floor(od.mean() * 1000 + 0.5) / 1000)


def parity_check(ts):
    res = []
    a = B.load_arrays()
    for cid, rec in ts.items():
        if "parity" not in rec:
            continue
        ci = a["ids"].index(cid)
        spend, fixed = sim_paths(ci, rec["fixedEvents"])
        pk = (pd.Timestamp(rec["nextPayday"]["date"]).date() - B.D0).days - B.ASOF_I
        for p in rec["parity"]:
            _, qs, od = sim_result(rec["balance"], spend, fixed, p["scale"], pk)
            tsfan = np.array([[f[k] for k in ["p10", "p25", "p50", "p75", "p90"]] for f in p["fan"]]).T
            diff = float(np.abs(r2(qs) - tsfan).max())
            res.append(dict(id=cid, scale=p["scale"], maxFanDiffEur=diff, odPython=od, odTs=p["overdraftProbToPayday"]))
    return res


# ------------------------------------------------------------------ 1c: overdraft-probability backtest
def od_backtest(R, p50_tp, n_paths=300, seed=7):
    """R: to_payday rows (test split, balance >= 0, outcome known). Simulated with the history ending at each cut-off."""
    a = B.load_arrays()
    rng = np.random.default_rng(seed)
    out_cal, out_raw = np.zeros(len(R)), np.zeros(len(R))
    scales = np.zeros(len(R))
    ci, t, dtp = R.ci.values, R.t.values, R.dtp.values.astype(int)
    for i in range(len(R)):
        K = max(0, dtp[i] - 1)  # days strictly before the predicted payday
        if K == 0:
            continue
        ks = np.arange(1, K + 1)
        j = rng.integers(0, 26, size=(n_paths, K))
        day = t[i] + ks[None, :] - 7 * (np.ceil(ks / 7).astype(int)[None, :] + j)
        sp = a["var"][ci[i], day]
        fixed = np.zeros(K)
        if R.rent_due.values[i] > 0 and R.days_to_rent.values[i] <= K:
            fixed[int(R.days_to_rent.values[i]) - 1] -= R.rent_due.values[i]
        if R.invest_due.values[i] > 0:
            fixed[0] -= R.invest_due.values[i]
        Hs = max(1, dtp[i] - 1)
        med = np.median(sp[:, :Hs].sum(axis=1))
        sc = float(np.clip(p50_tp[i] / med, 0.25, 4)) if med > 0 else 1.0
        scales[i] = sc
        b0 = R.bal.values[i]
        out_raw[i] = (np.cumsum(fixed[None, :] - sp, axis=1).min(axis=1) + b0 < 0).mean()
        out_cal[i] = (np.cumsum(fixed[None, :] - sp * sc, axis=1).min(axis=1) + b0 < 0).mean()
    return out_cal, out_raw, scales


def reliability(p, y, bins=10):
    edges = np.linspace(0, 1, bins + 1)
    out = []
    for b in range(bins):
        m = (p >= edges[b]) & ((p < edges[b + 1]) if b < bins - 1 else (p <= 1))
        if m.sum():
            out.append(dict(bin=f"{edges[b]:.1f}-{edges[b+1]:.1f}", predicted=float(p[m].mean()), observed=float(y[m].mean()), n=int(m.sum())))
    return out


def brier(p, y):
    return float(np.mean((p - y) ** 2))


# ------------------------------------------------------------------ main
def main():
    df = B.build_table()
    log("rows", df.shape)
    L = long_table(df)
    models, best = train_quantiles(L)
    t_train = time.time() - T0

    te = L[L.split == "test"].reset_index(drop=True)
    P = predict(models, te)
    ratio = fit_ratio(L)
    ev_all = evaluate(te, P, ratio)
    unseen_m = te.unseen.values
    ev_unseen = evaluate(te[unseen_m].reset_index(drop=True), P[unseen_m], ratio)
    log("test rows", len(te), "unseen", int(unseen_m.sum()))
    for r in ev_all["maeByHorizon"]:
        log("MAE", r)
    for r in ev_all["coverage"]:
        log("COV", r)

    # per-customer backtest (to_payday, test windows)
    tp = te[te.hn == "to_payday"].copy()
    tpP = P[(te.hn == "to_payday").values]
    tp["ae"] = np.abs(tp.y - tpP[:, 2])
    tp["nae"] = np.abs(tp.y - tp.m90 * tp.h)
    tp["cov"] = (tp.y >= tpP[:, 0]) & (tp.y <= tpP[:, 4])
    per_cust = tp.groupby("customer_id").agg(windows=("ae", "size"), mae=("ae", "mean"), naiveMae=("nae", "mean"), coverage80=("cov", "mean"))

    # 1c overdraft probability backtest on to_payday test rows with known outcome and a non-negative start
    R = tp[(tp.bal >= 0) & tp.risk_tp.notna()].reset_index(drop=True)
    p50_R = tpP[((tp.bal >= 0) & tp.risk_tp.notna()).values, 2]
    od_cal, od_raw, bt_scales = od_backtest(R, p50_R)
    y = R.risk_tp.values
    base = float(df[(df.t <= B.TRAIN_END) & (df.bal >= 0) & df.risk_tp.notna() & (df.pay_act <= B.TRAIN_END)].risk_tp.mean())
    od_stats = dict(n=len(R), observedRate=float(y.mean()), trainBaseRate=base,
                    brierSimCalibrated=brier(od_cal, y), brierSimScale1=brier(od_raw, y), brierBaseRate=brier(np.full(len(y), base), y),
                    brierSameAsLastCycle=brier(R.prev_cycle_dip.values, y))
    try:
        from sklearn.metrics import roc_auc_score
        od_stats["aucSimCalibrated"] = float(roc_auc_score(y, od_cal))
        od_stats["aucSameAsLastCycle"] = float(roc_auc_score(y, R.prev_cycle_dip.values))
    except Exception:
        pass
    log("OD backtest", od_stats)
    pd.DataFrame(dict(customer_id=R.customer_id, t=R.t, sim_cal=od_cal, sim_raw=od_raw, y=y)).to_parquet(os.path.join(CACHE_DIR, "b_od_backtest.parquet"))

    # ---------------------------------------------------------------- score as-of and write per-customer files
    ts = json.load(open(os.path.join(CACHE_DIR, "b_ts_export.json")))
    parity = parity_check(ts)
    log("parity", parity)
    now = L[L.t == B.ASOF_I].reset_index(drop=True)
    # use the TS engine's payday for the to_payday horizon (recompute horizon features if the port disagrees)
    agree = 0
    for i in np.nonzero((now.hn == "to_payday").values)[0]:
        rec = ts[now.customer_id[i]]
        hts = max(1, rec["nextPayday"]["daysAway"] - 1)
        if hts == now.h[i]:
            agree += 1
        else:
            now.loc[i, "base"] = now.base[i] / now.h[i] * hts
            now.loc[i, "h"] = hts
    n_tp = int((now.hn == "to_payday").sum())
    log("payday port agrees with TS for", agree, "of", n_tp)
    Pn = predict(models, now)
    pred = {}
    for i in range(len(now)):
        pred.setdefault(now.customer_id[i], {})[now.hn[i]] = (int(now.h[i]), Pn[i])

    a = B.load_arrays()
    odir = os.path.join(ML_DIR, "forecast")
    os.makedirs(odir, exist_ok=True)
    scales = {}
    n_written = 0
    order = PERSONAS + [c for c in a["ids"] if c not in PERSONAS]
    for cid in order:
        ci = a["ids"].index(cid)
        rec = ts[cid]
        npd = rec["nextPayday"]
        spend, fixed = sim_paths(ci, rec["fixedEvents"])
        pk = (pd.Timestamp(npd["date"]).date() - B.D0).days - B.ASOF_I
        Hs = max(1, min(35, npd["daysAway"] - 1))
        sim_spend_tp = spend[:, :Hs].sum(axis=1)
        med = float(np.median(sim_spend_tp))
        note = None
        if cid in pred:
            p50 = float(pred[cid]["to_payday"][1][2])
            scale = float(np.clip(p50 / med, 0.25, 4.0)) if med > 1 else 1.0
            spend_out = [dict(horizon=hn, days=pred[cid][hn][0], **{qn: float(v) for qn, v in zip(QN, pred[cid][hn][1])}) for hn in HN]
            if cid in per_cust.index:
                pc = per_cust.loc[cid]
                backtest = dict(windows=int(pc.windows), mae=float(pc.mae), naiveMae=float(pc.naiveMae), coverage80=float(pc.coverage80))
            else:
                backtest = None
            if a["has_sweep"][ci]:
                note = "Most of the salary moves to another account right after payday, so this forecast covers only the spending visible in this account."
        else:
            scale = 1.0
            backtest = None
            note = "Irregular-income customer (tail cohort): the quantile model was not trained on this group, so spending ranges come from the plain bootstrap simulation (scale 1) and are indicative only."
            spend_out = []
            for hn, h in [("7d", 7), ("14d", 14), ("to_payday", Hs), ("30d", 30)]:
                s = spend[:, :h].sum(axis=1)
                spend_out.append(dict(horizon=hn, days=h, **{qn: float(v) for qn, v in zip(QN, np.quantile(s, QS))}))
        scales[cid] = scale
        bal, qs, od = sim_result(rec["balance"], spend, fixed, scale, pk)
        dates = [B.i2s(B.ASOF_I + k) for k in range(36)]
        fan = [dict(day=k, date=dates[k], p10=qs[0, k], p25=qs[1, k], p50=qs[2, k], p75=qs[3, k], p90=qs[4, k]) for k in range(36)]
        out = dict(id=cid, asOf=B.i2s(B.ASOF_I), balance=rec["balance"],
                   nextPayday=dict(date=npd["date"], amount=npd["amount"], daysAway=npd["daysAway"]),
                   fixedEvents=rec["fixedEvents"], spend=spend_out, sim=dict(historyDays=182, scale=round(scale, 4)),
                   fan=fan, overdraftProbToPayday=od, backtest=backtest)
        if npd.get("estimated"):
            note = (note + " " if note else "") + "No regular salary: the payday is a 30-day planning horizon."
        if note:
            out["note"] = note
        write_json(os.path.join(odir, f"{cid}.json"), out)
        n_written += 1
    log("forecast files", n_written)

    sv = np.array([scales[c] for c in scales if c <= "CUST05000"])
    scale_dist = dict(zip(["p5", "p25", "p50", "p75", "p95"], np.quantile(sv, [0.05, 0.25, 0.5, 0.75, 0.95]).tolist()))
    scale_dist.update(mean=float(sv.mean()), clippedLow=int((sv <= 0.25).sum()), clippedHigh=int((sv >= 4).sum()))
    log("scale", scale_dist)

    # ---------------------------------------------------------------- model card
    rel_cal = reliability(od_cal, y)
    metrics = card_metrics(ev_all, od_stats)
    beats = all(m["model"] < m["baseline"] for m in metrics)
    import shap
    samp = te.sample(min(8000, len(te)), random_state=0)
    sv = shap.TreeExplainer(models["p50"]).shap_values(samp[FEATS])
    imp = np.abs(sv).mean(axis=0)
    fi = sorted(zip(FEATS, imp), key=lambda x: -x[1])[:15]
    n_tr = int(((L.split == "train") & ~L.unseen).sum())
    card = dict(
        key="forecast", name="Crystal ball: spending quantiles + balance fan",
        purpose="Predicts how much this person will spend before payday (with a range) and how their balance is likely to move.",
        method="LightGBM quantile regression (q = 0.1/0.25/0.5/0.75/0.9, one model per quantile, horizon as a feature) on "
               f"{len(FEATS)} features known at the forecast date; target is spend divided by the customer's own 182-day "
               "daily average x days. The balance fan is the shared bootstrap simulator (same-weekday days from the last 182 "
               "days, fixed events on their dates, mulberry32 seed 42), with its `scale` calibrated so the simulated median "
               "spend to payday equals the quantile model's median.",
        trainedOn=f"{n_tr:,} (customer, cut-off, horizon) rows; customers CUST00001-05000 minus a 10% never-seen hold-out; "
                  "weekly cut-offs 2025-01-01..2026-03-31 (two interleaved weekday grids)",
        split="Time split: train cut-offs <= 2026-03-31 with the whole target window inside the training period; "
              "validation (early stopping) cut-offs 2026-04..06 with windows ending by 2026-06-30; "
              "test cut-offs 2026-07-01..2026-08-31 with windows ending by 2026-09-30.",
        metrics=metrics,
        verdict="ships" if beats else "experimental",
        caveats=card_caveats(metrics),
        trainedAt=time.strftime("%Y-%m-%dT%H:%M:%S"),
        trainSeconds=round(t_train, 1),
        validation=dict(unseenCustomers=dict(maeByHorizon=ev_unseen["maeByHorizon"], coverage=ev_unseen["coverage"]),
                        overdraftBacktest=od_stats, simulatorParity=parity,
                        paydayPortAgreement=dict(agree=agree, of=n_tp), bestIterations=best),
        evidence=dict(
            pinball=ev_all["pinball"], coverage=ev_all["coverage"], maeByHorizon=ev_all["maeByHorizon"],
            reliability=rel_cal, reliabilityScale1=reliability(od_raw, y), baseRate=base,
            brier=[dict(method="Simulator, calibrated scale", value=od_stats["brierSimCalibrated"]),
                   dict(method="Simulator, scale 1 (plain bootstrap)", value=od_stats["brierSimScale1"]),
                   dict(method="Base rate", value=od_stats["brierBaseRate"]),
                   dict(method="Same as last cycle", value=od_stats["brierSameAsLastCycle"])],
            featureImportance=[dict(feature=f, label=LABELS.get(f, f), meanAbsShap=float(g)) for f, g in fi],
            featureImportanceUnit="mean |SHAP| of the median model, in units of the target ratio (spend / own normal spend for the horizon)",
            scaleDistribution=scale_dist,
            params=dict(models=5, objective="quantile", bestIterations=best, features=len(FEATS), numLeaves=63, learningRate=0.05),
            splits=dict(train=dict(cutoffs="2025-01-01..2026-03-31", rows=n_tr),
                        val=dict(cutoffs="2026-04-01..2026-06-30", rows=int(((L.split == "val") & ~L.unseen).sum())),
                        test=dict(cutoffs="2026-07-01..2026-08-31", rows=int(len(te)), unseenCustomerRows=int(unseen_m.sum())),
                        overdraftBacktestRows=len(R)),
        ),
    )
    write_json(os.path.join(GLOBAL_DIR, "modelcard-forecast.json"), card)
    log("done; verdict", card["verdict"])


LABELS = {
    "bal": "Balance at the forecast date", "m7": "Spend per day, last 7 days", "m14": "Spend per day, last 14 days",
    "m30": "Spend per day, last 30 days", "m90": "Spend per day, last 90 days", "m182": "Spend per day, last 182 days",
    "r7": "Last 7 days vs own normal", "r14": "Last 14 days vs own normal", "r30": "Last 30 days vs own normal",
    "cv90": "Day-to-day variability", "zero90": "Share of no-spend days", "npur30": "Purchases in the last 30 days",
    "dsp": "Days since payday", "dtp": "Days until payday", "pay_est": "No regular salary", "income": "Monthly salary",
    "housing_typ": "Typical rent", "rent_due": "Rent still to pay before payday", "days_to_rent": "Days until rent",
    "invest_due": "Investment still to go out", "util_rate": "Utilities per day", "util_exp": "Expected utilities before payday",
    "fixed_due": "Fixed payments still to come before payday", "bal_after_fixed": "Balance after fixed payments still to come",
    "bal_rel": "Balance after fixed payments vs typical spend to payday", "cycle_spend": "Spent since payday",
    "pace": "Spending pace since payday vs own normal", "prev_cycle_dip": "Went below zero last cycle",
    "cycle_dipped": "Already below zero this cycle", "dip_rate": "Share of past pay cycles that went below zero",
    "days_below182": "Days below zero, last 6 months", "min_low30": "Lowest balance, last 30 days",
    "min_low_prev_cycle": "Lowest balance last cycle", "buffer": "Buffer (months of spending)", "housing_share": "Rent share of salary",
    "burn": "Payday burn (share spent in 5 days after payday)", "vol": "Month-to-month spending volatility",
    "weekend_share": "Weekend share of spending", "age": "Age", "has_sweep": "Salary moved to another bank",
    "dom_t": "Day of month", "wday_t": "Weekday", "bal_same_phase_prev": "Balance at the same point last cycle",
    "hz": "Horizon", "h": "Days in horizon", "base": "Own normal spend for these days", "wk_exp": "Expected spend from own weekday pattern",
    "lm": "Same days last month", "post_pay": "Post-payday days in horizon", "fri_sat": "Fridays and Saturdays in horizon",
    "lm_rel": "Same days last month vs normal", "wk_rel": "Weekday pattern vs normal",
}

if __name__ == "__main__":
    main()
