"""Money Map + spender tribes (ML-A step 2). Idempotent; the language-model naming is cached in DATA_DIR/cache.

Reads  features/features.parquet (window y2 = the customer's last 12 months)
Writes global/map.json (MoneyMap), global/tribes.json (Tribe[]), global/modelcard-tribes.json,
       features/map.parquet (customer_id, x, y, tribe, fit, w0..wK-1)  -> merged into profiles by a_profile.py

usage: ~/mlenv/bin/python ml/a_map.py
"""
import hashlib, json, os, time, itertools
import numpy as np
import polars as pl
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score, adjusted_rand_score
from common import DATA_DIR, GLOBAL_DIR, CACHE_DIR, AS_OF, YEAR2, out_dir, write_json, is_tail_cohort
from a_dict import FEATURES, label, unit, disp
from a_llm import ask_json

t0 = time.time()
out_dir("global"); out_dir("cache")
MAP_FEATURES = ["share_groceries", "share_restaurants", "share_transportation", "share_entertainment", "share_health",
                "share_home_tech", "share_lifestyle", "share_travel", "share_everyday", "share_must_irregular",
                "small_count_share", "weekend_share", "evening_share", "payday_burn", "volatility", "savings_rate",
                "investing_rate", "housing_share", "purchases_to_income", "below_zero_share", "buffer_months", "sweep_share",
                "n_purchases_m"]
LOG_FEATURES = {"buffer_months", "n_purchases_m"}   # heavy-tailed: signed log1p before standardising
COLORS = ["#007841", "#00A1C5", "#CF8300", "#004628", "#949494", "#00AA46", "#885600", "#006E87"]  # bank-theme colours, by tribe id (id 4 = salary-sweep tribe, neutral grey)

F = pl.read_parquet(os.path.join(DATA_DIR, "features", "features.parquet")).filter(pl.col("window") == "y2").sort("customer_id")
ids_all = F["customer_id"].to_list()
X_raw_all = F.select(MAP_FEATURES).to_numpy().astype(float)
main_mask = np.array([not is_tail_cohort(c) for c in ids_all])


def transform(X, lo=None, hi=None, mu=None, sd=None):
    X = X.copy()
    for j, k in enumerate(MAP_FEATURES):
        if k in LOG_FEATURES:
            X[:, j] = np.sign(X[:, j]) * np.log1p(np.abs(X[:, j]))
    if lo is None:
        lo, hi = np.nanpercentile(X, 1, axis=0), np.nanpercentile(X, 99, axis=0)
    X = np.clip(X, lo, hi)
    med = np.nanmedian(np.clip(X, lo, hi), axis=0)
    X = np.where(np.isnan(X), med, X)
    if mu is None:
        mu, sd = X.mean(0), X.std(0) + 1e-9
    return (X - mu) / sd, (lo, hi, mu, sd)


Z, params = transform(X_raw_all[main_mask])
Z_tail, _ = transform(X_raw_all[~main_mask], *params)
ids = [c for c, m in zip(ids_all, main_mask) if m]
X_raw = X_raw_all[main_mask]
print(f"{len(ids)} main customers x {Z.shape[1]} features")

# ---- choose k by silhouette + seed stability
rng = np.random.default_rng(0)
sil_idx = rng.choice(len(Z), size=min(5000, len(Z)), replace=False)
evidence = []
for k in range(4, 10):
    labs = [KMeans(k, n_init=4, random_state=s).fit_predict(Z) for s in range(8)]
    ari = float(np.mean([adjusted_rand_score(a, b) for a, b in itertools.combinations(labs, 2)]))
    sil = float(silhouette_score(Z[sil_idx], labs[0][sil_idx]))
    evidence.append({"k": k, "silhouette": round(sil, 4), "stabilityARI": round(ari, 4)})
    print(evidence[-1])
cands = [e for e in evidence if 5 <= e["k"] <= 8 and e["stabilityARI"] >= 0.75] or [e for e in evidence if 5 <= e["k"] <= 8]
best = max(cands, key=lambda e: e["silhouette"] + 0.1 * e["stabilityARI"])
K = best["k"]
km = KMeans(K, n_init=20, random_state=42).fit(Z)
lab = km.labels_
# order tribes by size (largest first) so ids are stable-ish and readable
order = np.argsort(-np.bincount(lab, minlength=K))
remap = {int(o): i for i, o in enumerate(order)}
lab = np.array([remap[int(l)] for l in lab])
C = km.cluster_centers_[order]

# random-labels baseline for silhouette: silhouette of a random partition is ~0 (a straw man, kept for reference)
rand_sil = float(silhouette_score(Z[sil_idx], rng.integers(0, K, len(Z))[sil_idx]))
# the fair baseline: k-means with the same k on a Gaussian with the same mean and covariance, i.e. data with no clusters at
# all. Same computation as gauss_silhouette() in ml/card_fixes.py (own rng, so the main rng stream is unchanged).
G = np.random.default_rng(1).multivariate_normal(Z.mean(0), np.cov(Z.T), len(Z))
gauss_sil = float(silhouette_score(G[sil_idx], KMeans(K, n_init=4, random_state=0).fit_predict(G)[sil_idx]))


def soft(Zx):
    d2 = ((Zx[:, None, :] - C[None, :, :]) ** 2).sum(-1)
    T = np.median(d2.min(1))  # temperature = typical squared distance to own centroid
    w = np.exp(-(d2 - d2.min(1, keepdims=True)) / T)
    return w / w.sum(1, keepdims=True), d2.argmin(1)


W, _ = soft(Z)
W_tail, lab_tail = soft(Z_tail)

# ---- UMAP picture
import umap
um = umap.UMAP(n_neighbors=30, min_dist=0.3, random_state=42, n_jobs=1)
E = um.fit_transform(Z)
E_tail = um.transform(Z_tail)
lo, hi = E.min(0), E.max(0)
norm = lambda e: np.clip((e - lo) / (hi - lo), 0, 1)
En, En_tail = norm(E), norm(E_tail)

# ---- tribe stats
all_mean = np.nanmean(X_raw, 0)
Zmean_by_t = np.array([Z[lab == t].mean(0) for t in range(K)])
tribe_stats = []
for t in range(K):
    m = lab == t
    cen = {k: float(np.nanmean(X_raw[m, j])) for j, k in enumerate(MAP_FEATURES)}
    top = np.argsort(-np.abs(Zmean_by_t[t]))[:6]
    dist = [{"feature": MAP_FEATURES[j], "label": label(MAP_FEATURES[j]), "value": disp(MAP_FEATURES[j], cen[MAP_FEATURES[j]]),
             "vsAll": disp(MAP_FEATURES[j], all_mean[j]), "z": float(Zmean_by_t[t, j])} for j in top]
    extra = F.filter(pl.col("customer_id").is_in([c for c, mm in zip(ids, m) if mm])).select(
        pl.col("income_m").median(), pl.col("purchases_m").median(), pl.col("spend_restaurants_m").median())
    tribe_stats.append({"id": t, "share": float(m.mean()), "centroid": cen, "distinctive": dist,
                        "median_income": float(extra[0, 0]), "median_purchases": float(extra[0, 1])})

# ---- name the tribes with the language model (cached)
SYSTEM = ("You name customer segments for Vara, a friendly money coach inside a Finnish bank app for young adults (18-30). "
          "Write plain, warm English. Never shame, never moralise, no stereotypes about age, gender or background. "
          "Names are 2-3 words, playful but respectful (e.g. 'Payday Sprinter', 'Steady Stacker'). Every tribe must get a different name.")
summary = []
for s in tribe_stats:
    summary.append({"tribe": s["id"], "shareOfCustomers": round(s["share"] * 100, 1),
                    "medianMonthlyIncomeEur": round(s["median_income"]),
                    "mostDistinctive": [{"feature": d["label"], "unit": unit(d["feature"]), "tribe": round(d["value"], 1),
                                         "everyone": round(d["vsAll"], 1),
                                         "direction": "higher" if d["z"] > 0 else "lower"} for d in s["distinctive"]],
                    "profile": {label(k): round(disp(k, v), 1) for k, v in s["centroid"].items()}})
user = ("Here are spender tribes found by clustering bank customers' last 12 months of behaviour (shares and rates, so "
        "not just income). Note: 'Income moved to another account' means the person sends most salary to another bank, "
        "so their spending here is mostly invisible. For EACH tribe return an object with keys: id, name, tagline (max 10 words), "
        "description (2-3 sentences, non-judgemental, describe the behaviour pattern concretely), strengths (2 short items), "
        "watchOuts (2 short items, gentle). Return ONLY a JSON array.\n\n" + json.dumps(summary, ensure_ascii=False))
key = hashlib.sha256((SYSTEM + user).encode()).hexdigest()[:16]
# The cached texts were edited by hand after generation so that they describe the tribe ("People in this tribe ...")
# and never the reader ("You ..."): a tribe average such as rent share can differ a lot from one member's own figure.
# If the cache is lost and this step calls the model again, check the new texts for the same thing.
cache_path = os.path.join(CACHE_DIR, "tribe_names.json")
cache = json.load(open(cache_path)) if os.path.exists(cache_path) else {}
if key in cache:
    names = cache[key]
    print("tribe names from cache")
else:
    names = ask_json(SYSTEM, user, max_tokens=4000)
    cache[key] = names
    json.dump(cache, open(cache_path, "w"), indent=1, ensure_ascii=False)
names = {int(n["id"]): n for n in names}

tribes = []
for s in tribe_stats:
    n = names.get(s["id"], {})
    tribes.append({"id": s["id"], "name": n.get("name", f"Tribe {s['id'] + 1}"), "tagline": n.get("tagline", ""),
                   "description": n.get("description", ""), "strengths": n.get("strengths", []), "watchOuts": n.get("watchOuts", []),
                   "share": s["share"], "color": COLORS[s["id"] % len(COLORS)],
                   "centroid": {k: disp(k, v) for k, v in s["centroid"].items()},
                   "distinctive": [{k: d[k] for k in ("feature", "label", "value", "vsAll")} for d in s["distinctive"]],
                   "medianIncome": s["median_income"]})
method = (f"UMAP(n_neighbors=30, min_dist=0.3) for the picture; KMeans k={K} (n_init=20) on {len(MAP_FEATURES)} standardised "
          f"behaviour features (shares and rates, last 12 months, clipped at p1/p99); soft mix = softmax of squared centroid distances")
feat_dict = [{"key": k, "label": label(k), "unit": unit(k)} for k in MAP_FEATURES]
write_json(os.path.join(GLOBAL_DIR, "map.json"), {
    "ids": ids, "x": [round(float(v), 4) for v in En[:, 0]], "y": [round(float(v), 4) for v in En[:, 1]],
    "tribe": [int(v) for v in lab], "tribes": tribes, "method": method, "features": feat_dict})
write_json(os.path.join(GLOBAL_DIR, "tribes.json"), tribes)

# ---- per-customer map/tribe table for profiles (main + tail)
rows = []
for c, e, t, w in itertools.chain(zip(ids, En, lab, W), zip([c for c, m in zip(ids_all, main_mask) if not m], En_tail, lab_tail, W_tail)):
    r = {"customer_id": c, "x": float(e[0]), "y": float(e[1]), "tribe": int(t), "fit": float(w.max())}
    r.update({f"w{j}": float(w[j]) for j in range(K)})
    rows.append(r)
pl.DataFrame(rows).write_parquet(os.path.join(DATA_DIR, "features", "map.parquet"))

stab = best["stabilityARI"]
verdict = "experimental"
write_json(os.path.join(GLOBAL_DIR, "modelcard-tribes.json"), {
    "key": "tribes", "name": "Money Map and spender tribes",
    "purpose": "Place every customer on a 2D map of spending behaviour and group similar behaviour into a few named tribes.",
    "method": method + ". Names and descriptions written by Claude (via Runware) from each tribe's centroid; cached.",
    "trainedOn": f"{len(ids)} main-cohort customers (CUST00001-CUST05000), window {YEAR2[0]}..{YEAR2[1]}; tail cohort projected onto the fitted map",
    "split": "Unsupervised: no target. Quality = silhouette on the standardised space and stability across 8 random seeds (mean pairwise adjusted Rand index).",
    "metrics": [
        {"label": f"Silhouette (k={K})", "model": best["silhouette"], "baseline": round(gauss_sil, 4), "baselineName": "k-means on a Gaussian with the same covariance (no clusters)", "unit": "", "better": "higher"},
        {"label": "Seed stability (ARI)", "model": stab, "baseline": 0.0, "baselineName": "chance agreement", "unit": "", "better": "higher"},
    ],
    "verdict": verdict,
    "caveats": [f"Silhouette {best['silhouette']:.2f} is {'low' if best['silhouette'] < 0.25 else 'moderate'}: behaviour in this synthetic data forms a continuum, not crisp groups. Tribes are a simplification for storytelling; the soft mix shows how much a person sits between tribes.",
                f"Even data with no clusters at all (a Gaussian with the same covariance) gives a silhouette of {gauss_sil:.2f} with k={K}, so the "
                f"structure beyond that is modest. A random partition ({rand_sil:.2f}) would be a straw man.",
                f"The number of tribes was limited to {min(e['k'] for e in cands)}-{max(e['k'] for e in cands)} for storytelling; k={K} scored best in that range. "
                f"k=4 scores higher ({next(e['silhouette'] for e in evidence if e['k'] == 4):.2f}) but was outside it.",
                "Features are shares and rates so the map is about behaviour, not income level.",
                "Salary-sweep customers (most spending in another bank) form their own region because little spending is visible.",
                "Tribe names and descriptions are generated by a language model from the statistics; reviewed for tone, not for truth beyond the numbers shown."],
    "evidence": evidence, "validation": {"randomPartitionSilhouette": rand_sil, "gaussianSilhouette": gauss_sil, "kRange": [5, 8]}, "trainedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "trainSeconds": round(time.time() - t0, 1)})
for t in tribes:
    print(t["id"], round(t["share"], 3), t["name"], "|", t["tagline"], "|", [(d["label"], round(d["value"], 1), round(d["vsAll"], 1)) for d in t["distinctive"][:4]])
print(f"done K={K} ({time.time()-t0:.1f}s)")
