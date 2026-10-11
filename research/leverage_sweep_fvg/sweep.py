"""Liquidity sweep -> FVG -> opposite liquidity backtest (crypto adaptation of Stavros's two guides).
15m execution bars, BTC/ETH/SOL perps. All times UTC. Phoenix = UTC-7 (5 AM Phoenix = 12:00 UTC)."""
import json, numpy as np, pandas as pd, itertools
FEE = 0.0005  # per side, fraction of price (blend maker entry / taker exit)

def load(n):
    b = json.load(open(f'/home/claude/ict/{n}.json'))
    d = pd.DataFrame({k: b[k] for k in 'tohlc'}); d['ts'] = pd.to_datetime(d.t, unit='s'); return d.set_index('ts').drop(columns='t').astype(float)

def levels_for_day(d15, day, swings4h):
    """External liquidity known at the start of the trading window."""
    prev = d15[(d15.index >= day - pd.Timedelta(days=1)) & (d15.index < day)]
    asia = d15[(d15.index >= day) & (d15.index < day + pd.Timedelta(hours=8))]
    ldn = d15[(d15.index >= day + pd.Timedelta(hours=7)) & (d15.index < day + pd.Timedelta(hours=13, minutes=30))]
    L = {}
    if len(prev): L['PDH'] = prev.h.max(); L['PDL'] = prev.l.min()
    if len(asia): L['AH'] = asia.h.max(); L['AL'] = asia.l.min()
    if len(ldn): L['LH'] = ldn.h.max(); L['LL'] = ldn.l.min()
    sw = swings4h[(swings4h.index < day + pd.Timedelta(hours=12)) & (swings4h.index >= day - pd.Timedelta(days=5))]
    for i, (ts, r) in enumerate(sw.iterrows()):
        if r.kind == 'H': L[f'SH{i}'] = r.px
        else: L[f'SL{i}'] = r.px
    return L

def swings(d15):
    h4 = d15.resample('4h').agg({'o': 'first', 'h': 'max', 'l': 'min', 'c': 'last'}).dropna()
    out = []
    for i in range(2, len(h4) - 2):
        if h4.h.iloc[i] > max(h4.h.iloc[i-2:i]) and h4.h.iloc[i] >= max(h4.h.iloc[i+1:i+3]):
            out.append((h4.index[i] + pd.Timedelta(hours=12), 'H', h4.h.iloc[i]))  # known after 2 more 4h bars
        if h4.l.iloc[i] < min(h4.l.iloc[i-2:i]) and h4.l.iloc[i] <= min(h4.l.iloc[i+1:i+3]):
            out.append((h4.index[i] + pd.Timedelta(hours=12), 'L', h4.l.iloc[i]))
    return pd.DataFrame(out, columns=['ts', 'kind', 'px']).set_index('ts').sort_index(), h4

def run(asset, D, S, H4, win=(13.5, 16.0), days=(0, 1, 2, 3), min_r=3.0, stop_mode='sweep', fvg_bars=6, smt=None,
        bias=None, buf=0.0, retest_bars=8, eod_h=24, entry_mode='fvg'):
    d = D[asset]; trades = []
    for day in pd.date_range(d.index[0].normalize() + pd.Timedelta(days=6), d.index[-1].normalize(), freq='D'):
        if day.weekday() not in days: continue
        L = levels_for_day(d, day, S[asset])
        if not L: continue
        w0, w1 = day + pd.Timedelta(hours=win[0]), day + pd.Timedelta(hours=win[1])
        bars = d[(d.index >= w0) & (d.index < day + pd.Timedelta(hours=eod_h))]
        if len(bars) < 10: continue
        # 4H bias candle 08-12 UTC (closes 5 AM Phoenix)
        c4 = H4[asset]; cb = c4[c4.index == day + pd.Timedelta(hours=8)]
        bdir = None
        if len(cb):
            r = cb.iloc[0]; rng = r.h - r.l
            body = abs(r.c - r.o)
            if rng > 0 and body / rng >= 0.5: bdir = 'long' if r.c > r.o else 'short'
        taken = False
        arr = bars.reset_index(); n = len(arr)
        for i in range(n):
            if taken: break
            t = arr.ts[i]
            if t >= w1: break
            for name, lv in L.items():
                hi_side = name in ('PDH', 'AH', 'LH') or name.startswith('SH')
                if hi_side and arr.h[i] > lv and arr.c[i] < lv: side = 'short'
                elif (not hi_side) and arr.l[i] < lv and arr.c[i] > lv: side = 'long'
                else: continue
                # must be the first touch of this level today inside window? require level not already traded through earlier in the window
                if bias == 'with' and bdir and bdir != side: continue
                if bias == 'against' and bdir and bdir == side: continue
                if bias == 'need' and bdir != side: continue
                if smt:
                    ok = True
                    for o in smt:
                        if o == asset: continue
                        Lo = levels_for_day(D[o], day, S[o]); lvo = Lo.get(name)
                        if lvo is None: ok = False; break
                        ob = D[o][(D[o].index >= w0) & (D[o].index <= t)]
                        swept_o = (ob.h.max() > lvo) if side == 'short' else (ob.l.min() < lvo)
                        if swept_o: ok = False; break   # no divergence -> wait
                    if not ok: continue
                ext = arr.h[i] if side == 'short' else arr.l[i]
                if entry_mode == 'close':
                    entry = arr.c[i]; stop = ext; risk = abs(entry - stop)
                    if risk <= 0: continue
                    if side == 'short': opp = [v for k, v in L.items() if (k in ('PDL', 'AL', 'LL') or k.startswith('SL')) and v < entry]; tgt = max(opp) if opp else None
                    else: opp = [v for k, v in L.items() if (k in ('PDH', 'AH', 'LH') or k.startswith('SH')) and v > entry]; tgt = min(opp) if opp else None
                    if tgt is None or abs(tgt - entry) / risk < min_r: continue
                    res = None
                    for m in range(i + 1, n):
                        if side == 'short':
                            if arr.h[m] >= stop: res = (stop, 'stop'); break
                            if arr.l[m] <= tgt: res = (tgt, 'target'); break
                        else:
                            if arr.l[m] <= stop: res = (stop, 'stop'); break
                            if arr.h[m] >= tgt: res = (tgt, 'target'); break
                    if res is None: res = (arr.c[n-1], 'eod')
                    px, why = res
                    gross = (entry - px) if side == 'short' else (px - entry)
                    R = (gross - FEE * (entry + px)) / risk
                    trades.append(dict(asset=asset, day=day.date(), level=name, side=side, entry=entry, stop=stop, tgt=tgt, plan_r=abs(tgt-entry)/risk, R=R, why=why, stop_pct=risk/entry*100))
                    taken = True; break
                # FVG after the sweep
                for j in range(i + 2, min(n, i + 1 + fvg_bars)):
                    if arr.ts[j] >= w1 + pd.Timedelta(hours=1): break
                    if side == 'short' and arr.h[j] < arr.l[j-2] and max(arr.h[i:j+1]) <= ext:
                        g_lo, g_hi = arr.h[j], arr.l[j-2]; entry = g_lo
                        stop = (ext if stop_mode == 'sweep' else g_hi) * (1 + buf)
                    elif side == 'long' and arr.l[j] > arr.h[j-2] and min(arr.l[i:j+1]) >= ext:
                        g_lo, g_hi = arr.h[j-2], arr.l[j]; entry = g_hi
                        stop = (ext if stop_mode == 'sweep' else g_lo) * (1 - buf)
                    else: continue
                    risk = abs(entry - stop)
                    if risk <= 0: break
                    # opposite liquidity: nearest level on the other side
                    if side == 'short': opp = [v for k, v in L.items() if (k in ('PDL', 'AL', 'LL') or k.startswith('SL')) and v < entry]; tgt = max(opp) if opp else None
                    else: opp = [v for k, v in L.items() if (k in ('PDH', 'AH', 'LH') or k.startswith('SH')) and v > entry]; tgt = min(opp) if opp else None
                    if tgt is None or abs(tgt - entry) / risk < min_r: break
                    # wait for retest into the gap
                    for k in range(j + 1, min(n, j + 1 + retest_bars)):
                        hit = arr.h[k] >= entry if side == 'short' else arr.l[k] <= entry
                        if not hit:
                            # invalidated if stop or target hit before fill
                            if (side == 'short' and (arr.h[k] >= stop or arr.l[k] <= tgt)) or (side == 'long' and (arr.l[k] <= stop or arr.h[k] >= tgt)): break
                            continue
                        # filled at k: manage
                        res = None
                        for m in range(k, n):
                            if m > k or True:
                                if side == 'short':
                                    if arr.h[m] >= stop: res = (stop, 'stop'); break
                                    if arr.l[m] <= tgt and m > k: res = (tgt, 'target'); break
                                else:
                                    if arr.l[m] <= stop: res = (stop, 'stop'); break
                                    if arr.h[m] >= tgt and m > k: res = (tgt, 'target'); break
                        if res is None: res = (arr.c[n-1], 'eod')
                        px, why = res
                        gross = (entry - px) if side == 'short' else (px - entry)
                        R = (gross - FEE * (entry + px)) / risk
                        trades.append(dict(asset=asset, day=day.date(), level=name, side=side, entry=entry, stop=stop, tgt=tgt, plan_r=abs(tgt-entry)/risk, R=R, why=why, stop_pct=risk/entry*100))
                        taken = True; break
                    break
                if taken: break
    return pd.DataFrame(trades)

def stats(t):
    if len(t) == 0: return dict(n=0)
    w = t[t.R > 0]
    return dict(n=len(t), win=round(100*len(w)/len(t)), avgR=round(t.R.mean(), 2), totR=round(t.R.sum(), 1),
                pf=round(w.R.sum()/-t[t.R <= 0].R.sum(), 2) if (t.R <= 0).any() else 99, avg_plan=round(t.plan_r.mean(), 1),
                stop_pct=round(t.stop_pct.mean(), 2))
