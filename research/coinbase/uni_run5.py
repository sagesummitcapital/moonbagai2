exec(open('uni_run4.py').read().split("B={k")[0])
for st in ['2021-01-01','2023-01-01','2024-06-01']:
  for mn in [2,3,4]:
    for thr in [0.3,0.5,0.75,1.0]:
        c,t=run(U,btc_gate=True,start=st,rank='maj',alt_risk=0.025,elig=mk_elig(mn,thr)); s=stats(c,t)
        al=t[~t.a.isin(list(MAJORS))]
        print(st,mn,thr,{k:s[k] for k in ['cagr','dd','mar','n','avgR','pf']},'alts',len(al),round(al.R.mean(),2) if len(al) else '-',flush=True)
