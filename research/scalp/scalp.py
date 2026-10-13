"""Scalp research (Stavros, 2026-10-13): "smaller time frames - smaller scalps - higher lev is ok ... what about higher time
frame like 1h or 4h and using 15m for entry? ... figure out what a positive r:r strategy is and improve it weekly".

Bias on 4h/1h, entry and stop on 15m. BINANCE perps BTC/ETH/SOL, 15m bars 2026-08-01 -> 2026-10-13 (the TradingView
intraday limit), plus the same rules on 1h bars Jan-Oct for a longer check where noted.

Setups (all enter at the OPEN of the bar after the 15m trigger bar closes = a market order; no look-ahead):
  tpb   trend pullback: 4h EMA20>EMA50 and 1h close>1h EMA50 (longs; mirror for shorts); a 15m bar dips to the 15m EMA20
        and closes back above it and above the prior bar's high (shorts mirrored)
  swp   sweep & reclaim: a 15m bar trades through a 1h swing low/high (last 48h), the previous day's low/high or the Asia
        session (00-07 UTC) low/high and CLOSES back inside; optional 4h-trend filter
  orb   New York open range: the 13:30-14:00 UTC range; first 15m close outside it, in the 4h-trend direction
Stop: beyond the trigger structure (tpb: lowest low of the last 5 bars; swp: the sweep wick; orb: other side of the range)
      plus 0.1 x ATR14(15m), at least `min_stop` (fraction of price).
Target: `tp_r` x risk (maker, limit). Optional break-even at `be_r`. Time stop: `max_bars` 15m bars (then market close).
Fees: taker 0.06% + 0.01% slippage on market entry/stop/time exit, maker 0.02% on the target. Same-bar stop+target = stop.
Session: `hours` = 'his' (12-22 UTC = 5 AM-3 PM Phoenix, weekdays) or 'all'.
"""
import json, sys
import numpy as np, pandas as pd

D = '/home/claude/repo/research/scalp/data'
TAKER, MAKER, SLIP = 0.0006, 0.0002, 0.0001
FEES = 1.0


def load(c, tf='15m'):
    b = json.load(open(f'{D}/{c}_{tf}.json'))
    d = pd.DataFrame({k: b[k] for k in 'tohlc'}); d['ts'] = pd.to_datetime(d.t, unit='s')
    return d.set_index('ts').drop(columns='t').astype(float)


def prep(c):
    m = load(c)
    tr = np.maximum(m.h - m.l, np.maximum((m.h - m.c.shift()).abs(), (m.l - m.c.shift()).abs()))
    m['atr'] = tr.rolling(14).mean(); m['e20'] = m.c.ewm(span=20).mean()
    h1 = m.resample('1h').agg({'o': 'first', 'h': 'max', 'l': 'min', 'c': 'last'}).dropna()
    h1['e50'] = h1.c.ewm(span=50).mean()
    h4 = m.resample('4h').agg({'o': 'first', 'h': 'max', 'l': 'min', 'c': 'last'}).dropna()
    h4['e20'] = h4.c.ewm(span=20).mean(); h4['e50'] = h4.c.ewm(span=50).mean()
    # map the last CLOSED 1h / 4h bar onto each 15m bar (bar index is the open time; it closes 1h/4h later)
    m['h1_up'] = (h1.c > h1.e50).shift(1).reindex(m.index, method='ffill')
    t4 = (h4.e20 > h4.e50).astype(float) - (h4.e20 < h4.e50).astype(float)
    m['h4_tr'] = t4.shift(1).reindex(m.index, method='ffill')
    # 1h swing levels (fractal 2/2, known 2h after the swing bar closes)
    sl, sh = [], []
    for i in range(2, len(h1) - 2):
        if h1.l.iloc[i] < h1.l.iloc[i-2:i].min() and h1.l.iloc[i] <= h1.l.iloc[i+1:i+3].min(): sl.append((h1.index[i] + pd.Timedelta(hours=3), h1.l.iloc[i]))
        if h1.h.iloc[i] > h1.h.iloc[i-2:i].max() and h1.h.iloc[i] >= h1.h.iloc[i+1:i+3].max(): sh.append((h1.index[i] + pd.Timedelta(hours=3), h1.h.iloc[i]))
    d1 = m.resample('1D').agg({'h': 'max', 'l': 'min'})
    return dict(m=m, sl=sl, sh=sh, d1=d1)


def in_hours(ts, hours):
    if hours == 'all': return True
    return ts.weekday() < 5 and 12 <= ts.hour < 22


def monday_range(P, t):
    """This week's Monday high/low (UTC day), known once Monday has closed (Tuesday 00:00 onward)."""
    day = t.normalize(); mon = day - pd.Timedelta(days=day.weekday())
    if t < mon + pd.Timedelta(days=1): return None
    d = P['d1'][P['d1'].index == mon]
    return (d.l.iloc[0], d.h.iloc[0]) if len(d) else None


def levels(P, t, src='all'):
    """Support / resistance known at t: 1h swings of the last 48h, previous day low/high, today's Asia low/high (after 07 UTC),
    and this week's Monday low/high. src: all | monday (Monday range only) | no_monday."""
    S, R = [], []
    if src != 'monday':
        S = [p for k, p in P['sl'] if t - pd.Timedelta(hours=48) < k <= t]
        R = [p for k, p in P['sh'] if t - pd.Timedelta(hours=48) < k <= t]
        day = t.normalize(); pdv = P['d1'][P['d1'].index == day - pd.Timedelta(days=1)]
        if len(pdv): S.append(pdv.l.iloc[0]); R.append(pdv.h.iloc[0])
        if t.hour >= 7:
            asia = P['m'][(P['m'].index >= day) & (P['m'].index < day + pd.Timedelta(hours=7))]
            if len(asia): S.append(asia.l.min()); R.append(asia.h.max())
    if src != 'no_monday':
        mr = monday_range(P, t)
        if mr: S.append(mr[0]); R.append(mr[1])
    return S, R


def signals(c, P, cfg):
    m = P['m']; out = []
    idx = m.index; n = len(m)
    for i in range(60, n - 1):
        t = idx[i] + pd.Timedelta(minutes=15)           # bar i has closed
        if not in_hours(t, cfg['hours']): continue
        r = m.iloc[i]; p = m.iloc[i - 1]; a = r.atr
        if np.isnan(a): continue
        tr4 = r.h4_tr; up1 = bool(r.h1_up) if not pd.isna(r.h1_up) else None
        sig = None
        if cfg['setup'] == 'tpb':
            if tr4 == 1 and up1 and r.l <= r.e20 and r.c > r.e20 and r.c > p.h:
                sig = ('long', m.l.iloc[i-4:i+1].min() - 0.1 * a)
            elif tr4 == -1 and up1 is False and r.h >= r.e20 and r.c < r.e20 and r.c < p.l:
                sig = ('short', m.h.iloc[i-4:i+1].max() + 0.1 * a)
        elif cfg['setup'] == 'swp':
            S, R = levels(P, t, cfg.get('src', 'all'))
            for lv in S:
                if r.l < lv and r.c > lv and (cfg['trend'] == 'none' or tr4 == 1) and (cfg['trend'] != 'both' or up1):
                    sig = ('long', r.l - 0.1 * a, lv); break
            if not sig:
                for lv in R:
                    if r.h > lv and r.c < lv and (cfg['trend'] == 'none' or tr4 == -1) and (cfg['trend'] != 'both' or up1 is False):
                        sig = ('short', r.h + 0.1 * a, lv); break
        elif cfg['setup'] == 'orb':
            day = t.normalize(); o0, o1 = day + pd.Timedelta(hours=13, minutes=30), day + pd.Timedelta(hours=14)
            if t <= o1 or t > day + pd.Timedelta(hours=17): continue
            if out and out[-1]['t'].normalize() == day: continue
            rng = m[(idx >= o0) & (idx < o1)]
            if len(rng) < 2: continue
            hi, lo = rng.h.max(), rng.l.min()
            if r.c > hi and p.c <= hi and tr4 == 1: sig = ('long', lo - 0.1 * a)
            elif r.c < lo and p.c >= lo and tr4 == -1: sig = ('short', hi + 0.1 * a)
        if sig: out.append(dict(i=i, t=t, side=sig[0], stop=sig[1], lvl=sig[2] if len(sig) > 2 else None))
    return out


def simulate(c, P, cfg):
    m = P['m']; n = len(m); trades = []; busy = -1
    for s in signals(c, P, cfg):
        i = s['i']
        if i < busy: continue
        k = i + 1
        if k >= n: break
        side = s['side']; sg = 1 if side == 'long' else -1; fee_in = TAKER + SLIP
        if cfg.get('entry') == 'retest' and s.get('lvl') is not None:
            # resting limit back at the swept level (maker); valid `retest_bars` bars; cancelled if the target trades first
            entry = s['lvl']; filled = None
            pre_risk = max(sg * (entry - s['stop']), cfg['min_stop'] * entry)
            pre_tgt = entry + sg * cfg['tp_r'] * pre_risk
            for j in range(k, min(n, k + cfg.get('retest_bars', 8))):
                if (sg == 1 and m.h.iloc[j] >= pre_tgt) or (sg == -1 and m.l.iloc[j] <= pre_tgt): break
                if (sg == 1 and m.l.iloc[j] <= entry) or (sg == -1 and m.h.iloc[j] >= entry): filled = j; break
            if filled is None: busy = k + 1; continue
            k = filled; fee_in = MAKER
        else:
            entry = m.o.iloc[k]
        stop = s['stop']; risk = sg * (entry - stop)
        if risk <= 0: continue
        if risk < cfg['min_stop'] * entry:
            risk = cfg['min_stop'] * entry; stop = entry - sg * risk
        if cfg.get('max_stop') and risk > cfg['max_stop'] * entry: continue
        tgt = entry + sg * cfg['tp_r'] * risk; cur = stop; res = None
        for j in range(k, min(n, k + cfg['max_bars'])):
            hi, lo = m.h.iloc[j], m.l.iloc[j]
            if (sg == 1 and lo <= cur) or (sg == -1 and hi >= cur):
                res = (cur, TAKER + SLIP, 'stop' if cur == stop else 'be', j); break
            if (sg == 1 and hi >= tgt) or (sg == -1 and lo <= tgt):
                res = (tgt, MAKER, 'target', j); break
            if cfg.get('be_r') and cur == stop and ((sg == 1 and hi >= entry + cfg['be_r'] * risk) or (sg == -1 and lo <= entry - cfg['be_r'] * risk)):
                cur = entry + sg * 0.0008 * entry
        if res is None:
            j = min(n - 1, k + cfg['max_bars'] - 1); res = (m.c.iloc[j], TAKER + SLIP, 'time', j)
        px, fee_out, why, j = res
        R = (sg * (px - entry) - cfg.get('fees', 1.0) * (entry * fee_in + px * fee_out)) / risk
        trades.append(dict(coin=c, t=s['t'], side=side, R=R, why=why, stop_pct=100 * risk / entry, bars=j - k + 1))
        busy = j + 1
    return trades


def stats(t):
    if not len(t): return dict(n=0)
    w = t[t.R > 0]; neg = -t[t.R <= 0].R.sum()
    eq = t.sort_values('t').R.cumsum(); dd = (eq.cummax() - eq).max()
    weeks = max(1, (t.t.max() - t.t.min()).days / 7)
    return dict(n=len(t), per_wk=round(len(t) / weeks, 1), win=round(100 * len(w) / len(t)), avgR=round(t.R.mean(), 3),
                totR=round(t.R.sum(), 1), pf=round(w.R.sum() / neg, 2) if neg > 0 else 99, maxDD=round(dd, 1),
                stop=round(t.stop_pct.mean(), 2), hold_h=round(t.bars.mean() / 4, 1))


BASE = dict(setup='tpb', hours='his', trend='h4', min_stop=0.004, max_stop=None, tp_r=2.0, be_r=None, max_bars=24)
COINS = ['BTC', 'ETH', 'SOL']

if __name__ == '__main__':
    DATA = {c: prep(c) for c in COINS}
    grid = json.loads(sys.argv[1])
    split = pd.Timestamp('2026-09-06')
    rows = []
    for g in grid:
        cfg = {**BASE, **g}
        T = pd.DataFrame([x for c in COINS for x in simulate(c, DATA[c], cfg)])
        if not len(T): rows.append(dict(cfg=json.dumps(g), n=0)); continue
        r = dict(cfg=json.dumps(g), **stats(T))
        for lab, sub in (('H1', T[T.t < split]), ('H2', T[T.t >= split]), ('BTC', T[T.coin == 'BTC']), ('ETH', T[T.coin == 'ETH']), ('SOL', T[T.coin == 'SOL'])):
            s = stats(sub); r[lab] = f"{s.get('n', 0)}/{s.get('avgR', '-')}"
        rows.append(r)
        if len(grid) == 1: T.to_csv('/home/claude/repo/research/scalp/last_trades.csv', index=False)
    pd.set_option('display.width', 260); pd.set_option('display.max_colwidth', 70)
    print(pd.DataFrame(rows).to_string(index=False))
