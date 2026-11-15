"""ML-B shared data layer: dense per-customer daily arrays + a feature/target builder evaluated at cut-off dates.

Every feature for cut-off day t is computed ONLY from array positions <= t (see `leakage_check`, which recomputes the
features with everything after t overwritten by garbage and asserts they are unchanged). Targets look at t+1 onwards.

Day index i = days since 2024-10-01 (0..729, 729 = AS_OF 2026-09-30).
"""
import datetime as dt
import functools
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import CACHE_DIR, DATA_DIR, PURCHASE_CATEGORIES, load_tx  # noqa: E402

D0 = dt.date(2024, 10, 1)
ND = 730
ASOF_I = 729
SIM_CATS = PURCHASE_CATEGORIES + ["Utilities"]
ARR_PATH = os.path.join(CACHE_DIR, "b_arrays.npz")

# split boundaries (day indices, inclusive)
TRAIN_END = (dt.date(2026, 3, 31) - D0).days
VAL_START, VAL_END = (dt.date(2026, 4, 1) - D0).days, (dt.date(2026, 6, 30) - D0).days
TEST_START, TEST_END = (dt.date(2026, 7, 1) - D0).days, (dt.date(2026, 8, 31) - D0).days
FIRST_CUTOFF = (dt.date(2025, 1, 1) - D0).days  # >= 92 days of history; Oct 2024 never enters a target


def i2d(i):
    return D0 + dt.timedelta(days=int(i))


def i2s(i):
    return i2d(i).isoformat()


_EXT = ND + 500
_dates = [i2d(i) for i in range(-400, _EXT)]
DOM = np.array([d.day for d in _dates])
MKEY = np.array([d.year * 12 + d.month - 1 for d in _dates])
WDAY = np.array([d.isoweekday() for d in _dates])  # 1 = Mon .. 7 = Sun
_OFF = 400  # DOM[i + _OFF] is the day of month of day index i


def dom(i):
    return int(DOM[i + _OFF])


def mkey(i):
    return int(MKEY[i + _OFF])


def wday(i):
    return int(WDAY[i + _OFF])


@functools.lru_cache(None)
def month_start_i(mk):
    y, m = divmod(mk, 12)
    return (dt.date(y, m + 1, 1) - D0).days


@functools.lru_cache(None)
def month_len(mk):
    return month_start_i(mk + 1) - month_start_i(mk)


def date_in_month(mk, day):
    day = max(1, min(month_len(mk), int(np.floor(day + 0.5))))
    return month_start_i(mk) + day - 1


def month_end_i(mk):
    return month_start_i(mk) + month_len(mk) - 1


def js_round(x):
    return int(np.floor(x + 0.5))


# ------------------------------------------------------------------ arrays
def build_arrays():
    import polars as pl
    tx = load_tx().select(["customer_id", "date", "type", "category", "amount"])
    ids = sorted(tx["customer_id"].unique().to_list())
    cidx = {c: i for i, c in enumerate(ids)}
    C = len(ids)
    tx = tx.with_columns(
        ci=pl.col("customer_id").replace_strict(cidx, return_dtype=pl.Int32),
        di=(pl.col("date") - pl.lit(D0)).dt.total_days().cast(pl.Int32),
    )
    cat = np.zeros((C, ND, len(SIM_CATS)), np.float64)
    catmap = {k: i for i, k in enumerate(SIM_CATS)}
    v = (tx.filter(pl.col("type").is_in(["purchase", "utilities_payment"]))
           .group_by(["ci", "di", "category"]).agg(pl.col("amount").sum().alias("a")))
    k = np.array([catmap[c] for c in v["category"].to_list()])
    np.add.at(cat, (v["ci"].to_numpy(), v["di"].to_numpy(), k), -v["a"].to_numpy())
    npur = np.zeros((C, ND), np.int16)
    p = tx.filter(pl.col("type") == "purchase").group_by(["ci", "di"]).len()
    npur[p["ci"].to_numpy(), p["di"].to_numpy()] = p["len"].to_numpy()

    def flow(types):
        a = np.zeros((C, ND), np.float64)
        f = tx.filter(pl.col("type").is_in(types)).group_by(["ci", "di"]).agg(pl.col("amount").sum())
        a[f["ci"].to_numpy(), f["di"].to_numpy()] = f["amount"].to_numpy()
        return a

    salary = flow(["salary"])
    housing = flow(["housing_payment"])
    invest = flow(["investment_deposit"])
    other_in = flow(["other_income", "investment_withdrawal"])
    sweep = flow(["salary_sweep"])
    first_day = tx.group_by("ci").agg(pl.col("di").min()).sort("ci")["di"].to_numpy()

    daily = pl.read_parquet(os.path.join(DATA_DIR, "features", "daily.parquet")).with_columns(
        ci=pl.col("customer_id").replace_strict(cidx, return_dtype=pl.Int32),
        di=(pl.col("date") - pl.lit(D0)).dt.total_days().cast(pl.Int32))
    close = np.zeros((C, ND))
    low = np.zeros((C, ND))
    close[daily["ci"].to_numpy(), daily["di"].to_numpy()] = daily["close"].to_numpy()
    low[daily["ci"].to_numpy(), daily["di"].to_numpy()] = daily["low"].to_numpy()
    cu = pl.read_parquet(os.path.join(DATA_DIR, "features", "customers.parquet"))
    cu = cu.with_columns(ci=pl.col("customer_id").replace_strict(cidx, return_dtype=pl.Int32)).sort("ci")
    os.makedirs(CACHE_DIR, exist_ok=True)
    np.savez(ARR_PATH, ids=np.array(ids), cat=cat, npur=npur, salary=salary, housing=housing, invest=invest,
             other_in=other_in, sweep=sweep, close=close, low=low, first_day=first_day,
             age=cu["age"].to_numpy(), has_sweep=cu["has_sweep"].to_numpy())


A = None


def load_arrays():
    global A
    if A is None:
        if not os.path.exists(ARR_PATH):
            build_arrays()
        z = np.load(ARR_PATH)
        A = {k: z[k] for k in z.files}
        A["ids"] = [str(x) for x in A["ids"]]
        A["var"] = A["cat"].sum(axis=2)
    return A


# ------------------------------------------------------------------ Python port of the engine's recurring logic
def pred_payday(sd, sa, t):
    """Port of predictPaydays(c, 0)[0] at cut-off t. sd/sa: salary days/amounts <= t. -> (day, amount, estimated)."""
    m_t = mkey(t)
    if len(sd):
        l12 = sd >= month_start_i(m_t - 11)
        l6 = sd >= month_start_i(m_t - 5)
        a6 = sa[l6][-6:]
        typical = float(np.median(a6)) if len(a6) else 0.0
        days = DOM[sd[l12] + _OFF]
        share15 = float(np.mean(days == 15)) if len(days) else 0.0
        late = days[days != 15]
        late_day = js_round(np.median(late)) if len(late) else 29
        regular = len(set(MKEY[sd[l6] + _OFF].tolist())) >= 3
    else:
        typical, regular = 0.0, False
    if not regular or typical <= 0:
        return t + 30, 0.0, True
    use15 = share15 >= 0.5
    m = m_t + 1 if mkey(int(sd[-1])) == m_t else m_t
    for _ in range(6):
        date = date_in_month(m, 15 if use15 else late_day)
        if date <= t:
            ld = date_in_month(m, max(26, late_day))
            if ld > t:
                date = ld
            elif t < month_end_i(m):
                date = t + 1
            else:
                m += 1
                continue
        return date, typical, False
    return t + 30, typical, True


def housing_info(hd, ha, t):
    if not len(hd):
        return None
    m_t = mkey(t)
    days = DOM[hd[-12:] + _OFF]
    return dict(typical=float(np.median(ha[-6:])), day_from=int(days.min()), day_to=int(days.max()),
                median_day=js_round(np.median(days)), paid=set(MKEY[hd + _OFF].tolist()),
                active=bool((hd >= month_start_i(m_t - 3)).any()))


def housing_due(h, t, until):
    """Port of housingDue: [(day, amount)] with day < until."""
    if h is None or not h["active"] or h["typical"] <= 0:
        return []
    out = []
    m0 = mkey(t)
    for k in range(4):
        m = m0 + k
        f = date_in_month(m, h["day_from"])
        to = date_in_month(m, max(h["day_to"], h["day_from"]))
        if f >= until:
            break
        if m in h["paid"] or to < t:
            continue
        md = date_in_month(m, h["median_day"])
        out.append((md if md > t else t + 1, h["typical"]))
    return out


def invest_pending(vd, va, sd, t):
    """Port of investInfo/pendingInvestment: (day, amount) or None."""
    if not len(vd) or not len(sd):
        return None
    m_t = mkey(t)
    regular = len(set(MKEY[vd[vd >= month_start_i(m_t - 5)] + _OFF].tolist())) >= 3
    typical = float(np.median(va[-6:]))
    lags = []
    for d in vd[-12:]:
        prev = sd[sd <= d]
        if len(prev) and d - prev[-1] <= 10:
            lags.append(d - prev[-1])
    lag = js_round(np.median(lags)) if lags else 2
    last_s = int(sd[-1])
    if not regular or typical <= 0 or vd[-1] >= last_s or t - last_s > 7:
        return None
    d = last_s + lag
    return (d if d > t else t + 1, typical)


# ------------------------------------------------------------------ features and targets at cut-offs
HORIZONS = {"7d": 7, "14d": 14, "30d": 30, "to_payday": None}
COMMON = ["bal", "m7", "m14", "m30", "m90", "m182", "r7", "r14", "r30", "cv90", "zero90", "npur30", "dsp", "dtp",
          "pay_est", "income", "housing_typ", "rent_due", "days_to_rent", "invest_due", "util_rate", "util_exp",
          "fixed_due", "bal_after_fixed", "bal_rel", "cycle_spend", "pace", "prev_cycle_dip", "cycle_dipped",
          "dip_rate", "days_below182", "min_low30", "min_low_prev_cycle", "buffer", "housing_share", "burn",
          "vol", "weekend_share", "age", "has_sweep", "dom_t", "wday_t", "bal_same_phase_prev"]
HFEAT = ["h", "base", "wk_exp", "lm", "post_pay", "fri_sat"]
Q = [0.1, 0.25, 0.5, 0.75, 0.9]


def cutoffs_for(ci):
    g = set(range(ASOF_I - (ci % 7), FIRST_CUTOFF - 1, -7)) | set(range(ASOF_I, FIRST_CUTOFF - 1, -7))
    return sorted(g)


def cust_rows(ci, cutoffs=None, arrays=None):
    """Feature/target rows for customer ci at each cut-off. Returns dict of lists."""
    a = arrays or load_arrays()
    var = a["var"][ci]
    cs = np.concatenate([[0.0], np.cumsum(var)])
    util = a["cat"][ci, :, 8]
    ucs = np.concatenate([[0.0], np.cumsum(util)])
    npur = a["npur"][ci]
    low, close = a["low"][ci], a["close"][ci]
    sal_all = np.nonzero(a["salary"][ci] > 0)[0]
    sal_amt_all = a["salary"][ci][sal_all]
    hou_all = np.nonzero(a["housing"][ci] < 0)[0]
    hou_amt_all = -a["housing"][ci][hou_all]
    inv_all = np.nonzero(a["invest"][ci] < 0)[0]
    inv_amt_all = -a["invest"][ci][inv_all]
    first = int(a["first_day"][ci])
    age = float(a["age"][ci])
    has_sweep = float(a["has_sweep"][ci])
    if cutoffs is None:
        cutoffs = cutoffs_for(ci)

    def S(lo, hi):  # sum of var over [lo, hi] inclusive, clipped to data
        lo, hi = max(lo, 0), min(hi, ND - 1)
        return cs[hi + 1] - cs[lo] if hi >= lo else 0.0

    rows = {k: [] for k in ["t"] + COMMON}
    for hn in HORIZONS:
        for f in HFEAT + ["y"] + [f"emp{int(q*100)}" for q in Q]:
            rows[f"{hn}_{f}"] = []
    for k in ["risk_tp", "risk_14", "pay_act"]:
        rows[k] = []

    for t in cutoffs:
        R = {"t": t}
        n182 = min(182, t - first + 1)
        hist0 = t - n182 + 1
        m = {}
        for w in (7, 14, 30, 90, 182):
            nn = max(1, min(w, t - first + 1))
            m[w] = S(t - nn + 1, t) / nn
        for w in (7, 14, 30, 90, 182):
            R[f"m{w}"] = m[w]
        base_rate = max(m[182], 1.0)
        R["r7"], R["r14"], R["r30"] = m[7] / base_rate, m[14] / base_rate, m[30] / base_rate
        v90 = var[max(first, t - 89): t + 1]
        R["cv90"] = float(v90.std() / max(v90.mean(), 1e-6))
        R["zero90"] = float((v90 == 0).mean())
        R["npur30"] = float(npur[max(0, t - 29): t + 1].sum())
        R["bal"] = close[t]
        sd, sa = sal_all[sal_all <= t], sal_amt_all[sal_all <= t]
        P, pay_amt, est = pred_payday(sd, sa, t)
        R["dtp"], R["pay_est"] = P - t, float(est)
        R["income"] = float(np.median(sa[-6:])) if len(sa) else 0.0
        R["dsp"] = t - int(sd[-1]) if len(sd) else 99
        hm = hou_all <= t
        hinfo = housing_info(hou_all[hm], hou_amt_all[hm], t)
        R["housing_typ"] = hinfo["typical"] if hinfo else 0.0
        due = housing_due(hinfo, t, P)
        R["rent_due"] = sum(x[1] for x in due)
        R["days_to_rent"] = (due[0][0] - t) if due else 99
        vm = inv_all <= t
        ip = invest_pending(inv_all[vm], inv_amt_all[vm], sd, t)
        R["invest_due"] = ip[1] if ip and ip[0] < P else 0.0
        nu = max(1, min(90, t - first + 1))
        R["util_rate"] = (ucs[t + 1] - ucs[t - nu + 1]) / nu
        R["util_exp"] = R["util_rate"] * max(0, P - t - 1)
        R["fixed_due"] = R["rent_due"] + R["invest_due"] + R["util_exp"]
        R["bal_after_fixed"] = R["bal"] - R["fixed_due"]
        R["bal_rel"] = R["bal_after_fixed"] / (max(m[90] - R["util_rate"], 0.5) * max(1, P - t - 1))
        if len(sd):
            s1 = int(sd[-1])
            R["cycle_spend"] = S(s1, t)
            R["pace"] = R["cycle_spend"] / (base_rate * (t - s1 + 1))
            R["cycle_dipped"] = float(low[s1 + 1: t + 1].min() < 0) if t > s1 else 0.0
            # balance at the same phase of the previous cycle
            R["bal_same_phase_prev"] = close[int(sd[-2]) + (t - s1)] if len(sd) >= 2 and sd[-2] + (t - s1) <= t else R["bal"]
        else:
            R["cycle_spend"], R["pace"], R["cycle_dipped"], R["bal_same_phase_prev"] = S(t - 29, t), 1.0, 0.0, R["bal"]
        if len(sd) >= 2:
            s0, s1 = int(sd[-2]), int(sd[-1])
            seg = low[s0 + 1: s1]
            R["prev_cycle_dip"] = float(seg.min() < 0) if len(seg) else 0.0
            R["min_low_prev_cycle"] = float(seg.min()) if len(seg) else close[s1]
        else:
            R["prev_cycle_dip"], R["min_low_prev_cycle"] = 0.0, R["bal"]
        cyc = [(int(x), int(y)) for x, y in zip(sd[:-1], sd[1:]) if x >= 31]
        R["dip_rate"] = float(np.mean([low[x + 1: y].min() < 0 if y > x + 1 else False for x, y in cyc])) if cyc else 0.0
        R["days_below182"] = float((low[max(31, t - 181): t + 1] < 0).sum())
        R["min_low30"] = float(low[max(0, t - 29): t + 1].min())
        R["buffer"] = R["bal"] / max(1.0, m[90] * 30 + R["housing_typ"])
        R["housing_share"] = R["housing_typ"] / max(R["income"], 1.0)
        sd182 = sd[sd >= hist0]
        tot182 = S(hist0, t)
        R["burn"] = float(sum(S(s, min(s + 4, t)) for s in sd182) / tot182) if tot182 > 0 else 0.0
        if t - first + 1 >= 180:
            mo = np.array([S(t - 30 * (j + 1) + 1, t - 30 * j) for j in range(6)])
            R["vol"] = float(mo.std() / max(mo.mean(), 1.0))
        else:
            R["vol"] = 0.0
        hv = var[hist0: t + 1]
        hw = WDAY[np.arange(hist0, t + 1) + _OFF]
        R["weekend_share"] = float(hv[hw >= 6].sum() / max(hv.sum(), 1e-6))
        wmean = np.array([hv[hw == w].mean() if (hw == w).any() else m[182] for w in range(1, 8)])
        R["age"], R["has_sweep"], R["dom_t"], R["wday_t"] = age, has_sweep, dom(t), wday(t)
        for k in COMMON:
            rows[k].append(R[k])
        rows["t"].append(t)
        paydays_pred = [P, date_in_month(mkey(P) + 1, dom(P))]
        for hn, h in HORIZONS.items():
            if h is None:
                h = max(1, P - t - 1)
            days = np.arange(t + 1, t + h + 1)
            wd = WDAY[days + _OFF]
            rows[f"{hn}_h"].append(h)
            rows[f"{hn}_base"].append(base_rate * h)
            rows[f"{hn}_wk_exp"].append(float(wmean[wd - 1].sum()))
            sh = max(30, h)
            rows[f"{hn}_lm"].append(S(t + 1 - sh, t + h - sh))
            rows[f"{hn}_post_pay"].append(float(sum(((days >= p) & (days <= p + 4)).sum() for p in paydays_pred)))
            rows[f"{hn}_fri_sat"].append(float(((wd == 5) | (wd == 6)).sum()))
            rows[f"{hn}_y"].append(S(t + 1, t + h) if t + h <= ASOF_I else np.nan)
            # empirical baseline: quantiles of own past windows of the same length ending within the last 182 days
            st = np.arange(max(first, t - 181), t - h + 2)
            if len(st):
                ws = cs[st + h] - cs[st]
                qs = np.quantile(ws, Q)
            else:
                qs = np.full(len(Q), base_rate * h)
            for q, val in zip(Q, qs):
                rows[f"{hn}_emp{int(q*100)}"].append(float(val))
        nxt = sal_all[sal_all > t]
        if len(nxt):
            pa = int(nxt[0])
            rows["pay_act"].append(pa)
            rows["risk_tp"].append(float(low[t + 1: pa].min() < 0) if pa > t + 1 else 0.0)
        else:
            rows["pay_act"].append(-1)
            rows["risk_tp"].append(np.nan)
        rows["risk_14"].append(float(low[t + 1: t + 15].min() < 0) if t + 14 <= ASOF_I else np.nan)
    return rows


def _worker(ci):
    r = cust_rows(ci)
    r["ci"] = [ci] * len(r["t"])
    return r


def build_table(force=False):
    """All (customer, cut-off) rows for main-cohort customers as a pandas DataFrame (cached parquet)."""
    import pandas as pd
    path = os.path.join(CACHE_DIR, "b_rows.parquet")
    if os.path.exists(path) and not force:
        return pd.read_parquet(path)
    a = load_arrays()
    cis = [i for i, c in enumerate(a["ids"]) if c <= "CUST05000"]
    import multiprocessing as mp
    with mp.get_context("fork").Pool(30) as pool:
        parts = pool.map(_worker, cis, chunksize=20)
    df = pd.concat([pd.DataFrame(p) for p in parts], ignore_index=True)
    df["customer_id"] = [a["ids"][i] for i in df["ci"]]
    df.to_parquet(path)
    return df


def leakage_check(n=40, seed=0):
    """Recompute features with all data after the cut-off replaced by garbage; features must be identical."""
    a = load_arrays()
    rng = np.random.default_rng(seed)
    cis = rng.choice(5000, n, replace=False)
    bad = 0
    checked = 0
    for ci in cis:
        cuts = cutoffs_for(int(ci))
        for t in rng.choice(cuts, 3, replace=False):
            t = int(t)
            ref = cust_rows(int(ci), [t])
            b = {k: (v[int(ci): int(ci) + 1].copy() if isinstance(v, np.ndarray) else v) for k, v in a.items()}
            for k in ["cat", "npur", "salary", "housing", "invest", "other_in", "sweep", "close", "low"]:
                arr = b[k][0]
                garbage = rng.normal(0, 5000, arr[t + 1:].shape)
                if k == "npur":
                    garbage = np.abs(garbage)
                arr[t + 1:] = garbage.astype(arr.dtype)
            b["var"] = b["cat"].sum(axis=2)
            got = cust_rows(0, [t], arrays=b)
            for k in COMMON + [f"{hn}_{f}" for hn in HORIZONS for f in HFEAT + [f"emp{int(q*100)}" for q in Q]]:
                x, y = ref[k][0], got[k][0]
                checked += 1
                if not (x == y or (np.isnan(x) and np.isnan(y))):
                    bad += 1
                    print("LEAK?", a["ids"][ci], i2s(t), k, x, y)
    return {"customersChecked": int(n), "cutoffsChecked": int(n * 3), "valuesCompared": checked, "mismatches": bad}


if __name__ == "__main__":
    import time
    t0 = time.time()
    if "--arrays" in sys.argv or not os.path.exists(ARR_PATH):
        build_arrays()
        print("arrays", time.time() - t0)
    df = build_table(force="--force" in sys.argv)
    print(df.shape, time.time() - t0)
    import json
    res = leakage_check(40)
    json.dump(res, open(os.path.join(CACHE_DIR, "b_leakage.json"), "w"))
    print("leakage check", res)
