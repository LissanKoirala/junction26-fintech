"""TransactionGPT (MlTxGpt), experimental: a small decoder-only transformer trained from scratch on transaction sequences.

Tokenisation (vocabulary 511):
  prefix  [BOS] [AGE band] [INCOME bucket]
  per active day   one DAY token = (gap since previous active day: 1..7 exact, 8-13, 14+) x weekday x day-of-month bucket
  per transaction  one TX token  = category (15) x log-amount bucket (12), in time order within the day
Train on tokens dated <= 2026-06-30 (customers CUST00001-05000 except a 10% hold-out used for validation loss);
test on 2026-07-01 onwards. Amounts of sampled TX tokens are decoded by drawing one of the customer's own past
amounts in that (category, bucket) cell.

usage:  b_txgpt.py train     (budget TXGPT_MINUTES, default 22, checkpoints every 250 steps)
        b_txgpt.py eval      (next-category, perplexity vs baselines on the test period)
        b_txgpt.py gen K N   (shard K of N: per-customer files + 14-day forecast backtest rows)
        b_txgpt.py card      (merge shards, write the model card)
"""
import json
import math
import os
import sys
import time

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import b_data as B  # noqa: E402
from common import CACHE_DIR, GLOBAL_DIR, ML_DIR, load_domain, load_tx, write_json  # noqa: E402

T0 = time.time()
CATS = load_domain()["categories"]
CATS = list(CATS) if not isinstance(CATS, dict) else list(CATS.keys())
SPEND_CATS = set(B.SIM_CATS)
AMT_EDGES = np.array([2, 5, 10, 20, 35, 60, 100, 200, 400, 800, 1600])
NAB = len(AMT_EDGES) + 1
INC_EDGES = np.array([1000, 1500, 2000, 2500, 3000, 4000, 5500])
PAD, BOS = 0, 1
AGE0, INC0, DAY0 = 2, 8, 16
NDAY = 9 * 7 * 5
TX0 = DAY0 + NDAY
V = TX0 + len(CATS) * NAB
CTX = 256
TRAIN_CUT = (B.dt.date(2026, 6, 30) - B.D0).days
TEST0 = TRAIN_CUT + 1
WDIR = os.path.join(CACHE_DIR, "b_txgpt")
os.makedirs(WDIR, exist_ok=True)
CKPT = os.path.join(WDIR, "model.pt")
PERSONAS = ["CUST04754", "CUST01408", "CUST03861", "CUST01349", "CUST00651", "CUST04375"]
CFG = dict(d=192, layers=4, heads=4, ctx=CTX, vocab=V)


def log(*a):
    print(f"[{time.time()-T0:7.1f}s]", *a, flush=True)


def unseen(cid):
    return int(cid[4:]) % 10 == 7


def gap_bucket(g):
    return min(g, 7) - 1 if g <= 7 else (7 if g <= 13 else 8)


def dom_bucket(d):
    return 0 if d <= 8 else 1 if d <= 14 else 2 if d == 15 else 3 if d <= 25 else 4


def day_token(gap, di):
    return DAY0 + gap_bucket(gap) * 35 + (B.wday(di) - 1) * 5 + dom_bucket(B.dom(di))


# DAY token for "next active day is cur+g", g = 1..30, for every possible current day
DAYTAB = np.array([[day_token(g, cur + g) for g in range(1, 31)] for cur in range(0, B.ND + 40)])


# ------------------------------------------------------------------ sequences
def build_sequences():
    path = os.path.join(WDIR, "seqs.npz")
    if os.path.exists(path):
        z = np.load(path, allow_pickle=True)
        return z["data"].item()
    import polars as pl
    tx = load_tx().sort(["customer_id", "idx"])
    tx = tx.with_columns(di=(pl.col("date") - pl.lit(B.D0)).dt.total_days().cast(pl.Int32))
    cat_id = {c: i for i, c in enumerate(CATS)}
    cu = pl.read_parquet(os.path.join(B.DATA_DIR, "features", "customers.parquet"))
    ages = dict(zip(cu["customer_id"].to_list(), cu["age"].to_list()))
    out = {}
    for (cid,), g in tx.group_by(["customer_id"], maintain_order=True):
        di = g["di"].to_numpy()
        cat = np.array([cat_id[c] for c in g["category"].to_list()])
        amt = g["amount"].to_numpy()
        ab = np.searchsorted(AMT_EDGES, np.abs(amt), side="right")
        i0 = int(g["idx"][0])
        ii = g["idx"].to_numpy() - i0
        sal = amt[(g["type"].to_numpy() == "salary") & (di <= TRAIN_CUT)]
        inc = int(np.searchsorted(INC_EDGES, np.median(sal) if len(sal) else 0, side="right"))
        age = ages[cid]
        band = 0 if age <= 24 else 1 if age <= 34 else 2 if age <= 44 else 3 if age <= 54 else 4 if age <= 64 else 5
        toks, tday, tidx = [], [], []
        prev = None
        for k in range(len(di)):
            if prev is None or di[k] != prev:
                toks.append(day_token(14 if prev is None else int(di[k] - prev), int(di[k])))
                tday.append(int(di[k]))
                tidx.append(-1)
                prev = int(di[k])
            toks.append(TX0 + cat[k] * NAB + ab[k])
            tday.append(int(di[k]))
            tidx.append(int(ii[k]))
        out[cid] = dict(tok=np.array(toks, np.int16), day=np.array(tday, np.int16), idx=np.array(tidx, np.int32),
                        prefix=np.array([BOS, AGE0 + band, INC0 + inc], np.int16), amt=amt, cell=cat * NAB + ab, txday=di)
    np.savez(path, data=np.array(out, dtype=object))
    return out


# ------------------------------------------------------------------ model
def make_model():
    import torch
    import torch.nn as nn
    import torch.nn.functional as F

    class Block(nn.Module):
        def __init__(s, d, h):
            super().__init__()
            s.h = h
            s.ln1, s.ln2 = nn.LayerNorm(d), nn.LayerNorm(d)
            s.qkv, s.proj = nn.Linear(d, 3 * d), nn.Linear(d, d)
            s.fc1, s.fc2 = nn.Linear(d, 4 * d), nn.Linear(4 * d, d)

        def forward(s, x, cache=None):
            Bn, T, d = x.shape
            q, k, v = s.qkv(s.ln1(x)).split(d, 2)
            q, k, v = (t.view(Bn, T, s.h, d // s.h).transpose(1, 2) for t in (q, k, v))
            if cache is not None:
                if cache.get("k") is not None:
                    k = torch.cat([cache["k"], k], 2)
                    v = torch.cat([cache["v"], v], 2)
                cache["k"], cache["v"] = k, v
            causal = q.shape[2] == k.shape[2] and T > 1
            y = F.scaled_dot_product_attention(q, k, v, is_causal=causal)
            x = x + s.proj(y.transpose(1, 2).reshape(Bn, T, d))
            return x + s.fc2(F.gelu(s.fc1(s.ln2(x))))

    class GPT(nn.Module):
        def __init__(s, d, layers, heads, ctx, vocab):
            super().__init__()
            s.tok, s.pos = nn.Embedding(vocab, d), nn.Embedding(ctx, d)
            s.blocks = nn.ModuleList([Block(d, heads) for _ in range(layers)])
            s.ln = nn.LayerNorm(d)
            s.head = nn.Linear(d, vocab, bias=False)
            s.head.weight = s.tok.weight
            nn.init.normal_(s.tok.weight, std=0.02)
            nn.init.normal_(s.pos.weight, std=0.02)
            for b in s.blocks:
                nn.init.normal_(b.proj.weight, std=0.02 / math.sqrt(2 * layers))
                nn.init.normal_(b.fc2.weight, std=0.02 / math.sqrt(2 * layers))

        def forward(s, idx, caches=None, pos0=0):
            T = idx.shape[1]
            x = s.tok(idx) + s.pos(torch.arange(pos0, pos0 + T, device=idx.device))[None]
            for i, b in enumerate(s.blocks):
                x = b(x, None if caches is None else caches[i])
            return s.head(s.ln(x))

    return GPT(**CFG)


# ------------------------------------------------------------------ training
def batch(seqs, keys, w, bs, rng, cut=TRAIN_CUT):
    import torch
    L = CTX - 3
    X = np.zeros((bs, CTX - 1), np.int64)
    Y = np.full((bs, CTX - 1), -100, np.int64)
    for b in range(bs):
        cid = keys[rng.choice(len(keys), p=w)]
        s = seqs[cid]
        n = int((s["day"] <= cut).sum())
        st = rng.integers(0, max(1, n - L))
        win = s["tok"][st: st + L].astype(np.int64)
        full = np.concatenate([s["prefix"].astype(np.int64), win])
        X[b, : len(full) - 1] = full[:-1]
        Y[b, 2: len(full) - 1] = full[3:]
    return torch.from_numpy(X), torch.from_numpy(Y)


def train():
    import torch
    import torch.nn.functional as F
    torch.set_num_threads(int(os.environ.get("TXGPT_THREADS", "30")))
    torch.manual_seed(0)
    seqs = build_sequences()
    log("sequences", len(seqs))
    keys = [c for c in seqs if c <= "CUST05000" and not unseen(c)]
    vkeys = [c for c in seqs if c <= "CUST05000" and unseen(c)]
    n = np.array([(seqs[c]["day"] <= TRAIN_CUT).sum() for c in keys], float)
    w = n / n.sum()
    vw = np.array([(seqs[c]["day"] <= TRAIN_CUT).sum() for c in vkeys], float)
    vw = vw / vw.sum()
    model = make_model()
    nparams = sum(p.numel() for p in model.parameters())
    log("params", nparams, "train tokens", int(n.sum()))
    opt = torch.optim.AdamW(model.parameters(), lr=1e-3, weight_decay=0.05, betas=(0.9, 0.95))
    rng = np.random.default_rng(0)
    vrng = np.random.default_rng(1)
    VX = [batch(seqs, vkeys, vw, 64, vrng) for _ in range(4)]
    budget = float(os.environ.get("TXGPT_MINUTES", "22")) * 60
    bs, warm, total_guess = 64, 200, 4000
    curve, step, t0 = [], 0, time.time()
    tl = []
    while True:
        lr = 1e-3 * min(1, (step + 1) / warm) * max(0.1, 0.5 * (1 + math.cos(math.pi * min(1, step / total_guess))))
        for g in opt.param_groups:
            g["lr"] = lr
        X, Y = batch(seqs, keys, w, bs, rng)
        loss = F.cross_entropy(model(X).reshape(-1, V), Y.reshape(-1), ignore_index=-100)
        opt.zero_grad()
        loss.backward()
        torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
        opt.step()
        tl.append(loss.item())
        step += 1
        el = time.time() - t0
        if step == 20:
            spd = el / 20
            total_guess = int(budget / spd)
            log(f"{spd:.3f}s/step -> planning {total_guess} steps")
        if step % 100 == 0 or el > budget:
            model.eval()
            with torch.no_grad():
                vl = float(np.mean([F.cross_entropy(model(x).reshape(-1, V), y.reshape(-1), ignore_index=-100).item() for x, y in VX]))
            model.train()
            curve.append(dict(step=step, trainLoss=float(np.mean(tl[-100:])), valLoss=vl, seconds=round(el, 1), tokensSeen=step * bs * (CTX - 3)))
            log(curve[-1])
        if step % 250 == 0 or el > budget:
            torch.save(dict(state=model.state_dict(), cfg=CFG, step=step, curve=curve, params=nparams, seconds=el, trainTokens=int(n.sum())), CKPT + ".tmp")
            os.replace(CKPT + ".tmp", CKPT)
        if el > budget:
            break
    log("trained", step, "steps")


def load_model():
    import torch
    ck = torch.load(CKPT, weights_only=False)
    m = make_model()
    m.load_state_dict(ck["state"])
    m.eval()
    return m, ck


def tx_cat_matrix():
    import torch
    M = torch.zeros(V, len(CATS))
    for c in range(len(CATS)):
        M[TX0 + c * NAB: TX0 + (c + 1) * NAB, c] = 1
    return M


# ------------------------------------------------------------------ evaluation: next category, perplexity
def evaluate():
    import torch
    import torch.nn.functional as F
    torch.set_num_threads(int(os.environ.get("TXGPT_THREADS", "30")))
    seqs = build_sequences()
    model, ck = load_model()
    rng = np.random.default_rng(3)
    main = [c for c in seqs if c <= "CUST05000"]
    ns, nu = int(os.environ.get("TXGPT_EVAL_SEEN", "1000")), int(os.environ.get("TXGPT_EVAL_UNSEEN", "300"))
    test_ids = sorted(rng.choice([c for c in main if not unseen(c)], ns, replace=False).tolist()) + sorted([c for c in main if unseen(c)][:nu])
    # global baselines from the training period
    ntx = len(CATS) * NAB
    glob_uni = np.ones(ntx)
    glob_cat_tr = np.ones((len(CATS), len(CATS)))
    for c in main:
        if unseen(c):
            continue
        s = seqs[c]
        m = (s["day"] <= TRAIN_CUT) & (s["tok"] >= TX0)
        t = s["tok"][m] - TX0
        np.add.at(glob_uni, t, 1)
        cc = t // NAB
        np.add.at(glob_cat_tr, (cc[:-1], cc[1:]), 1)
    glob_uni /= glob_uni.sum()
    glob_cat_tr /= glob_cat_tr.sum(1, keepdims=True)
    glob_big = None
    Mcat = tx_cat_matrix()
    res = {k: [] for k in ["tf_top1", "tf_top3", "freq_top1", "freq_top3", "mk_top1", "mk_top3", "nll_tf", "nll_uni", "nll_mk", "nll_full", "unseen"]}
    bits_all = []
    for cid in test_ids:
        s = seqs[cid]
        tok = s["tok"].astype(np.int64)
        n_tr = int((s["day"] <= TRAIN_CUT).sum())
        tr = tok[:n_tr]
        trt = tr[tr >= TX0] - TX0
        cnt = np.bincount(trt, minlength=ntx).astype(float)
        uni = (cnt + 20 * glob_uni) / (cnt.sum() + 20)
        catc = np.bincount(trt // NAB, minlength=len(CATS)).astype(float) + 1e-3 * np.arange(len(CATS))[::-1]
        big = np.zeros((ntx, ntx))
        np.add.at(big, (trt[:-1], trt[1:]), 1)
        ctr = np.zeros((len(CATS), len(CATS)))
        np.add.at(ctr, (trt[:-1] // NAB, trt[1:] // NAB), 1)
        mk_cat = (ctr + 3 * glob_cat_tr) / (ctr.sum(1, keepdims=True) + 3)
        # scored chunks of the test period
        logits_rows, targets = [], []
        a = n_tr
        while a < len(tok):
            b = min(len(tok), a + 128)
            c0 = max(0, b - (CTX - 3))
            inp = np.concatenate([s["prefix"].astype(np.int64), tok[c0: b - 1]])
            with torch.no_grad():
                lg = model(torch.from_numpy(inp)[None])[0, 2:]
            sel = np.arange(c0, b) >= a
            logits_rows.append(lg[torch.from_numpy(sel)])
            targets.append(tok[c0:b][sel])
            a = b
        if not targets:
            continue
        lg = torch.cat(logits_rows)
        tg = np.concatenate(targets)
        isx = tg >= TX0
        lp_full = F.log_softmax(lg, -1)
        res["nll_full"] += (-lp_full[torch.arange(len(tg)), torch.from_numpy(tg)]).tolist()
        lgx = lg[:, TX0:]
        lpx = F.log_softmax(lgx, -1)[torch.from_numpy(isx)]
        tgx = tg[isx] - TX0
        if not len(tgx):
            continue
        res["nll_tf"] += (-lpx[torch.arange(len(tgx)), torch.from_numpy(tgx)]).tolist()
        bits_all += ((-lp_full[torch.from_numpy(isx)][torch.arange(len(tgx)), torch.from_numpy(tgx + TX0)]) / math.log(2)).tolist()
        pc = (lpx.exp() @ Mcat[TX0:]).numpy()
        tc = tgx // NAB
        r = np.argsort(-pc, 1)
        res["tf_top1"] += (r[:, 0] == tc).tolist()
        res["tf_top3"] += (r[:, :3] == tc[:, None]).any(1).tolist()
        fr = np.argsort(-catc)
        res["freq_top1"] += (tc == fr[0]).tolist()
        res["freq_top3"] += np.isin(tc, fr[:3]).tolist()
        # previous TX token for Markov (the TX token before each target in the full sequence)
        allx = tok[tok >= TX0] - TX0
        nprev = int((tok[:n_tr] >= TX0).sum())
        prevs = allx[nprev - 1: nprev - 1 + len(tgx)]
        mc = mk_cat[prevs // NAB]
        rr = np.argsort(-mc, 1)
        res["mk_top1"] += (rr[:, 0] == tc).tolist()
        res["mk_top3"] += (rr[:, :3] == tc[:, None]).any(1).tolist()
        res["nll_uni"] += (-np.log(uni[tgx])).tolist()
        rowc = big[prevs]
        p_mk = (rowc[np.arange(len(tgx)), tgx] + 5 * uni[tgx]) / (rowc.sum(1) + 5)
        res["nll_mk"] += (-np.log(p_mk)).tolist()
        res["unseen"] += [unseen(cid)] * len(tgx)
    un = np.array(res["unseen"])
    out = {}
    for sub, mask in [("all", np.ones(len(un), bool)), ("unseenCustomers", un)]:
        g = lambda k: float(np.mean(np.array(res[k])[mask]))  # noqa: E731
        out[sub] = dict(
            nextCategory=[dict(method="TransactionGPT", top1=g("tf_top1"), top3=g("tf_top3")),
                          dict(method="Customer's most frequent categories", top1=g("freq_top1"), top3=g("freq_top3")),
                          dict(method="First-order Markov chain (per customer, smoothed)", top1=g("mk_top1"), top3=g("mk_top3"))],
            perplexity=[dict(method="TransactionGPT", value=math.exp(g("nll_tf"))),
                        dict(method="Unigram (per customer, smoothed)", value=math.exp(g("nll_uni"))),
                        dict(method="Bigram Markov (per customer, smoothed)", value=math.exp(g("nll_mk")))],
            nTransactions=int(mask.sum()))
    out["fullVocabPerplexityTransformer"] = math.exp(float(np.mean(res["nll_full"])))
    out["customers"] = dict(seen=ns, unseen=nu)
    out["bitsQuantiles"] = np.quantile(np.array(bits_all), np.linspace(0, 1, 101)).tolist()
    json.dump(out, open(os.path.join(WDIR, "eval.json"), "w"))
    log(json.dumps({k: v for k, v in out.items() if k != "bitsQuantiles"}, indent=1))


# ------------------------------------------------------------------ generation
def sample_futures(model, s, t, n=200, horizon=14, gen_max=100, rng=None):
    """Sample n continuations after cut-off day t. Returns per-sample events [(day, cell, amount)] and finished flags."""
    import torch
    tok = s["tok"].astype(np.int64)
    upto = int((s["day"] <= t).sum())
    ctx_len = CTX - 3 - gen_max
    ctx = np.concatenate([s["prefix"].astype(np.int64), tok[max(0, upto - ctx_len): upto]])
    # amount decoding table: the customer's own past amounts per cell (<= t), global fallback
    m = s["txday"] <= t
    cells, amts = s["cell"][m], s["amt"][m]
    K = 32
    tab = np.zeros((len(CATS) * NAB, K))
    for c in np.unique(cells):
        a = amts[cells == c]
        tab[c] = rng.choice(a, K, replace=True)
    have = np.isin(np.arange(len(CATS) * NAB), np.unique(cells))
    for c in np.nonzero(~have)[0]:  # unseen cell: the customer's own median for that category, if any
        same = amts[(cells // NAB) == c // NAB]
        if len(same):
            tab[c] = np.median(same)
            have[c] = True
    caches = [dict() for _ in model.blocks]
    with torch.no_grad():
        lg = model(torch.from_numpy(ctx)[None], caches)[0, -1]
        for c in caches:
            c["k"] = c["k"].expand(n, -1, -1, -1).contiguous()
            c["v"] = c["v"].expand(n, -1, -1, -1).contiguous()
        logits = lg[None].expand(n, -1).clone()
        pos = len(ctx)
        cur = np.full(n, t)
        done = np.zeros(n, bool)
        events = [[] for _ in range(n)]
        g = torch.Generator().manual_seed(int(rng.integers(1 << 30)))
        for step in range(gen_max):
            mask = torch.full((n, V), float("-inf"))
            if step > 0:
                mask[:, TX0:] = 0
            dt_ = torch.from_numpy(DAYTAB[np.minimum(cur, DAYTAB.shape[0] - 1)])
            mask.scatter_(1, dt_, 0.0)
            probs = torch.softmax(logits + mask, -1)
            nxt = torch.multinomial(probs, 1, generator=g)[:, 0].numpy()
            isday = nxt < TX0
            if isday.any():
                tabc = DAYTAB[np.minimum(cur[isday], DAYTAB.shape[0] - 1)]
                match = (tabc == nxt[isday][:, None]) * rng.random(tabc.shape)
                cur[isday] = cur[isday] + 1 + match.argmax(1)
            done |= cur > t + horizon
            for i in np.nonzero(~isday & ~done)[0]:
                cell = nxt[i] - TX0
                amt = tab[cell, rng.integers(K)] if have[cell] else -float(np.sqrt(AMT_EDGES[max(0, (cell % NAB) - 1)] * AMT_EDGES[min(NAB - 2, cell % NAB)]))
                events[i].append((int(cur[i]), int(cell), float(amt)))
            if done.all():
                break
            logits = model(torch.from_numpy(nxt)[:, None], caches, pos0=pos)[:, -1]
            pos += 1
    return events, done


def spend_of(ev):
    return sum(-a for (_, c, a) in ev if CATS[c // NAB] in SPEND_CATS and a < 0)


def surprises(model, s, t, bitsq, k=5, days=60):
    import torch
    import torch.nn.functional as F
    tok = s["tok"].astype(np.int64)
    n = int((s["day"] <= t).sum())
    c0 = max(0, n - (CTX - 3))
    inp = np.concatenate([s["prefix"].astype(np.int64), tok[c0: n - 1]])
    with torch.no_grad():
        lp = F.log_softmax(model(torch.from_numpy(inp)[None])[0, 2:], -1)
    tg = tok[c0:n]
    bits = (-lp[torch.arange(len(tg)), torch.from_numpy(tg)] / math.log(2)).numpy()
    sel = np.nonzero((tg >= TX0) & (s["day"][c0:n] > t - days))[0]
    out = []
    for j in sel[np.argsort(-bits[sel])][:k]:
        gi = c0 + j
        i = int(s["idx"][gi])
        out.append(dict(i=i, date=B.i2s(int(s["day"][gi])), category=CATS[(tg[j] - TX0) // NAB], amount=float(s["amt"][i]),
                        bits=float(bits[j]), percentile=float(np.searchsorted(bitsq, bits[j]) / len(bitsq) * 100)))
    return out


def gen(shard, nshards):
    import pandas as pd
    import torch
    torch.set_num_threads(int(os.environ.get("TXGPT_GEN_THREADS", "4")))
    seqs = build_sequences()
    model, ck = load_model()
    ev = json.load(open(os.path.join(WDIR, "eval.json")))
    bitsq = np.array(ev["bitsQuantiles"])
    ids = [c for c in seqs if c <= "CUST05000"]
    ids = PERSONAS + [c for c in ids if c not in PERSONAS]
    mine = ids[shard::nshards]
    # backtest cut-offs: the LightGBM 14d test rows (first test cut-off on or after 2026-07-15) for a sample of customers
    rows = pd.read_parquet(os.path.join(CACHE_DIR, "b_rows.parquet"), columns=["customer_id", "t", "m90", "14d_y", "14d_emp10", "14d_emp50", "14d_emp90"])
    rows = rows[(rows.t >= (B.dt.date(2026, 7, 15) - B.D0).days) & (rows.t <= B.TEST_END)].sort_values("t").groupby("customer_id").head(1).set_index("customer_id")
    bt_ids = set(np.random.default_rng(5).choice(sorted(rows.index), 800, replace=False).tolist())
    odir = os.path.join(ML_DIR, "txgpt")
    os.makedirs(odir, exist_ok=True)
    bt = []
    budget = float(os.environ.get("TXGPT_GEN_MINUTES", "30")) * 60
    nw = 0
    for cid in mine:
        if time.time() - T0 > budget:
            break
        s = seqs[cid]
        rng = np.random.default_rng(int(cid[4:]))
        if cid in bt_ids:
            t = int(rows.loc[cid, "t"])
            evs, done = sample_futures(model, s, t, n=200, rng=rng)
            tot = np.array([spend_of(e) for e in evs])
            r = rows.loc[cid]
            bt.append(dict(customer_id=cid, t=t, y=float(r["14d_y"]), p10=float(np.quantile(tot, 0.1)), p50=float(np.median(tot)),
                           p90=float(np.quantile(tot, 0.9)), trailing=float(r.m90 * 14), emp10=float(r["14d_emp10"]), emp50=float(r["14d_emp50"]),
                           emp90=float(r["14d_emp90"]), truncated=float(1 - done.mean())))
        t = B.ASOF_I
        evs, done = sample_futures(model, s, t, n=200, rng=rng)
        tot = np.array([spend_of(e) for e in evs])
        futures = []
        for lab, q in [("thrifty", 0.15), ("typical", 0.5), ("spendy", 0.85)]:
            j = int(np.argmin(np.abs(tot - np.quantile(tot, q))))
            byday = {}
            for d, c, a in evs[j]:
                byday.setdefault(d, []).append(dict(category=CATS[c // NAB], amount=round(a, 2)))
            futures.append(dict(label=lab, total=float(tot[j]), days=[dict(date=B.i2s(d), events=e) for d, e in sorted(byday.items())]))
        firsts = [CATS[e[0][1] // NAB] for e in evs if e]
        vc = pd.Series(firsts).value_counts(normalize=True).head(3) if firsts else pd.Series(dtype=float)
        out = dict(id=cid, asOf=B.i2s(t), futures=futures,
                   next14=dict(p10=float(np.quantile(tot, 0.1)), p50=float(np.median(tot)), p90=float(np.quantile(tot, 0.9)), nSamples=len(tot)),
                   nextCategoryTop3=[dict(category=k, p=float(v)) for k, v in vc.items()],
                   surprises=surprises(model, s, t, bitsq),
                   spendDefinition="purchases + utilities over the 14 days after 2026-09-30; event amounts are signed (money out negative)",
                   truncatedShare=float(1 - done.mean()))
        write_json(os.path.join(odir, f"{cid}.json"), out)
        nw += 1
    pd.DataFrame(bt).to_parquet(os.path.join(WDIR, f"bt_{shard}.parquet"))
    log("shard", shard, "wrote", nw, "of", len(mine), "backtest", len(bt))


def card():
    import glob

    import lightgbm as lgb
    import pandas as pd
    import b_forecast as F
    ev = json.load(open(os.path.join(WDIR, "eval.json")))
    import torch
    ck = torch.load(CKPT, weights_only=False)
    bt = pd.concat([pd.read_parquet(p) for p in glob.glob(os.path.join(WDIR, "bt_*.parquet"))], ignore_index=True)
    # LightGBM quantile model on exactly the same (customer, cut-off) rows
    df = B.build_table()
    sub = df.merge(bt[["customer_id", "t"]], on=["customer_id", "t"])
    L = F.long_table(sub)
    L = L[L.hn == "14d"].reset_index(drop=True)
    models = {qn: lgb.Booster(model_file=os.path.join(F.MODEL_DIR, f"forecast_{qn}.txt")) for qn in F.QN}
    for m in models.values():
        m.best_iteration = 0
    P = F.predict(models, L)
    L["lg10"], L["lg50"], L["lg90"] = P[:, 0], P[:, 2], P[:, 4]
    j = bt.merge(L[["customer_id", "t", "lg10", "lg50", "lg90"]], on=["customer_id", "t"])
    y = j.y.values
    f14 = [dict(method="TransactionGPT (200 sampled futures)", mae=float(np.mean(np.abs(y - j.p50))), coverage80=float(np.mean((y >= j.p10) & (y <= j.p90)))),
           dict(method="LightGBM quantile model", mae=float(np.mean(np.abs(y - j.lg50))), coverage80=float(np.mean((y >= j.lg10) & (y <= j.lg90)))),
           dict(method="Trailing 90-day average x 14", mae=float(np.mean(np.abs(y - j.trailing))), coverage80=None),
           dict(method="Empirical quantiles of own past 14-day windows", mae=float(np.mean(np.abs(y - j.emp50))), coverage80=float(np.mean((y >= j.emp10) & (y <= j.emp90))))]
    nfiles = len(glob.glob(os.path.join(ML_DIR, "txgpt", "*.json")))
    a = ev["all"]
    nc = {r["method"]: r for r in a["nextCategory"]}
    pp = {r["method"]: r["value"] for r in a["perplexity"]}
    mk = "First-order Markov chain (per customer, smoothed)"
    metrics = [
        dict(label="Next-category top-1 accuracy (test, Jul-Sep 2026)", model=nc["TransactionGPT"]["top1"], baseline=nc[mk]["top1"], baselineName="first-order Markov chain", unit="", better="higher"),
        dict(label="Next-category top-3 accuracy", model=nc["TransactionGPT"]["top3"], baseline=nc["Customer's most frequent categories"]["top3"], baselineName="customer's most frequent categories", unit="", better="higher"),
        dict(label="Perplexity of the next transaction token (category x amount bucket)", model=pp["TransactionGPT"], baseline=pp["Bigram Markov (per customer, smoothed)"], baselineName="bigram Markov", unit="", better="lower"),
        dict(label="14-day spending forecast, MAE of the median", model=f14[0]["mae"], baseline=f14[1]["mae"], baselineName="LightGBM quantile model", unit="EUR", better="lower"),
        dict(label="14-day spending forecast, MAE of the median", model=f14[0]["mae"], baseline=f14[2]["mae"], baselineName="trailing 90-day average", unit="EUR", better="lower"),
        dict(label="14-day spending forecast, coverage of the 10-90% band", model=f14[0]["coverage80"] * 100, baseline=f14[1]["coverage80"] * 100, baselineName="LightGBM quantile model (nominal 80%)", unit="%", better="higher"),
    ]
    beats_fc = f14[0]["mae"] < f14[1]["mae"]
    verdict = "experimental" if beats_fc else "not_better_than_baseline"
    out = dict(
        key="txgpt", name="TransactionGPT (experimental)",
        purpose="A small transformer that has read every customer's transaction history and imagines plausible next two weeks.",
        method=f"Decoder-only transformer ({ck['params']/1e6:.2f} M parameters, {CFG['layers']} layers, d={CFG['d']}, {CFG['heads']} heads, context {CTX}) "
               f"trained from scratch on CPU for {ck['seconds']/60:.0f} min. One DAY token per active day (gap x weekday x day-of-month bucket) and one "
               "TX token per transaction (category x log-amount bucket), after an age/income prefix. Futures are 200 sampled continuations; "
               "amounts are drawn from the customer's own past amounts in the sampled cell.",
        trainedOn=f"{ck['trainTokens']:,} tokens dated 2024-10-01..2026-06-30 from 4,500 customers (10% hold-out for validation loss)",
        split=f"Time split: train <= 2026-06-30, test 2026-07-01..2026-09-30 ({ev['customers']['seen']:,} seen + {ev['customers']['unseen']} never-seen customers for token metrics; "
              f"{len(j)} customers for the 14-day forecast backtest at their first LightGBM test cut-off on or after 2026-07-15).",
        metrics=metrics, verdict=verdict,
        caveats=["Experimental: shown as 'imagined futures', not as a prediction to act on.",
                 "The transformer knows the date (DAY tokens) while the Markov baselines do not; that is part of the comparison.",
                 "Amounts are bucketed (12 log buckets), so perplexity is over category x bucket, not exact euros.",
                 "Surprises are the recent real transactions the model gave the lowest probability: a learned second opinion, not fraud detection."],
        trainedAt=time.strftime("%Y-%m-%dT%H:%M:%S"), trainSeconds=round(ck["seconds"], 1),
        validation=dict(unseenCustomers=ev["unseenCustomers"], fullVocabPerplexity=ev["fullVocabPerplexityTransformer"],
                        forecastTruncatedShare=float(j.truncated.mean())),
        evidence=dict(trainingCurve=ck["curve"], nextCategory=a["nextCategory"], perplexity=a["perplexity"], forecast14d=f14,
                      params=dict(parameters=ck["params"], layers=CFG["layers"], dModel=CFG["d"], heads=CFG["heads"], context=CTX, vocabulary=V,
                                  vocabParts=dict(special=2, age=6, income=8, day=NDAY, tx=len(CATS) * NAB), steps=ck["step"],
                                  trainingSeconds=round(ck["seconds"], 1), trainTokens=ck["trainTokens"], device="CPU (32 cores)"),
                      splits=dict(train="tokens <= 2026-06-30", test="2026-07-01..2026-09-30", tokenMetricTransactions=a["nTransactions"],
                                  forecastBacktestCustomers=len(j)),
                      files=nfiles))
    write_json(os.path.join(GLOBAL_DIR, "modelcard-txgpt.json"), out)
    log("card", verdict, f14, "files", nfiles)


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "train"
    if cmd == "seqs":
        build_sequences()
    elif cmd == "train":
        train()
    elif cmd == "eval":
        evaluate()
    elif cmd == "gen":
        gen(int(sys.argv[2]), int(sys.argv[3]))
    elif cmd == "card":
        card()
