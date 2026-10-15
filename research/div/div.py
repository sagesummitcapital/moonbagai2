"""RSI / OBV divergence and divergence-combo strategies (Stavros, 2026-10-15: "I want to start looking at rsi divergence and
other indicators as part of leverage scalp strategy ... can you recreate these [Woods Bot 'Divergence Combo Alert']? also
using rsi heatmaps to identify overbought and oversold ... If usdt is down market is typically going up ... use higher
timeframe to see if there is a set up and lower timeframe to confirm").

Divergence (regular): pivot lows/highs with L bars left and R bars right (confirmed R bars later — no lookahead).
  bullish: price makes a lower low vs the previous pivot low 5–60 bars earlier, RSI makes a higher low.
  bearish: price higher high, RSI lower high.  OBV divergence: same with OBV instead of RSI.
Combo (market direction, 4h): bullish votes = bullish div on TOTAL / TOTAL2 / TOTAL3 / BTC / ETH + bearish div on USDT.D /
  USDC.D (stablecoin dominance topping = money leaving stables); bearish votes the mirror. A combo = >= N votes inside a
  window of W bars (the Woods bot posts 3–6 lines).
Trades on BINANCE BTC / ETH perps with fees: taker 0.06% + 0.01% slippage in, taker/slip on stops and time exits, maker on
  targets. Stop beyond the divergence pivot extreme + buffer (minimum %), target tp_r x risk, time exit.
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
    d['rsi'] = rsi(d.c)
    d['obv'] = (np.sign(d.c.diff()).fillna(0) * d.v).cumsum()
    tr = np.maximum(d.h - d.l, np.maximum((d.h - d.c.shift()).abs(), (d.l - d.c.shift()).abs()))
    d['atr'] = tr.rolling(14).mean()
    d['ema200'] = d.c.ewm(span=200).mean()
    return d


def rsi(c, n=14):
    dl = c.diff()
    up = dl.clip(lower=0).ewm(alpha=1 / n, adjust=False).mean()
    dn = (-dl.clip(upper=0)).ewm(alpha=1 / n, adjust=False).mean()
    return 100 - 100 / (1 + up / dn)


def divergences(d, osc='rsi', L=5, R=5, lo=5, hi=60, os_lvl=None, ob_lvl=None):
    """Returns list of (signal_index, side, pivot_index, pivot_price). Signal at pivot + R (confirmation)."""
    h, l, o = d.h.values, d.l.values, d[osc].values
    n = len(d); out = []
    pl, ph = [], []
    for i in range(L, n - R):
        if l[i] == l[i - L:i + R + 1].min():
            for j in reversed(pl):
                if i - j > hi: break
                if i - j < lo: continue
                if l[i] < l[j] and o[i] > o[j] and (os_lvl is None or min(o[i], o[j]) < os_lvl):
                    out.append((i + R, 'bull', i, l[i]))
                break
            pl.append(i)
        if h[i] == h[i - L:i + R + 1].max():
            for j in reversed(ph):
                if i - j > hi: break
                if i - j < lo: continue
                if h[i] > h[j] and o[i] < o[j] and (ob_lvl is None or max(o[i], o[j]) > ob_lvl):
                    out.append((i + R, 'bear', i, h[i]))
                break
            ph.append(i)
    return sorted(out)


def trade(m, k, side, stop, cfg, t_end=None):
    """Enter at bar k open. Returns (R, why, exit_idx)."""
    sg = 1 if side == 'long' else -1
    if k >= len(m): return None
    e = m.o.iloc[k]
    if sg * (e - stop) <= 0: return None
    if abs(e - stop) < cfg.get('min_stop', 0.004) * e: stop = e - sg * cfg.get('min_stop', 0.004) * e
    if cfg.get('max_stop') and abs(e - stop) > cfg['max_stop'] * e: return None
    risk = abs(e - stop); tgt = e + sg * cfg.get('tp_r', 2) * risk; cur = stop
    end = min(len(m), k + cfg.get('hold', 18))
    for j in range(k, end):
        hi, lo = m.h.iloc[j], m.l.iloc[j]
        if (sg == 1 and lo <= cur) or (sg == -1 and hi >= cur):
            px = cur; f = TAKER + SLIP; why = 'stop' if cur == stop else 'be'
            return (sg * (px - e) - e * (TAKER + SLIP) - px * f) / risk, why, j
        if (sg == 1 and hi >= tgt) or (sg == -1 and lo <= tgt):
            return (sg * (tgt - e) - e * (TAKER + SLIP) - tgt * MAKER) / risk, 'target', j
        if cfg.get('be') and ((sg == 1 and hi >= e + cfg['be'] * risk) or (sg == -1 and lo <= e - cfg['be'] * risk)):
            cur = e + sg * 0.0008 * e
    j = end - 1; px = m.c.iloc[j]
    return (sg * (px - e) - e * (TAKER + SLIP) - px * (TAKER + SLIP)) / risk, 'time', j


def combo_votes(frames, cfg):
    """Per 4h timestamp: bull/bear votes from divergences on the market instruments."""
    votes = {}
    for name, d in frames.items():
        stable = name in ('USDTD', 'USDCD')
        for (si, side, pi, pp) in divergences(d, cfg.get('osc', 'rsi'), cfg.get('L', 5), cfg.get('R', 5), os_lvl=cfg.get('os'), ob_lvl=cfg.get('ob')):
            mkt = ('bear' if side == 'bull' else 'bull') if stable else side
            ts = d.index[si]
            votes.setdefault(ts, []).append((name, mkt))
        if cfg.get('obv') and not stable:
            for (si, side, pi, pp) in divergences(d, 'obv', cfg.get('L', 5), cfg.get('R', 5)):
                votes.setdefault(d.index[si], []).append((name + '_obv', side))
    return votes


def run(cfg):
    coins = cfg.get('coins', ['BTC', 'ETH'])
    tf = cfg.get('tf', '4h')
    out = []
    if cfg['s'] == 'div':          # single-instrument divergence on the traded coin
        for c in coins:
            m = load(f'{c}_{tf}')
            last = -1
            for (si, side, pi, pp) in divergences(m, cfg.get('osc', 'rsi'), cfg.get('L', 5), cfg.get('R', 5), os_lvl=cfg.get('os'), ob_lvl=cfg.get('ob')):
                if si + 1 >= len(m) or si <= last: continue
                sd = 'long' if side == 'bull' else 'short'
                if cfg.get('trend') and ((sd == 'long') != (m.c.iloc[si] > m.ema200.iloc[si])): continue
                a = m.atr.iloc[si]
                stop = pp - a * cfg.get('buf', 0.25) if sd == 'long' else pp + a * cfg.get('buf', 0.25)
                r = trade(m, si + 1, sd, stop, cfg)
                if r: out.append(dict(coin=c, t=m.index[si], side=sd, R=r[0], why=r[1])); last = r[2]
    elif cfg['s'] in ('combo', 'combo_ltf'):
        names = cfg.get('mkt', ['TOTAL', 'TOTAL2', 'TOTAL3', 'USDTD', 'USDCD', 'BTC', 'ETH'])
        frames = {n: load(f'{n}_4h') for n in names}
        votes = combo_votes(frames, cfg)
        ts_sorted = sorted(votes)
        W = pd.Timedelta(hours=4 * cfg.get('W', 3))
        sigs = []
        for ts in ts_sorted:
            win = [v for t2 in ts_sorted if ts - W <= t2 <= ts for v in votes[t2]]
            bull = len({n for n, s in win if s == 'bull'}); bear = len({n for n, s in win if s == 'bear'})
            if bull >= cfg.get('N', 3) and bull > bear: sigs.append((ts, 'long', bull))
            elif bear >= cfg.get('N', 3) and bear > bull: sigs.append((ts, 'short', bear))
        for c in coins:
            m4 = load(f'{c}_4h')
            mt = load(f'{c}_{cfg.get("ltf", "1h")}') if cfg['s'] == 'combo_ltf' else m4
            busy_until = None
            for ts, sd, nv in sigs:
                if busy_until is not None and ts <= busy_until: continue
                if ts not in m4.index: continue
                i = m4.index.get_loc(ts)
                if cfg.get('trend') and ((sd == 'long') != (m4.c.iloc[i] > m4.ema200.iloc[i])): continue
                a = m4.atr.iloc[i]
                look = m4.iloc[max(0, i - 10):i + 1]
                ext = look.l.min() if sd == 'long' else look.h.max()
                stop = ext - cfg.get('buf', 0.25) * a if sd == 'long' else ext + cfg.get('buf', 0.25) * a
                if cfg['s'] == 'combo':
                    r = trade(m4, i + 1, sd, stop, cfg)
                    if r: out.append(dict(coin=c, t=ts, side=sd, R=r[0], why=r[1], votes=nv)); busy_until = m4.index[r[2]]
                else:
                    # LTF confirmation within confirm_h hours: 1h RSI crosses back through 30/70 or an LTF divergence in the same direction
                    t0 = ts + pd.Timedelta(hours=4); t1 = t0 + pd.Timedelta(hours=cfg.get('confirm_h', 24))
                    seg = mt[(mt.index >= t0) & (mt.index < t1)]
                    if not len(seg): continue
                    k = None
                    ltf_div = {mt.index[s]: sd2 for (s, sd2, _, _) in divergences(mt, 'rsi', 3, 3)}
                    for t2 in seg.index:
                        j = mt.index.get_loc(t2)
                        if j < 1: continue
                        r0, r1 = mt.rsi.iloc[j - 1], mt.rsi.iloc[j]
                        cross = (sd == 'long' and r0 < cfg.get('os_l', 35) <= r1) or (sd == 'short' and r0 > cfg.get('ob_l', 65) >= r1)
                        dv = ltf_div.get(t2) == ('bull' if sd == 'long' else 'bear')
                        if (cfg.get('confirm', 'either') in ('cross', 'either') and cross) or (cfg.get('confirm', 'either') in ('div', 'either') and dv):
                            k = j + 1; break
                    if k is None or k >= len(mt): continue
                    seg2 = mt.iloc[mt.index.get_loc(seg.index[0]):k]
                    ext2 = min(ext, seg2.l.min()) if sd == 'long' else max(ext, seg2.h.max())
                    a1 = mt.atr.iloc[k - 1]
                    stop = (seg2.l.min() - cfg.get('buf1', 0.5) * a1) if (sd == 'long' and cfg.get('tight')) else (seg2.h.max() + cfg.get('buf1', 0.5) * a1) if cfg.get('tight') else (ext2 - cfg.get('buf', 0.25) * a if sd == 'long' else ext2 + cfg.get('buf', 0.25) * a)
                    r = trade(mt, k, sd, stop, cfg)
                    if r: out.append(dict(coin=c, t=ts, side=sd, R=r[0], why=r[1], votes=nv)); busy_until = mt.index[r[2]]
    elif cfg['s'] == 'heat':      # RSI heatmap: HTF and LTF both oversold/overbought, enter on the LTF cross back
        for c in coins:
            m4 = load(f'{c}_4h'); m1 = load(f'{c}_{cfg.get("ltf", "1h")}')
            r4 = m4.rsi.reindex(m1.index, method='ffill')
            busy = -1
            for j in range(1, len(m1) - 1):
                if j <= busy: continue
                a, b = m1.rsi.iloc[j - 1], m1.rsi.iloc[j]
                sd = None
                if r4.iloc[j] < cfg.get('os4', 35) and a < cfg.get('os1', 30) <= b: sd = 'long'
                elif r4.iloc[j] > cfg.get('ob4', 65) and a > cfg.get('ob1', 70) >= b: sd = 'short'
                if not sd: continue
                seg = m1.iloc[max(0, j - 12):j + 1]
                at = m1.atr.iloc[j]
                stop = seg.l.min() - 0.5 * at if sd == 'long' else seg.h.max() + 0.5 * at
                r = trade(m1, j + 1, sd, stop, cfg)
                if r: out.append(dict(coin=c, t=m1.index[j], side=sd, R=r[0], why=r[1])); busy = r[2]
    return pd.DataFrame(out)


def stats(T, split):
    if not len(T): return dict(n=0)
    w = T[T.R > 0]; neg = -T[T.R <= 0].R.sum(); eq = T.sort_values('t').R.cumsum()
    h1, h2 = T[T.t < split], T[T.t >= split]
    return dict(n=len(T), win=round(100 * len(w) / len(T)), avgR=round(T.R.mean(), 3), totR=round(T.R.sum(), 1),
                pf=round(w.R.sum() / neg, 2) if neg > 0 else 99, maxDD=round((eq.cummax() - eq).max(), 1),
                H1=f"{len(h1)}/{round(h1.R.mean(), 2) if len(h1) else '-'}", H2=f"{len(h2)}/{round(h2.R.mean(), 2) if len(h2) else '-'}",
                L=f"{(T.side == 'long').sum()}/{round(T[T.side == 'long'].R.mean(), 2) if (T.side == 'long').any() else '-'}",
                S=f"{(T.side == 'short').sum()}/{round(T[T.side == 'short'].R.mean(), 2) if (T.side == 'short').any() else '-'}")


if __name__ == '__main__':
    grid = json.load(open(sys.argv[1]))
    rows = []
    for g in grid:
        T = run(g)
        split = pd.Timestamp(g.get('split', '2026-06-01'), tz='UTC')
        r = dict(cfg=json.dumps({k: v for k, v in g.items() if k not in ('dump',)}), **stats(T, split))
        if len(T):
            for c in ('BTC', 'ETH'):
                s_ = T[T.coin == c]; r[c] = f"{len(s_)}/{round(s_.R.mean(), 2) if len(s_) else '-'}"
        rows.append(r)
        if g.get('dump') and len(T): T.to_csv(g['dump'], index=False)
    pd.set_option('display.width', 280); pd.set_option('display.max_colwidth', 110)
    print(pd.DataFrame(rows).to_string(index=False))
