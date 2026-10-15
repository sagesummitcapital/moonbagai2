"""US-open strategies on crypto perps (Stavros 2026-10-15: "a lot of traders only trade open, figure out a few winning
strategies they use and lets test them. i want to go into open everyday with a clear strategy").

Open = 9:30 New York (13:30 UTC in summer, 14:30 UTC in winter — handled with the NY timezone). Weekdays only.
Fees: taker 0.06% + 0.01% slippage on market entries / stops / time exits, maker 0.02% on limit entries and targets.
Every trade is flat by 16:00 New York (time exit) unless noted. One trade per coin per day.

Strategies
  orb      Opening-range breakout: first N minutes' high/low; first close beyond it -> enter next bar open with the break;
           stop = other side of the range (or the range mid with stop='mid'); target tp_r x risk.
  fade     Failed breakout: price breaks the opening range then a bar CLOSES back inside -> enter the other way;
           stop beyond the extreme of the break; target the far side of the range (or tp_r).
  onsweep  Overnight range (00:00 NY -> open): in the first 2h after the open, price sweeps the overnight high/low and a bar
           closes back inside -> fade it; stop beyond the sweep extreme; target the overnight range mid / tp_r.
  pdsweep  Previous NY-day high/low swept after the open and reclaimed (close back inside) -> fade; stop beyond the extreme.
  drive    Open drive: if the first 30/60 minutes move more than k x the 1h ATR, enter with it at the next bar; stop = the
           open price -/+ buffer; target tp_r.
  Filters: trend = only with the daily 50 EMA side; red = skip CPI/FOMC/NFP days (not modelled; sample too small).
"""
import json, sys
import numpy as np, pandas as pd

TAKER, MAKER, SLIP = 0.0006, 0.0002, 0.0001
D15 = '/home/claude/repo/research/scalp/data'
D1H = '/home/claude/repo/research/limits/data'


def load(path):
    b = json.load(open(path))
    d = pd.DataFrame({k: b[k] for k in 'tohlcv'})
    d['ts'] = pd.to_datetime(d.t, unit='s', utc=True)
    d = d.set_index('ts').drop(columns='t').astype(float)
    tr = np.maximum(d.h - d.l, np.maximum((d.h - d.c.shift()).abs(), (d.l - d.c.shift()).abs()))
    d['atr'] = tr.rolling(14).mean()
    d['ny'] = d.index.tz_convert('America/New_York')
    # daily (NY session date) OHLC + EMA50 for the trend filter
    day = d.ny.dt.date
    daily = d.groupby(day).agg(h=('h', 'max'), l=('l', 'min'), c=('c', 'last'))
    daily['ema50'] = daily.c.ewm(span=50).mean()
    tr_d = np.maximum(daily.h - daily.l, np.maximum((daily.h - daily.c.shift()).abs(), (daily.l - daily.c.shift()).abs()))
    daily['atrd'] = tr_d.rolling(14).mean()
    return d, daily


def manage(m, k, sg, entry, stop, tgt, fee_in, t_end, be_r=None):
    """From bar k. Returns (R, why)."""
    risk = sg * (entry - stop); cur = stop
    for j in range(k, len(m)):
        if m.index[j] >= t_end:
            px = m.o.iloc[j]; return fin(entry, px, sg, risk, fee_in, TAKER + SLIP), 'time'
        hi, lo = m.h.iloc[j], m.l.iloc[j]
        if (sg == 1 and lo <= cur) or (sg == -1 and hi >= cur):
            return fin(entry, cur, sg, risk, fee_in, TAKER + SLIP), ('stop' if cur == stop else 'be')
        if (sg == 1 and hi >= tgt) or (sg == -1 and lo <= tgt):
            return fin(entry, tgt, sg, risk, fee_in, MAKER), 'target'
        if be_r and ((sg == 1 and hi >= entry + be_r * risk) or (sg == -1 and lo <= entry - be_r * risk)):
            cur = entry + sg * 0.0008 * entry
    return fin(entry, m.c.iloc[-1], sg, risk, fee_in, TAKER + SLIP), 'time'


def fin(entry, px, sg, risk, fee_in, fee_out):
    return (sg * (px - entry) - entry * fee_in - px * fee_out) / risk


def run(m, daily, coin, cfg):
    out = []
    dates = sorted(set(m.ny.dt.date))
    bar = (m.index[1] - m.index[0])
    for i, dt in enumerate(dates):
        if pd.Timestamp(dt).weekday() >= 5 or i == 0: continue
        o_ny = pd.Timestamp(dt).tz_localize('America/New_York') + pd.Timedelta(hours=9, minutes=30)
        o = o_ny.tz_convert('UTC'); t_end = (pd.Timestamp(dt).tz_localize('America/New_York') + pd.Timedelta(hours=cfg.get('exit_h', 16))).tz_convert('UTC')
        prev = dates[i - 1]
        if prev not in daily.index or dt not in daily.index: continue
        drow = daily.loc[prev]
        if np.isnan(drow.ema50) or np.isnan(drow.atrd): continue
        trend = 1 if drow.c > drow.ema50 else -1
        sess = m[(m.index >= o) & (m.index < t_end)]
        if len(sess) < 4: continue
        s = cfg['s']; nb = max(1, int(pd.Timedelta(minutes=cfg.get('orm', 30)) / bar))
        min_stop = cfg.get('min_stop', 0.003)

        def take(k, side, entry, stop, tgt, fee_in, label):
            sg = 1 if side == 'long' else -1
            if cfg.get('trend') and sg != trend: return
            if sg * (entry - stop) <= 0: return
            if abs(entry - stop) < min_stop * entry: stop = entry - sg * min_stop * entry
            if tgt is None or sg * (tgt - entry) <= 0: tgt = entry + sg * cfg.get('tp_r', 2) * abs(entry - stop)
            R, why = manage(m, k, sg, entry, stop, tgt, fee_in, t_end, cfg.get('be'))
            out.append(dict(coin=coin, t=o, s=label, side=side, R=R, why=why, plan=abs(tgt - entry) / abs(entry - stop)))

        if s in ('orb', 'fade'):
            orr = sess.iloc[:nb]; rh, rl = orr.h.max(), orr.l.min(); rest = sess.iloc[nb:]
            if not len(rest) or rh - rl <= 0: continue
            if cfg.get('max_or_atr') and (rh - rl) > cfg['max_or_atr'] * drow.atrd: continue
            broke = 0; ext = None
            for ts, r in rest.iterrows():
                j = m.index.get_loc(ts)
                if s == 'orb':
                    side = 'long' if r.c > rh else 'short' if r.c < rl else None
                    if side and j + 1 < len(m) and m.index[j + 1] < t_end:
                        stop = (rl if side == 'long' else rh) if cfg.get('stop') != 'mid' else (rh + rl) / 2
                        take(j + 1, side, m.o.iloc[j + 1], stop, None, TAKER + SLIP, 'orb'); break
                else:
                    if not broke:
                        if r.h > rh: broke, ext = 1, r.h
                        elif r.l < rl: broke, ext = -1, r.l
                    else:
                        ext = max(ext, r.h) if broke == 1 else min(ext, r.l)
                    if broke and rl < r.c < rh and j + 1 < len(m) and m.index[j + 1] < t_end:
                        side = 'short' if broke == 1 else 'long'
                        buf = 0.1 * r.atr
                        stop = ext + buf if side == 'short' else ext - buf
                        tgt = (rl if side == 'short' else rh) if cfg.get('tgt') == 'far' else None
                        take(j + 1, side, m.o.iloc[j + 1], stop, tgt, TAKER + SLIP, 'fade'); break
                    if broke and m.index[j] >= o + pd.Timedelta(hours=cfg.get('win_h', 2)): break
        elif s in ('onsweep', 'pdsweep'):
            if s == 'onsweep':
                pre = m[(m.index >= (o_ny - pd.Timedelta(hours=9, minutes=30)).tz_convert('UTC')) & (m.index < o)]
                if len(pre) < 4: continue
                H, L = pre.h.max(), pre.l.min()
            else:
                H, L = drow.h, drow.l
            win = sess[sess.index < o + pd.Timedelta(hours=cfg.get('win_h', 2))]
            for ts, r in win.iterrows():
                j = m.index.get_loc(ts)
                side = None
                if r.h > H and r.c < H: side, stop = 'short', r.h + 0.1 * r.atr
                elif r.l < L and r.c > L: side, stop = 'long', r.l - 0.1 * r.atr
                if side and j + 1 < len(m):
                    tgt = (H + L) / 2 if cfg.get('tgt') == 'mid' else None
                    take(j + 1, side, m.o.iloc[j + 1], stop, tgt, TAKER + SLIP, s); break
        elif s == 'drive':
            first = sess.iloc[:nb]
            mv = first.c.iloc[-1] - first.o.iloc[0]
            a = m.atr.loc[first.index[-1]]
            if abs(mv) < cfg.get('k', 1.0) * a or nb >= len(sess): continue
            side = 'long' if mv > 0 else 'short'; j = m.index.get_loc(first.index[-1]) + 1
            stop = first.o.iloc[0] - (1 if side == 'long' else -1) * 0.25 * a
            take(j, side, m.o.iloc[j], stop, None, TAKER + SLIP, 'drive')
    return out


def stats(T, split):
    if not len(T): return dict(n=0)
    w = T[T.R > 0]; neg = -T[T.R <= 0].R.sum(); eq = T.sort_values('t').R.cumsum()
    h1, h2 = T[T.t < split], T[T.t >= split]
    return dict(n=len(T), win=round(100 * len(w) / len(T)), avgR=round(T.R.mean(), 3), totR=round(T.R.sum(), 1),
                pf=round(w.R.sum() / neg, 2) if neg > 0 else 99, maxDD=round((eq.cummax() - eq).max(), 1),
                H1=f"{len(h1)}/{round(h1.R.mean(), 3) if len(h1) else '-'}", H2=f"{len(h2)}/{round(h2.R.mean(), 3) if len(h2) else '-'}")


if __name__ == '__main__':
    grid = json.loads(open(sys.argv[1]).read()) if sys.argv[1].endswith('.json') else json.loads(sys.argv[1])
    cache = {}; rows = []
    for g in grid:
        if g['data'] == '15m':
            coins = ['BTC', 'ETH', 'SOL']; split = pd.Timestamp('2026-09-07', tz='UTC'); path = lambda c: f'{D15}/{c}_15m.json'
        else:
            coins = g.get('coins', ['BTC', 'ETH', 'SOL', 'NEAR', 'TIA', 'ENA', 'SEI', 'SUI']); split = pd.Timestamp('2026-05-20', tz='UTC'); path = lambda c: f'{D1H}/{c}_1h.json'
        T = []
        for c in coins:
            key = (g['data'], c)
            if key not in cache: cache[key] = load(path(c))
            T += run(*cache[key], c, g)
        T = pd.DataFrame(T)
        r = dict(cfg=json.dumps({k: v for k, v in g.items() if k != 'data'}) + ' ' + g['data'], **stats(T, split))
        if len(T):
            for c in ('BTC', 'ETH', 'SOL'):
                s_ = T[T.coin == c]; r[c] = f"{len(s_)}/{round(s_.R.mean(), 2) if len(s_) else '-'}"
        rows.append(r)
        if g.get('dump'): T.to_csv(g['dump'], index=False)
    pd.set_option('display.width', 260); pd.set_option('display.max_colwidth', 80)
    print(pd.DataFrame(rows).to_string(index=False))
