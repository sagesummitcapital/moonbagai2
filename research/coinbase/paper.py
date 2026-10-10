from uni import *
def paper(d, min_hist=250):
    rows=[]; p=None
    for t,r in d.iterrows():
        if p:
            ex=None
            if r.l<=p['cur']: ex=min(r.o,p['cur']); why='stop'
            else:
                if not p['tp1d'] and r.h>=p['tp1']: p['tp1d']=True; p['cur']=max(p['cur'],p['e']*1.012)
                if p['tp1d'] and not np.isnan(r.ll20): p['cur']=max(p['cur'],r.ll20)
                if not r.reg: ex=r.c; why='regime'
            if ex is not None:
                e=p['e']; den=(e-p['s0'])+0.012*e
                proceeds=(0.5*p['tp1']*(1-FEE_M)+0.5*ex*(1-FEE_T)) if p['tp1d'] else ex*(1-FEE_T)
                p.update(closed=t, exit=ex, R=(proceeds-e*(1+FEE_T))/den, why=why); rows.append(p); p=None
        if p is None and r.n>=min_hist and r.reg and not np.isnan(r.hh) and r.c>r.hh and not np.isnan(r.atr):
            s0=r.c-3*r.atr
            if s0>0: p=dict(opened=t,e=r.c,s0=s0,tp1=r.c+3*(r.c-s0),cur=s0,tp1d=False,closed=None,exit=None,R=None,why=None)
    if p: rows.append(p)
    return rows
if __name__=='__main__':
    U=universe(); out={}
    for a,d in U.items(): out[a]=paper(d)
    import pickle; pickle.dump(out,open('paper.pkl','wb'))
    for a,rs in sorted(out.items()):
        cl=[x for x in rs if x['closed'] is not None]; op=[x for x in rs if x['closed'] is None]
        R=[x['R'] for x in cl]
        live = a in MAJORS or (len(R)>=4 and np.mean(R)>=0.5)
        print(f"{a:7s} n={len(R):2d} avg={np.mean(R) if R else float('nan'):5.2f} last4={np.mean(R[-4:]) if R else float('nan'):5.2f} open={'Y '+str(op[0]['opened'].date()) if op else '-'} live={live}")
