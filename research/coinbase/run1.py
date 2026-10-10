from bt import *
import itertools
res=[]
for asset in ['btc_d','eth_d']:
    d=load(asset)
    w=d.resample('W-SUN').agg({'o':'first','h':'max','l':'min','c':'last'})
    c=d.c
    sma=lambda n: c.rolling(n).mean()
    ema=lambda n: c.ewm(span=n,adjust=False).mean()
    wema20=w.c.ewm(span=20,adjust=False).mean(); wsma50=w.c.rolling(50).mean()
    # weekly signals forward-filled to days (known at weekly close)
    wk=lambda s: s.reindex(d.index,method='ffill')
    sigs={
     'hold': pd.Series(True,index=d.index),
     '200D': c>sma(200),
     '200D_buf3': None,
     '50/200 cross': sma(50)>sma(200),
     '20W EMA (wk close)': wk(w.c>wema20),
     '50W SMA (wk close)': wk(w.c>wsma50),
     '200D & 20W': (c>sma(200)) & wk(w.c>wema20),
     '100D': c>sma(100),
     '21D EMA': c>ema(21),
     '50D': c>sma(50),
    }
    # hysteresis 200D: enter >1.0*, exit < 0.97*
    s=[];st=False;m=sma(200)
    for x,mm in zip(c,m):
        if np.isnan(mm): s.append(False);continue
        if not st and x>mm*1.02: st=True
        elif st and x<mm*0.97: st=False
        s.append(st)
    sigs['200D_buf3']=pd.Series(s,index=d.index)
    start = '2016-01-01' if asset=='btc_d' else '2017-06-01'
    for per in [(start,'2020-12-31'),('2021-01-01','2026-10-10'),(start,'2026-10-10')]:
        dd=d[per[0]:per[1]]
        for k,v in sigs.items():
            eq,tr=regime_bt(dd, v[per[0]:per[1]])
            r=stats(eq,tr,k); r.update({'asset':asset[:3],'per':per[0][:4]+'-'+per[1][:4]}); res.append(r)
pd.set_option('display.width',200)
R=pd.DataFrame(res)
for (a,p),g in R.groupby(['asset','per'],sort=False):
    print('\n==',a,p); print(g.drop(columns=['asset','per']).to_string(index=False))
