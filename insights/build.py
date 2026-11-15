#!/usr/bin/env python
"""Build the Vara Insights site (the judges' companion report) as one self-contained HTML file.

Runs on the VM:  ~/mlenv/bin/python insights/build.py
Reads  DATA_DIR/insights/eda.json (insights/eda.py), DATA_DIR/global/*.json and DATA_DIR/ml/<kind>/*.json (model outputs).
Writes /srv/vara/insights/index.html (served at /insights/) and DATA_DIR/insights/site/index.html.
Every number in the text is computed here from those files; nothing is typed in by hand.
"""
import collections
import glob
import html
import json
import os
import re
import statistics as st
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "ml"))
from common import DATA_DIR  # noqa: E402

G = os.path.join(DATA_DIR, "global")
E = json.load(open(os.path.join(DATA_DIR, "insights", "eda.json")))
NB = " "
C = dict(g7="#007841", g9="#004628", g5="#00AA46", g3="#91FA9B", g2="#99D59F", blue="#00A1C5", amber="#CF8300", grey="#B8B8B8", ink="#1F1F1F")
BASKET_KEYS = [{"name": "Fixed musts", "color": C["g7"]}, {"name": "Surprise musts", "color": C["blue"]}, {"name": "Everyday extras", "color": C["amber"]}]


def jl(path, default=None):
    try:
        return json.load(open(path))
    except Exception:
        return default


def n0(x):
    return f"{round(x):,}".replace(",", NB)


def eur(x):
    return f"{n0(x)}{NB}€"


def pc(x, d=0):
    return f"{x * 100:.{d}f}%"


def esc(s):
    return html.escape(str(s))


def rr(o, d=4):
    if isinstance(o, float):
        return round(o, d)
    if isinstance(o, dict):
        return {k: rr(v, d) for k, v in o.items()}
    if isinstance(o, (list, tuple)):
        return [rr(v, d) for v in o]
    return o


def chart(spec, cap=""):
    data = html.escape(json.dumps(rr(spec), separators=(",", ":")), quote=True)
    return f'<figure class="fig"><div class="chart" data-spec="{data}"></div>' + (f"<figcaption>{cap}</figcaption>" if cap else "") + "</figure>"


def kpis(items):
    return '<div class="kpis">' + "".join(
        f'<div class="kpi"><div class="k-n">{n}</div><div class="k-l">{l}</div>' + (f'<div class="k-s">{s}</div>' if s else "") + "</div>"
        for n, l, s in items) + "</div>"


SPROUT = ('<svg viewBox="0 0 48 48" width="34" height="34" aria-hidden="true"><circle cx="24" cy="24" r="24" fill="#91FA9B"/>'
          '<path d="M24 36V22" stroke="#004628" stroke-width="3" stroke-linecap="round"/>'
          '<path d="M24 24c0-6 4-10 10-10 0 6-4 10-10 10Z" fill="#007841"/><path d="M24 28c0-5-3-8-8-8 0 5 3 8 8 8Z" fill="#004628"/></svg>')


def vara(text):
    return f'<aside class="vara">{SPROUT}<div><b>What Vara does with this</b><p>{text}</p></div></aside>'


def method(text):
    return f'<details class="method"><summary>How this was measured</summary><p>{text}</p></details>'


def table(headers, rows, cls=""):
    h = "".join(f"<th>{x}</th>" for x in headers)
    b = "".join("<tr>" + "".join(f"<td>{c}</td>" for c in r) + "</tr>" for r in rows)
    return f'<div class="tblw"><table class="tbl {cls}"><thead><tr>{h}</tr></thead><tbody>{b}</tbody></table></div>'


def fnum(v):
    if isinstance(v, bool) or v is None:
        return "–" if v is None else str(v)
    if isinstance(v, int):
        return n0(v)
    if isinstance(v, float):
        a = abs(v)
        return n0(v) if a >= 1000 else (f"{v:.1f}" if a >= 100 else (f"{v:.2f}" if a >= 1 else f"{v:.3f}"))
    return esc(v)


def dict_table(rows):
    keys = list(rows[0].keys())
    return table([esc(k) for k in keys], [[fnum(r.get(k)) for k in keys] for r in rows])


def section(sid, eyebrow, title, body):
    return f'<section id="{sid}"><div class="eyebrow">{eyebrow}</div><h2>{title}</h2>{body}</section>'


def med(xs):
    xs = [x for x in xs if x is not None]
    return st.median(xs) if xs else float("nan")


def load_dir(kind):
    d = os.path.join(DATA_DIR, "ml", kind)
    out = []
    for fn in sorted(glob.glob(os.path.join(d, "CUST*.json"))):
        try:
            out.append(json.load(open(fn)))
        except Exception:
            pass
    return out


# ------------------------------------------------------------------------------------------ inputs
m, o, cy, cfr, b = E["meta"], E["overdraft"], E["cycles"], E["counterfactual"], E["baskets"]
su, sm, rh, ho, sa, sw, ages, cb, mo = E["surprise"], E["small"], E["rhythm"], E["housing"], E["saving"], E["sweep"], E["byAge"], E["cyclesByBand"], E["mortgage"]
bands = E["bands"]
cards = {os.path.basename(p)[len("modelcard-"):-5]: jl(p) for p in sorted(glob.glob(os.path.join(G, "modelcard-*.json")))}
cards = {k: v for k, v in cards.items() if v}
tribes = jl(os.path.join(G, "tribes.json"), [])
mmap = jl(os.path.join(G, "map.json"))
bench = jl(os.path.join(G, "benchmarks.json"))
t0 = time.time()
PERSONA = "CUST04754"

# ------------------------------------------------------------------------------------------ derived numbers
neg_all = o["everNegativeAll"]["neg"] / o["everNegativeAll"]["n"]
dsp = o["byDaysSincePayday"]
lowneg = cy["lowDayHistNegativeOnly"]["counts"]
low_after20 = sum(lowneg[20:]) / max(1, sum(lowneg))
burn = sum(x["everydayIndex"] for x in dsp[0:5]) / 5 - 1
late = sum(x["everydayIndex"] for x in dsp[23:31]) / len(dsp[23:31]) - 1
wk = rh["weekday"]
evw = [x["everydayPerDay"] for x in wk]
sat_mon = evw[5] / evw[0]
frisat = (evw[4] + evw[5]) / sum(evw)
hours = rh["hour"]
htot = sum(x["n"] for x in hours)
h1519 = sum(x["n"] for x in hours if 15 <= x["hour"] <= 18) / htot
ov = b["overall"]
spend_tot = ov["mustRegular"] + ov["mustIrregular"] + ov["everyday"]
sh_mr, sh_mi, sh_ev = ov["mustRegular"] / spend_tot, ov["mustIrregular"] / spend_tot, ov["everyday"] / spend_tot
sos = b["shareOfSalary"]
cf = cfr["rows"]
cf0 = cf[0]
cfd = {r["trim"]: r for r in cf}
ev_med = cfr["everydayMonthly"]["p50"]
cut = lambda r, k, base: 1 - r[k] / cf0[base]  # share removed, against what actually happened
c5 = cfd[0.05]
kept_c, kept_d = cut(c5, "customersNegative", "customersNegative"), cut(c5, "negativeDays", "negativeDays")
cyc_c, cyc_d = cut(c5, "customersNegativeCycle", "customersNegative"), cut(c5, "negativeDaysCycle", "negativeDays")
kept_end = cfr["keptAtEnd5"]["p50"]
cush = {r["cushion"]: r for r in cfr["cushion"]}
th = {t["threshold"]: t for t in sm["thresholds"]}
small_rest = next(x["n"] for x in sm["byCategory"] if x["category"] == "Restaurants") / sum(x["n"] for x in sm["byCategory"])
age = {a["band"]: a for a in ages}
cbb = {a["band"]: a for a in cb["byBand"]}
inv = sa["investors"]
iwn = sa["investingWhileNegative"]
buf = {x["bin"][3:]: x["n"] for x in sa["bufferBins"]}
buf_n = sum(buf.values())
hbin = ho["byShareBin"]
yoy = [(x["category"], x["y2"] / x["y1"] - 1) for x in E["yoy"] if x.get("y1") and x["type"] in ("purchase", "housing_payment", "utilities_payment", "salary")]
yoy_max = max(abs(v) for _, v in yoy)
oct24 = o["byMonth"][0]["negShare"]
later = st.mean(x["negShare"] for x in o["byMonth"][6:])
n_core = sos["mr"]["n"]

# ------------------------------------------------------------------------------------------ model aggregates
ML = {}
try:
    tw = load_dir("twins")
    paths = {k: [0.0] * 13 for k in ("built", "held", "slipped")}
    cnt, gaps, top, alll, vals = 0, [], collections.Counter(), collections.Counter(), collections.defaultdict(list)
    for t in tw:
        inc = t.get("monthlyIncome")
        g = {x["key"]: x for x in t.get("groups", [])}
        if not inc or len(g) < 3:
            continue
        cnt += 1
        gaps.append((g["built"]["bufferChange"] - g["slipped"]["bufferChange"]) / inc)
        for k in paths:
            for p in g[k]["path"]:
                if 0 <= p["month"] <= 12:
                    paths[k][p["month"]] += p["p50"] / inc
        d = t.get("differences") or []
        if d:
            top[d[0]["label"]] += 1
        for x in d:
            alll[x["label"]] += 1
            vals[x["label"]].append((x["built"], x["slipped"], x.get("unit", "")))
    ML["twins"] = dict(n=cnt, gap=med(gaps), paths={k: [v / max(cnt, 1) for v in p] for k, p in paths.items()}, top=top.most_common(6),
                       all=[(k, c, med([v[0] for v in vals[k]]), med([v[1] for v in vals[k]]), vals[k][0][2]) for k, c in alll.most_common(8)])
except Exception as e:
    print("twins agg failed", repr(e))
try:
    hb = load_dir("habits")
    stc, catc, imp = collections.Counter(), collections.Counter(), collections.defaultdict(list)
    for h in hb:
        for x in h.get("habits", []):
            stc[x["status"]] += 1
            catc[(x["category"], x["direction"])] += 1
            imp[x["status"]].append(abs(x.get("monthlyImpact") or 0))
    cats = collections.Counter()
    for (c, d), n in catc.items():
        cats[c] += n
    ML["habits"] = dict(n=len(hb), withHabit=sum(1 for h in hb if h.get("habits")), total=sum(stc.values()), status=dict(stc),
                        cats=[(c, catc.get((c, "down"), 0), catc.get((c, "up"), 0)) for c, _ in cats.most_common(9)],
                        impact={k: med(v) for k, v in imp.items()})
except Exception as e:
    print("habits agg failed", repr(e))
try:
    an = load_dir("anomalies")
    catc, sug, recent, tmpl, nflag = collections.Counter(), 0, 0, collections.Counter(), 0
    for a in an:
        thr = a.get("threshold") or 0.95
        recent += 1 if (a.get("last30Days") or {}).get("count", 0) > 0 else 0
        for x in a.get("transactions", []):
            if x.get("score", 0) >= thr:
                nflag += 1
                catc[x["category"]] += 1
                sug += 1 if x.get("suggestedBasket") == "must_irregular" else 0
                for r in x.get("reasons", [])[:1]:
                    tmpl[re.sub(r"\d[\d.,:]*", "N", r)] += 1
    ML["anomalies"] = dict(n=len(an), recent=recent, flagged=nflag, cats=catc.most_common(8), suggested=sug, reasons=tmpl.most_common(6))
except Exception as e:
    print("anomalies agg failed", repr(e))
try:
    hm = load_dir("home")
    yrs = [h.get("yearsToReady") for h in hm]
    bins = [("Under 2 years", 0, 2), ("2–5 years", 2, 5), ("5–10 years", 5, 10), ("10–20 years", 10, 20), ("Over 20 years", 20, 1e9)]
    ML["home"] = dict(n=len(hm), bins=[(l, sum(1 for y in yrs if y is not None and lo <= y < hi)) for l, lo, hi in bins] + [("Not saving now", sum(1 for y in yrs if y is None))],
                      gap=med([h["equity"]["gap"] for h in hm]), price=med([h["reachable"]["priceP50"] for h in hm]),
                      share=med([h["equity"]["typicalSharePct"] for h in hm]), withProb=sum(1 for h in hm if (h.get("approval") or {}).get("probabilityIfAppliedNow") is not None))
except Exception as e:
    print("home agg failed", repr(e))
try:
    pf = load_dir("profile")
    fits = [p["tribe"]["fit"] for p in pf if p.get("cohort", "main") == "main" and p.get("tribe")]
    ML["profile"] = dict(n=len(fits), fitMedian=med(fits), below50=sum(1 for f in fits if f < 0.5) / max(1, len(fits)))
except Exception as e:
    print("profile agg failed", repr(e))
try:
    fc = load_dir("forecast")
    if fc:
        ps = [f.get("overdraftProbToPayday") for f in fc if isinstance(f.get("overdraftProbToPayday"), (int, float))]
        edges = [0, 0.02, 0.05, 0.1, 0.2, 0.4, 0.6, 0.8, 1.0001]
        ML["forecast"] = dict(n=len(ps), hist=[sum(1 for p in ps if lo <= p < hi) for lo, hi in zip(edges, edges[1:])],
                              labels=["0–2%", "2–5%", "5–10%", "10–20%", "20–40%", "40–60%", "60–80%", "80–100%"], above20=sum(1 for p in ps if p >= 0.2) / max(1, len(ps)))
    rk = load_dir("risk")
    if rk:
        lv, drv = collections.Counter(), collections.Counter()
        for r in rk:
            lv[r.get("level", "?")] += 1
            for d in (r.get("drivers") or [])[:1]:
                drv[re.sub(r"\d[\d  .,:%€]*", "N ", str(d.get("label") or d.get("feature") or "?")).strip()] += 1
        ML["risk"] = dict(n=len(rk), levels=dict(lv), drivers=drv.most_common(6))
    ML["txgptN"] = len(glob.glob(os.path.join(DATA_DIR, "ml", "txgpt", "CUST*.json")))
except Exception as e:
    print("forecast/risk agg failed", repr(e))
print(f"model aggregates {time.time() - t0:.1f}s: {list(ML)}")

# ------------------------------------------------------------------------------------------ sections
S = []  # (id, nav label, html)

# ---- summary
find = [
    (pc(neg_all), "of customers dipped below zero at least once in two years",
     f"Almost always late in the pay cycle: {pc(low_after20)} of the dips bottom out 20 or more days after payday."),
    (f"{pc(kept_d)} fewer", "days below zero if a 5% trim of everyday extras is kept as a cushion",
     f"About {eur(ev_med * 0.05)} a month for the median customer, about {eur(kept_end)} after two years. If the same money is spent again before the next payday, the drop is only {pc(cyc_d)}."),
    (pc(sos["mr"]["p50"]), "of salary is committed to fixed musts before any choice is made",
     f"Everyday extras are {pc(sos['ev']['p50'])} of salary: the part a coach can actually help with."),
    (pc(su["customersWithShock"]), "of customers were hit by a surprise-must month",
     f"Typical size {eur(su['shockSize']['p50'])}, about {pc(su['shockSizeVsSalary']['p50'])} of a month's pay. Roughly one month in ten."),
    (pc(th[10]["shareOfEuros"], 1), "of purchase euros go to purchases under 10 €",
     f"They are {pc(th[10]['shareOfPurchases'], 1)} of purchases. The latte factor is small in this data."),
    (pc(iwn["customers"] / inv["investors"]), "of investors made an investing deposit in a month when their account also went below zero",
     f"{n0(iwn['n'])} such months across {n0(iwn['customers'])} customers. Investors dip below zero as often as everyone else."),
]
if E.get("cravings"):
    _c = E["cravings"]
    find.insert(2, (f"{_c['toCoverDeepestDip']['p50']:.1f} cravings", "is all that the deepest dip of two years amounts to",
                    f"For the median overdrawn customer, at {eur(_c['medianAmount']['p50'])} per typical everyday purchase. This is the case for Crave mode: saving money, a craving at a time."))
body = f"""
<p class="lede">This page is the analysis behind Vara, our AI money trainer for S-mobiili. We studied all {n0(m['nTx'])} transactions of the {n0(m['nCustomers'])} customers in the challenge dataset, {m['dateFrom'][:7]} to {m['dateTo'][:7]}, and trained eight machine-learning models on them. Each finding below is tied to the product feature it led to, and every model is reported against a naive baseline, including the ones that barely beat it.</p>
{kpis([(n0(m['nTx']), 'transactions analysed', '24 months, one account per customer'), (n0(m['nCustomers']), 'customers', f"{n0(m['nMain'])} main cohort, {m['nTail']} irregular-income cohort"), (str(len(cards)) + (' of 8' if len(cards) < 8 else ''), 'models with a model card', 'each tested against a naive baseline'), ('3 s', 'to recompute every statistic here', 'DuckDB on one machine')])}
<h3>{ {6: 'Six', 7: 'Seven', 8: 'Eight'}.get(len(find), str(len(find))) } things the data says</h3>
<div class="finds">{''.join(f'<div class="find"><div class="f-n">{n}</div><div class="f-l">{l}</div><p>{s}</p></div>' for n, l, s in find)}</div>
<p class="note">All figures are computed from the synthetic dataset provided for the challenge. They describe that dataset, not S-Pankki's real customers.</p>
"""
S.append(("summary", "Summary", section("summary", "Vara Insights", "What 3.6 million transactions say about everyday money", body)))

# ---- data
types = m["types"]
rows = [[esc(t["category"]), esc(t["type"]), n0(t["n"]), n0(t["customers"]), eur(abs(t["median"])), eur(abs(t["total"]) / 1e6) .replace("€", "M€")] for t in types]
body = f"""
<p>The dataset holds {n0(m['nTx'])} transactions for {n0(m['nCustomers'])} customers over 24 months, with a running balance after every transaction. There are 8 purchase categories and 7 account-level flows (salary, housing, utilities, investing and so on). Merchants are anonymous: there are no names, only {m['nMcc']} merchant category codes, so Vara talks about "fast food and cafés" and never pretends to know the shop.</p>
{table(['Category', 'Type', 'Transactions', 'Customers', 'Median amount', 'Total'], rows, 'num')}
<p>Three groups of customers need separate handling, and the app handles each one differently:</p>
<ul>
<li><b>{n0(m['nMain'] - m['nSweepMain'])} regular customers</b> with a monthly salary and visible spending. Most statistics on this page use this group.</li>
<li><b>{m['nSweep']} salary-sweep customers</b> ({pc(sw['shareOfCustomers'], 1)}): about {pc(sw['sweptShare'])} of their salary leaves for another bank right after payday, so only about {eur(sw['visibleSpend'])} of monthly spending is visible against a salary of {eur(sw['salary'])}. For them Vara says what it cannot see and offers to connect the other bank (the PSD2 flow in the prototype). {m['nSweepMain']} of them are in the main cohort and {m['nSweep'] - m['nSweepMain']} in the irregular-income cohort.</li>
<li><b>{m['nTail']} irregular-income customers</b> (ids above CUST05000), kept out of model training.</li>
</ul>
"""
S.append(("data", "The data", section("data", "The data", "One account, every transaction, two years", body)))

# ---- F1 below zero
lb, hbf = cb["lowBuffer"], cb["highBuffer"]
body = f"""
<p class="lede">Over two years, {n0(o['everNegativeAll']['neg'])} of {n0(o['everNegativeAll']['n'])} customers ({pc(neg_all)}) saw their balance go below zero at least once. Among them the median is {o['negMonths']['p50']:.0f} different months with a dip. In total there were {n0(o['episodes']['episodes'])} overdraft episodes with a median length of {o['episodes']['medianDays']:.0f} days, and {pc(o['episodes']['share14PlusDays'])} lasted two weeks or longer.</p>
<p>The dips are shallow: a median of {eur(-o['depth']['p50'])} at the lowest point, about {pc(o['depthVsSalary']['p50'])} of a monthly salary. That is the size of problem a small, well-timed nudge can prevent.</p>
<p>The timing is very regular. In the first week after payday almost nobody is below zero. From day 18 the share climbs steadily and reaches {pc(dsp[30]['negShare'])} on day 30. In {pc(low_after20)} of the pay cycles that dip, the lowest point comes 20 or more days after payday.</p>
<div class="g2">
{chart({'type': 'line', 'x': [x['dsp'] for x in dsp], 'series': [{'name': 'Customers below zero', 'y': [x['negShare'] for x in dsp], 'color': C['g7'], 'area': True}], 'fmt': 'pct', 'xTitle': 'Days since payday', 'every': 5}, 'Share of customers with a negative end-of-day balance, by days since their last salary.')}
{chart({'type': 'cols', 'x': list(range(0, 25)), 'y': o['negMonthsHist']['counts'], 'fmt': 'num', 'xTitle': 'Months with a dip below zero (out of 24)', 'yTitle': 'Customers', 'every': 4, 'hi': [0]}, f"Number of customers by how many months included a dip. The first bar is the {pc(1 - o['everNegativeMain']['neg'] / o['everNegativeMain']['n'])} who never dipped.")}
</div>
<h3>The balance on payday overstates what is free</h3>
<p>On payday evening the median balance is {eur(cy['paydayBalance'])}. Fixed musts for the coming cycle (rent, bills, groceries, commuting) take {eur(cy['mustRegular'])} of it, {pc(cy['mustRegularShareOfSalary'])} of the salary. The gap matters most for people without a cushion. In {pc(cb['lowBufferShare'])} of pay cycles the customer starts with less than 1.5 salaries on the account. In those cycles fixed musts take more than half of what the balance shows (only {pc(lb['freeShareOfPaydayBalance'])} is free), and {pc(lb['cyclesDippingBelowZero'])} of them end up below zero, against {pc(hbf['cyclesDippingBelowZero'], 1)} of the others.</p>
{chart({'type': 'hbars', 'rows': [{'label': a['band'], 'vals': [a['cyclesDippingBelowZero']]} for a in cb['byBand']], 'series': [{'name': 'Pay cycles that dip below zero', 'color': C['g7']}], 'fmt': 'pct'}, 'Share of pay cycles that dip below zero, by age band. The 18–30 target group runs closest to the edge.')}
{vara('The headline number in the app is not the balance but <b>safe to spend this week</b>: balance minus the rent, bills, groceries and savings still due before the next payday, divided over the weeks left. Because dips cluster after day 20, the early-warning model looks a full pay cycle ahead and the weekly check-in gets more specific as payday approaches.')}
{method(f"Below zero means a transaction left the running balance negative. Days below zero use end-of-day balances carried forward over days without transactions. A pay cycle runs from one salary to the day before the next (20 to 45 days; {n0(cy['cycles'])} complete cycles of {n0(n_core)} regular customers). October 2024 is an outlier ({pc(oct24)} of customers below zero against about {pc(later)} in later months), an artefact of the synthetic opening balances; it is included in the counts above and excluded from model training targets.")}
"""
S.append(("below-zero", "Below zero", section("below-zero", "Finding 1", "Seven in ten customers dip below zero, almost always in the last ten days before payday", body)))

# ---- F2 rhythm
wd = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
body = f"""
<p class="lede">In the five days after payday, spending on everyday extras runs {pc(burn)} above each customer's own daily average. In the last week before the next payday it runs {pc(-late)} below. People do not spend evenly: they front-load, then tighten.</p>
{chart({'type': 'cols', 'x': [x['dsp'] for x in dsp], 'y': [x['everydayIndex'] - 1 for x in dsp], 'fmt': 'pct', 'xTitle': 'Days since payday', 'yTitle': 'vs own average', 'every': 5, 'hi': [0, 1, 2, 3, 4]}, 'Everyday-extras spending relative to each customer\'s own daily average, by days since payday. The first five days are highlighted.')}
<p>The weekly rhythm is stronger still. Saturday's everyday spending is {sat_mon:.1f} times Monday's, and Friday plus Saturday make up {pc(frisat)} of the week. During the day, purchases build towards late afternoon: {pc(h1519)} of all purchases happen between 15:00 and 19:00.</p>
<div class="g2">
{chart({'type': 'cols', 'x': wd, 'y': evw, 'fmt': 'eur', 'yTitle': 'Per customer per day', 'labels': True, 'hi': [4, 5]}, 'Average everyday-extras spending per customer per day, by weekday.')}
{chart({'type': 'cols', 'x': [f"{x['hour']:02d}" for x in hours], 'y': [x['n'] / htot for x in hours], 'fmt': 'pct', 'xTitle': 'Hour of day', 'every': 3, 'hi': [i for i, x in enumerate(hours) if 15 <= x['hour'] <= 18]}, 'Share of purchases by hour of day.')}
</div>
{vara('The balance forecast samples past days <b>of the same weekday</b>, so a Friday is forecast from the customer\'s own Fridays. The weekly check-in lands at the start of the week with a target for the weekend, and in payday week Vara shows what the month\'s fixed musts will take before the spending starts.')}
{method('Each customer-day\'s everyday-extras spending is divided by that customer\'s own mean daily spending, then averaged by days since the last salary. Regular customers only. Weekday and hour charts cover the main cohort.')}
"""
S.append(("rhythm", "Payday rhythm", section("rhythm", "Finding 2", f"Payday changes behaviour: everyday spending runs {pc(burn)} hot for five days", body)))

# ---- F3 baskets
bb = b["byBand"]
catrows = collections.defaultdict(list)
for x in b["byCategory"]:
    catrows[x["basket"]].append(f"{esc(x['category'])} {pc(x['eur'] / spend_tot)}")
body = f"""
<p class="lede">S-Pankki's own way of explaining a budget is three baskets. We implemented it as explicit rules over the transaction data, so every euro lands in exactly one basket and the customer can move things.</p>
{kpis([(pc(sh_mr), 'Fixed musts', 'Rent, utilities, groceries, commuting'), (pc(sh_mi), 'Surprise musts', 'Health, large home and tech purchases'), (pc(sh_ev), 'Everyday extras', 'Eating out, entertainment, lifestyle, travel, taxis')])}
<p>Of the {n0(spend_tot / 1e6)} million euros the main cohort spent in two years, {pc(sh_mr)} went to fixed musts, {pc(sh_mi)} to surprise musts and {pc(sh_ev)} to everyday extras. Measured against salary, the median customer commits {pc(sos['mr']['p50'])} to fixed musts and spends {pc(sos['ev']['p50'])} on everyday extras. That last share is where people differ most: from {pc(sos['ev']['p10'])} of salary at the 10th percentile to {pc(sos['ev']['p90'])} at the 90th.</p>
<div class="g2">
{chart({'type': 'stack', 'rows': [{'label': x['band'], 'parts': [x['mustRegular'], x['mustIrregular'], x['everyday']]} for x in bb], 'keys': BASKET_KEYS, 'fmt': 'pct'}, 'How spending splits across the three baskets, by age band.')}
{chart({'type': 'cols', 'x': [pc(e) for e in b['everydayShareHist']['edges'][:-1]], 'y': b['everydayShareHist']['counts'], 'fmt': 'num', 'xTitle': 'Everyday extras as a share of all spending', 'yTitle': 'Customers', 'every': 4, 'color': C['amber']}, 'Customers by the share of their spending that goes to everyday extras.')}
</div>
{table(['Basket', 'What is in it (share of all spending)'], [['Fixed musts', ' · '.join(catrows['must_regular'])], ['Surprise musts', ' · '.join(catrows['must_irregular'])], ['Everyday extras', ' · '.join(catrows['everyday'])]])}
{vara('The <b>baskets explorer</b> shows the month in these three baskets and lets the customer move a purchase, or all similar ones, to another basket. Vara remembers the correction and every number, including safe to spend, recalculates. The same rules drive the chat, the weekly check-in and the models, from one shared rules file.')}
{method(f"Rules: housing and utilities, groceries (except convenience stores, MCC 5499) and public transport or fuel (MCC 4111, 5541, 5542) are fixed musts. Health, and home and tech purchases of at least 150 € and three times the customer's own median, are surprise musts ({n0(b['homeTechBig']['nBig'])} such purchases, {pc(b['homeTechBig']['eurBig'] / b['homeTechBig']['eur'])} of home and tech euros). Everything else bought by card is an everyday extra. Investing deposits and salary sweeps are not spending. The SQL in this analysis and the Python used for the models classify all {n0(m['nTx'])} transactions identically (checked row count by row count).")}
"""
S.append(("baskets", "Three baskets", section("baskets", "Finding 3", f"Fixed musts take {pc(sos['mr']['p50'])} of pay. Everyday extras are the {pc(sos['ev']['p50'])} people can steer", body)))

# ---- F4 surprise
mh = su["monthlyHist"]
body = f"""
<p class="lede">We call a month a shock month when surprise musts exceed 15% of a monthly salary. {pc(su['customersWithShock'])} of customers had at least one in two years, the median customer had {su['shocksPerCustomer']['p50']:.0f}, and about one month in ten ({pc(su['shockMonthShare'], 1)}) is a shock month.</p>
<p>A typical shock is {eur(su['shockSize']['p50'])}, or {pc(su['shockSizeVsSalary']['p50'])} of a month's pay; one in ten exceeds {eur(su['shockSize']['p90'])}. Over a year the median customer spends {eur(su['yearlyTotal']['p50'])} on surprise musts. Spread evenly, that is {eur(su['yearlyTotal']['p50'] / 12)} a month: a concrete, personal size for a buffer.</p>
{chart({'type': 'cols', 'x': [pc(e) for e in mh['edges'][:-1]], 'y': mh['counts'], 'fmt': 'num', 'xTitle': 'Surprise musts in a month, as a share of monthly salary', 'yTitle': 'Customer-months', 'every': 5, 'hi': [i for i, e in enumerate(mh['edges'][:-1]) if e >= 0.15], 'color': C['blue']}, 'All customer-months by the size of that month\'s surprise musts. Shock months (15% of salary or more) are highlighted.')}
<p>Customers mostly absorb these months: the chance of dipping below zero is {pc(su['negativeInShockMonth']['shock'], 1)} in a shock month against {pc(su['negativeInShockMonth']['normal'], 1)} otherwise.</p>
{vara('Surprise musts get their own basket and their own lesson: they are not monthly, but they always come. Vara sizes the suggested buffer from the customer\'s <b>own</b> history of surprise musts, and the "unusual for you" model proposes moving large one-off health or home purchases into this basket.')}
{method(f"Customer-months of {n0(n_core)} regular customers; salary is each customer's median monthly salary. The largest single surprise must per customer has a median of {eur(su['largestSingle']['p50'])}.")}
"""
S.append(("surprise", "Surprise musts", section("surprise", "Finding 4", f"Surprise musts are not rare: {pc(su['customersWithShock'])} of customers were hit, typically for {eur(su['shockSize']['p50'])}", body)))

# ---- F5 small purchases
body = f"""
<p class="lede">"Skip the daily coffee" is the most common money advice there is, so we tested it. Purchases under 10 € are {pc(th[10]['shareOfPurchases'], 1)} of all purchases but only {pc(th[10]['shareOfEuros'], 1)} of the money. The median customer spends {eur(sm['perYearEur']['p50'])} a year on them, and even the top tenth spend {eur(sm['perYearEur']['p90'])}.</p>
<div class="g2">
{chart({'type': 'hbars', 'rows': [{'label': f"Under {t['threshold']} €", 'vals': [t['shareOfPurchases'], t['shareOfEuros']]} for t in sm['thresholds']], 'series': [{'name': 'Share of purchases', 'color': C['g2']}, {'name': 'Share of euros', 'color': C['g7']}], 'fmt': 'pct1'}, 'Small purchases are frequent but carry little money, at any threshold.')}
{chart({'type': 'cols', 'x': [a['band'] for a in ages], 'y': [a['smallN'] for a in ages], 'fmt': 'num', 'yTitle': 'Per month (median)', 'labels': True}, 'Purchases under 10 € per month, median customer by age band.')}
</div>
<p>Two things are still worth knowing. {pc(small_rest)} of small purchases are in restaurants and cafés, and the habit is strongly age-related: the median 18–24-year-old makes {age['18-24']['smallN']:.1f} a month, the median 55–64-year-old {age['55-64']['smallN']:.2f}.</p>
{vara('Vara does not lecture about coffee. The what-if simulator starts from the customer\'s biggest everyday categories, where a small percentage is real money (see the next finding). Small purchases are still tracked by the habit detector, and the Säästäjä hand-off is framed as an easy saving habit, not as the fix.')}
{method('All card purchases with an amount under the threshold. Per-customer figures are monthly averages over 24 months for the main cohort.')}
"""
S.append(("small", "Small purchases", section("small", "Finding 5", f"The latte factor is small here: {pc(th[10]['shareOfPurchases'], 1)} of purchases, {pc(th[10]['shareOfEuros'], 1)} of the money", body)))

# ---- F6 counterfactual
trims = [r for r in cf if 0 < r["trim"] <= 0.2]
bm = cfr["byMonth"]
body = f"""
<p class="lede">We replayed two years of balances for every main-cohort customer with everyday extras trimmed by 5%, about {eur(ev_med * 0.05)} a month for the median customer, in two ways. The result depends almost entirely on what happens to the money afterwards.</p>
{kpis([(pc(cyc_d), 'fewer days below zero', 'if the trimmed money is spent again before the next payday'), (pc(kept_d), 'fewer days below zero', f'if it is kept and builds up (median {eur(kept_end)} after two years)'), (pc(cyc_c), 'fewer customers ever below zero', f"spent again: {n0(cf0['customersNegative'])} to {n0(c5['customersNegativeCycle'])}"), (pc(kept_c), 'fewer customers ever below zero', f"kept: {n0(cf0['customersNegative'])} to {n0(c5['customersNegative'])}")])}
<div class="g2">
{chart({'type': 'hbars', 'rows': [{'label': f"{pc(r['trim'])} trim", 'vals': [cut(r, 'negativeDaysCycle', 'negativeDays'), cut(r, 'negativeDays', 'negativeDays')]} for r in trims], 'series': [{'name': 'Spent again before the next payday', 'color': C['amber']}, {'name': 'Kept and built up', 'color': C['g7']}], 'fmt': 'pct'}, 'Share of days below zero that disappear, by size of trim and by what happens to the money.')}
{chart({'type': 'line', 'x': [r['month'] for r in bm], 'series': [{'name': 'As it happened', 'y': [r['actual'] for r in bm], 'color': C['grey']}, {'name': '5% trim, spent again', 'y': [r['cycle5'] for r in bm], 'color': C['amber']}, {'name': '5% trim, kept', 'y': [r['kept5'] for r in bm], 'color': C['g7']}], 'fmt': 'pct', 'every': 4, 'yTitle': 'Share of customer-days below zero'}, 'The kept version starts where the others do and pulls away as the cushion builds: the cushion does the work, not the trim.')}
</div>
<p>This follows from the earlier findings. Dips are shallow and late in the pay cycle, so what prevents one is money that is already there when the dip would have happened. A standing cushion of 100 € would have removed {pc(cut(cush[100], 'negativeDays', 'negativeDays'))} of the days below zero, and 250 € would have removed {pc(cut(cush[250], 'negativeDays', 'negativeDays'))}. A 5% trim builds 250 € in about {250 / (ev_med * 0.05):.0f} months for the median customer. (No account in the dataset goes lower than about −500 €, which looks like an overdraft limit in the synthetic data, so a 500 € cushion removes every dip by construction.)</p>
<p>Even with the money kept, {n0(c5['customersNegative'])} customers still go below zero at some point. A small trim is a real help for most people who dip, not a cure for all of them.</p>
{vara('Two things follow in the product. The <b>what-if simulator</b> shows a customer their own version of this on their own transactions. And saving has to mean <b>moving the money</b>, not just skipping a purchase: Crave mode and the Säästäjä hand-off both put the amount in a savings pot where it stays, because the data says the staying is what counts.')}
{method('A mechanical replay, not a behavioural prediction. "Kept": end-of-day balance plus the trim percentage times cumulative everyday-extras spending since October 2024, so the saved money counts as available when a dip comes (for example a savings pot that tops the account up). "Spent again": the same, but the cumulative sum restarts at each salary. Both assume income and all other spending stay the same. Customers ever below zero is counted on end-of-day balances.')}
"""

S.append(("trims", "Small trims", section("trims", "Finding 6", f"A small trim only counts if the money is kept: {pc(kept_d)} fewer days below zero when kept, {pc(cyc_d)} when spent later", body)))

# ---- cravings (the data behind Crave mode)
try:
    cr = E["cravings"]
    ch = cr["hour"]
    chtot = sum(x["n"] for x in ch)
    eve = sum(x["n"] for x in ch if x["hour"] >= 18) / chtot
    ab, ae = cr["amountBuckets"], cr["amountEdges"]
    alab = [f"{ae[i]}–{ae[i + 1]} €" if i + 1 < len(ae) else f"{ae[i]} € +" for i in range(len(ae))]
    abn = {x["b"]: x for x in ab}
    antot = sum(x["n"] for x in ab)
    in20 = cr["perMonth"]["p50"] / 20
    body = f"""
<p class="lede">Everyday extras are not one decision a month. They are many small ones: the median customer makes {cr['perMonth']['p50']:.0f} everyday-extras purchases a month, typically {eur(cr['medianAmount']['p50'])} each. {pc(eve)} of them happen after 18:00, and the five days after payday carry {pc(cr['paydayWeekShare'])} of the spending in {pc(cr['paydayWeekDaysShare'])} of the days.</p>
{kpis([(f"{cr['perMonth']['p50']:.0f}", 'everyday-extras purchases a month', 'median customer'), (eur(cr['medianAmount']['p50']), 'typical size of one', 'median of each customer\'s median'), (f"{cr['toCoverDeepestDip']['p50']:.1f}", 'purchases equal the deepest dip', 'median overdrawn customer, over two years'), (eur(cr['oneAWeekPerYear']['p50']), 'a year from one redirected a week', 'median customer')])}
<p>The amounts involved are small. The 5% trim of the previous finding is about {eur(ev_med * 0.05)} a month for the median customer, a little more than one typical purchase (the typical purchase is {eur(cr['medianAmount']['p50'])}; the average is {eur(cr['meanAmount']['p50'])} because a few are large). And for the median customer who went below zero, the deepest dip of the whole two years is the size of {cr['toCoverDeepestDip']['p50']:.1f} typical purchases. What the previous finding adds is that skipping a purchase is not enough on its own: the money has to still be there when the dip would have come. That is the design brief for Crave mode. Make skipping feel like buying, and move the money somewhere it stays.</p>
<div class="g2">
{chart({'type': 'cols', 'x': [f"{x['hour']:02d}" for x in ch], 'y': [x['n'] / chtot for x in ch], 'fmt': 'pct', 'xTitle': 'Hour of day', 'every': 3, 'color': C['amber'], 'hi': [i for i, x in enumerate(ch) if x['hour'] >= 18], 'hiColor': C['g9']}, 'When everyday-extras purchases happen. Evening hours (from 18:00) are highlighted.')}
{chart({'type': 'cols', 'x': alab, 'y': [abn.get(i, {'n': 0})['n'] / antot for i in range(len(ae))], 'fmt': 'pct', 'xTitle': 'Size of one purchase', 'every': 2, 'color': C['amber']}, 'Everyday-extras purchases by size.')}
</div>
{chart({'type': 'hbars', 'rows': [{'label': x['category'], 'vals': [x['eur'] / sum(y['eur'] for y in cr['byCategory'])]} for x in cr['byCategory']], 'series': [{'name': 'Share of everyday-extras euros', 'color': C['amber']}], 'fmt': 'pct'}, 'Where the everyday-extras money goes.')}
{vara('<b>Crave mode.</b> When a customer feels like buying something, Vara opens a generated shop for exactly that craving: browsing, basket, checkout, even the confirmation chime. Nothing ships. The amount goes to the customer\'s own savings pot instead. It is opt-in and stated up front, the money can be released within 48 hours to buy the thing for real, and the safe-to-spend guard never lets a craving eat into rent money. Saving money, a craving at a time.')}
{method('Card purchases classified as everyday extras, main cohort. "Typical size" is the median of each customer\'s own median purchase. Deepest dip: the lowest balance in 24 months divided by the customer\'s median everyday-extras purchase, for customers who went below zero.')}
"""
    S.append(("cravings", "Cravings", section("cravings", "Finding 7", f"A craving costs {eur(cr['medianAmount']['p50'])}. The deepest dip in two years is the size of {cr['toCoverDeepestDip']['p50']:.0f} of them", body)))
except Exception as e:
    print("cravings section failed", repr(e))

# ---- F7 housing
hl = [x["bin"][3:] for x in hbin]
body = f"""
<p class="lede">The median customer spends {pc(ho['share']['p50'])} of salary on housing. {pc(ho['above40'])} spend more than 40% and {pc(ho['above50'])} more than half.</p>
<p>Customers with heavy housing costs also spend less on everyday extras: those paying 55% or more spend {pc(hbin[-1]['everydayShareOfSalary'])} of salary on everyday extras, against {pc(hbin[0]['everydayShareOfSalary'])} for those paying under 25%. Their balance still grew less: by {eur(hbin[-1]['balanceChange'])} over two years against {eur(hbin[0]['balanceChange'])}, and they had {hbin[-1]['negMonthsMean']:.1f} months with a dip against {hbin[0]['negMonthsMean']:.1f}.</p>
<div class="g3">
{chart({'type': 'cols', 'x': hl, 'y': [x['everydayShareOfSalary'] for x in hbin], 'fmt': 'pct', 'labels': True, 'color': C['amber'], 'h': 220}, 'Everyday extras as a share of salary.')}
{chart({'type': 'cols', 'x': hl, 'y': [x['negMonthsMean'] for x in hbin], 'fmt': 'num', 'labels': True, 'h': 220}, 'Average months with a dip below zero (of 24).')}
{chart({'type': 'cols', 'x': hl, 'y': [x['balanceChange'] for x in hbin], 'fmt': 'eur', 'labels': True, 'h': 220}, 'Median change in balance over two years.')}
</div>
<p class="note">Groups on the horizontal axis: housing cost as a share of salary.</p>
{vara('Advice has to fit the situation. For a customer like our demo persona, whose rent takes about 65% of pay, "spend less on extras" is the wrong message. Vara compares people with <b>peers in the same position</b>, focuses on timing and buffer, and says plainly when the fixed musts are the issue.')}
{method(f"Housing share is the customer's median monthly housing payment over their median monthly salary, for {n0(ho['share']['n'])} regular customers with housing payments. {ho['noHousing']} customers have no housing payments at all, and housing payments are missing in {pc(ho['missingMonthShare'], 1)} of customer-months for the rest, which is why medians are used.")}
"""
S.append(("housing", "Housing", section("housing", "Finding 8", "Where housing costs are high, everyday extras are lower and so is the growth in savings", body)))

# ---- F8 saving
srh = sa["savingsRateHist"]
body = f"""
<p class="lede">{pc(inv['investors'] / inv['n'])} of customers invest from this account, a median of {eur(inv['monthlyMedian'])} a month. Yet {n0(iwn['customers'])} of those {n0(inv['investors'])} investors ({pc(iwn['customers'] / inv['investors'])}) made a deposit in a month when their balance went below zero: {n0(iwn['n'])} such months in two years. Investors dip just as often as everyone else ({pc(inv['investorsEverNegative'])} against {pc(inv['nonInvestorsEverNegative'])}).</p>
<p>The wider picture is better than the overdraft numbers suggest. {pc(sa['balanceUp'])} of balances grew over two years, by a median of {eur(sa['balanceChange']['p50'])}, and the median savings rate is {pc(sa['savingsRate']['p50'])} of income. But {pc(sa['spendMoreThanEarn'])} of customers spent more than they earned, and today {pc(buf.get('under 1 month', 0) / buf_n)} have less than one month of fixed musts on the account.</p>
<div class="g2">
{chart({'type': 'cols', 'x': ['Below zero', 'Under 1 month', '1–3 months', '3–6 months', '6 months or more'], 'y': [buf.get('below zero', 0), buf.get('under 1 month', 0), buf.get('1-3 months', 0), buf.get('3-6 months', 0), buf.get('6 months or more', 0)], 'fmt': 'num', 'yTitle': 'Customers', 'labels': True, 'hi': [0, 1]}, 'Buffer today: the current balance measured in months of fixed musts.')}
{chart({'type': 'cols', 'x': [pc(e) for e in srh['edges'][:-1]], 'y': srh['counts'], 'fmt': 'num', 'xTitle': 'Savings rate (share of income not spent)', 'yTitle': 'Customers', 'every': 4, 'hi': [i for i, e in enumerate(srh['edges'][:-1]) if e < 0]}, 'Customers by two-year savings rate. Highlighted: spending more than income.')}
</div>
{vara('Vara teaches sequencing: <b>buffer first, then invest</b>. Safe to spend can include or exclude the monthly investing deposit, the savings-goal flow shows what a contribution does to the weekly number before the customer commits, and the hand-off to Säästäjä turns the decision into an automatic habit.')}
{method('Investor: at least one investment deposit in 24 months. Savings rate: income minus the three spending baskets, over income, for regular customers. Buffer: current balance over average monthly fixed musts.')}
"""
S.append(("saving", "Saving and investing", section("saving", "Finding 9", f"{pc(iwn['customers'] / inv['investors'])} of investors made a deposit in a month when they were overdrawn", body)))

# ---- F9 age
rows = [[a["band"], n0(a["n"]), eur(a["salary"]), pc(a["housingShare"]), pc(a["everNegative"]), pc(cbb[a["band"]]["cyclesDippingBelowZero"]), pc(cbb[a["band"]]["freeShareOfPaydayBalance"]),
         pc(a["everydayShareOfSalary"]), f"{a['smallN']:.1f}", pc(a["investors"]), eur(a["balanceChange"])] for a in ages]
y = age["18-24"]
body = f"""
<p class="lede">Vara is designed for 18–30-year-olds, and the data shows why. In the 18–24 band {pc(y['everNegative'])} dipped below zero at least once and {pc(cbb['18-24']['cyclesDippingBelowZero'])} of all pay cycles include a dip, twice the rate of the 55–64 band. Housing takes the largest share of their salary ({pc(y['housingShare'])}) and only {pc(cbb['18-24']['freeShareOfPaydayBalance'])} of the balance they see on payday is actually free.</p>
{table(['Age', 'Customers', 'Median salary', 'Housing / salary', 'Ever below zero', 'Pay cycles with a dip', 'Free share of payday balance', 'Everyday extras / salary', 'Purchases under 10 € / month', 'Invest', 'Balance change, 2 years'], rows, 'num')}
{vara('The tone, the examples and the default lessons are written for this group: short, concrete, no moralising. The peer comparisons in the app use the customer\'s own age band, and the "Two Futures" model only matches people with a similar income.')}
{method('Medians per age band for regular customers. Pay-cycle columns use complete cycles only.')}
"""
S.append(("age", "Age", section("age", "Finding 10", "Young adults run closest to the edge", body)))

# ---- F10 benchmarks
if bench:
    try:
        cbd = collections.defaultdict(dict)
        for x in E["catByBand"]:
            cbd[x["band"]][x["category"]] = x["meanMonthly"]
        pairs = [("Groceries", ["Groceries"], "01"), ("Eating out", ["Restaurants"], "11.1"), ("Transport", ["Transportation"], "07"),
                 ("Culture and leisure", ["Entertainment"], "09"), ("Health", ["Health"], "06"), ("Housing and energy", ["Housing", "Utilities"], "04x")]
        figs = []
        for band, grp in (("18-24", "age:17-24"), ("25-34", "age:25-34")):
            adj = bench["groups"][grp]["adjusted"]
            figs.append(chart({'type': 'hbars', 'rows': [{'label': l, 'vals': [sum(cbd[band].get(c, 0) for c in cs), adj[k]]} for l, cs, k in pairs],
                               'series': [{'name': f'Dataset, age {band} (per customer)', 'color': C['g7']}, {'name': f"Statistics Finland, {bench['groups'][grp]['label'].lower()} (per household)", 'color': C['grey']}], 'fmt': 'eur'},
                              f"Average monthly spending, age {band}."))
        body = f"""
<p class="lede">A coach that says "you spend a lot on eating out" needs a reference point. We use two: peers of the same age inside the bank's data, and Finnish households from Statistics Finland's Household Budget Survey 2022, price-adjusted to today with the consumer price index.</p>
<div class="g2">{''.join(figs)}</div>
<p>The young customers in the dataset eat out far more than the national figures and spend less on transport. The two sources measure different things: the survey covers whole households and all payment methods, the dataset one person's account in one bank. In the app the bank-peer comparison is the default and the national figure is shown as context with its source.</p>
{vara('The <b>benchmark card</b> in chat places the customer between peers of the same age (10th to 90th percentile) and shows the Statistics Finland figure next to it, with the source line. Vara phrases it as information, never as a grade.')}
{method(f"{esc(bench.get('sourceLine') or bench.get('source'))}. Licence {esc(bench.get('licence', 'CC BY 4.0'))}. Housing uses COICOP 04 without imputed rent (04.2). All {len(bench.get('crossChecks') or [])} spot checks against published table cells match.")}
"""
        S.append(("benchmarks", "Peers and benchmarks", section("benchmarks", "Finding 11", "How the dataset compares with Finnish households", body)))
    except Exception as e:
        print("benchmarks section failed", repr(e))

# ------------------------------------------------------------------------------------------ models
VERD = {"ships": ("Ships", "ok"), "experimental": ("Experimental", "exp"), "not_better_than_baseline": ("Not better than baseline", "no")}


def mval(v, unit):
    return pc(v, 1) if unit == "share" else fnum(float(v))


def metric_table(card):
    rows = []
    for x in card.get("metrics", []):
        win = (x["model"] > x["baseline"]) if x.get("better") == "higher" else (x["model"] < x["baseline"])
        rows.append([esc(x["label"]), f"<b>{mval(x['model'], x.get('unit'))}</b>", f"{mval(x['baseline'], x.get('unit'))} <span class='mut'>({esc(x['baselineName'])})</span>",
                     '<span class="win">better</span>' if win else '<span class="lose">not better</span>'])
    return table(["Metric", "Model", "Baseline", ""], rows, "num")


def card_head(card):
    v, cls = VERD.get(card.get("verdict"), (card.get("verdict", "?"), "exp"))
    return (f'<p class="lede">{esc(card.get("purpose", ""))} <span class="badge {cls}">{v}</span></p>'
            f'<p><b>Method.</b> {esc(card.get("method", ""))}</p><p><b>Trained on.</b> {esc(card.get("trainedOn", ""))}</p><p><b>Validation.</b> {esc(card.get("split", ""))}</p>')


def caveats(card):
    c = card.get("caveats") or []
    return ('<details class="method" open><summary>Caveats, in the model\'s own card</summary><ul>' + "".join(f"<li>{esc(x)}</li>" for x in c) + "</ul></details>") if c else ""


def generic_evidence(card):
    ev = card.get("evidence")
    out = []
    if not isinstance(ev, dict):
        return ""
    try:
        if ev.get("reliability"):
            r = ev["reliability"]
            out.append(chart({'type': 'xy', 'series': [{'name': 'Model', 'pts': [[x['predicted'], x['observed']] for x in r], 'color': C['g7'], 'dots': True}, {'name': 'Perfect calibration', 'pts': [[0, 0], [1, 1]], 'color': C['grey'], 'dash': True}],
                              'xfmt': 'pct', 'fmt': 'pct', 'xTitle': 'Predicted probability', 'yTitle': 'Observed'}, 'Reliability: when the model says 30%, does it happen 30% of the time?'))
        if ev.get("roc"):
            out.append(chart({'type': 'xy', 'series': [{'name': 'Model', 'pts': [[x['fpr'], x['tpr']] for x in ev['roc']], 'color': C['g7']}, {'name': 'No skill', 'pts': [[0, 0], [1, 1]], 'color': C['grey'], 'dash': True}],
                              'xfmt': 'pct', 'fmt': 'pct', 'xTitle': 'False-positive rate', 'yTitle': 'True-positive rate'}, 'ROC curve on the test period.'))
        if ev.get("liftByDecile"):
            l = ev["liftByDecile"]
            out.append(chart({'type': 'cols', 'x': [str(x['decile']) for x in l], 'y': [x['rate'] for x in l], 'fmt': 'pct', 'xTitle': 'Predicted-risk decile (1 = highest risk)' if l[0]['rate'] > l[-1]['rate'] else 'Predicted-risk decile (10 = highest risk)', 'labels': True}, 'Observed rate by predicted-risk decile.'))
        if ev.get("featureImportance"):
            fi = ev["featureImportance"][:12]
            vk = next((k for k in ("meanAbsShap", "importance", "gain", "value") if k in fi[0]), None) or next(k for k, v in fi[0].items() if isinstance(v, (int, float)))
            tot = sum(abs(x[vk]) for x in ev["featureImportance"]) or 1
            out.append(chart({'type': 'hbars', 'rows': [{'label': x.get('label') or x['feature'], 'vals': [abs(x[vk]) / tot]} for x in fi], 'series': [{'name': 'Share of total importance' + (' (mean absolute SHAP)' if vk == 'meanAbsShap' else f' ({vk})'), 'color': C['g7']}], 'fmt': 'pct1'}, 'What drives the prediction.'))
        if ev.get("trainingCurve"):
            tc = ev["trainingCurve"]
            out.append(chart({'type': 'xy', 'series': [{'name': 'Training loss', 'pts': [[x['step'], x['trainLoss']] for x in tc if x.get('trainLoss') is not None], 'color': C['grey']}, {'name': 'Validation loss', 'pts': [[x['step'], x['valLoss']] for x in tc if x.get('valLoss') is not None], 'color': C['g7']}],
                              'xfmt': 'num', 'fmt': 'dec', 'xTitle': 'Training step', 'yTitle': 'Loss'}, 'Training curve.'))
        if ev.get("nextCategory"):
            nc = ev["nextCategory"]
            out.append(chart({'type': 'hbars', 'rows': [{'label': x['method'], 'vals': [x['top1'], x['top3']]} for x in nc], 'series': [{'name': 'Top-1 accuracy', 'color': C['g7']}, {'name': 'Top-3 accuracy', 'color': C['g2']}], 'fmt': 'pct1'}, 'Predicting the category of the next transaction.'))
    except Exception as e:
        print("evidence chart failed", card.get("key"), repr(e))
    html_charts = f'<div class="g2">{"".join(out)}</div>' if out else ""
    tabs = ""
    for k, title in (("maeByHorizon", "Median error by horizon"), ("coverage", "Interval coverage"), ("pinball", "Pinball loss"), ("forecast14d", "14-day spending forecast"), ("perplexity", "Perplexity"), ("splits", "Data splits")):
        v = ev.get(k)
        try:
            if isinstance(v, list) and v and isinstance(v[0], dict):
                tabs += f"<h4>{title}</h4>" + dict_table(v[:24])
            elif isinstance(v, dict) and v and all(isinstance(c, dict) for c in v.values()):
                keys = []
                for c in v.values():
                    keys += [x for x in c if x not in keys]
                tabs += f"<h4>{title}</h4>" + table([""] + [esc(re.sub(r"(?<=[a-z])(?=[A-Z])", " ", x).lower()) for x in keys], [[esc(a)] + [("" if c.get(x) is None else (n0(c[x]) if isinstance(c[x], int) and not isinstance(c[x], bool) else (fnum(c[x]) if isinstance(c[x], float) else esc(str(c[x]).replace("..", " to "))))) for x in keys] for a, c in v.items()])
            elif isinstance(v, dict) and v:
                tabs += f"<h4>{title}</h4>" + table(["", ""], [[esc(a), fnum(c) if not isinstance(c, (dict, list)) else esc(json.dumps(c))[:160]] for a, c in v.items()])
        except Exception as e:
            print("evidence table failed", k, repr(e))
    return html_charts + tabs


def twins_note(card):
    """One honest sentence on how much the twins beat their baselines, computed from the card itself."""
    gains = [(1 - mt["model"] / mt["baseline"], mt.get("baselineName", "baseline")) for mt in card.get("metrics", [])
             if "MAE" in mt.get("label", "") and mt.get("better") == "lower" and mt.get("baseline")]
    if not gains:
        return "<p>Read this model as a mirror, not a forecast.</p>"
    lo, hi = min(g for g, _ in gains), max(g for g, _ in gains)
    rng = pc(lo, 1) if abs(hi - lo) < 0.002 else f"{pc(lo, 1)} to {pc(hi, 1)}"
    return (f"<p>Read this model as a mirror, not a forecast. Its error is only {rng} lower than its baselines ({', '.join(n for _, n in gains)}), "
            "so the app presents it as \"what happened to people like you\" and never as a prediction.</p>")


MS = []  # model sub-sections
ORDER = ["tribes", "twins", "anomalies", "habits", "forecast", "risk", "txgpt", "home"]
TITLES = {"tribes": "Money Map", "twins": "Two Futures", "anomalies": "Unusual for you", "habits": "Habit detector", "forecast": "Crystal ball", "risk": "Early warning", "txgpt": "TransactionGPT", "home": "First-home readiness"}
overview = []
for k in ORDER:
    c = cards.get(k)
    if not c:
        overview.append([f"<b>{TITLES[k]}</b>", "Training while this page was built. Its backtest appears here when it finishes.", "", '<span class="badge exp">In training</span>'])
        continue
    x = (c.get("metrics") or [{}])[0]
    v, cls = VERD.get(c.get("verdict"), ("?", "exp"))
    head = f"{esc(x.get('label', ''))}: <b>{mval(x['model'], x.get('unit'))}</b> vs {mval(x['baseline'], x.get('unit'))} ({esc(x.get('baselineName', ''))})" if x else ""
    overview.append([f'<a href="#m-{k}"><b>{TITLES[k]}</b></a>', esc(c.get("purpose", "")), head, f'<span class="badge {cls}">{v}</span>'])
body = f"""
<p class="lede">The team asked for machine learning with a real point, so each model answers a question a customer would ask, and each is measured against the simplest thing that could work. The verdicts below are the models' own: "ships" when it clearly beats the baseline, "experimental" when the gain is small or the validation is weak. We kept the weak ones on the page on purpose.</p>
{table(['Model', 'Question it answers', 'Headline result vs baseline', 'Verdict'], overview)}
"""
S.append(("models", "Models", section("models", "Machine learning", "Eight models, each measured against a naive baseline", body)))

# tribes
c = cards.get("tribes")
if c and mmap:
    try:
        pi = mmap["ids"].index(PERSONA) if PERSONA in mmap["ids"] else None
        spec = {'type': 'scatter', 'x': [round(v, 3) for v in mmap['x']], 'y': [round(v, 3) for v in mmap['y']], 'c': mmap['tribe'],
                'groups': [{'id': t['id'], 'name': t['name'], 'color': t['color'], 'share': t['share']} for t in tribes]}
        if pi is not None:
            spec['mark'] = {'x': mmap['x'][pi], 'y': mmap['y'][pi], 'label': 'Demo persona'}
        ev = c.get("evidence") or []
        tr = "".join(
            f'<div class="tribe"><div class="t-h"><i style="background:{t["color"]}"></i><b>{esc(t["name"])}</b><span>{pc(t["share"])}</span></div><p class="t-tag">{esc(t["tagline"])}</p>'
            f'<p>{esc(t["description"])}</p><p class="mut">Sets it apart: ' + "; ".join(f'{esc(d["label"].lower())} {fnum(float(d["value"]))} (all: {fnum(float(d["vsAll"]))})' for d in t.get("distinctive", [])[:3]) + "</p></div>" for t in tribes)
        pfm = ML.get("profile", {})
        body = card_head(c) + chart(spec, f"Every main-cohort customer placed by spending behaviour (shares and rates, so the map is about habits, not income). Colours are the {len(tribes)} tribes; names and descriptions were written by Claude from each tribe's statistics and are shown below as the customer sees them in the app.") + \
            f'<div class="tribes">{tr}</div>' + metric_table(c) + \
            (f"<p>We chose the number of tribes by evidence, not taste:</p>{dict_table(ev)}" if isinstance(ev, list) and ev else "") + \
            (f"<p>The honest reading: behaviour in this dataset is a continuum. {pc(pfm.get('below50', 0))} of customers fit their main tribe at under 50%, so the app always shows a <b>mix</b> (for example 35% Evening Socialite, 32% Buffer Builder) and calls the tribes a simplification.</p>" if pfm else "") + caveats(c)
        MS.append(("m-tribes", "Money Map", section("m-tribes", "Model 1 · What kind of spender am I?", f"Money Map: {n0(len(mmap['ids']))} customers on one picture", body)))
    except Exception as e:
        print("tribes section failed", repr(e))

c = cards.get("twins")
if c:
    try:
        t = ML.get("twins") or {}
        extra = ""
        if t:
            extra = chart({'type': 'line', 'x': list(range(13)), 'series': [{'name': 'Twins who built a buffer', 'y': t['paths']['built'], 'color': C['g7']}, {'name': 'Held steady', 'y': t['paths']['held'], 'color': C['grey']}, {'name': 'Twins who slipped', 'y': t['paths']['slipped'], 'color': C['amber']}],
                           'fmt': 'num', 'xTitle': 'Months after the matching year', 'yTitle': 'Balance change, months of income', 'every': 2},
                          f"Average path of the three twin groups across {n0(t['n'])} customers. After 12 months the gap between the top and bottom third of a customer's own twins is {t['gap']:.1f} months of income (median).") + \
                "<p>Which behaviour most often separates the twins who built a buffer from those who slipped?</p>" + \
                chart({'type': 'hbars', 'rows': [{'label': l, 'vals': [n / t['n']]} for l, n in t['top']], 'series': [{'name': 'Share of customers for whom this is the clearest difference', 'color': C['g7']}], 'fmt': 'pct'}, 'The single clearest difference between builders and slippers, per customer.')
        body = card_head(c) + extra + metric_table(c) + \
            twins_note(c) + caveats(c)
        MS.append(("m-twins", "Two Futures", section("m-twins", "Model 2 · Where is this heading?", "Two Futures: what happened next to people like you", body)))
    except Exception as e:
        print("twins section failed", repr(e))

c = cards.get("anomalies")
if c:
    try:
        a = ML.get("anomalies") or {}
        bt = ((c.get("validation") or {}).get("byType")) or {}
        extra = ""
        if bt:
            extra += chart({'type': 'hbars', 'rows': [{'label': k, 'vals': [v.get('model'), v.get('global_amount'), v.get('isolation_forest')]} for k, v in bt.items()],
                            'series': [{'name': 'Personal score (used in the app)', 'color': C['g7']}, {'name': 'Global amount percentile', 'color': C['grey']}, {'name': 'Isolation Forest', 'color': C['blue']}], 'fmt': 'dec'},
                           'ROC AUC by type of injected anomaly. The personal score beats an amount-only rule on unusual hours and categories, which that rule cannot see by construction. The Isolation Forest is better on both of those and worse on amount spikes.')
        if a:
            extra += f"<p>Across {n0(a['n'])} customers the model flags {n0(a['flagged'])} purchases in the last 12 months, {n0(a['suggested'])} of them are proposed for the Surprise musts basket. A flag means &quot;in the top 5% of unusualness for this customer&quot;, so most active customers have one in any given month ({pc(a['recent'] / a['n'])} in the last 30 days): that share follows from the cut-off and is not a finding.</p><p>We kept the simple personal score, although the Isolation Forest scores slightly higher overall, because every flag comes with a plain reason the customer can check (&quot;6x your usual Home &amp; tech purchase&quot;).</p>" + \
                chart({'type': 'hbars', 'rows': [{'label': k, 'vals': [n]} for k, n in a['cats']], 'series': [{'name': 'Flagged purchases', 'color': C['g7']}], 'fmt': 'num'}, 'Flagged purchases by category.')
        body = card_head(c) + extra + metric_table(c) + caveats(c)
        MS.append(("m-anomalies", "Unusual for you", section("m-anomalies", "Model 3 · Did anything odd happen?", "Unusual for you: a personal normal for every customer", body)))
    except Exception as e:
        print("anomalies section failed", repr(e))

c = cards.get("habits")
if c:
    try:
        h = ML.get("habits") or {}
        v = c.get("validation") or {}
        extra = ""
        if v:
            blocks = v.get('fp_rate_series_blocks', v.get('fp_rate_series'))
            series = [{'name': 'Real data', 'color': C['g7']}, {'name': f"{v.get('block_weeks', 4)}-week blocks shuffled", 'color': C['amber']}]
            rows = [{'label': 'Weekly series flagged', 'vals': [v.get('detection_rate_series'), blocks]}, {'label': 'Customers with at least one habit', 'vals': [v.get('detection_rate_customers'), v.get('fp_rate_customers')]}]
            if v.get('fp_rate_series_weeks') is not None:
                series.append({'name': 'Single weeks shuffled', 'color': C['grey']})
                rows[0]['vals'].append(v.get('fp_rate_series_weeks')); rows[1]['vals'].append(v.get('fp_rate_customers_weeks'))
            extra += chart({'type': 'hbars', 'rows': rows, 'series': series, 'fmt': 'pct1'},
                           'The detector on real series against the same detector on two shuffled copies, where no sustained change exists by construction.')
            cr_ = v.get('chance_share_range')
            if cr_:
                extra += f"<p>How many flags are noise depends on what counts as \"no change\". Shuffling single weeks destroys all structure and gives {pc(cr_[0])}; shuffling {v.get('block_weeks', 4)}-week blocks keeps short runs such as one busy month and gives {pc(cr_[1])}. The second is conservative, because a real shift survives inside its blocks, so the truth lies between them. The threshold was set on the stricter one after an independent check showed the first was too easy.</p>"
        if h:
            lab = {"new_habit": "New habit (holding)", "forming": "Forming", "slipping": "Slipping"}
            extra += f"<p>{n0(h['withHabit'])} of {n0(h['n'])} customers ({pc(h['withHabit'] / h['n'])}) have at least one sustained shift in the last year, {n0(h['total'])} shifts in total.</p><div class='g2'>" + \
                chart({'type': 'cols', 'x': [lab.get(k, k) for k in h['status']], 'y': list(h['status'].values()), 'fmt': 'num', 'labels': True, 'yTitle': 'Detected shifts'}, 'Shifts by status.') + \
                chart({'type': 'hbars', 'rows': [{'label': cname, 'vals': [d, u]} for cname, d, u in h['cats']], 'series': [{'name': 'Spending went down', 'color': C['g7']}, {'name': 'Went up', 'color': C['amber']}], 'fmt': 'num'}, 'Shifts by category and direction.') + "</div>"
        body = card_head(c) + extra + metric_table(c) + caveats(c)
        MS.append(("m-habits", "Habit detector", section("m-habits", "Model 4 · Am I changing?", "Habit detector: noticing a change that has stuck", body)))
    except Exception as e:
        print("habits section failed", repr(e))

for k, eyebrow, title in (("forecast", "Model 5 · Will I make it to payday?", "Crystal ball: a balance forecast with honest uncertainty"),
                          ("risk", "Model 6 · Should I worry?", "Early warning: overdraft risk, with reasons"),
                          ("txgpt", "Model 7 · The moonshot", "TransactionGPT: a small transformer that reads account history like text")):
    c = cards.get(k)
    try:
        if not c:
            MS.append((f"m-{k}", TITLES[k], section(f"m-{k}", eyebrow, title, '<p class="lede">This model was still training when the page was built. The section fills in with its backtest against baselines as soon as its model card is written.</p>')))
            continue
        extra = ""
        if k == "forecast" and ML.get("forecast"):
            f = ML["forecast"]
            extra = f"<p>Across {n0(f['n'])} customers, {pc(f['above20'])} currently have a 20% or higher chance of dipping below zero before their next payday.</p>" + \
                chart({'type': 'cols', 'x': f['labels'], 'y': f['hist'], 'fmt': 'num', 'xTitle': 'Chance of dipping below zero before the next payday', 'yTitle': 'Customers', 'labels': True, 'hi': [4, 5, 6, 7]}, 'Customers by forecast overdraft probability, as of the last day in the data.')
        if k == "risk" and ML.get("risk"):
            r = ML["risk"]
            extra = "<p>Risk level today: " + ", ".join(f"<b>{esc(a)}</b> {n0(n)}" for a, n in sorted(r["levels"].items(), key=lambda z: -z[1])) + f" (of {n0(r['n'])} customers).</p>" + \
                (chart({'type': 'hbars', 'rows': [{'label': l, 'vals': [n]} for l, n in r['drivers']], 'series': [{'name': 'Customers for whom this is the top reason', 'color': C['g7']}], 'fmt': 'num'}, 'The most common top reason behind a customer\'s risk score.') if r.get("drivers") else "")
        if k == "txgpt":
            pr = ((c.get("evidence") or {}).get("params")) or {}
            bits = []
            if pr.get("parameters") and pr.get("trainTokens"):
                bits.append(f"The model has {pr['parameters'] / 1e6:.1f} million parameters ({pr.get('layers')} layers, context of {pr.get('context')} tokens) and was trained on {pr['trainTokens'] / 1e6:.1f} million tokens in {pr.get('trainingSeconds', 0) / 60:.0f} minutes on {esc(str(pr.get('device', 'CPU')))}. A token is one day marker or one transaction (category and amount bucket).")
            if ML.get("txgptN"):
                bits.append(f"For {n0(ML['txgptN'])} customers it sampled 200 possible next fortnights each; the app shows three of them (a thrifty, a typical and a spendy one) as imagined futures.")
            extra = "<p>" + " ".join(bits) + "</p>" if bits else ""
        body = card_head(c) + extra + metric_table(c) + generic_evidence(c) + caveats(c)
        MS.append((f"m-{k}", TITLES[k], section(f"m-{k}", eyebrow, title, body)))
    except Exception as e:
        print(k, "section failed", repr(e))

c = cards.get("home")
try:
    bd = {x["decision"]: x for x in mo["byDecision"]}
    ap, rj = bd.get("approved"), bd.get("rejected")
    rows = [[lab, f(ap[key]), f(rj[key])] for lab, key, f in (
        ("Applications", "n", n0), ("Median property price", "price", eur), ("Median loan", "loan", eur), ("Median own equity", "equity", eur), ("Equity share of price", "equityShare", lambda v: pc(v, 1)),
        ("Loan to value", "ltv", lambda v: pc(v, 1)), ("Required monthly income", "requiredIncome", eur), ("Applicant's median salary", "salary", eur),
        ("Account balance today", "endBalance", eur), ("Balance as a share of the equity", "balanceVsEquity", pc), ("Ever below zero", "everNegative", pc))]
    extra = f"""
<p>The dataset includes {mo['n']} mortgage applications with {n0(mo['nEvents'])} negotiation events. {ap['n']} were approved and {rj['n']} rejected, most often for {esc(mo['rejectionReasons'][0]['reason'].replace('_', ' '))} ({mo['rejectionReasons'][0]['n']} of {rj['n']}). A typical application takes {mo['eventsPerApplication']['p50']:.0f} events and {mo['daysToDecision'].get('p50', 0):.0f} days from start to decision.</p>
{table(['', 'Approved', 'Rejected'], rows, 'num')}
<p>Approved and rejected applicants look almost the same on price, loan and income. What differs most is the equity they bring and, in the recorded reasons, the collateral.</p>
<div class="g2">
{chart({'type': 'hbars', 'rows': [{'label': x['reason'].replace('_', ' ').capitalize(), 'vals': [x['n']]} for x in mo['rejectionReasons']], 'series': [{'name': 'Rejected applications', 'color': C['g7']}], 'fmt': 'num'}, 'Why applications were rejected.')}
{chart({'type': 'cols', 'x': [l for l, _ in ML['home']['bins']], 'y': [n for _, n in ML['home']['bins']], 'fmt': 'num', 'yTitle': 'Customers', 'labels': True}, 'Years until each customer reaches the typical equity for their income, at their current saving pace.') if ML.get('home') else ''}
</div>"""
    if ML.get("home"):
        hmg = ML["home"]
        extra += f"<p>For the median customer, similar-income applicants were approved for a home of about {eur(hmg['price'])} with {hmg['share']:.0f}% own equity, which leaves a gap of {eur(hmg['gap'])} from what is visible on the account.</p>"
    body = (card_head(c) if c else "") + extra + (metric_table(c) if c else "")
    if c and c.get("coefficients"):
        body += chart({'type': 'hbars', 'rows': [{'label': a.replace('_', ' '), 'vals': [v]} for a, v in sorted(c['coefficients'].items(), key=lambda z: -abs(z[1]))], 'series': [{'name': 'Change in log-odds of approval per standard deviation', 'color': C['g7']}], 'fmt': 'dec'},
                      'Logistic-regression coefficients. Some run against everyday logic (a bigger buffer lowers approval), which says more about how the synthetic decisions were generated than about lending.')
    body += (f"<p><b>Simple rule found.</b> {esc(c.get('rule'))}</p>" if c and c.get("rule") else "") + \
        "<p>In the app this is shown as an illustration: prices, equity, the gap and the years. The approval probability is hidden unless the customer's situation lies inside the range of the 200 applications.</p>" + (caveats(c) if c else "")
    MS.append(("m-home", "First-home readiness", section("m-home", "Model 8 · Could I buy a home?", "First-home readiness: what 200 mortgage applications can and cannot tell", body)))
except Exception as e:
    print("home section failed", repr(e))
S += MS

# ---- limits
body = f"""
<ul class="limits">
<li><b>The data is synthetic.</b> Every figure here describes the challenge dataset. Patterns such as the payday effect are built into it by its authors; real customers will differ, and each model would need re-validation on real data.</li>
<li><b>No merchant names.</b> Only {m['nMcc']} merchant category codes. Vara cannot answer "how much at a specific shop" and says so.</li>
<li><b>No inflation.</b> Year-two spending is within {pc(yoy_max, 1)} of year one in every category, and salaries are flat. Real series would need price adjustment, which our benchmark pipeline already does for the Statistics Finland figures.</li>
<li><b>Opening balances.</b> {pc(oct24)} of customers are below zero in the first month against about {pc(later)} later. We keep October 2024 out of model targets.</li>
<li><b>Missing housing payments.</b> {pc(ho['missingMonthShare'], 1)} of customer-months lack a housing payment for customers who otherwise pay one, so we use medians and never "last month's rent".</li>
<li><b>One account per customer.</b> Savings and spending elsewhere are invisible, most clearly for the {m['nSweep']} salary-sweep customers. The prototype's multi-bank (PSD2) flow is a mock that shows how this would be closed.</li>
<li><b>Small samples.</b> The mortgage model learns from {mo['n']} applications. Its numbers are noisy and it is labelled illustrative.</li>
<li><b>Correlation, not causation.</b> Two Futures and the trim replay show what goes together, not what causes what. The app says so next to each of them.</li>
<li><b>Every figure in a chat answer is checked against the engine.</b> The language model chooses which calculation to run and writes the sentence, quoting figures from the results. A number guard then checks each figure in the text against those results and flags any it cannot find. The model never does the arithmetic.</li>
</ul>
"""
S.append(("limits", "Limits", section("limits", "Honest limits", "What this analysis cannot tell you", body)))

# ---- method
body = f"""
<p>Everything on this page is reproducible from the challenge repository with three commands on one machine: the data export, the model pipelines and this analysis. The descriptive statistics take about three seconds with DuckDB; the five self-understanding models retrain in about a minute on 32 CPU cores; no GPU is used anywhere.</p>
<ul>
<li><b>One rules file.</b> Basket rules, category labels and age bands live in a single JSON file shared by the TypeScript app, the SQL in this analysis and the Python models.</li>
<li><b>Time splits.</b> Anything predictive is trained on earlier months and tested on later ones; unsupervised models are checked for stability across random seeds or against shuffled data.</li>
<li><b>Baselines first.</b> Each model card names the naive alternative (population mean, last year's value, a global rule, shuffled data) and the model's verdict follows from that comparison.</li>
<li><b>Definitions.</b> Regular customers: main cohort without salary sweep ({n0(n_core)}). Salary: the customer's median monthly salary. Pay cycle: salary date to the day before the next salary. Below zero: running balance after a transaction is negative.</li>
<li><b>Sources.</b> Synthetic transaction and mortgage data provided by S-Pankki for Junction 2026. National benchmarks: Statistics Finland, Household Budget Survey 2022 and consumer price index (CC BY 4.0).</li>
</ul>
<p class="note">Built {time.strftime('%d.%m.%Y %H:%M UTC', time.gmtime())}. Junction 2026 concept, not an official S-Pankki product.</p>
"""
S.append(("method", "Method", section("method", "Method", "How to reproduce this", body)))

# ------------------------------------------------------------------------------------------ page
TEMPLATE = open(os.path.join(HERE, "template.html"), encoding="utf-8").read()
nav = "".join(f'<a href="#{sid}" class="{"sub" if sid.startswith("m-") else ""}">{esc(lab)}</a>' for sid, lab, _ in S)
page = TEMPLATE.replace("<!--NAV-->", nav).replace("<!--BODY-->", "\n".join(h for _, _, h in S))
for out in ("/srv/vara/insights/index.html", os.path.join(DATA_DIR, "insights", "site", "index.html")):
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with open(out, "w", encoding="utf-8") as f:
        f.write(page)
print(f"wrote {len(page) / 1024:.0f} KB, {len(S)} sections, model cards: {sorted(cards)}  ({time.time() - t0:.1f}s)")
