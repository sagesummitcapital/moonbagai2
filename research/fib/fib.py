"""Fib retracement limit plays (Stavros, 2026-10-15: "i think .75 fib levels are great plays - please test").

Leg: a confirmed swing low -> swing high (up-leg; mirror for down-leg) from pivots with L/R bars (confirmed R bars after
the high, so no look-ahead). Leg size must be >= min_atr x ATR(14).
Entry: a resting LIMIT at the retracement level f (0.75 = 75% of the leg given back), placed when the leg is confirmed,
valid until expiry bars or until price makes a new extreme beyond the leg (then the leg is re-drawn).
Stop: beyond the leg origin (1.0) + buf x ATR (option: at 0.886). Target: the leg extreme (0.0) or an extension (-0.272),
or a fixed R. Fees: maker 0.02% on the limit entry and target, taker 0.06% + 0.01% slippage on stops and time exits.
Compared against 0.5 / 0.618 / 0.705 / 0.786 to see whether 0.75 is special.
"""
import json, sys
import numpy as np, pandas as pd

TAKER, MAKER, SLIP = 0.0006, 0.0002, 0.0001
DIV = '/home/claude/repo/research/div/data'
LIM = '/home/claude/repo/research/limits/data'


def load(path):
    b = json.load(open(path))
    d = pd.DataFrame({k: b[k] for k in 'tohlcv'})
    d['ts'] = pd.to_datetime(d.t, unit='s', utc=True)
    d = d.set_index('ts').drop(columns='t').astype(float)
    tr = np.maximum(d.h - d.l, np.maximum((d.h - d.c.shift()).abs(), (d.l - d.c.shift()).abs()))
    d['atr'] = tr.rolling(14).mean()
    d['ema200'] = d.c.ewm(span=200).mean()
    return d


def pivots(d, L, R):
    h, l = d.h.values, d.l.values; n = len(d); P = []
    for i in range(L, n - R):
        if h[i] == h[i - L:i + R + 1].max(): P.append((i, 'H', h[i]))
        if l[i] == l[i - L:i + R + 1].min(): P.append((i, 'L', l[i]))
    return P


def run(d, coin, cfg):
    L, R = cfg.get('L', 5), cfg.get('R', 5)
    f = cfg['f']
    P = pivots(d, L, R)
    out = []
    busy = -1
    # walk pivots in order; a leg = last opposite pivot -> this pivot
    lastL = lastH = None
    for (i, kind, px) in sorted(P, key=lambda x: x[0]):
        conf = i + R                          # the moment the pivot is known
        if kind == 'H':
            if lastL is not None and lastL[0] < i:
                lo_i, lo = lastL; hi = px
                side = 'long'
                legs = [(lo_i, i, lo, hi)]
            else:
                legs = []
            lastH = (i, px)
        else:
            if lastH is not None and lastH[0] < i:
                hi_i, hi = lastH; lo = px
                side = 'short'
                legs = [(hi_i, i, hi, lo)]
            else:
                legs = []
            lastL = (i, px)
        for (a_i, b_i, A, B) in legs:          # A = origin (1.0), B = extreme (0.0)
            if conf <= busy or conf + 1 >= len(d): continue
            atr = d.atr.iloc[conf]
            size = abs(B - A)
            if not atr or size < cfg.get('min_atr', 3) * atr: continue
            if cfg.get('max_atr') and size > cfg['max_atr'] * atr: continue
            sg = 1 if side == 'long' else -1
            if cfg.get('trend') and ((sg == 1) != (d.c.iloc[conf] > d.ema200.iloc[conf])): continue
            entry = B - sg * f * size
            stop = (B - sg * cfg.get('stop_f', 1.0) * size) - sg * cfg.get('buf', 0.25) * atr
            if cfg.get('tp_r'): tgt = entry + sg * cfg['tp_r'] * abs(entry - stop)
            else: tgt = B - sg * cfg.get('tgt_f', 0.0) * size      # 0.0 = back to the extreme, -0.272 = extension
            # wait for the fill
            k = None
            for j in range(conf + 1, min(len(d), conf + 1 + cfg.get('expiry', 48))):
                hj, lj = d.h.iloc[j], d.l.iloc[j]
                if (sg == 1 and hj > B) or (sg == -1 and lj < B): break          # new extreme first: leg re-drawn
                if (sg == 1 and lj <= entry) or (sg == -1 and hj >= entry):
                    k = j; break
            if k is None: continue
            risk = abs(entry - stop)
            res = None
            for j in range(k, min(len(d), k + cfg.get('hold', 72))):
                hj, lj = d.h.iloc[j], d.l.iloc[j]
                # the fill bar: assume the worst — if the stop is also inside the fill bar, stopped
                if (j > k or not cfg.get('optimistic')) and ((sg == 1 and lj <= stop) or (sg == -1 and hj >= stop)):
                    res = ((sg * (stop - entry) - entry * MAKER - stop * (TAKER + SLIP)) / risk, 'stop', j); break
                if j > k and ((sg == 1 and hj >= tgt) or (sg == -1 and lj <= tgt)):
                    res = ((sg * (tgt - entry) - entry * MAKER - tgt * MAKER) / risk, 'target', j); break
            if res is None:
                j = min(len(d), k + cfg.get('hold', 72)) - 1; px = d.c.iloc[j]
                res = ((sg * (px - entry) - entry * MAKER - px * (TAKER + SLIP)) / risk, 'time', j)
            out.append(dict(coin=coin, t=d.index[conf], side=side, R=res[0], why=res[1], plan=abs(tgt - entry) / risk))
            busy = res[2]
    return out


def stats(T, split):
    if not len(T): return dict(n=0)
    w = T[T.R > 0]; neg = -T[T.R <= 0].R.sum(); eq = T.sort_values('t').R.cumsum()
    h1, h2 = T[T.t < split], T[T.t >= split]
    return dict(n=len(T), win=round(100 * len(w) / len(T)), avgR=round(T.R.mean(), 3), totR=round(T.R.sum(), 1),
                pf=round(w.R.sum() / neg, 2) if neg > 0 else 99, maxDD=round((eq.cummax() - eq).max(), 1), plan=round(T.plan.mean(), 2),
                H1=f"{len(h1)}/{round(h1.R.mean(), 2) if len(h1) else '-'}", H2=f"{len(h2)}/{round(h2.R.mean(), 2) if len(h2) else '-'}",
                L=f"{(T.side == 'long').sum()}/{round(T[T.side == 'long'].R.mean(), 2) if (T.side == 'long').any() else '-'}",
                S=f"{(T.side == 'short').sum()}/{round(T[T.side == 'short'].R.mean(), 2) if (T.side == 'short').any() else '-'}")


DATA = {}
def data(tf, coins):
    for c in coins:
        if (tf, c) in DATA: continue
        if tf == '1h8': DATA[(tf, c)] = load(f'{LIM}/{c}_1h.json')
        else: DATA[(tf, c)] = load(f'{DIV}/{c}_{tf}.json')
    return [(c, DATA[(tf, c)]) for c in coins]


if __name__ == '__main__':
    grid = json.load(open(sys.argv[1]))
    rows = []
    for g in grid:
        tf = g.get('tf', '1h8')
        coins = g.get('coins', ['BTC', 'ETH', 'SOL', 'NEAR', 'TIA', 'ENA', 'SEI', 'SUI'] if tf == '1h8' else ['BTC', 'ETH'] if tf != '15m' else ['BTC'])
        T = pd.DataFrame([x for c, d in data(tf, coins) for x in run(d, c, g)])
        split = pd.Timestamp(g.get('split', '2026-05-20' if tf in ('1h8', '4h', '1h') else '2026-09-07'), tz='UTC')
        r = dict(cfg=json.dumps({k: v for k, v in g.items() if k != 'dump'}), **stats(T, split))
        if len(T):
            core = T[T.coin.isin(['BTC', 'ETH', 'SOL'])]; r['core'] = f"{len(core)}/{round(core.R.mean(), 2) if len(core) else '-'}"
        rows.append(r)
        if g.get('dump') and len(T): T.to_csv(g['dump'], index=False)
    pd.set_option('display.width', 260); pd.set_option('display.max_colwidth', 90)
    print(pd.DataFrame(rows).to_string(index=False))
