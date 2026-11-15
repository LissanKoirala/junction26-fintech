"""Statistics Finland benchmarks (ML-A step 6): Household Budget Survey 2022, price-adjusted. Idempotent.

PxWeb API v1 (no personal data sent, generic User-Agent). Tables ktutk/14q4 (age of reference person) and
ktutk/14ph (household type), content kulukk_kt_hk_1_1 (EUR per household per month, current prices), year 2022.
CPI khi/15b5 (2025=100): factor = mean(Nov 2025..Oct 2026) / mean(2022). "04x" = 04 minus 04.2 (imputed owner rent).
Raw responses are cached in DATA_DIR/cache/statfin_*.json.

Writes global/benchmarks.json (Benchmarks)
usage: ~/mlenv/bin/python ml/a_benchmarks.py [--refresh]
"""
import json, os, sys, urllib.request
from common import GLOBAL_DIR, CACHE_DIR, out_dir, write_json

BASE = "https://pxdata.stat.fi/PxWeb/api/v1/en/StatFin/"
UA = {"User-Agent": "python-pxweb-client/1.0", "Content-Type": "application/json"}
TOP = ["0", "01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12", "13", "111", "112", "042", "77"]
CPI_CODE = {c: c for c in TOP}
CPI_CODE.update({"0": "SSS", "042": "04", "77": "SSS"})       # imputed rent -> housing CPI; consumption abroad -> total CPI
CPI_MONTHS_NOW = ["2025M11", "2025M12"] + [f"2026M{m:02d}" for m in range(1, 11)]
CPI_MONTHS_2022 = [f"2022M{m:02d}" for m in range(1, 13)]
AGE = ["SSS", "17-24", "25-34", "35-44", "45-54", "55-64", "65-74", "75-84", "85-"]
HH = {"1": "one-person-under-65", "2": "couple-under-65", "3": "single-parent", "4": "two-parent-family", "5": "over-64", "6": "other"}
out_dir("cache")


def post(table, query, cache):
    path = os.path.join(CACHE_DIR, f"statfin_{cache}.json")
    if os.path.exists(path) and "--refresh" not in sys.argv:
        return json.load(open(path))
    body = json.dumps({"query": [{"code": k, "selection": {"filter": "item", "values": v}} for k, v in query.items()],
                       "response": {"format": "json-stat2"}}).encode()
    req = urllib.request.Request(BASE + table, data=body, headers=UA, method="POST")
    j = json.loads(urllib.request.urlopen(req, timeout=120).read())
    json.dump(j, open(path, "w"))
    return j


def cube(j):
    """json-stat2 -> dict keyed by tuple of category codes (in dimension order)."""
    ids, sizes = j["id"], j["size"]
    cats = []
    for d in ids:
        idx = j["dimension"][d]["category"]["index"]
        codes = sorted(idx, key=idx.get) if isinstance(idx, dict) else idx
        cats.append(codes)
    out = {}
    for flat, v in enumerate(j["value"]):
        key, rem = [], flat
        for s in reversed(sizes):
            key.append(rem % s); rem //= s
        key = tuple(cats[i][k] for i, k in enumerate(reversed(key)))
        out[key] = v
    return ids, out, {d: j["dimension"][d]["category"]["label"] for d in ids}


age = post("ktutk/14q4.px", {"timeperiod_y": ["2022"], "coicop_46_20231201": TOP, "ikaryhma_10_20180101": AGE,
                             "contentscode": ["kulukk_kt_hk_1_1"]}, "14q4")
hh = post("ktutk/14ph.px", {"timeperiod_y": ["2022"], "coicop_46_20231201": TOP, "elinvaihe_13_20160101": list(HH) + ["SSS"],
                            "contentscode": ["kulukk_kt_hk_1_1"]}, "14ph")
cpi_codes = sorted(set(CPI_CODE.values()))
cpi = post("khi/15b5.px", {"timeperiod_m": CPI_MONTHS_2022 + CPI_MONTHS_NOW, "coicop_46_20231201": cpi_codes, "contentscode": ["ip_khi"]}, "15b5")

a_ids, A, a_lab = cube(age)
h_ids, H, h_lab = cube(hh)
c_ids, Cc, c_lab = cube(cpi)


def get(cubeids, data, **want):
    key = tuple(want.get(d, None) for d in cubeids)
    for k, v in data.items():
        if all(w is None or w == kk for w, kk in zip(key, k)):
            return v
    return None


coicop_labels = a_lab["coicop_46_20231201"]
factor = {}
for c in TOP:
    cc = CPI_CODE[c]
    now = [get(c_ids, Cc, timeperiod_m=m, coicop_46_20231201=cc) for m in CPI_MONTHS_NOW]
    old = [get(c_ids, Cc, timeperiod_m=m, coicop_46_20231201=cc) for m in CPI_MONTHS_2022]
    assert None not in now and None not in old, (c, now, old)
    factor[c] = (sum(now) / len(now)) / (sum(old) / len(old))
factor["04x"] = factor["04"]
coicop = {("total" if c == "0" else c if len(c) == 2 else f"{c[:2]}.{c[2:]}"): {"label": coicop_labels[c].split(" ", 1)[1] if " " in coicop_labels[c] else coicop_labels[c],
                                                                          "cpiFactor": round(factor[c], 4)} for c in TOP}
coicop["04x"] = {"label": "Housing and energy excluding imputed owner rent (04 minus 04.2)", "cpiFactor": round(factor["04"], 4)}
key_of = {c: ("total" if c == "0" else c if len(c) == 2 else f"{c[:2]}.{c[2:]}") for c in TOP}


def group(getter, label):
    raw = {key_of[c]: getter(c) for c in TOP}
    raw = {k: v for k, v in raw.items() if v is not None}
    if "04" in raw and "04.2" in raw:
        raw["04x"] = raw["04"] - raw["04.2"]
    adj = {k: v * (factor["04"] if k == "04x" else factor[next(c for c in TOP if key_of[c] == k)]) for k, v in raw.items()}
    return {"label": label, "raw2022": {k: round(v, 2) for k, v in raw.items()}, "adjusted": {k: round(v, 2) for k, v in adj.items()}}


groups = {"all": group(lambda c: get(a_ids, A, coicop_46_20231201=c, ikaryhma_10_20180101="SSS"), "All households")}
for g in AGE[1:]:
    groups[f"age:{g}"] = group(lambda c, g=g: get(a_ids, A, coicop_46_20231201=c, ikaryhma_10_20180101=g), f"Reference person aged {g.replace('-', '–')}")
for code, k in HH.items():
    groups[f"household:{k}"] = group(lambda c, code=code: get(h_ids, H, coicop_46_20231201=c,elinvaihe_13_20160101=code),
                                     h_lab["elinvaihe_13_20160101"][code])

checks = [("age:17-24", "total", 1871), ("age:17-24", "01", 251), ("age:17-24", "11.1", 81), ("age:25-34", "total", 3044),
          ("age:25-34", "11.1", 150), ("household:one-person-under-65", "total", 2167), ("household:one-person-under-65", "11.1", 95),
          ("all", "11.1", 111)]
fails = []
for g, c, v in checks:
    got = groups[g]["raw2022"].get(c)
    ok = got is not None and abs(got - v) <= 1
    print(f"check {g:34s} {c:6s} expected {v:5d} got {got}  {'OK' if ok else 'MISMATCH'}")
    if not ok:
        fails.append((g, c, v, got))
for c, v in [("total", 1.099), ("01", 1.126), ("11.1", 1.157), ("07", 1.020)]:
    got = coicop[c]["cpiFactor"]
    ok = abs(got - v) <= 0.0015
    print(f"check CPI {c:6s} expected {v} got {got}  {'OK' if ok else 'MISMATCH'}")
    if not ok:
        fails.append(("cpi", c, v, got))

write_json(os.path.join(GLOBAL_DIR, "benchmarks.json"), {
    "source": "Statistics Finland, Household Budget Survey 2022, tables 14q4 and 14ph",
    "sourceLine": "Source: Statistics Finland, Household Budget Survey 2022, price-adjusted",
    "licence": "CC BY 4.0", "surveyYear": 2022,
    "priceAdjustedTo": "average of Nov 2025 - Oct 2026 (CPI table 15b5, 2025=100)",
    "unit": "EUR per household per month",
    "groups": groups, "coicop": coicop,
    "crossChecks": [{"group": g, "coicop": c, "expected": v, "ok": (g, c, v) not in [(f[0], f[1], f[2]) for f in fails]} for g, c, v in checks],
    "caveats": ["Figures are per household, not per person; a household can have several members.",
                "Survey year 2022, inflated to today's prices with the matching CPI group (housing 04x uses the 04 CPI; consumption abroad uses total CPI).",
                "Housing is compared on 04 minus 04.2: 04.2 is the imputed (non-cash) rent of owner-occupiers.",
                "The age band 17-24 includes students living alone and with others; bank customers 18-24 are compared with it.",
                "Bank card categories are not exactly COICOP groups; the mapping is approximate (see domain.json)."]})
print("wrote benchmarks.json", "with MISMATCHES: " + str(fails) if fails else "(all cross-checks OK)")
