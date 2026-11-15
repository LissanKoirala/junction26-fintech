# Independent ground truth for app/shared/engine/engine.test.ts (DuckDB over tx.parquet). Run: ~/mlenv/bin/python server/scripts/groundtruth.py
import duckdb, json, os
con=duckdb.connect()
con.execute(f"create view t as select * from read_parquet('{os.environ.get('DATA_DIR', os.path.expanduser('~/data'))}/tx.parquet')")
def one(s): return con.execute(s).fetchall()
A="customer_id='CUST04754'"
spend="(type in ('purchase','utilities_payment','housing_payment'))"
out={}
out['n_tx']=one(f"select count(*) from t where {A}")
out['final']=one(f"select date, balance from t where {A} order by date desc, time desc, idx desc limit 1")
out['rest_sep']=one(f"select round(sum(-amount),2), count(*) from t where {A} and category='Restaurants' and date between '2026-09-01' and '2026-09-30'")
out['rest_aug']=one(f"select round(sum(-amount),2), count(*) from t where {A} and category='Restaurants' and date between '2026-08-01' and '2026-08-31'")
out['taxi_aug']=one(f"select round(coalesce(sum(-amount),0),2), count(*) from t where {A} and mcc='4121' and date between '2026-08-01' and '2026-08-31'")
out['taxi_all']=one(f"select round(coalesce(sum(-amount),0),2), count(*) from t where {A} and mcc='4121'")
out['mika_trn_sep']=one("select round(sum(-amount),2), count(*) from t where customer_id='CUST00651' and category='Transportation' and date between '2026-09-01' and '2026-09-30'")
out['sep_spend']=one(f"select round(sum(-amount),2) from t where {A} and {spend} and date between '2026-09-01' and '2026-09-30'")
out['sep_mustreg']=one(f"""select round(sum(-amount),2) from t where {A} and date between '2026-09-01' and '2026-09-30' and (type in ('utilities_payment','housing_payment') or (category='Groceries' and coalesce(mcc,'')<>'5499') or (category='Transportation' and mcc in ('4111','5541','5542')))""")
out['housing_med6']=one(f"select round(median(-amount),3) from (select amount from t where {A} and type='housing_payment' order by date desc limit 6)")
out['util_mean_aprsep']=one(f"select round(sum(-amount)/6,3) from t where {A} and type='utilities_payment' and date between '2026-04-01' and '2026-09-30'")
out['aug_income_everyday']=one(f"""select round(sum(case when type in ('salary','other_income','investment_withdrawal') then amount else 0 end),2),
 round(sum(case when type='purchase' and category in ('Restaurants','Entertainment','Lifestyle','Travel') then -amount else 0 end),2) from t where {A} and date between '2026-08-01' and '2026-08-31'""")
out['lastweek_spend']=one(f"select round(sum(-amount),2), count(*) from t where {A} and {spend} and date between '2026-09-21' and '2026-09-27'")
out['spend_12m']=one(f"select round(sum(-amount)/12,2) from t where {A} and {spend} and date between '2025-10-01' and '2026-09-30'")
out['income_12m']=one(f"select round(sum(amount)/12,2) from t where {A} and type in ('salary','other_income','investment_withdrawal') and date between '2025-10-01' and '2026-09-30'")
out['rest_aprsep_monthly']=one(f"select round(sum(-amount)/6,3) from t where {A} and category='Restaurants' and date between '2026-04-01' and '2026-09-30'")
out['weekday_sep']=one(f"select isodow(date) wd, round(sum(-amount),2) from t where {A} and {spend} and date between '2026-09-01' and '2026-09-30' group by 1 order by 1")
out['overdraft_days']=one(f"""with d as (select unnest(generate_series(date '2025-10-01', date '2026-09-30', interval 1 day))::date dd),
eod as (select date, arg_max(balance, idx) bal from t where {A} group by date)
select count(*) from d asof join eod on d.dd >= eod.date where eod.bal < 0""")
out['groc_jul_sep']=one(f"select round(sum(-amount),2) from t where {A} and category='Groceries' and date between '2026-07-01' and '2026-09-30'")
out['sweep_customers']=one("select count(distinct customer_id) from t where type='salary_sweep'")
print(json.dumps(out, default=str, indent=0))

# everyday basket with the big-purchase rule
for cid in ['CUST04754','CUST00651']:
    thr=one(f"select greatest(150, 3*median(-amount)) from t where customer_id='{cid}' and type='purchase' and category='Home & Tech'")[0][0]
    r=one(f"""select round(sum(-amount),2) from t where customer_id='{cid}' and type='purchase' and date between '2026-08-01' and '2026-08-31'
      and not (category='Groceries' and coalesce(mcc,'')<>'5499') and not (category='Transportation' and mcc in ('4111','5541','5542'))
      and category<>'Health' and not (category='Home & Tech' and -amount>={thr})""")
    print(cid, thr, r)
print(one("select round(sum(-amount),2), count(*) from t where customer_id='CUST00651' and category='Transportation' and mcc='4121' and date between '2026-09-01' and '2026-09-30'"))
print(one("select balance from t where customer_id='CUST00651' order by date desc, time desc, idx desc limit 1"))
