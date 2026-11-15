"""First-home readiness (ML-A step 7), ILLUSTRATIVE: n = 200 mortgage applications. Idempotent.

Applications are dated Jan-Aug 2026; applicant behaviour features come from YEAR 1 (2024-10..2025-09), i.e. strictly
before every application (no leakage). Interpretable models (standardised logistic regression; depth-2 tree for a
readable rule) are evaluated with repeated stratified 5-fold CV against the majority-class baseline.

Per customer: approved applicants with the most similar monthly income -> reachable price range, typical equity share,
gap from current savings (balance + net investment deposits seen in the data), years to close the gap at the current
saving pace, and a hypothetical approval probability for a median-price application funded with current savings.

Writes ml/home/{id}.json (MlHome) for main-cohort customers, global/modelcard-home.json
usage: ~/mlenv/bin/python ml/a_home.py
"""
import os, time
import numpy as np
import polars as pl
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.tree import DecisionTreeClassifier, export_text
from sklearn.model_selection import RepeatedStratifiedKFold, cross_val_predict, StratifiedKFold
from sklearn.metrics import roc_auc_score, accuracy_score
from common import RAW, DATA_DIR, GLOBAL_DIR, AS_OF, YEAR1, out_dir, write_json, is_tail_cohort

t0 = time.time()
m = pl.read_csv(os.path.join(RAW, "mtg_tx_customer_link_and_final_mtg_infio.csv"), encoding="utf8-lossy")
m = m.rename({c: c.lstrip("﻿") for c in m.columns}).rename({"lfinal_loan_to_value": "ltv"})   # typo in source column
F = pl.read_parquet(os.path.join(DATA_DIR, "features", "features.parquet"))
F1 = F.filter(pl.col("window") == "y1")
F2 = F.filter(pl.col("window") == "y2")
FULL = F.filter(pl.col("window") == "full")
BEH = ["income_m", "end_balance", "savings_rate", "buffer_months", "below_zero_share", "everyday_to_income", "invest_m", "housing_share"]
x = m.join(F1.select(["customer_id"] + BEH), on="customer_id", how="left").with_columns(
    (pl.col("final_collateral_value_eur") / pl.col("final_requested_loan_eur")).alias("collateral_cover"),
    (pl.col("final_equity_amount_eur") / pl.col("final_property_price_eur")).alias("equity_share"),
    (pl.col("final_requested_loan_eur") / (pl.col("income_m") * 12)).alias("loan_to_income"),
    pl.col("income_m").log().alias("log_income"),
    (pl.col("final_decision") == "approved").cast(pl.Int32).alias("y"))
MODEL_F = ["ltv", "collateral_cover", "loan_to_income", "log_income", "buffer_months", "below_zero_share", "savings_rate"]
X = x.select(MODEL_F).to_numpy().astype(float)
X = np.where(np.isnan(X), np.nanmedian(X, 0), X)
X[:, 4] = np.log1p(np.clip(X[:, 4], 0, None))
y = x["y"].to_numpy()

lr = make_pipeline(StandardScaler(), LogisticRegression(C=0.5, max_iter=2000))
tree = DecisionTreeClassifier(max_depth=2, min_samples_leaf=15, random_state=0)
rk = RepeatedStratifiedKFold(n_splits=5, n_repeats=20, random_state=0)
aucs, accs, taucs, taccs = [], [], [], []
for tr, te in rk.split(X, y):
    p = lr.fit(X[tr], y[tr]).predict_proba(X[te])[:, 1]; aucs.append(roc_auc_score(y[te], p)); accs.append(accuracy_score(y[te], p >= 0.5))
    pt = tree.fit(X[tr], y[tr]).predict_proba(X[te])[:, 1]; taucs.append(roc_auc_score(y[te], pt)); taccs.append(accuracy_score(y[te], pt >= 0.5))
cv = {"lr_auc": float(np.mean(aucs)), "lr_auc_sd": float(np.std(aucs)), "lr_acc": float(np.mean(accs)),
      "tree_auc": float(np.mean(taucs)), "tree_acc": float(np.mean(taccs)), "majority_acc": float(max(y.mean(), 1 - y.mean()))}
# ablation: application terms only vs transaction behaviour only
for name, cols in [("terms_only", [0, 1, 2]), ("behaviour_only", [3, 4, 5, 6])]:
    p = cross_val_predict(make_pipeline(StandardScaler(), LogisticRegression(C=0.5, max_iter=2000)), X[:, cols], y,
                          cv=StratifiedKFold(5, shuffle=True, random_state=0), method="predict_proba")[:, 1]
    cv[f"{name}_auc"] = float(roc_auc_score(y, p))
print("CV", {k: round(v, 3) for k, v in cv.items()})
lo95, hi95 = np.percentile(X, 5, 0), np.percentile(X, 95, 0)
lr.fit(X, y); tree.fit(X, y)
coefs = dict(zip(MODEL_F, lr[-1].coef_[0]))
rule_txt = export_text(tree, feature_names=MODEL_F, decimals=2)
print(rule_txt); print({k: round(v, 2) for k, v in coefs.items()})
# readable rule from the root split of the tree
f0, t0r = MODEL_F[tree.tree_.feature[0]], tree.tree_.threshold[0]
left_rate = tree.tree_.value[tree.tree_.children_left[0]][0]; right_rate = tree.tree_.value[tree.tree_.children_right[0]][0]
lrate = left_rate[1] / left_rate.sum(); rrate = right_rate[1] / right_rate.sum()
NICE = {"ltv": "loan-to-value", "collateral_cover": "collateral / loan", "loan_to_income": "loan / yearly income",
        "log_income": "log income", "buffer_months": "buffer", "below_zero_share": "days below zero", "savings_rate": "savings rate"}
RULE = (f"Strongest single split: {NICE[f0]} <= {t0r:.2f} -> {lrate:.0%} approved, otherwise {rrate:.0%} approved "
        f"(depth-2 tree, CV AUC {cv['tree_auc']:.2f}).")
use_prob = cv["lr_auc"] >= 0.6

app = x.filter(pl.col("y") == 1)
app_inc = app["income_m"].to_numpy(); app_price = app["final_property_price_eur"].to_numpy()
app_loan = app["final_requested_loan_eur"].to_numpy(); app_eq = app["equity_share"].to_numpy()
app_cov = app["collateral_cover"].to_numpy()
link = {r["customer_id"]: r for r in m.to_dicts()}

base = (F2.select("customer_id", "income_m", "end_balance", "savings_rate", "buffer_months", "below_zero_share", "invest_m", "invest_withdraw_m",
                  "days_below_zero", "housing_share")
        .join(FULL.select("customer_id", (pl.col("invest_m") * pl.col("months") - pl.col("invest_withdraw_m") * pl.col("months")).alias("invest_net_total")),
              on="customer_id"))
odir = out_dir("ml", "home")
CAVEAT = ("Illustrative only: learned from 200 mortgage applications in this synthetic dataset (150 approved, 50 rejected). "
          "Not a credit decision or an offer; real lending looks at much more (debts, employment, the property itself).")
n = 0
for r in base.iter_rows(named=True):
    cid = r["customer_id"]
    if is_tail_cohort(cid):
        continue
    inc = max(r["income_m"], 1.0)
    d = np.abs(np.log(app_inc / inc))
    nn = np.argsort(d)[:25]
    nn = nn[d[nn] <= np.log(1.5)] if (d[nn] <= np.log(1.5)).sum() >= 10 else nn[:10]
    pP = np.percentile(app_price[nn], [25, 50, 75]); loan50 = float(np.median(app_loan[nn])); eq = float(np.median(app_eq[nn]))
    savings = max(0.0, r["end_balance"]) + max(0.0, r["invest_net_total"] or 0)
    needed = eq * pP[1]
    gap = max(0.0, needed - savings)
    monthly_saving = (r["savings_rate"] or 0) * inc
    years = 0.0 if gap == 0 else (gap / (12 * monthly_saving) if monthly_saving > 1 else None)
    prob = None
    if use_prob:
        equity = min(savings, 0.5 * pP[1]); loan = pP[1] - equity
        xi = np.array([[loan / pP[1], float(np.median(app_cov[nn])), loan / (12 * inc), np.log(inc),
                        np.log1p(max(r["buffer_months"] or 0, 0)), r["below_zero_share"] or 0, r["savings_rate"] or 0]])
        # only inside the training support (p5..p95 of every feature): no extrapolation from 200 rows
        if np.all((xi[0] >= lo95) & (xi[0] <= hi95)):
            prob = float(lr.predict_proba(xi)[0, 1])
    blockers = []
    if gap > 0:
        blockers.append(f"Equity: about {needed:,.0f} € is typical for a {pP[1]:,.0f} € home; you have about {savings:,.0f} € visible here.".replace(",", " "))
    if (r["days_below_zero"] or 0) > 0:
        blockers.append(f"{int(r['days_below_zero'])} days below zero in the last 12 months; lenders look at a steady buffer.")
    if monthly_saving <= 1:
        blockers.append("No net saving over the last 12 months yet, so the gap is not closing.")
    if (r["housing_share"] or 0) > 0.5:
        blockers.append(f"Rent takes {100 * r['housing_share']:.0f}% of income, which leaves little room to save.")
    doc = {"id": cid, "asOf": AS_OF, "monthlyIncome": inc,
           "reachable": {"priceP25": float(pP[0]), "priceP50": float(pP[1]), "priceP75": float(pP[2]), "loanP50": loan50, "nSimilar": int(len(nn))},
           "equity": {"typicalSharePct": 100 * eq, "neededForP50": needed, "currentSavings": savings, "gap": gap,
                      "savingsNote": "Balance now plus net investment deposits seen in this account since Oct 2024 (an estimate)."},
           "monthlySavingNow": monthly_saving, "yearsToReady": years,
           "approval": {"probabilityIfAppliedNow": prob, "cvAuc": cv["lr_auc"], "cvAccuracy": cv["lr_acc"], "n": int(len(y)), "rule": RULE,
                        "baselineAccuracy": cv["majority_acc"]},
           "blockers": blockers[:3], "caveat": CAVEAT}
    if cid in link:
        L = link[cid]
        doc["linkedApplication"] = {"decision": L["final_decision"], "reason": L["rejection_reason"], "price": float(L["final_property_price_eur"]),
                                    "loan": float(L["final_requested_loan_eur"])}
    write_json(os.path.join(odir, f"{cid}.json"), doc)
    n += 1
print(f"wrote {n} home files ({time.time()-t0:.1f}s)")

write_json(os.path.join(GLOBAL_DIR, "modelcard-home.json"), {
    "key": "home", "name": "First-home readiness (illustrative)",
    "purpose": "Show what people with a similar income were approved for, how much equity that takes, and how long the gap takes to close at today's saving pace.",
    "method": f"Standardised logistic regression (C=0.5) on {', '.join(MODEL_F)}; depth-2 decision tree for a readable rule; "
              "nearest approved applicants by monthly income (10-25) for price, loan and equity share.",
    "trainedOn": f"200 mortgage applications (150 approved, 50 rejected; rejections: collateral 34, income 8, equity 6, debt 2), applicant features from {YEAR1[0]}..{YEAR1[1]}",
    "split": "Repeated stratified 5-fold CV (20 repeats). Applications are dated Jan-Aug 2026 and features end 2025-09-30, so no look-ahead.",
    "metrics": [
        {"label": "CV ROC AUC (logistic)", "model": cv["lr_auc"], "baseline": 0.5, "baselineName": "no-skill", "unit": "", "better": "higher"},
        {"label": "CV accuracy (logistic)", "model": cv["lr_acc"], "baseline": cv["majority_acc"], "baselineName": "always 'approved'", "unit": "share", "better": "higher"},
        {"label": "CV ROC AUC (depth-2 tree)", "model": cv["tree_auc"], "baseline": 0.5, "baselineName": "no-skill", "unit": "", "better": "higher"},
    ],
    "verdict": "experimental" if cv["lr_acc"] > cv["majority_acc"] else "not_better_than_baseline",
    "caveats": [CAVEAT, f"CV AUC standard deviation across folds is {cv['lr_auc_sd']:.2f}: with n=200 the numbers are noisy.",
                "The approval probability for a hypothetical application assumes the collateral cover typical of similar approved applicants, "
                "and is left empty (null) when any input falls outside the 5th-95th percentile of the 200 applications.",
                f"Some coefficients are counter-intuitive (e.g. buffer {coefs['buffer_months']:+.2f}, days below zero {coefs['below_zero_share']:+.2f} in log-odds per SD): "
                "the synthetic decisions do not follow everyday-finance logic, so show the descriptive numbers (prices, equity, gap, years) and treat the probability as a demo of the mechanism.",
                f"Ablation: application terms only AUC {cv['terms_only_auc']:.2f}, transaction behaviour only AUC {cv['behaviour_only_auc']:.2f}.",
                "Savings outside this account (and the value of investments) are not visible."],
    "coefficients": coefs, "rule": RULE, "validation": cv,
    "trainedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "trainSeconds": round(time.time() - t0, 1)})
