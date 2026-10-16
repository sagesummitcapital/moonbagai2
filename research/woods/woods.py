"""Woods framework — mechanical core of the long/short trigger (Stavros's mentor, adopted 2026-10-16).

LONG (all required; short = mirror):
 (a) a 4H candle sweeps a liquidity pool: the last confirmed 4H swing low (pivot 3/3, within 60 bars), the previous day low
     or the previous week low;
 (b) the same 4H candle CLOSES back above it (SFP);
 (c) 4H RSI bullish divergence from oversold: price made a lower low than the swept low, RSI(14) made a higher low, and the
     lower of the two RSI lows is below `os` (default 35);
 (d) 1H trigger within `confirm_h` hours: a 1H higher low above the sweep low, then a 1H close above the high of the bars
     since the sweep (demand candle / break of the micro high). Enter at the next 1H open.
Stop: just past the swept wick (sweep low − buf × ATR1h), optional house minimum. Management (rule 9): take `p1` of the
position at the first pop (+tp1_r R), stop to break-even, runner to tp2_r R (or time exit). BTC anchor for ETH (rule 1): no ETH
long while BTC's last 4H close is below its 4H EMA50 (proxy for "below the reclaim level"); mirror for shorts.
Fees: taker 0.06% + 0.01% slippage on market entries/stops/time exits, maker 0.02% on targets.
"""
import json, sys
import numpy as np, pandas as pd

TAKER, MAKER, SLIP = 0.0006, 0.0002, 0.0001
D = '/home/claude/repo/research/div/data'


def load(name):
    b = json.load(open(f'{D}/{name}.json'))
    d = pd.DataFrame({k: b[k] for k in 'tohlcv'})
    d['ts'] = pd.to_datetime(d.t, unit='s', utc=True)
    d = d.set_index('ts').drop(columns='t').astype(float)
    dl = d.c.diff(); up = dl.clip(lower=0).ewm(alpha=1 / 14, adjust=False).mean(); dn = (-dl.clip(upper=0)).ewm(alpha=1 / 14, adjust=False).mean()
    d['rsi'] = 100 - 100 / (1 + up / dn)
    tr = np.maximum(d.h - d.l, np.maximum((d.h - d.c.shift()).abs(), (d.l - d.c.shift()).abs()))
    d['atr'] = tr.rolling(14).mean()
    d['ema50'] = d.c.ewm(span=50).mean()
    return d


def pools(m4, i, side, L=3):
    """Liquidity pools known at 4H bar i (before it): last confirmed swing low/high, previous day and previous week low/high."""
    out = []
    lo, hi = m4.l.values, m4.h.values
    for j in range(i - L - 1, max(L, i - 60), -1):          # confirmed pivot: j + L < i
        if side == 'long' and lo[j] == lo[j - L:j + L + 1].min(): out.append(('swing', lo[j], j)); break
        if side == 'short' and hi[j] == hi[j - L:j + L + 1].max(): out.append(('swing', hi[j], j)); break
    t = m4.index[i]
    day0 = t.floor('D'); wk0 = (t - pd.Timedelta(days=t.weekday())).floor('D')
    pd_ = m4[(m4.index >= day0 - pd.Timedelta(days=1)) & (m4.index < day0)]
    pw_ = m4[(m4.index >= wk0 - pd.Timedelta(days=7)) & (m4.index < wk0)]
    for kind, seg in (('pdl', pd_), ('pwl', pw_)):
        if len(seg):
            if side == 'long': out.append((kind, seg.l.min(), m4.index.get_loc(seg.l.idxmin())))
            else: out.append((kind.replace('l', 'h'), seg.h.max(), m4.index.get_loc(seg.h.idxmax())))
    return out


def simulate(m1, k, sg, entry, stop, cfg):
    risk = abs(entry - stop); tp1 = entry + sg * cfg.get('tp1_r', 1.0) * risk; tp2 = entry + sg * cfg.get('tp2_r', 3.0) * risk
    p1 = cfg.get('p1', 0.7); filled1 = False; cur = stop; R = 0.0
    fee_in = (TAKER + SLIP) * entry / risk
    for j in range(k, min(len(m1), k + cfg.get('hold', 72))):
        hi, lo = m1.h.iloc[j], m1.l.iloc[j]
        if (sg == 1 and lo <= cur) or (sg == -1 and hi >= cur):
            q = (1 - p1) if filled1 else 1.0
            R += q * (sg * (cur - entry) - cur * (TAKER + SLIP)) / risk
            return R - fee_in, ('be' if filled1 else 'stop'), j
        if not filled1 and ((sg == 1 and hi >= tp1) or (sg == -1 and lo <= tp1)):
            if p1 >= 1:
                return (sg * (tp1 - entry) - tp1 * MAKER) / risk - fee_in, 'tp1', j
            R += p1 * (sg * (tp1 - entry) - tp1 * MAKER) / risk; filled1 = True; cur = entry + sg * 0.0008 * entry
        if filled1 and ((sg == 1 and hi >= tp2) or (sg == -1 and lo <= tp2)):
            R += (1 - p1) * (sg * (tp2 - entry) - tp2 * MAKER) / risk
            return R - fee_in, 'tp2', j
    j = min(len(m1), k + cfg.get('hold', 72)) - 1; px = m1.c.iloc[j]
    q = (1 - p1) if filled1 else 1.0
    R += q * (sg * (px - entry) - px * (TAKER + SLIP)) / risk
    return R - fee_in, 'time', j


def run(coin, cfg, btc4=None):
    m4, m1 = load(f'{coin}_4h'), load(f'{coin}_1h')
    m4 = m4[m4.index >= m1.index[0] - pd.Timedelta(days=30)]
    out = []; busy_until = m1.index[0]
    for i in range(80, len(m4) - 1):
        t = m4.index[i]
        if t + pd.Timedelta(hours=4) <= busy_until: continue
        if t < m1.index[0]: continue
        r = m4.iloc[i]
        for side in ('long', 'short'):
            if cfg.get('side') and side != cfg['side']: continue
            sg = 1 if side == 'long' else -1
            best = None
            for kind, lvl, j in pools(m4, i, side):
                if np.isnan(lvl): continue
                swept = (r.l < lvl and r.c > lvl) if sg == 1 else (r.h > lvl and r.c < lvl)
                if not swept: continue
                if cfg.get('div', True):
                    rj, ri = m4.rsi.iloc[j], m4.rsi.iloc[i]
                    div = (ri > rj and min(ri, rj) < cfg.get('os', 35)) if sg == 1 else (ri < rj and max(ri, rj) > 100 - cfg.get('os', 35))
                    if not div: continue
                best = (kind, lvl); break
            if not best: continue
            if cfg.get('anchor') and coin != 'BTC' and btc4 is not None:
                b = btc4[btc4.index <= t]
                if len(b) and ((sg == 1 and b.c.iloc[-1] < b.ema50.iloc[-1]) or (sg == -1 and b.c.iloc[-1] > b.ema50.iloc[-1])): continue
            wick = r.l if sg == 1 else r.h
            if cfg.get('edge'):
                w = m4.iloc[max(0, i - cfg.get('rng', 180)):i]
                hi_, lo_ = w.h.max(), w.l.min()
                pos = (r.c - lo_) / (hi_ - lo_) if hi_ > lo_ else 0.5
                if (sg == 1 and pos > cfg['edge']) or (sg == -1 and pos < 1 - cfg['edge']): continue
            # (d) 1H trigger
            t0 = t + pd.Timedelta(hours=4); t1 = t0 + pd.Timedelta(hours=cfg.get('confirm_h', 12))
            seg = m1[(m1.index >= t0) & (m1.index < t1)]
            if not len(seg): continue
            k = None
            if cfg.get('ltf', True):
                ext = None
                for ts2, b1 in seg.iterrows():
                    if (sg == 1 and b1.l < wick) or (sg == -1 and b1.h > wick): break        # sweep low taken out: invalid
                    jj = m1.index.get_loc(ts2)
                    prior = m1.iloc[max(0, jj - 3):jj]
                    if len(prior) and ((sg == 1 and b1.c > prior.h.max()) or (sg == -1 and b1.c < prior.l.min())):
                        k = jj + 1; break
            else:
                k = m1.index.get_loc(seg.index[0])
            if k is None or k >= len(m1): continue
            entry = m1.o.iloc[k]; a1 = m1.atr.iloc[k - 1]
            stop = wick - sg * cfg.get('buf', 0.1) * a1
            if cfg.get('min_stop') and abs(entry - stop) < cfg['min_stop'] * entry: stop = entry - sg * cfg['min_stop'] * entry
            if sg * (entry - stop) <= 0: continue
            R, why, je = simulate(m1, k, sg, entry, stop, cfg)
            out.append(dict(coin=coin, t=t, side=side, pool=best[0], R=R, why=why, stop_pct=abs(entry - stop) / entry * 100))
            busy_until = m1.index[je]
            break
    return out


def stats(T, split):
    if not len(T): return dict(n=0)
    w = T[T.R > 0]; neg = -T[T.R <= 0].R.sum(); eq = T.sort_values('t').R.cumsum()
    h1, h2 = T[T.t < split], T[T.t >= split]
    return dict(n=len(T), win=round(100 * len(w) / len(T)), avgR=round(T.R.mean(), 3), totR=round(T.R.sum(), 1),
                pf=round(w.R.sum() / neg, 2) if neg > 0 else 99, maxDD=round((eq.cummax() - eq).max(), 1), stop=round(T.stop_pct.median(), 2),
                H1=f"{len(h1)}/{round(h1.R.mean(), 2) if len(h1) else '-'}", H2=f"{len(h2)}/{round(h2.R.mean(), 2) if len(h2) else '-'}",
                L=f"{(T.side == 'long').sum()}/{round(T[T.side == 'long'].R.mean(), 2) if (T.side == 'long').any() else '-'}",
                S=f"{(T.side == 'short').sum()}/{round(T[T.side == 'short'].R.mean(), 2) if (T.side == 'short').any() else '-'}")


if __name__ == '__main__':
    grid = json.load(open(sys.argv[1])); rows = []
    btc4 = load('BTC_4h')
    for g in grid:
        T = pd.DataFrame([x for c in g.get('coins', ['BTC', 'ETH']) for x in run(c, g, btc4)])
        r = dict(cfg=json.dumps({k: v for k, v in g.items() if k != 'dump'}), **stats(T, pd.Timestamp('2026-06-10', tz='UTC')))
        if len(T):
            for c in ('BTC', 'ETH'): s = T[T.coin == c]; r[c] = f"{len(s)}/{round(s.R.mean(), 2) if len(s) else '-'}"
        rows.append(r)
        if g.get('dump') and len(T): T.to_csv(g['dump'], index=False)
    pd.set_option('display.width', 280); pd.set_option('display.max_colwidth', 100)
    print(pd.DataFrame(rows).to_string(index=False))
