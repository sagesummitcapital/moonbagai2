"""Strategy ideas from X, 2026-10-14 (Stavros: "don't blindly change anything live — backtest and layer in what makes sense").

Idea A — "Day trading plan": VWAP pullback / break & retest with the trend, volume expansion on entry, stop below VWAP /
         last higher low, 50% off at 1R, final 2R, trail; max 3 trades/day, 4% daily loss stop.
Idea B — "15-minute pre-market": Asia range (8 PM-midnight ET = 00-04 UTC), London range (2-5 AM ET = 06-09 UTC),
         name the day: (1) London sweeps one side of Asia and closes back inside -> NY continues London's reversal;
         (2) London inside Asia -> NY takes a side first, then delivers the opposite; (3) both sides taken -> no trade.
         Trade 9:30-12:00 ET (13:30-16:00 UTC). Trade 1 wins -> done; loses -> one more at half size.

Crypto translation, BINANCE perps, fees on (taker 0.06% + 0.01% slip on market entries/stops/time exits, maker 0.02%
on targets). 15m bars BTC/ETH/SOL 2026-08-01 -> 10-13; Idea B also on 1h bars for 8 coins Jan-Oct 2026 (longer sample).
"""
import json, sys
import numpy as np, pandas as pd

TAKER, MAKER, SLIP = 0.0006, 0.0002, 0.0001
D15 = '/home/claude/repo/research/scalp/data'
D1H = '/home/claude/repo/research/limits/data'


def load(path):
    b = json.load(open(path))
    d = pd.DataFrame({k: b[k] for k in 'tohlcv'}); d['ts'] = pd.to_datetime(d.t, unit='s')
    d = d.set_index('ts').drop(columns='t').astype(float)
    tr = np.maximum(d.h - d.l, np.maximum((d.h - d.c.shift()).abs(), (d.l - d.c.shift()).abs()))
    d['atr'] = tr.rolling(14).mean()
    return d


def run_trade(m, k, side, entry, stop, cfg, fee_in, t_end=None):
    """Manage from bar k (entry fills at bar k's open or at `entry`). Returns (R, why, exit_index)."""
    sg = 1 if side == 'long' else -1; risk = sg * (entry - stop); n = len(m)
    tgt = entry + sg * cfg['tp_r'] * risk; cur = stop; half = None
    for j in range(k, n):
        if t_end is not None and m.index[j] >= t_end:
            px = m.o.iloc[j]; break
        hi, lo = m.h.iloc[j], m.l.iloc[j]
        if (sg == 1 and lo <= cur) or (sg == -1 and hi >= cur):
            px = cur; fee_out = TAKER + SLIP; why = 'stop' if cur == stop else 'be'
            return finish(entry, px, sg, risk, fee_in, fee_out, half, why), why, j
        if cfg.get('partial') and half is None and ((sg == 1 and hi >= entry + risk) or (sg == -1 and lo <= entry - risk)):
            half = entry + sg * risk; cur = entry + sg * 0.0008 * entry     # 50% off at 1R, stop to entry + fees
        if (sg == 1 and hi >= tgt) or (sg == -1 and lo <= tgt):
            return finish(entry, tgt, sg, risk, fee_in, MAKER, half, 'target'), 'target', j
    else:
        px = m.c.iloc[n - 1]; j = n - 1
    return finish(entry, px, sg, risk, fee_in, TAKER + SLIP, half, 'time'), 'time', j


def finish(entry, px, sg, risk, fee_in, fee_out, half, why):
    full = (sg * (px - entry) - entry * fee_in - px * fee_out) / risk
    if half is None: return full
    h = (sg * (half - entry) - entry * fee_in - half * MAKER) / risk
    return 0.5 * h + 0.5 * full


# ---------------------------------------------------------------- Idea B: session profiles
def idea_b(m, coin, cfg):
    out = []
    for day in sorted(set(m.index.normalize())):
        if cfg.get('weekdays') and day.weekday() >= 5: continue
        a = m[(m.index >= day) & (m.index < day + pd.Timedelta(hours=4))]
        lo_ = m[(m.index >= day + pd.Timedelta(hours=6)) & (m.index < day + pd.Timedelta(hours=9))]
        if len(a) < 2 or len(lo_) < 2: continue
        ah, al, lh, ll = a.h.max(), a.l.min(), lo_.h.max(), lo_.l.min()
        lclose = lo_.c.iloc[-1]
        t0 = day + pd.Timedelta(hours=13, minutes=30); t1 = day + pd.Timedelta(hours=16)
        t_end = day + pd.Timedelta(hours=cfg.get('exit_h', 20))
        w = m[(m.index >= t0) & (m.index < t1)]
        if not len(w): continue
        hi_sw, lo_sw = lh > ah, ll < al
        trades_today = 0; size = 1.0; done = False
        if hi_sw != lo_sw and al < lclose < ah:                     # profile 1: London swept one side and closed back inside
            if cfg['profile'] not in ('p1', 'all'): continue
            side = 'short' if hi_sw else 'long'
            k = m.index.get_loc(w.index[0])
            if cfg.get('entry') == 'retrace':                       # wait for a pullback toward the London range mid
                mid = (lh + ll) / 2; k2 = None
                for j in range(k, m.index.get_loc(w.index[-1]) + 1):
                    if (side == 'short' and m.h.iloc[j] >= mid) or (side == 'long' and m.l.iloc[j] <= mid): k2 = j; break
                if k2 is None: continue
                entry, fee_in, k = mid, MAKER, k2
            else:
                entry, fee_in = m.o.iloc[k], TAKER + SLIP
            a_ = m.atr.iloc[k]
            stop = (lh + 0.1 * a_) if side == 'short' else (ll - 0.1 * a_)
            if (side == 'short' and stop <= entry) or (side == 'long' and stop >= entry): continue
            if abs(entry - stop) < cfg.get('min_stop', 0.004) * entry: stop = entry + (1 if side == 'short' else -1) * cfg.get('min_stop', 0.004) * entry
            R, why, j = run_trade(m, k, side, entry, stop, cfg, fee_in, t_end)
            out.append(dict(coin=coin, t=w.index[0], profile='p1', side=side, R=R * size, why=why))
        elif not hi_sw and not lo_sw:                               # profile 2: London inside Asia
            if cfg['profile'] not in ('p2', 'all'): continue
            idx = [m.index.get_loc(x) for x in w.index]
            for j in idx:
                if done or trades_today >= cfg.get('max_trades', 2): break
                r = m.iloc[j]
                side = None
                if r.h > ah and r.c < ah: side, stop, tgt_lvl = 'short', r.h + 0.1 * r.atr, al
                elif r.l < al and r.c > al: side, stop, tgt_lvl = 'long', r.l - 0.1 * r.atr, ah
                if not side or j + 1 >= len(m): continue
                k = j + 1; entry = m.o.iloc[k]
                if abs(entry - stop) < cfg.get('min_stop', 0.004) * entry: stop = entry + (1 if side == 'short' else -1) * cfg.get('min_stop', 0.004) * entry
                R, why, jx = run_trade(m, k, side, entry, stop, cfg, TAKER + SLIP, t_end)
                out.append(dict(coin=coin, t=m.index[j], profile='p2', side=side, R=R * size, why=why))
                trades_today += 1
                if R > 0: done = True
                else: size = 0.5
        # profile 3 (both sides taken): no trade
    return out


# ---------------------------------------------------------------- Idea A: VWAP pullback (NY session)
def idea_a(m, coin, cfg):
    out = []
    m = m.copy(); m['e9'] = m.c.ewm(span=9).mean(); m['e20'] = m.c.ewm(span=20).mean(); m['v20'] = m.v.rolling(20).mean()
    for day in sorted(set(m.index.normalize())):
        if day.weekday() >= 5: continue
        s0 = day + pd.Timedelta(hours=13, minutes=30)
        sess = m[(m.index >= s0) & (m.index < day + pd.Timedelta(hours=16))]
        if len(sess) < 3: continue
        tp = (m.h + m.l + m.c) / 3
        seg = m[(m.index >= s0) & (m.index < day + pd.Timedelta(hours=20))]
        vw = ((tp.loc[seg.index] * seg.v).cumsum() / seg.v.cumsum())
        n_today, loss = 0, 0.0
        for ts in sess.index[1:]:
            if n_today >= cfg.get('max_trades', 3) or loss <= -2: break     # 3 trades, 4% (= 2R) daily stop
            j = m.index.get_loc(ts); r = m.iloc[j]; p = m.iloc[j - 1]; v = vw.loc[ts]
            vol_ok = (not cfg.get('vol')) or r.v > 1.2 * r.v20
            side = None
            if r.e9 > r.e20 and r.l <= v and r.c > v and r.c > p.h and vol_ok:
                side, stop = 'long', min(m.l.iloc[j-2:j+1].min(), v) - 0.1 * r.atr
            elif r.e9 < r.e20 and r.h >= v and r.c < v and r.c < p.l and vol_ok:
                side, stop = 'short', max(m.h.iloc[j-2:j+1].max(), v) + 0.1 * r.atr
            if not side or j + 1 >= len(m): continue
            k = j + 1; entry = m.o.iloc[k]
            if abs(entry - stop) < cfg.get('min_stop', 0.004) * entry: stop = entry + (1 if side == 'short' else -1) * cfg.get('min_stop', 0.004) * entry
            R, why, jx = run_trade(m, k, side, entry, stop, cfg, TAKER + SLIP, day + pd.Timedelta(hours=20))
            out.append(dict(coin=coin, t=ts, profile='vwap', side=side, R=R, why=why)); n_today += 1; loss += R
    return out


def stats(t, split):
    if not len(t): return dict(n=0)
    w = t[t.R > 0]; neg = -t[t.R <= 0].R.sum(); eq = t.sort_values('t').R.cumsum()
    h1, h2 = t[t.t < split], t[t.t >= split]
    return dict(n=len(t), win=round(100 * len(w) / len(t)), avgR=round(t.R.mean(), 3), totR=round(t.R.sum(), 1),
                pf=round(w.R.sum() / neg, 2) if neg > 0 else 99, maxDD=round((eq.cummax() - eq).max(), 1),
                H1=f"{len(h1)}/{round(h1.R.mean(), 3) if len(h1) else '-'}", H2=f"{len(h2)}/{round(h2.R.mean(), 3) if len(h2) else '-'}")


if __name__ == '__main__':
    grid = json.loads(sys.argv[1]); rows = []
    for g in grid:
        cfg = {'tp_r': 2.0, **g}
        if cfg['data'] == '15m':
            coins = ['BTC', 'ETH', 'SOL']; data = {c: load(f'{D15}/{c}_15m.json') for c in coins}; split = pd.Timestamp('2026-09-06')
        else:
            coins = ['BTC', 'ETH', 'SOL', 'NEAR', 'TIA', 'ENA', 'SEI', 'SUI']; data = {c: load(f'{D1H}/{c}_1h.json') for c in coins}; split = pd.Timestamp('2026-05-20')
        fn = idea_a if cfg['idea'] == 'A' else idea_b
        T = pd.DataFrame([x for c in coins for x in fn(data[c], c, cfg)])
        r = dict(cfg=json.dumps(g), **(stats(T, split) if len(T) else {'n': 0}))
        if len(T):
            for c in ('BTC', 'ETH', 'SOL'):
                s = T[T.coin == c]; r[c] = f"{len(s)}/{round(s.R.mean(), 2) if len(s) else '-'}"
        rows.append(r)
    pd.set_option('display.width', 250); pd.set_option('display.max_colwidth', 90)
    print(pd.DataFrame(rows).to_string(index=False))
