from sweep import *
rows=[]
for tf in ['60','15']:
    D={a:load(f'{a}_{tf}') for a in ['btc','eth','sol']}
    S={};H4={}
    for a in D: S[a],H4[a]=swings(D[a])
    fb,rb=(4,4) if tf=='60' else (6,8)
    for em in (['close'] if tf=='60' else ['close','fvg']):
      for win in [(12,24),(13.5,16),(12,20)]:
        for mr,bias in itertools.product([2.0,3.0],[None,'with','need']):
            T=pd.concat([run(a,D,S,H4,win=win,days=tuple(range(7)),min_r=mr,stop_mode='sweep',bias=bias,fvg_bars=fb,retest_bars=rb,entry_mode=em) for a in D],ignore_index=True)
            s=stats(T); s.update(tf=tf,entry=em,win=win,min_r=mr,bias=bias)
            if len(T):
                ds=pd.to_datetime(T.day); h=ds<ds.quantile(0.5)
                s['h1']=round(T[h].R.mean(),2); s['h2']=round(T[~h].R.mean(),2)
                s['by_coin']={a:round(T[T.asset==a].R.mean(),2) for a in D}
            rows.append(s); print(s, flush=True)
pd.DataFrame(rows).to_csv('g3.csv',index=False)
