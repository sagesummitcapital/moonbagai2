from sweep import *
import sys
rows=[]
for tf in ['15','60']:
    D={a:load(f'{a}_{tf}') for a in ['btc','eth','sol']}
    S={};H4={}
    for a in D: S[a],H4[a]=swings(D[a])
    fb,rb=(4,4) if tf=='60' else (6,8)
    for em,mr,bias,smt in itertools.product(['close','fvg'],[2.0,3.0],[None,'with','need'],[None]):
        T=pd.concat([run(a,D,S,H4,win=(0,24),days=tuple(range(7)),min_r=mr,stop_mode='sweep',smt=(['btc','eth','sol'] if smt else None),bias=bias,fvg_bars=fb,retest_bars=rb,entry_mode=em) for a in D],ignore_index=True)
        s=stats(T); s.update(tf=tf,entry=em,min_r=mr,bias=bias,smt=smt)
        if len(T):
            ds=pd.to_datetime(T.day); h=ds<ds.quantile(0.5)
            s['avgR_h1']=round(T[h].R.mean(),2); s['avgR_h2']=round(T[~h].R.mean(),2)
        rows.append(s); print(s, flush=True)
pd.DataFrame(rows).to_csv('g2.csv',index=False)
