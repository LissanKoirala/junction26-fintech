"""Sanity checks for ML-A outputs: file counts, required keys (typesA.ts), file sizes, persona excerpts.
usage: ~/mlenv/bin/python ml/a_check.py"""
import json, os, random
from common import ML_DIR, GLOBAL_DIR

REQ = {
    "profile": ["id", "asOf", "ageBand", "features", "percentiles", "map", "tribe", "highlights"],
    "twins": ["id", "asOf", "nTwins", "window", "matchedOn", "groups", "differences", "you", "quality", "caveat"],
    "anomalies": ["id", "asOf", "transactions", "weeks", "last30Days", "method"],
    "habits": ["id", "asOf", "habits", "method"],
    "home": ["id", "asOf", "monthlyIncome", "reachable", "equity", "monthlySavingNow", "yearsToReady", "approval", "blockers", "caveat"],
}
GLOBAL = {"map": ["ids", "x", "y", "tribe", "tribes", "method", "features"], "peers": ["byAgeBand", "metrics"],
          "benchmarks": ["source", "licence", "surveyYear", "priceAdjustedTo", "groups", "coicop", "caveats"],
          **{f"modelcard-{k}": ["key", "name", "purpose", "method", "trainedOn", "split", "metrics", "verdict", "caveats", "trainedAt"]
             for k in ["tribes", "twins", "anomalies", "habits", "home"]}}
PERSONAS = ["CUST04754", "CUST01408", "CUST03861", "CUST01349", "CUST00651", "CUST04375"]
main = [f"CUST{i:05d}" for i in range(1, 5001)]
ok = True
for kind, keys in REQ.items():
    d = os.path.join(ML_DIR, kind)
    files = set(os.listdir(d)) if os.path.isdir(d) else set()
    missing = [c for c in main if f"{c}.json" not in files]
    sample = random.Random(0).sample(main, 50) + PERSONAS
    bad, sizes = [], []
    for c in sample:
        p = os.path.join(d, f"{c}.json")
        if not os.path.exists(p):
            continue
        sizes.append(os.path.getsize(p))
        j = json.load(open(p))
        bad += [(c, k) for k in keys if k not in j]
    print(f"{kind:10s} files={len(files):5d} missing_main={len(missing):4d} bad_keys={len(bad)} max_size={max(sizes) if sizes else 0:,}B")
    ok &= not missing and not bad
for g, keys in GLOBAL.items():
    p = os.path.join(GLOBAL_DIR, f"{g}.json")
    if not os.path.exists(p):
        print(f"global {g}: MISSING"); ok = False; continue
    j = json.load(open(p))
    miss = [k for k in keys if k not in j]
    extra = f" verdict={j['verdict']}" if "verdict" in j else ""
    print(f"global {g:22s} {os.path.getsize(p):>9,}B missing={miss}{extra}")
    ok &= not miss
for c in PERSONAS:
    pr = json.load(open(os.path.join(ML_DIR, "profile", f"{c}.json")))
    tw = json.load(open(os.path.join(ML_DIR, "twins", f"{c}.json"))) if os.path.exists(os.path.join(ML_DIR, "twins", f"{c}.json")) else None
    hb = json.load(open(os.path.join(ML_DIR, "habits", f"{c}.json")))
    print(f"\n{c}: tribe={pr['tribe']['name']} (fit {pr['tribe']['fit']}) rent share={pr['features'].get('housing_share', 0):.0f}% "
          f"days<0={pr['features'].get('days_below_zero')} highlights={[h['label'] for h in pr['highlights']]}")
    if tw:
        print("   twins:", {g["key"]: round(g["bufferChange"]) for g in tw["groups"]}, "|", [x["insight"] for x in tw["differences"][:2]])
    print("   habits:", [(h["category"], h["status"], h["changePct"]) for h in hb["habits"]])
print("\nALL OK" if ok else "\nPROBLEMS FOUND")
