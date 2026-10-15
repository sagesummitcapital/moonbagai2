"""Divergence AT A LEVEL: price sweeps the previous UTC-day low/high (or the 20-bar extreme) and that sweep pivot is an RSI
divergence -> enter on confirmation (pivot + R bars), stop beyond the sweep, 2R. This is the 2026-10-15 BTC case
(PDL 80,188 swept to 79,732 with a 15m bullish RSI divergence, then +2.4%)."""
import json, sys, pandas as pd, numpy as np
from div import load, divergences, trade, stats

def run(cfg):
    out=[]
    for c in cfg.get('coins',['BTC','ETH']):
        m=load(f"{c}_{cfg['tf']}")
        day=m.index.floor('D')
        dl=m.groupby(day).l.min().shift(1); dh=m.groupby(day).h.max().shift(1)
        pdl=pd.Series(day.map(dl).values,index=m.index); pdh=pd.Series(day.map(dh).values,index=m.index)
        last=-1
        for (si,side,pi,pp) in divergences(m,'rsi',cfg.get('L',3),cfg.get('R',3),os_lvl=cfg.get('os'),ob_lvl=cfg.get('ob')):
            if si<=last or si+1>=len(m): continue
            sd='long' if side=='bull' else 'short'
            lv = pdl.iloc[pi] if sd=='long' else pdh.iloc[pi]
            if cfg.get('lvl','pd')=='pd':
                if np.isnan(lv): continue
                swept = (pp<lv and m.c.iloc[si]>lv) if sd=='long' else (pp>lv and m.c.iloc[si]<lv)
            else:
                w=m.iloc[max(0,pi-cfg.get('lb',48)):pi]
                lv=w.l.min() if sd=='long' else w.h.max()
                swept=(pp<lv and m.c.iloc[si]>lv) if sd=='long' else (pp>lv and m.c.iloc[si]<lv)
            if not swept: continue
            if cfg.get('trend') and ((sd=='long')!=(m.c.iloc[si]>m.ema200.iloc[si])): continue
            a=m.atr.iloc[si]
            stop=pp-cfg.get('buf',0.25)*a if sd=='long' else pp+cfg.get('buf',0.25)*a
            r=trade(m,si+1,sd,stop,cfg)
            if r: out.append(dict(coin=c,t=m.index[si],side=sd,R=r[0],why=r[1])); last=r[2]
    return pd.DataFrame(out)

grid=[
 dict(tf='15m',coins=['BTC'],hold=48,min_stop=0.003,split='2026-09-07'),
 dict(tf='15m',coins=['BTC'],hold=48,min_stop=0.003,split='2026-09-07',tp_r=3),
 dict(tf='15m',coins=['BTC'],hold=48,min_stop=0.003,split='2026-09-07',lvl='ext',lb=96),
 dict(tf='15m',coins=['BTC'],hold=48,min_stop=0.003,split='2026-09-07',os=35,ob=65),
 dict(tf='1h',hold=36,min_stop=0.004),
 dict(tf='1h',hold=36,min_stop=0.004,tp_r=3),
 dict(tf='1h',hold=36,min_stop=0.004,lvl='ext',lb=48),
 dict(tf='1h',hold=36,min_stop=0.004,os=35,ob=65),
 dict(tf='1h',hold=36,min_stop=0.004,trend=True),
 dict(tf='1h',hold=36,min_stop=0.004,L=5,R=5),
 dict(tf='4h',hold=18,min_stop=0.008,lvl='ext',lb=30),
]
rows=[]
for g in grid:
    T=run(g); r=dict(cfg=json.dumps(g),**stats(T,pd.Timestamp(g.get('split','2026-06-01'),tz='UTC')))
    if len(T):
        for c in ('BTC','ETH'): s=T[T.coin==c]; r[c]=f"{len(s)}/{round(s.R.mean(),2) if len(s) else '-'}"
    rows.append(r)
    if g['tf']=='15m' and g.get('tp_r') is None and g.get('lvl') is None and g.get('os') is None: T.to_csv('lvl15.csv',index=False)
pd.set_option('display.width',260); pd.set_option('display.max_colwidth',100)
print(pd.DataFrame(rows).to_string(index=False))
