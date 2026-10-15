"""Does a combo / stablecoin-dominance signal predict BTC's next 24h / 72h? (information value, before fees)"""
import pandas as pd, numpy as np
from div import load, combo_votes
btc = load('BTC_4h')
names = ['TOTAL','TOTAL2','TOTAL3','USDTD','USDCD','BTC','ETH']
fr = {n: load(f'{n}_4h') for n in names}
for N in (2,3,4):
    votes = combo_votes(fr, {}); ts = sorted(votes); W = pd.Timedelta(hours=12)
    rows=[]
    for t in ts:
        win=[v for t2 in ts if t-W<=t2<=t for v in votes[t2]]
        bu=len({n for n,s in win if s=='bull'}); be=len({n for n,s in win if s=='bear'})
        if max(bu,be)<N or bu==be: continue
        sg=1 if bu>be else -1
        if t not in btc.index: continue
        i=btc.index.get_loc(t)
        if i+18>=len(btc): continue
        e=btc.o.iloc[i+1]
        rows.append(dict(t=t,sg=sg,r24=sg*(btc.c.iloc[i+6]/e-1)*100,r72=sg*(btc.c.iloc[i+18]/e-1)*100))
    T=pd.DataFrame(rows).drop_duplicates('t')
    # de-cluster: one per 24h
    T=T[T.t.diff().fillna(pd.Timedelta(days=9))>pd.Timedelta(hours=24)]
    print(f"combo N>={N}: n={len(T)} hit24={100*(T.r24>0).mean():.0f}% avg24={T.r24.mean():+.2f}% hit72={100*(T.r72>0).mean():.0f}% avg72={T.r72.mean():+.2f}%")
# USDT.D trend: EMA20 slope down -> long BTC next 24h?
u=fr['USDTD']; u['slope']=u.c.ewm(span=20).mean().diff(3)
j=btc.join(u[['slope']],how='inner')
j['f24']=j.c.shift(-6)/j.o.shift(-1)-1
for nm,mask in [('USDT.D falling',j.slope<0),('USDT.D rising',j.slope>0)]:
    print(nm, f"bars={mask.sum()} BTC next-24h avg {100*j.f24[mask].mean():+.3f}% up {100*(j.f24[mask]>0).mean():.0f}%")
print('BTC baseline next-24h', f"{100*j.f24.mean():+.3f}%")
print('same-bar corr USDT.D vs BTC 4h returns', round(j.c.pct_change().corr(u.c.pct_change().reindex(j.index)),2))
