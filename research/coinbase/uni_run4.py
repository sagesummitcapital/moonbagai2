from uni import *
exec(open('uni_run3.py').read().split("rows=[]")[0].split("U=universe()")[1]) if False else None
U=universe()
shadow={}
for a in U:
    c,t=run({a:U[a],'btc':U['btc']},max_pos=1,elig=lambda x,tt,tr,a=a: x==a,start='2020-06-01'); shadow[a]=t
def mk_elig(minn=2,thr=0.0,last=None):
    def f(a,t,tr):
        if a in MAJORS: return True
        s=shadow[a]; s=s[s.d1<t] if len(s) else s
        if last: s=s.tail(last)
        return len(s)>=minn and s.R.mean()>thr
    return f
B={k:U[k] for k in ['btc','eth','sol']}
for per in [('2021-01-01','2026-12-31'),('2023-01-01','2026-12-31'),('2024-06-01','2026-12-31')]:
    c,t=run(B,start=per[0]); s=stats(c,t); print(per[0],'base3',{k:s[k] for k in ['cagr','dd','mar','n','win','avgR','pf']})
    for name,k in [('maj-first alt2.5 wf2 top10',dict(rank='maj',alt_risk=0.025,elig=mk_elig(2),top_dv=10)),
                   ('maj-first alt2.5 wf2',dict(rank='maj',alt_risk=0.025,elig=mk_elig(2))),
                   ('maj-first alt1.5 wf2 rs0',dict(rank='maj',alt_risk=0.015,elig=mk_elig(2),rs_min=0.0)),
                   ('maj-first alt2.5 wf2 mp5',dict(rank='maj',alt_risk=0.025,elig=mk_elig(2),max_pos=5)),
                   ('maj-first alt2.5 wf2 thr0.5',dict(rank='maj',alt_risk=0.025,elig=mk_elig(2,0.5))),
                   ('maj-first all-alts 2.5',dict(rank='maj',alt_risk=0.025))]:
        c,t=run(U,btc_gate=True,start=per[0],**k); s=stats(c,t)
        alts=t[~t.a.isin(list(MAJORS))] if len(t) else t
        print(per[0],name,{k:s[k] for k in ['cagr','dd','mar','n','win','avgR','pf']}, 'alt n',len(alts),'alt avgR',round(alts.R.mean(),2) if len(alts) else None, flush=True)
