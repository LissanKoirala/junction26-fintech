#!/usr/bin/env python
"""Dataset-wide analysis for the Vara Insights site (the judges' companion report).

Runs on the VM:  ~/mlenv/bin/python insights/eda.py
Writes DATA_DIR/insights/eda.json. Descriptive statistics over tx.parquet only (no model outputs),
using the same basket rules as the app (app/shared/domain.json).
"""
import datetime as dt
import decimal
import json
import os
import sys
import time
import traceback

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "ml"))
import duckdb  # noqa: E402
import numpy as np  # noqa: E402
from common import AS_OF, CUSTOMERS_DIR, DATA_DIR, PARQUET, RAW, load_domain  # noqa: E402

OUT_DIR = os.path.join(DATA_DIR, "insights")
os.makedirs(OUT_DIR, exist_ok=True)
con = duckdb.connect()
con.execute("pragma threads=24")
D = load_domain()
BANDS = [b["key"] for b in D["ageBands"]]
out = {"generatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "asOf": AS_OF, "bands": BANDS, "errors": {}}
T0 = time.time()


def q(sql):
    cur = con.execute(sql)
    cols = [c[0] for c in cur.description]
    return [dict(zip(cols, r)) for r in cur.fetchall()]


def col(sql):
    return np.array([np.nan if r[0] is None else float(r[0]) for r in con.execute(sql).fetchall()], dtype=float)


def one(sql):
    return con.execute(sql).fetchone()[0]


def pct(a, ps=(5, 10, 25, 50, 75, 90, 95)):
    a = a[~np.isnan(a)]
    d = {f"p{p}": float(np.percentile(a, p)) for p in ps}
    d.update(mean=float(a.mean()), n=int(len(a)))
    return d


def hist(a, edges):
    a = a[~np.isnan(a)]
    c, _ = np.histogram(np.clip(a, edges[0], edges[-1] - 1e-9), bins=edges)
    return {"edges": [float(e) for e in edges], "counts": c.tolist(), "n": int(len(a))}


def section(name):
    def deco(fn):
        t = time.time()
        try:
            out[name] = fn()
            print(f"[ok] {name:12s} {time.time() - t:5.1f}s", flush=True)
        except Exception:
            out["errors"][name] = traceback.format_exc()[-1500:]
            print(f"[FAIL] {name}\n{traceback.format_exc()}", flush=True)
        return fn
    return deco


def clean(o):
    if isinstance(o, dict):
        return {str(k): clean(v) for k, v in o.items()}
    if isinstance(o, (list, tuple)):
        return [clean(v) for v in o]
    if isinstance(o, (np.floating, float, decimal.Decimal)):
        f = float(o)
        return None if (f != f or f in (float("inf"), float("-inf"))) else round(f, 4)
    if isinstance(o, (np.integer,)):
        return int(o)
    if isinstance(o, (dt.date, dt.datetime)):
        return o.isoformat()
    return o


# ------------------------------------------------------------------ base tables
band_case = "case " + " ".join(
    f"when age between {b['min']} and {b.get('max') or 200} then '{b['key']}'" for b in D["ageBands"]) + " else 'other' end"
con.execute(f"create view raw as select * from read_parquet('{PARQUET}')")
con.execute(f"""create table cust as
  select id customer_id, age, cohort, hasSalarySweep sweep, hasHousing has_housing, {band_case} band
  from read_json_auto('{CUSTOMERS_DIR}/index.json')""")
# Basket rules: mirror of app/shared/domain.json basketRules (checked against ml/common.add_basket_column below).
con.execute("""create table t as
  with ht as (select customer_id, median(abs(amount)) m from raw where type='purchase' and category='Home & Tech' group by 1)
  select r.idx, r.customer_id, r.date, r.time, r.category, r.type, r.amount, r.balance, r.mcc, strftime(r.date,'%Y-%m') ym,
    case
      when r.type in ('housing_payment','utilities_payment') then 'must_regular'
      when r.type='investment_deposit' then 'saving'
      when r.type='salary_sweep' then 'transfer'
      when r.type in ('salary','other_income','investment_withdrawal') then 'income'
      when r.category='Groceries' then (case when r.mcc='5499' then 'everyday' else 'must_regular' end)
      when r.category='Health' then 'must_irregular'
      when r.category='Transportation' then (case when r.mcc in ('4111','5541','5542') then 'must_regular' else 'everyday' end)
      when r.category='Home & Tech' then (case when abs(r.amount) >= greatest(150, 3*ht.m) then 'must_irregular' else 'everyday' end)
      else 'everyday' end basket
  from raw r left join ht using (customer_id)""")
con.execute("""create table cm as
  select customer_id, ym,
    sum(case when type='salary' then amount else 0 end) salary,
    sum(case when basket='income' then amount else 0 end) income,
    -sum(case when type='housing_payment' then amount else 0 end) housing,
    -sum(case when type='utilities_payment' then amount else 0 end) utilities,
    -sum(case when basket='must_regular' then amount else 0 end) mr,
    -sum(case when basket='must_irregular' then amount else 0 end) mi,
    -sum(case when basket='everyday' then amount else 0 end) ev,
    -sum(case when basket='saving' then amount else 0 end) saving,
    -sum(case when basket='transfer' then amount else 0 end) transfer,
    -sum(case when type='purchase' then amount else 0 end) purchases,
    sum(case when type='purchase' and -amount < 10 then 1 else 0 end) small_n,
    -sum(case when type='purchase' and -amount < 10 then amount else 0 end) small_eur,
    sum(case when type='purchase' then 1 else 0 end) purch_n,
    min(balance) min_bal, arg_max(balance, idx) end_bal
  from t group by 1,2""")
con.execute("""create table ob as
  select customer_id, arg_min(balance-amount, idx) open_bal, arg_max(balance, idx) end_bal, min(balance) min_bal from t group by 1""")
con.execute("""create table cs as
  select c.customer_id, c.age, c.band, c.cohort, c.sweep, c.has_housing, o.open_bal, o.end_bal, o.min_bal,
    median(case when m.salary>0 then m.salary end) med_salary, sum(m.salary)/24 avg_salary, sum(m.income)/24 avg_income,
    median(case when m.housing>0 then m.housing end) med_housing, sum(case when m.housing>0 then 1 else 0 end) housing_months,
    sum(m.utilities)/24 utilities, sum(m.mr)/24 mr, sum(m.mi)/24 mi, sum(m.ev)/24 ev, sum(m.saving)/24 sav, sum(m.transfer)/24 tr,
    sum(m.small_n)/24 small_n, sum(m.small_eur)/24 small_eur, sum(m.purch_n)/24 purch_n,
    sum(case when m.min_bal<0 then 1 else 0 end) neg_months, count(*) as n_months
  from cust c join cm m using (customer_id) join ob o using (customer_id) group by all""")
con.execute("create table eod as select customer_id, date, arg_max(balance, idx) bal from t group by 1,2")
con.execute("""create table spend_d as select customer_id, date,
    -sum(case when type='purchase' then amount else 0 end) purch, -sum(case when basket='everyday' then amount else 0 end) ev
  from t group by 1,2""")
con.execute("""create table daily as
  with days as (select c.customer_id, cast(g.d as date) date from cust c,
                generate_series(date '2024-10-01', date '2026-09-30', interval 1 day) g(d))
  select d.customer_id, d.date,
    coalesce(last_value(e.bal ignore nulls) over (partition by d.customer_id order by d.date
             rows between unbounded preceding and current row), o.open_bal) bal,
    coalesce(s.purch,0) purch, coalesce(s.ev,0) ev
  from days d left join eod e using (customer_id, date) left join spend_d s using (customer_id, date) join ob o using (customer_id)""")
con.execute("""create table sal as select customer_id, date sal_date, amount sal_amt,
    lead(date) over (partition by customer_id order by date) next_sal from
    (select customer_id, date, sum(amount) amount from t where type='salary' group by 1,2)""")
con.execute("""create table dd as select d.*, s.sal_date, s.sal_amt, s.next_sal, datediff('day', s.sal_date, d.date) dsp
  from daily d asof left join sal s on d.customer_id = s.customer_id and d.date >= s.sal_date""")
con.execute("""create table cyc as
  select d.customer_id, d.sal_date, any_value(d.sal_amt) sal_amt, count(*) as n_days,
    arg_min(d.bal, d.dsp) pay_bal, min(d.bal) min_bal, arg_max(d.bal, d.dsp) end_bal, arg_min(d.dsp, d.bal) low_dsp,
    sum(d.ev) ev, sum(d.purch) purch
  from dd d where d.sal_date is not null and d.next_sal is not null group by 1,2""")
con.execute("""create table cyc_b as select x.customer_id, s.sal_date,
    -sum(case when x.basket='must_regular' then x.amount else 0 end) mr,
    -sum(case when x.basket='must_irregular' then x.amount else 0 end) mi
  from t x asof join sal s on x.customer_id = s.customer_id and x.date >= s.sal_date group by 1,2""")
print(f"base tables {time.time() - T0:.1f}s", flush=True)
MAIN = "cohort='main'"
CORE = "cohort='main' and not sweep"   # ratios to salary exclude salary-sweep customers (their salary leaves at once)


@section("meta")
def _():
    m = q("""select count(*) nTx, count(distinct customer_id) nCustomers, min(date) dateFrom, max(date) dateTo,
             sum(case when amount>0 then amount end) totalIn, -sum(case when amount<0 then amount end) totalOut,
             count(distinct mcc) nMcc from t""")[0]
    m.update(q("""select sum((cohort='main')::int) nMain, sum((cohort<>'main')::int) nTail, sum(sweep::int) nSweep,
                  sum((not has_housing)::int) nNoHousing, median(age) medianAge from cust""")[0])
    m["types"] = q("""select type, category, count(*) n, sum(amount) total, avg(amount) avg, median(amount) median,
                      count(distinct customer_id) customers from t group by 1,2 order by abs(sum(amount)) desc""")
    m["ageHist"] = q("select age, count(*) n from cust group by 1 order by 1")
    return m


@section("byAge")
def _():
    return q(f"""select band, count(*) n, median(med_salary) salary, median(med_housing/med_salary) housingShare,
        avg((min_bal<0)::int) everNegative, avg(neg_months) negMonthsMean, median(mr) mustRegular, median(mi) mustIrregular,
        median(ev) everyday, median(ev/nullif(avg_salary,0)) everydayShareOfSalary,
        median(mr/nullif(avg_salary,0)) mustRegularShareOfSalary, median(small_n) smallN, median(small_eur) smallEur,
        avg((sav>0)::int) investors, median(case when sav>0 then sav end) investMonthly,
        median(end_bal-open_bal) balanceChange, avg((end_bal>open_bal)::int) balanceUp, median(end_bal) endBalance
      from cs where {CORE} group by 1 order by 1""")


@section("overdraft")
def _():
    r = {}
    r["everNegativeAll"] = q("select count(*) n, sum((min_bal<0)::int) neg from ob")[0]
    r["everNegativeMain"] = q(f"select count(*) n, sum((min_bal<0)::int) neg from cs where {MAIN}")[0]
    r["negMonthsHist"] = hist(col(f"select neg_months from cs where {MAIN}"), np.arange(0, 26, 1))
    r["negMonths"] = pct(col(f"select neg_months from cs where {MAIN} and min_bal<0"))
    r["customerMonthsNegative"] = one(f"select avg((m.min_bal<0)::int) from cm m join cust c using(customer_id) where {MAIN}")
    r["customerDaysNegative"] = one(f"select avg((d.bal<0)::int) from daily d join cust c using(customer_id) where {MAIN}")
    r["depth"] = pct(col(f"select min_bal from cs where {MAIN} and min_bal<0"))
    r["depthVsSalary"] = pct(col(f"select -min_bal/med_salary from cs where {CORE} and min_bal<0 and med_salary>0"))
    r["byMonth"] = q(f"""select m.ym, avg((m.min_bal<0)::int) negShare, median(m.end_bal) medianEndBalance
                         from cm m join cust c using(customer_id) where {MAIN} group by 1 order by 1""")
    r["byDaysSincePayday"] = q(f"""select dsp, count(*) n, avg((bal<0)::int) negShare, avg(ev/nullif(mev,0)) everydayIndex,
          avg(purch/nullif(mp,0)) purchaseIndex, median(bal/nullif(sal_amt,0)) balanceVsSalary
        from (select d.*, avg(d.ev) over (partition by d.customer_id) mev, avg(d.purch) over (partition by d.customer_id) mp
              from dd d join cust c using(customer_id) where {CORE} and d.dsp is not null)
        where dsp between 0 and 30 group by 1 order by 1""")
    # episodes: consecutive days below zero
    r["episodes"] = q(f"""with x as (select d.customer_id, d.date, (d.bal<0) neg,
             (d.bal<0 and not coalesce(lag(d.bal<0) over (partition by d.customer_id order by d.date), false))::int st
           from daily d join cust c using(customer_id) where {MAIN}),
         y as (select *, sum(st) over (partition by customer_id order by date) ep from x where neg),
         z as (select customer_id, ep, count(*) len from y group by 1,2)
       select count(*) episodes, median(len) medianDays, avg(len) meanDays, quantile_cont(len, 0.9) p90Days,
              avg((len<=3)::int) shareUpTo3Days, avg((len>=14)::int) share14PlusDays from z""")[0]
    return r


@section("cycles")
def _():
    base = f"""from cyc y join cyc_b b using (customer_id, sal_date) join cust c using (customer_id)
               where {CORE} and y.sal_amt > 0 and y.n_days between 20 and 45"""
    r = q(f"""select count(*) cycles, median(y.sal_amt) salary, median(y.pay_bal) paydayBalance, median(b.mr) mustRegular,
        median(b.mi) mustIrregular, median(y.ev) everyday, median(b.mr/y.sal_amt) mustRegularShareOfSalary,
        median(y.ev/y.sal_amt) everydayShareOfSalary,
        median(case when y.pay_bal>0 then (y.pay_bal-b.mr)/y.pay_bal end) freeShareOfPaydayBalance,
        avg((y.pay_bal - b.mr < 0)::int) paydayBalanceBelowFixedMusts,
        avg((y.min_bal<0)::int) cyclesDippingBelowZero, avg((y.end_bal<y.pay_bal - y.sal_amt)::int) cyclesEndingLower,
        avg((y.ev > y.sal_amt - b.mr)::int) everydayAboveFreeMoney, median(y.low_dsp) medianLowDay, median(y.n_days) as medianDays
      {base}""")[0]
    r["lowDayHist"] = hist(col(f"select y.low_dsp {base}"), np.arange(0, 33, 1))
    r["lowDayHistNegativeOnly"] = hist(col(f"select y.low_dsp {base} and y.min_bal<0"), np.arange(0, 33, 1))
    r["freeShareHist"] = hist(col(f"select (y.pay_bal-b.mr)/y.pay_bal {base} and y.pay_bal>0"), np.round(np.arange(-0.5, 1.01, 0.1), 2))
    return r


@section("counterfactual")
def _():
    """If everyday extras had been p% lower from day one (savings left on the account), who still goes below zero?"""
    con.execute("""create table cf as select d.customer_id, d.date, d.bal,
        sum(d.ev) over (partition by d.customer_id order by d.date rows between unbounded preceding and current row) cumev
      from daily d join cust c using (customer_id) where c.cohort='main'""")
    rows = []
    for p in (0, 0.05, 0.10, 0.20, 0.30):
        x = q(f"""select count(distinct case when bal + {p}*cumev < 0 then customer_id end) customersNegative,
                         sum((bal + {p}*cumev < 0)::int) negativeDays from cf""")[0]
        x["trim"] = p
        rows.append(x)
    ev = pct(col(f"select ev from cs where {MAIN}"))
    return {"rows": rows, "everydayMonthly": ev}


@section("baskets")
def _():
    r = {}
    r["overall"] = q(f"""select sum(mr)*24 mustRegular, sum(mi)*24 mustIrregular, sum(ev)*24 everyday, sum(sav)*24 saving,
                         sum(tr)*24 transfer, sum(avg_income)*24 income from cs where {MAIN}""")[0]
    r["byCategory"] = q(f"""select basket, category, -sum(amount) eur, count(*) n from t join cust c using(customer_id)
                            where {MAIN} and amount<0 group by 1,2 order by 1, 3 desc""")
    r["byBand"] = q(f"""select band, sum(mr) mustRegular, sum(mi) mustIrregular, sum(ev) everyday, sum(sav) saving
                        from cs where {CORE} group by 1 order by 1""")
    r["everydayShareOfSpend"] = pct(col(f"select ev/nullif(mr+mi+ev,0) from cs where {MAIN}"))
    r["everydayShareHist"] = hist(col(f"select ev/nullif(mr+mi+ev,0) from cs where {MAIN}"), np.round(np.arange(0, 1.01, 0.05), 2))
    r["shareOfSalary"] = {k: pct(col(f"select {k}/nullif(avg_salary,0) from cs where {CORE} and avg_salary>0"))
                          for k in ("mr", "mi", "ev", "sav")}
    r["homeTechBig"] = q("""select sum((basket='must_irregular')::int) nBig, count(*) n,
        -sum(case when basket='must_irregular' then amount else 0 end) eurBig, -sum(amount) eur from t where category='Home & Tech'""")[0]
    return r


@section("surprise")
def _():
    r = {}
    x = f"from cm m join cs s using (customer_id) where s.{CORE} and s.med_salary>0"
    r["shockMonthShare"] = one(f"select avg((m.mi > 0.15*s.med_salary)::int) {x}")
    r["customersWithShock"] = one(f"""select avg((k>0)::int) from (select m.customer_id, sum((m.mi > 0.15*s.med_salary)::int) k {x} group by 1)""")
    r["shocksPerCustomer"] = pct(col(f"select sum((m.mi > 0.15*s.med_salary)::int) {x} group by m.customer_id"))
    r["shockSize"] = pct(col(f"select m.mi {x} and m.mi > 0.15*s.med_salary"))
    r["shockSizeVsSalary"] = pct(col(f"select m.mi/s.med_salary {x} and m.mi > 0.15*s.med_salary"))
    r["negativeInShockMonth"] = q(f"""select avg(case when m.mi > 0.15*s.med_salary then (m.min_bal<0)::int end) shock,
                                             avg(case when m.mi <= 0.15*s.med_salary then (m.min_bal<0)::int end) normal {x}""")[0]
    r["largestSingle"] = pct(col(f"""select max(-t.amount) from t join cust c using(customer_id)
                                     where {MAIN} and t.basket='must_irregular' group by t.customer_id"""))
    r["yearlyTotal"] = pct(col(f"select mi*12 from cs where {MAIN}"))
    r["monthlyHist"] = hist(col(f"select m.mi/s.med_salary {x}"), np.round(np.arange(0, 0.61, 0.03), 2))
    return r


@section("small")
def _():
    r = {}
    r["thresholds"] = [dict(threshold=th, **q(f"""select avg((-amount<{th})::int) shareOfPurchases,
          sum(case when -amount<{th} then -amount else 0 end)/sum(-amount) shareOfEuros,
          sum((-amount<{th})::int) n, sum(case when -amount<{th} then -amount else 0 end) eur
        from t where type='purchase'""")[0]) for th in (5, 10, 15, 20)]
    r["byCategory"] = q("""select category, count(*) n, -sum(amount) eur, avg(-amount) avg from t
                           where type='purchase' and -amount<10 group by 1 order by 2 desc""")
    r["byMcc"] = q("""select mcc, any_value(category) category, count(*) n, -sum(amount) eur from t
                      where type='purchase' and -amount<10 group by 1 order by 2 desc limit 12""")
    r["perMonthCount"] = pct(col(f"select small_n from cs where {MAIN}"))
    r["perMonthEur"] = pct(col(f"select small_eur from cs where {MAIN}"))
    r["perYearEur"] = pct(col(f"select small_eur*12 from cs where {MAIN}"))
    r["shareOfPurchaseCount"] = pct(col(f"select small_n/nullif(purch_n,0) from cs where {MAIN}"))
    r["perYearHist"] = hist(col(f"select small_eur*12 from cs where {MAIN}"), np.arange(0, 1601, 100))
    return r


@section("rhythm")
def _():
    r = {}
    r["weekday"] = q(f"""select isodow(d.date) as weekday, avg(d.purch) purchasesPerDay, avg(d.ev) everydayPerDay
                         from daily d join cust c using(customer_id) where {MAIN} group by 1 order by 1""")
    r["weekdayByCategory"] = q(f"""select isodow(date) as weekday, category, -sum(amount) eur, count(*) n
                                   from t join cust c using(customer_id) where {MAIN} and type='purchase' group by 1,2 order by 2,1""")
    r["hour"] = q("""select cast(substr(time,1,2) as int) as hour, count(*) n, -sum(amount) eur from t
                     where type='purchase' group by 1 order by 1""")
    r["hourByCategory"] = q("""select cast(substr(time,1,2) as int) as hour, category, count(*) n from t
                               where type='purchase' group by 1,2 order by 2,1""")
    r["dayOfMonth"] = q(f"""select day(d.date) dom, avg(d.purch) purchasesPerDay, avg(d.ev) everydayPerDay, avg((d.bal<0)::int) negShare
                            from daily d join cust c using(customer_id) where {MAIN} group by 1 order by 1""")
    r["billCalendar"] = q("""select type, day(date) dom, count(*) n from t
                             where type in ('salary','housing_payment','utilities_payment','investment_deposit','salary_sweep')
                             group by 1,2 order by 1,2""")
    r["monthly"] = q(f"""select m.ym, sum(m.salary) salary, sum(m.mr) mustRegular, sum(m.mi) mustIrregular, sum(m.ev) everyday,
          sum(m.saving) saving, sum(m.purchases) purchases, sum(m.purch_n) nPurchases
        from cm m join cust c using(customer_id) where {MAIN} group by 1 order by 1""")
    r["seasonal"] = q(f"""select month(date) as month, category, -sum(amount) eur from t join cust c using(customer_id)
                          where {MAIN} and type='purchase' group by 1,2 order by 2,1""")
    return r


@section("housing")
def _():
    r = {}
    x = f"from cs where {CORE} and med_housing is not null and med_salary>0"
    sh = col(f"select med_housing/med_salary {x}")
    r["share"] = pct(sh)
    r["shareHist"] = hist(sh, np.round(np.arange(0, 1.21, 0.05), 2))
    r["above40"] = float((sh > 0.4).mean())
    r["above50"] = float((sh > 0.5).mean())
    r["byShareBin"] = q(f"""select case when s<0.25 then '1: under 25%' when s<0.35 then '2: 25-35%' when s<0.45 then '3: 35-45%'
            when s<0.55 then '4: 45-55%' else '5: 55% or more' end as bin, count(*) n, avg((min_bal<0)::int) everNegative,
          avg(neg_months) negMonthsMean, median(ev/avg_salary) everydayShareOfSalary, median(end_bal-open_bal) balanceChange,
          avg((sav>0)::int) investors
        from (select *, med_housing/med_salary s {x}) group by 1 order by 1""")
    r["noHousing"] = one("select sum((not has_housing)::int) from cust")
    r["missingMonths"] = hist(col(f"select 24-housing_months from cs where {MAIN} and has_housing"), np.arange(0, 26, 1))
    r["missingMonthShare"] = one(f"select 1 - sum(housing_months)/(24.0*count(*)) from cs where {MAIN} and has_housing")
    r["monthToMonthChange"] = pct(col(f"""select abs(h/lag(h) over (partition by customer_id order by ym) - 1) from
        (select m.customer_id, m.ym, m.housing h from cm m join cust c using(customer_id) where {MAIN} and m.housing>0)"""))
    return r


@section("saving")
def _():
    r = {}
    r["investors"] = q(f"""select count(*) n, sum((sav>0)::int) investors, median(case when sav>0 then sav end) monthlyMedian,
          avg(case when sav>0 then (min_bal<0)::int end) investorsEverNegative,
          avg(case when sav=0 then (min_bal<0)::int end) nonInvestorsEverNegative from cs where {MAIN}""")[0]
    r["depositSize"] = pct(col("select -amount from t where type='investment_deposit'"))
    r["investingWhileNegative"] = q(f"""select avg(case when m.saving>0 then (m.min_bal<0)::int end) monthsWithDeposit,
          avg(case when m.saving=0 then (m.min_bal<0)::int end) monthsWithout,
          sum((m.saving>0 and m.min_bal<0)::int) n, count(distinct case when m.saving>0 and m.min_bal<0 then m.customer_id end) customers
        from cm m join cust c using(customer_id) where {MAIN}""")[0]
    r["balanceChange"] = pct(col(f"select end_bal-open_bal from cs where {MAIN}"))
    r["balanceChangeVsSalary"] = pct(col(f"select (end_bal-open_bal)/avg_salary from cs where {CORE} and avg_salary>0"))
    r["balanceChangeHist"] = hist(col(f"select (end_bal-open_bal)/avg_salary from cs where {CORE} and avg_salary>0"), np.arange(-10, 10.5, 1))
    r["balanceUp"] = one(f"select avg((end_bal>open_bal)::int) from cs where {MAIN}")
    r["openBalance"] = pct(col(f"select open_bal from cs where {MAIN}"))
    r["endBalance"] = pct(col(f"select end_bal from cs where {MAIN}"))
    r["bufferMonths"] = pct(col(f"select end_bal/nullif(mr,0) from cs where {MAIN} and mr>0"))
    r["bufferBins"] = q(f"""select case when b<0 then '0: below zero' when b<1 then '1: under 1 month' when b<3 then '2: 1-3 months'
            when b<6 then '3: 3-6 months' else '4: 6 months or more' end as bin, count(*) n
        from (select end_bal/nullif(mr,0) b from cs where {MAIN} and mr>0) group by 1 order by 1""")
    r["savingsRate"] = pct(col(f"select (avg_income-mr-mi-ev)/avg_income from cs where {CORE} and avg_income>0"))
    r["savingsRateHist"] = hist(col(f"select (avg_income-mr-mi-ev)/avg_income from cs where {CORE} and avg_income>0"), np.round(np.arange(-0.5, 0.81, 0.05), 2))
    r["spendMoreThanEarn"] = one(f"select avg((mr+mi+ev > avg_income)::int) from cs where {CORE} and avg_income>0")
    return r


@section("yoy")
def _():
    return q(f"""select type, category, sum(case when date<'2025-10-01' then abs(amount) end) y1,
          sum(case when date>='2025-10-01' then abs(amount) end) y2,
          sum(case when date<'2025-10-01' then 1 end) n1, sum(case when date>='2025-10-01' then 1 end) n2
        from t join cust c using(customer_id) where {MAIN} group by 1,2 order by 1,2""")


@section("sweep")
def _():
    r = q("""select count(*) n, median(tr/nullif(avg_salary,0)) sweptShare, median(avg_salary) salary,
             median(mr+mi+ev) visibleSpend from cs where sweep""")[0]
    r["shareOfCustomers"] = one("select avg(sweep::int) from cust")
    return r


@section("tail")
def _():
    return q("""select count(*) n, median(n_months) as activeMonths, median(avg_income) income, avg((min_bal<0)::int) everNegative,
                sum((med_salary is null)::int) noSalary from cs where cohort<>'main'""")[0]


@section("cyclesByBand")
def _():
    base = f"""from cyc y join cyc_b b using (customer_id, sal_date) join cust c using (customer_id)
               where {CORE} and y.sal_amt > 0 and y.n_days between 20 and 45"""
    sel = """count(*) cycles, median(y.sal_amt) salary, median(y.pay_bal) paydayBalance, median(b.mr) mustRegular,
        median(case when y.pay_bal>0 then (y.pay_bal-b.mr)/y.pay_bal end) freeShareOfPaydayBalance,
        avg((y.min_bal<0)::int) cyclesDippingBelowZero, median(y.min_bal) lowestBalance, median(y.ev) everyday"""
    r = {"byBand": q(f"select c.band, {sel} {base} group by 1 order by 1")}
    r["lowBuffer"] = q(f"select {sel} {base} and y.pay_bal < 1.5*y.sal_amt")[0]
    r["lowBufferShare"] = one(f"select avg((y.pay_bal < 1.5*y.sal_amt)::int) {base}")
    r["highBuffer"] = q(f"select {sel} {base} and y.pay_bal >= 1.5*y.sal_amt")[0]
    return r


@section("catByBand")
def _():
    return q(f"""select c.band, t.category, -sum(t.amount)/24.0/count(distinct c.customer_id) meanMonthly
                 from t join cust c using (customer_id) where {CORE} and t.amount<0 and t.basket not in ('saving','transfer')
                 group by 1,2 order by 1,2""")


@section("mortgage")
def _():
    r = {}
    f1 = os.path.join(RAW, "mtg_tx_customer_link_and_final_mtg_infio.csv")
    f2 = os.path.join(RAW, "mtg_negotiation_history.csv")
    con.execute(f"create table mf as select * from read_csv_auto('{f1}')")
    con.execute(f"create table mh as select * from read_csv_auto('{f2}')")
    r["n"] = one("select count(*) from mf")
    r["nEvents"] = one("select count(*) from mh")
    r["decisions"] = q("select final_decision decision, count(*) n from mf group by 1 order by 2 desc")
    r["rejectionReasons"] = q("select rejection_reason reason, count(*) n from mf where rejection_reason is not null group by 1 order by 2 desc")
    r["byDecision"] = q("""select m.final_decision decision, count(*) n, median(m.final_property_price_eur) price,
          median(m.final_requested_loan_eur) loan, median(m.final_equity_amount_eur) equity,
          median(m.final_equity_amount_eur/m.final_property_price_eur) equityShare, median(m.lfinal_loan_to_value) ltv,
          median(m.required_monthly_income_eur) requiredIncome, median(s.med_salary) salary,
          median(s.med_salary/m.required_monthly_income_eur) incomeCover, median(s.end_bal) endBalance,
          median(s.end_bal/nullif(m.final_equity_amount_eur,0)) balanceVsEquity, avg((s.min_bal<0)::int) everNegative,
          median(s.age) age, median(s.sav) investMonthly, median((s.avg_income-s.mr-s.mi-s.ev)/nullif(s.avg_income,0)) savingsRate
        from mf m join cs s using (customer_id) group by 1 order by 2 desc""")
    decs = [d["decision"] for d in r["decisions"]]
    r["ltvHist"] = {d: hist(col(f"select lfinal_loan_to_value from mf where final_decision='{d}'"), np.round(np.arange(0.4, 1.26, 0.05), 2)) for d in decs}
    r["incomeCoverHist"] = {d: hist(col(f"""select s.med_salary/m.required_monthly_income_eur from mf m join cs s using (customer_id)
                                             where m.final_decision='{d}'"""), np.round(np.arange(0, 2.51, 0.125), 3)) for d in decs}
    r["events"] = q("select event_type, count(*) n from mh group by 1 order by 2 desc")
    r["eventsPerApplication"] = pct(col("select count(*) from mh group by mortgage_customer_id"))
    r["propertiesPerApplication"] = pct(col("select count(distinct property_id) from mh group by mortgage_customer_id"))
    try:
        r["daysToDecision"] = pct(col("""select datediff('day', min(ts), max(ts)) from
            (select mortgage_customer_id, strptime(timestamp, '%d%b%y:%H:%M:%S') ts from mh) group by mortgage_customer_id"""))
    except Exception as e:
        r["daysToDecisionError"] = repr(e)[:200]
    return r


@section("cravings")
def _():
    """Everyday-extras purchases seen as individual 'cravings': how many, how big, when."""
    w = f"from t join cust c using (customer_id) where {MAIN} and t.basket='everyday' and t.type='purchase'"
    con.execute(f"create table evc as select t.customer_id, count(*)/24.0 n_m, median(-t.amount) med_amt, avg(-t.amount) avg_amt {w} group by 1")
    r = {"perMonth": pct(col("select n_m from evc")), "medianAmount": pct(col("select med_amt from evc")),
         "meanAmount": pct(col("select avg_amt from evc")), "oneAWeekPerYear": pct(col("select med_amt*52 from evc")),
         "toCoverDeepestDip": pct(col("select -s.min_bal/e.med_amt from evc e join cs s using (customer_id) where s.min_bal<0")),
         "overallMedian": one(f"select median(-t.amount) {w}"), "overallMean": one(f"select avg(-t.amount) {w}")}
    r["hour"] = q(f"select cast(substr(t.time,1,2) as int) as hour, count(*) n, -sum(t.amount) eur {w} group by 1 order by 1")
    r["byCategory"] = q(f"select t.category, count(*) n, -sum(t.amount) eur, median(-t.amount) median {w} group by 1 order by 3 desc")
    edges = [0, 5, 10, 20, 30, 50, 75, 100, 150, 250, 500]
    r["amountBuckets"] = q(f"""select b, count(*) n, -sum(t.amount) eur from (select t.*, case {' '.join(f"when -t.amount < {e} then {i}" for i, e in enumerate(edges[1:]))} else {len(edges) - 1} end b {w}) t group by 1 order by 1""")
    r["amountEdges"] = edges
    r["paydayWeekShare"] = one(f"""select sum(case when d.dsp between 0 and 4 then d.ev else 0 end)/sum(d.ev)
                                   from dd d join cust c using (customer_id) where {CORE} and d.dsp is not null""")
    r["paydayWeekDaysShare"] = one(f"select avg((d.dsp between 0 and 4)::int) from dd d join cust c using (customer_id) where {CORE} and d.dsp is not null")
    return r


@section("checks")
def _():
    r = {"basketCounts": q("select basket, count(*) n, sum(amount) total from t group by 1 order by 1")}
    try:
        from common import add_basket_column, load_tx
        df = add_basket_column(load_tx(), D)
        ref = df.group_by("basket").len().sort("basket").to_dicts()
        r["mlCommonBasketCounts"] = ref
        mine = {x["basket"]: x["n"] for x in r["basketCounts"]}
        r["matchesMlCommon"] = all(mine.get(x["basket"]) == x["len"] for x in ref) and len(ref) == len(mine)
    except Exception as e:  # ML-A may be mid-edit
        r["mlCommonError"] = repr(e)[:300]
    return r


with open(os.path.join(OUT_DIR, "eda.json"), "w") as f:
    json.dump(clean(out), f, separators=(",", ":"))
print(f"wrote {OUT_DIR}/eda.json  {os.path.getsize(os.path.join(OUT_DIR, 'eda.json')) / 1024:.0f} KB  in {time.time() - T0:.1f}s; errors: {list(out['errors'])}")
