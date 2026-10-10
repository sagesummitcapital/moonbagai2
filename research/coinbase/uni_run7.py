exec(open('uni_run4.py').read().split("B={k")[0])
import json
B={k:U[k] for k in ['btc','eth','sol']}
out=[]
for st in ['2021-01-01','2023-01-01']:
  for name,UU,k in [('base3',B,{}),('open36_naive',U,dict(btc_gate=False)),('open36_earned',U,dict(btc_gate=True,rank='maj',alt_risk=0.025,elig=mk_elig(4,0.5)))]:
    c,t=run(UU,start=st,**k); s=stats(c,t)
    out.append(dict(name=name,start=st,n=len(t),wins=int((t.R>0).sum()),avg_r=round(t.R.mean(),3),total_r=round(t.R.sum(),2),cagr=s['cagr'],dd=s['dd'],pf=s['pf']))
    print(out[-1])
json.dump(out,open('g7.json','w'),default=float)
