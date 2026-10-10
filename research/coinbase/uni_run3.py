from uni import *
import itertools
U=universe()
# standalone shadow trades per coin for walk-forward eligibility
shadow={}
for a in U:
    c,t=run({a:U[a],'btc':U['btc']},max_pos=1,elig=lambda x,tt,tr,a=a: x==a,start='2020-06-01')
    shadow[a]=t
def mk_elig(minn=2, thr=0.0, last=None, majors_free=True):
    def f(a,t,tr):
        if majors_free and a in MAJORS: return True
        s=shadow[a]; s=s[s.d1<t] if len(s) else s
        if last: s=s.tail(last)
        return len(s)>=minn and s.R.mean()>thr
    return f
rows=[]
def go(name,**k):
    c,t=run(U,**k); s=stats(c,t); s['name']=name; rows.append(s); print(name, {k:s[k] for k in ['cagr','dd','mar','n','win','avgR','pf']}, flush=True)
B={k:U[k] for k in ['btc','eth','sol']}
c,t=run(B); s=stats(c,t); print('base3',s)
for gate,rs,ar,top,el in itertools.product([True],[None,0.0],[None,0.025],[None,10],[None,'wf2','wf3l']):
    e={'wf2':mk_elig(2),'wf3l':mk_elig(3,0.0,last=4),None:None}[el]
    go(f'gate rs{rs} altrisk{ar} top{top} elig{el}',btc_gate=gate,rs_min=rs,alt_risk=ar,top_dv=top,elig=e,max_pos=3)
pd.DataFrame(rows).to_csv('g3.csv',index=False)
