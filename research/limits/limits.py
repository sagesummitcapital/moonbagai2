"""Resting limit orders at Moonbag levels — backtest (Stavros, 2026-10-12: "introduce limit orders ... really good r:r and win %").

Same idea as the market desk, entered differently:
  levels  = 4h swing lows/highs (confirmed 2 bars later), previous day and previous week low/high — all known at placement
  place   = every 4h close, per coin: long limit at the nearest untouched support below price, short at the nearest
            untouched resistance above, if the level is 0.5-3 x ATR14(1D)... from price (not on top of price, not far away)
  entry   = 'at' the level, 'front' (+0.1 x 1h ATR in front), 'deep' (0.3 x 1h ATR through it — fills only on a sweep),
            or 'ladder' (half at, half deep)
  stop    = beyond the level by 0.5 x 1h ATR, at least 0.8% (BTC/ETH/SOL) / 1.5% (alts) and 1.5 x 1h ATR from entry
            (the v16 stop rule)
  target  = the next opposite level known at placement; the order is only placed if planned R >= min_r
  expiry  = cancel after `expiry_h` hours, or as soon as price trades to the target before filling (R:R gone)
  manage  = full exit at target, or half at target + runner with stop at entry to the next level ('runner')
  filters = trend: none | with (4h EMA20 > EMA50 for longs, < for shorts) ; cooling: skip if >= 10% from the
            3-day low/high (the no-chase rule)
Fees: maker 0.02% on limit entry and target, taker 0.06% + 0.02% slippage on stops. Same-bar fill+stop = loss.
Baseline 'market': same levels, but enter at market on the first 1h close back on the right side of the level after
a touch (the current desk's validated bounce), same stop/target rules.
"""
import json, sys, itertools
import numpy as np, pandas as pd

D = '/home/claude/repo/research/limits/data'
CORE = {'BTC', 'ETH', 'SOL'}
COINS = ['BTC', 'ETH', 'SOL', 'NEAR', 'TIA', 'ENA', 'SEI', 'SUI']
MAKER, TAKER, SLIP = 0.0002, 0.0006, 0.0002


def load(c):
    b = json.load(open(f'{D}/{c}_1h.json'))
    d = pd.DataFrame({k: b[k] for k in 'tohlc'})
    d['ts'] = pd.to_datetime(d.t, unit='s')
    return d.set_index('ts').drop(columns='t').astype(float)


def prep(c):
    h = load(c)
    tr = np.maximum(h.h - h.l, np.maximum((h.h - h.c.shift()).abs(), (h.l - h.c.shift()).abs()))
    h['atr1h'] = tr.rolling(14).mean()
    d1 = h.resample('1D').agg({'o': 'first', 'h': 'max', 'l': 'min', 'c': 'last'}).dropna()
    trd = np.maximum(d1.h - d1.l, np.maximum((d1.h - d1.c.shift()).abs(), (d1.l - d1.c.shift()).abs()))
    d1['atr1d'] = trd.rolling(14).mean()
    h4 = h.resample('4h').agg({'o': 'first', 'h': 'max', 'l': 'min', 'c': 'last'}).dropna()
    h4['e20'] = h4.c.ewm(span=20).mean(); h4['e50'] = h4.c.ewm(span=50).mean()
    w1 = h.resample('W-MON', label='left', closed='left').agg({'h': 'max', 'l': 'min'}).dropna()
    # swings on 4h: index i is a swing low if lower than 2 bars each side; known at bar i+3 close
    sw = []
    for i in range(2, len(h4) - 2):
        if h4.l.iloc[i] < h4.l.iloc[i-2:i].min() and h4.l.iloc[i] <= h4.l.iloc[i+1:i+3].min():
            sw.append((h4.index[i] + pd.Timedelta(hours=12), 'S', h4.l.iloc[i]))
        if h4.h.iloc[i] > h4.h.iloc[i-2:i].max() and h4.h.iloc[i] >= h4.h.iloc[i+1:i+3].max():
            sw.append((h4.index[i] + pd.Timedelta(hours=12), 'R', h4.h.iloc[i]))
    sw = pd.DataFrame(sw, columns=['known', 'kind', 'px']).sort_values('known')
    return h, d1, h4, w1, sw


def levels_at(t, h, d1, w1, sw, lookback_days=10, src='all'):
    """Support/resistance levels known at time t, with an 'untouched since formed' flag computed from h."""
    S, R = [], []
    s = sw[(sw.known <= t) & (sw.known > t - pd.Timedelta(days=lookback_days))]
    for _, r in s.iterrows():
        if src in ('all', 'swing'): (S if r.kind == 'S' else R).append((r.px, r.known))
    day = t.normalize()
    pd_ = d1[d1.index == day - pd.Timedelta(days=1)]
    if len(pd_) and src in ('all', 'daily', 'htf'): S.append((pd_.l.iloc[0], day)); R.append((pd_.h.iloc[0], day))
    wk = w1[w1.index <= day - pd.Timedelta(days=7)].tail(1)
    if len(wk) and src in ('all', 'weekly', 'htf'): S.append((wk.l.iloc[0], wk.index[0] + pd.Timedelta(days=7))); R.append((wk.h.iloc[0], wk.index[0] + pd.Timedelta(days=7)))
    return S, R


def untouched(h, px, since, t, side):
    seg = h[(h.index >= since) & (h.index < t)]
    if not len(seg): return True
    return seg.l.min() > px if side == 'long' else seg.h.max() < px


def run(c, P, data):
    h, d1, h4, w1, sw = data
    core = c in CORE
    min_pct = 0.008 if core else 0.015
    trades, busy_until = [], h.index[0]
    places = [x for x in h4.index[60:] if x.hour % P.get('every', 4) == 0]
    idx = h.index
    for t0 in places:
        t = t0 + pd.Timedelta(hours=4)               # 4h bar closed -> place at its close
        if t <= busy_until or t not in idx: continue
        i0 = idx.get_loc(t)
        price = h.c.iloc[i0 - 1]; a1 = h.atr1h.iloc[i0 - 1]
        dd = d1[d1.index < t.normalize()].tail(1)
        if not len(dd) or np.isnan(a1) or np.isnan(dd.atr1d.iloc[0]): continue
        a1d = dd.atr1d.iloc[0]
        b4 = h4[h4.index < t0 + pd.Timedelta(hours=4)].iloc[-1]
        # cooling (no chase): 3-day range move >= 10%
        last3 = h.iloc[max(0, i0 - 72):i0]
        cooling = price >= last3.l.min() * 1.10 or price <= last3.h.max() * 0.90
        if P['cool'] and cooling: continue
        S, R = levels_at(t, h, d1, w1, sw, src=P.get('src', 'all'))
        dtr = d1[d1.index < t.normalize()]
        e50d = dtr.c.ewm(span=50).mean().iloc[-1] if len(dtr) > 20 else None
        best = None
        for side in ('long', 'short'):
            if P['trend'] == 'with':
                if side == 'long' and not b4.e20 > b4.e50: continue
                if side == 'short' and not b4.e20 < b4.e50: continue
            if P['sides'] != 'both' and side != P['sides']: continue
            if P.get('dtrend') and e50d is not None:
                if side == 'long' and price < e50d: continue
                if side == 'short' and price > e50d: continue
            pool = S if side == 'long' else R
            cand = [(px, since) for px, since in pool
                    if (side == 'long' and price - px >= P['dmin'] * a1d and price - px <= P['dmax'] * a1d)
                    or (side == 'short' and px - price >= P['dmin'] * a1d and px - price <= P['dmax'] * a1d)]
            cand = [x for x in cand if untouched(h, x[0], x[1], t, side)] if P['fresh'] else cand
            if not cand: continue
            lvl = max(cand)[0] if side == 'long' else min(cand)[0]
            sgn = 1 if side == 'long' else -1
            off = {'at': 0.0, 'front': 0.1, 'deep': -P.get('deep', 0.3)}
            entries = [lvl + sgn * off['at'] * a1, lvl + sgn * off['deep'] * a1] if P['entry'] == 'ladder' else [lvl + sgn * off[P['entry']] * a1]
            avg = float(np.mean(entries))
            stop = lvl - sgn * 0.5 * a1
            ref = min(entries) if side == 'long' else max(entries)
            need = max(min_pct * ref, 1.5 * a1)
            if abs(ref - stop) < need: stop = ref - sgn * need
            risk = abs(avg - stop)
            opp = [px for px, _ in (R if side == 'long' else S) if (px > avg + risk if side == 'long' else px < avg - risk)]
            if not opp: continue
            tgt = min(opp) if side == 'long' else max(opp)
            nxt = [px for px in opp if (px > tgt if side == 'long' else px < tgt)]
            tgt2 = (min(nxt) if side == 'long' else max(nxt)) if nxt else None
            plan_r = abs(tgt - avg) / risk
            if plan_r < P['min_r']: continue
            if P['max_r'] and plan_r > P['max_r']:
                tgt = avg + sgn * P['max_r'] * risk; plan_r = P['max_r']
            if best is None or abs(lvl - price) < abs(best['lvl'] - price):
                best = dict(side=side, lvl=lvl, entries=entries, stop=stop, tgt=tgt, tgt2=tgt2, plan_r=plan_r)
        if not best: continue
        res = simulate(h, i0, best, P)
        if res is None: continue
        res.update(coin=c, t=t, core=core); trades.append(res)
        busy_until = res['end']
    return trades


def simulate(h, i0, b, P):
    side, sgn = b['side'], (1 if b['side'] == 'long' else -1)
    exp = i0 + P['expiry_h']
    n = len(h)
    if P['mode'] == 'market':
        # touch the level, then enter at the first 1h close back on the right side (validated bounce)
        lvl = b['lvl']; touched = False
        for k in range(i0, min(n, exp)):
            hi, lo, cl = h.h.iloc[k], h.l.iloc[k], h.c.iloc[k]
            if (side == 'long' and hi >= b['tgt']) or (side == 'short' and lo <= b['tgt']):
                if not touched: return None
            if not touched and ((side == 'long' and lo <= lvl) or (side == 'short' and hi >= lvl)): touched = True
            if touched and ((side == 'long' and lo <= b['stop']) or (side == 'short' and hi >= b['stop'])): return None
            if touched and ((side == 'long' and cl > lvl) or (side == 'short' and cl < lvl)):
                entry = cl; risk = abs(entry - b['stop'])
                if risk <= 0 or abs(b['tgt'] - entry) / risk < 1.5: return None
                fills = [(entry, 1.0)]; start = k + 1; fee_in = TAKER
                return manage(h, start, side, fills, b, P, fee_in)
        return None
    # limit orders
    fills, remaining = [], list(b['entries'])
    w = 1.0 / len(b['entries'])
    for k in range(i0, min(n, exp)):
        hi, lo = h.h.iloc[k], h.l.iloc[k]
        if not fills and ((side == 'long' and hi >= b['tgt']) or (side == 'short' and lo <= b['tgt'])):
            return None  # ran to target before filling — cancel
        for e in list(remaining):
            if (side == 'long' and lo < e) or (side == 'short' and hi > e):
                fills.append((e, w)); remaining.remove(e)
        if fills:
            # stop on the fill bar = loss (conservative); manage from this bar for stop, next bar for target
            if (side == 'long' and lo <= b['stop']) or (side == 'short' and hi >= b['stop']):
                return close(fills, b['stop'], side, b, 'stop', h.index[k], MAKER, TAKER + SLIP)
            if remaining:  # keep the other rung working only until the end of this bar
                pass
            return manage(h, k + 1, side, fills, b, P, MAKER)
    return None


def close(fills, px, side, b, why, end, fee_in, fee_out):
    sgn = 1 if side == 'long' else -1
    wsum = sum(w for _, w in fills); avg = sum(e * w for e, w in fills) / wsum
    full_risk = abs(np.mean(b['entries']) - b['stop'])  # 1R = planned full-size risk
    gross = sum(w * sgn * (px - e) for e, w in fills)
    fees = sum(w * (e * fee_in + px * fee_out) for e, w in fills)
    return dict(side=side, R=(gross - fees) / full_risk, why=why, end=end, plan_r=b['plan_r'], filled=wsum, avg=avg)


def manage(h, start, side, fills, b, P, fee_in):
    sgn = 1 if side == 'long' else -1
    stop, tgt = b['stop'], b['tgt']
    n = len(h); half_done = None
    for m in range(start, n):
        hi, lo = h.h.iloc[m], h.l.iloc[m]
        if half_done is None:
            if P.get('be1') and stop == b['stop']:
                avg0 = sum(e * w for e, w in fills) / sum(w for _, w in fills); r0 = abs(avg0 - b['stop'])
                if (side == 'long' and h.h.iloc[m - 1] >= avg0 + P['be1'] * r0) or (side == 'short' and h.l.iloc[m - 1] <= avg0 - P['be1'] * r0):
                    stop = avg0 + sgn * 0.002 * avg0  # entry + fees
            if (side == 'long' and lo <= stop) or (side == 'short' and hi >= stop):
                return close(fills, stop, side, b, 'stop' if stop == b['stop'] else 'be', h.index[m], fee_in, TAKER + SLIP)
            if (side == 'long' and hi >= tgt) or (side == 'short' and lo <= tgt):
                if P['manage'] == 'runner' and b['tgt2']:
                    half_done = tgt; avg = sum(e * w for e, w in fills) / sum(w for _, w in fills); stop = avg
                    continue
                return close(fills, tgt, side, b, 'target', h.index[m], fee_in, MAKER)
        else:
            if (side == 'long' and lo <= stop) or (side == 'short' and hi >= stop):
                a = close(fills, half_done, side, b, 'target', h.index[m], fee_in, MAKER)
                z = close(fills, stop, side, b, 'be', h.index[m], fee_in, TAKER + SLIP)
                a['R'] = 0.5 * a['R'] + 0.5 * z['R']; a['why'] = 'tp1+be'; return a
            if (side == 'long' and hi >= b['tgt2']) or (side == 'short' and lo <= b['tgt2']):
                a = close(fills, half_done, side, b, 'target', h.index[m], fee_in, MAKER)
                z = close(fills, b['tgt2'], side, b, 'target2', h.index[m], fee_in, MAKER)
                a['R'] = 0.5 * a['R'] + 0.5 * z['R']; a['why'] = 'tp1+tp2'; return a
        if m - start > 24 * 14:  # 14-day safety close (there is no time stop; this only ends the simulation)
            return close(fills, h.c.iloc[m], side, b, 'open14d', h.index[m], fee_in, TAKER)
    return close(fills, h.c.iloc[n - 1], side, b, 'eod', h.index[n - 1], fee_in, TAKER)


def stats(t):
    if not len(t): return dict(n=0)
    w = t[t.R > 0]; neg = -t[t.R <= 0].R.sum()
    eq = t.sort_values('t').R.cumsum(); dd = (eq.cummax() - eq).max()
    return dict(n=len(t), win=round(100 * len(w) / len(t)), avgR=round(t.R.mean(), 3), totR=round(t.R.sum(), 1),
                pf=round(w.R.sum() / neg, 2) if neg > 0 else 99, maxDD=round(dd, 1), plan=round(t.plan_r.mean(), 2))


BASE = dict(mode='limit', entry='at', trend='none', cool=True, fresh=True, sides='both', dmin=0.3, dmax=2.0,
            min_r=2.0, max_r=None, expiry_h=48, manage='full')

if __name__ == '__main__':
    DATA = {c: prep(c) for c in COINS}
    grid = json.loads(sys.argv[1]) if len(sys.argv) > 1 else [{}]
    split = pd.Timestamp('2026-05-20')
    rows = []
    for g in grid:
        P = {**BASE, **g}
        T = pd.DataFrame([x for c in COINS for x in run(c, P, DATA[c])])
        if not len(T): print(g, 'no trades'); continue
        r = dict(cfg=json.dumps(g), **stats(T))
        for lab, sub in (('H1', T[T.t < split]), ('H2', T[T.t >= split]), ('core', T[T.core]), ('alts', T[~T.core])):
            s = stats(sub); r[lab] = f"{s.get('n',0)}/{s.get('avgR','-')}"
        rows.append(r)
        T.to_csv(f"/home/claude/repo/research/limits/last_trades.csv", index=False)
    pd.set_option('display.width', 250); pd.set_option('display.max_colwidth', 90)
    print(pd.DataFrame(rows).to_string(index=False))
