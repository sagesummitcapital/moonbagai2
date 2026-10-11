import json,glob,os,numpy as np,pandas as pd,itertools
P={}
for f in glob.glob('*.json'):
    b=json.load(open(f)); s=pd.Series(b['c'],index=pd.to_datetime(b['t'],unit='s').normalize()); P[os.path.basename(f)[:-5]]=s[~s.index.duplicated()]
px=pd.DataFrame(P).sort_index().ffill(limit=3)
print('COPX last',px.COPX.dropna().iloc[-1], 'SPY last', px.SPY.iloc[-1])
rets=px.pct_change()
ms=px.resample('ME').last().index
ms=[px.index[px.index<=m][-1] for m in ms]
UNI=[c for c in px.columns if c not in ('SPY','TLT')]
def stats(eq):
    yrs=(eq.index[-1]-eq.index[0]).days/365.25; cagr=eq.iloc[-1]**(1/yrs)-1; dd=(eq/eq.cummax()-1).min()
    r=eq.pct_change().dropna(); sh=r.mean()/r.std()*np.sqrt(252)
    return dict(cagr=round(cagr*100,1),dd=round(dd*100,1),sharpe=round(sh,2))
def run(lb='6m',top=3,trend=True,start='2015-01-01',end='2026-12-31',cost=0.001,uni=UNI,fallback=None):
    eq=[];idx=[];cur={};val=1.0
    days=px.loc[start:end].index
    reb=set(d for d in ms if d>=days[0])
    for d in days:
        if cur:
            val*=1+sum(w*(rets.at[d,a] if not np.isnan(rets.at[d,a]) else 0) for a,w in cur.items())
        if d in reb:
            h=px.loc[:d]
            if len(h)<260: continue
            sc={}
            for a in uni:
                s=h[a].dropna()
                if len(s)<260: continue
                m={'3m':s.iloc[-1]/s.iloc[-63]-1,'6m':s.iloc[-1]/s.iloc[-126]-1,'12m1':s.iloc[-21]/s.iloc[-252]-1,
                   'blend':(s.iloc[-1]/s.iloc[-63]-1)+(s.iloc[-1]/s.iloc[-126]-1)+(s.iloc[-21]/s.iloc[-252]-1)}[lb]
                if trend and s.iloc[-1]<s.iloc[-200:].mean(): continue
                sc[a]=m
            pick=sorted(sc,key=lambda a:-sc[a])[:top]
            new={a:1/top for a in pick}
            if fallback and len(pick)<top: new[fallback]=new.get(fallback,0)+(top-len(pick))/top
            turn=sum(abs(new.get(a,0)-cur.get(a,0)) for a in set(new)|set(cur)); val*=1-cost*turn; cur=new
        eq.append(val); idx.append(d)
    return pd.Series(eq,index=idx)
rows=[]
for start,end in [('2015-01-01','2026-12-31'),('2015-01-01','2020-12-31'),('2021-01-01','2026-12-31')]:
    for bm in ['SPY','QQQ']:
        s=px[bm].loc[start:end]; r=stats(s/s.iloc[0]); r.update(name=bm,start=start,end=end); rows.append(r)
    for lb,top,trend in itertools.product(['3m','6m','12m1','blend'],[1,3,5],[True,False]):
        e=run(lb,top,trend,start,end); r=stats(e); r.update(name=f'rot {lb} top{top} trend{int(trend)}',start=start,end=end); rows.append(r)
df=pd.DataFrame(rows); df.to_csv('rot.csv',index=False)
pd.set_option('display.width',200)
for (s,e),g in df.groupby(['start','end']): print(s,e); print(g.sort_values('sharpe',ascending=False).head(12).to_string(index=False))
