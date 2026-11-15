"""Per-customer profile (MlProfile) + in-bank peer stats (PeerStats). ML-A step 1b. Idempotent.

Reads  features/features.parquet (window y2 = last 12 months), features/customers.parquet, features/map.parquet, global/tribes.json
Writes ml/profile/{id}.json for all 5,100 customers, global/peers.json

usage: ~/mlenv/bin/python ml/a_profile.py [CUST...]
"""
import json, os, sys, time
import numpy as np
import polars as pl
from common import DATA_DIR, GLOBAL_DIR, AS_OF, out_dir, write_json, is_tail_cohort
from a_dict import FEATURES, label, unit, disp

t0 = time.time()
PROFILE_FEATURES = list(FEATURES)
# candidates for highlights (what a coach would talk about) and whether "high" is notable
HIGHLIGHT = ["housing_share", "spend_restaurants_m", "share_restaurants", "small_n_m", "payday_burn", "weekend_share",
             "evening_share", "savings_rate", "investing_rate", "days_below_zero", "buffer_months", "volatility",
             "share_everyday", "spend_transportation_m", "spend_entertainment_m", "spend_lifestyle_m", "spend_travel_m",
             "spend_groceries_m", "everyday_to_income", "basket_must_irregular_m"]
COACH_PRIORITY = {"housing_share", "days_below_zero", "savings_rate", "buffer_months", "small_n_m", "spend_restaurants_m",
                  "payday_burn", "everyday_to_income", "investing_rate"}  # ranked first when equally unusual
PEER_METRICS = ["spend_restaurants_m", "spend_groceries_m", "basket_everyday_m", "basket_must_irregular_m", "savings_rate",
                "investing_rate", "small_n_m", "small_total_m", "housing_level", "housing_share", "utilities_m",
                "spend_transportation_m", "spend_entertainment_m", "spend_lifestyle_m", "spend_travel_m", "spend_health_m",
                "spend_home_tech_m", "purchases_m", "income_m", "payday_burn", "weekend_share", "buffer_months", "days_below_zero"]

F = pl.read_parquet(os.path.join(DATA_DIR, "features", "features.parquet")).filter(pl.col("window") == "y2")
C = pl.read_parquet(os.path.join(DATA_DIR, "features", "customers.parquet"))
F = F.join(C.select("customer_id", "age", "age_band", "has_sweep", "has_housing"), on="customer_id").sort("customer_id")
mp_path = os.path.join(DATA_DIR, "features", "map.parquet")
MP = {r["customer_id"]: r for r in pl.read_parquet(mp_path).to_dicts()} if os.path.exists(mp_path) else {}
tribes = json.load(open(os.path.join(GLOBAL_DIR, "tribes.json"))) if os.path.exists(os.path.join(GLOBAL_DIR, "tribes.json")) else []
tname = {t["id"]: t["name"] for t in tribes}

# reference population: main cohort; salary-sweep customers excluded (their spending is mostly invisible here);
# housing metrics only among customers with a housing payment
ref = F.filter(~pl.col("customer_id").map_elements(is_tail_cohort, return_dtype=pl.Boolean) & ~pl.col("has_sweep"))
ref_by_band = {b: ref.filter(pl.col("age_band") == b) for b in ref["age_band"].unique().to_list()}
arr = {b: {k: (np.sort(df.filter(pl.col("has_housing")) [k].drop_nulls().to_numpy()) if k.startswith("housing")
               else np.sort(df[k].drop_nulls().to_numpy())) for k in PROFILE_FEATURES} for b, df in ref_by_band.items()}


def pct(band, k, v):
    a = arr[band][k]
    if v is None or len(a) == 0 or (isinstance(v, float) and np.isnan(v)):
        return None
    lo, hi = np.searchsorted(a, v, "left"), np.searchsorted(a, v, "right")
    return 100.0 * (lo + hi) / 2 / len(a)


# ---- peers.json
peers = {"byAgeBand": {}, "metrics": [{"key": k, "label": label(k), "unit": unit(k)} for k in PEER_METRICS],
         "population": "main-cohort customers, last 12 months (2025-10-01..2026-09-30), salary-sweep customers excluded; housing metrics among customers with a housing payment",
         "asOf": AS_OF}
for b, df in sorted(ref_by_band.items()):
    peers["byAgeBand"][b] = {}
    for k in PEER_METRICS:
        a = arr[b][k]
        if len(a) == 0:
            continue
        q = np.percentile(a, [10, 25, 50, 75, 90])
        peers["byAgeBand"][b][k] = {"p10": disp(k, q[0]), "p25": disp(k, q[1]), "p50": disp(k, q[2]), "p75": disp(k, q[3]),
                                    "p90": disp(k, q[4]), "n": int(len(a))}
write_json(os.path.join(GLOBAL_DIR, "peers.json"), peers)

# ---- profiles
only = set(sys.argv[1:])
odir = out_dir("ml", "profile")
n = 0
for r in F.iter_rows(named=True):
    cid = r["customer_id"]
    if only and cid not in only:
        continue
    band = r["age_band"]
    feats = {k: disp(k, r[k]) for k in PROFILE_FEATURES if r.get(k) is not None}
    pcts = {k: pct(band, k, r[k]) for k in PROFILE_FEATURES if r.get(k) is not None}
    pcts = {k: round(v, 1) for k, v in pcts.items() if v is not None}
    cands = []
    for k in HIGHLIGHT:
        if k not in pcts or k not in feats:
            continue
        if k.startswith("housing") and not r["has_housing"]:
            continue
        if r["has_sweep"] and k not in ("savings_rate", "investing_rate", "buffer_months", "days_below_zero"):
            continue
        p = pcts[k]
        if k == "days_below_zero" and r[k] == 0:
            continue
        # material difference only: tight synthetic distributions make tiny gaps look extreme in percentile terms
        med = disp(k, float(np.median(arr[band][k]))) if len(arr[band][k]) else feats[k]
        gap = abs(feats[k] - med)
        if unit(k) == "%" and gap < 5:
            continue
        if unit(k) == "days" and gap < 7:
            continue
        if unit(k) not in ("%", "days") and gap < 0.25 * max(abs(med), 1e-9):
            continue
        cands.append((abs(p - 50) + (15 if k in COACH_PRIORITY else 0), k, p))
    cands.sort(reverse=True)
    hl, used_groups = [], set()
    for _, k, p in cands:
        grp = k.replace("share_", "spend_").replace("_m", "")  # avoid restaurants twice (euros and share)
        if grp in used_groups:
            continue
        used_groups.add(grp)
        hl.append({"feature": k, "label": label(k), "value": feats[k], "unit": unit(k), "percentile": p,
                   "direction": "high" if p >= 50 else "low"})
        if len(hl) == 6:
            break
    m = MP.get(cid)
    if m:
        K = len([c for c in m if c.startswith("w") and c[1:].isdigit()])
        mix = sorted([{"id": j, "name": tname.get(j, f"Tribe {j+1}"), "weight": m[f"w{j}"]} for j in range(K)], key=lambda x: -x["weight"])
        mix = [x for x in mix if x["weight"] >= 0.02]
        s = sum(x["weight"] for x in mix)
        for x in mix:
            x["weight"] = round(x["weight"] / s, 3)
        tribe = {"id": int(m["tribe"]), "name": tname.get(int(m["tribe"]), ""), "fit": round(m["fit"], 3), "mix": mix}
        mapxy = {"x": round(m["x"], 4), "y": round(m["y"], 4)}
    else:
        tribe, mapxy = {"id": -1, "name": "", "fit": 0, "mix": []}, {"x": 0.5, "y": 0.5}
    doc = {"id": cid, "asOf": AS_OF, "ageBand": band, "window": ["2025-10-01", AS_OF], "features": feats, "percentiles": pcts,
           "map": mapxy, "tribe": tribe, "highlights": hl, "cohort": "tail" if is_tail_cohort(cid) else "main",
           "hasSalarySweep": bool(r["has_sweep"])}
    write_json(os.path.join(odir, f"{cid}.json"), doc)
    n += 1
print(f"wrote {n} profiles + peers.json ({time.time()-t0:.1f}s)")
