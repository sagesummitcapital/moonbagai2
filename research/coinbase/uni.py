import json, glob, os, numpy as np, pandas as pd
FEE_T=0.006; FEE_M=0.004
MAJORS={'btc','eth','sol'}
def load(path):
    b=json.load(open(path))['bars']
    df=pd.DataFrame({k:b[k] for k in ['t','o','h','l','c','v'] if k in b}); df['date']=pd.to_datetime(df.t,unit='s').dt.normalize()
    df=df.set_index('date').drop(columns='t').astype(float)
    df=df[~df.index.duplicated(keep='last')].sort_index()
    return df.iloc[:-1]  # drop forming bar
def atr(d,n=14):
    tr=pd.concat([d.h-d.l,(d.h-d.c.shift()).abs(),(d.l-d.c.shift()).abs()],axis=1).max(axis=1); return tr.rolling(n).mean()
def regime(c, up=1.02, dn=0.97):
    m=c.rolling(200).mean(); s=[]; st=False
    for x,mm in zip(c,m):
        if np.isnan(mm): s.append(False); continue
        if not st and x>mm*up: st=True
        elif st and x<mm*dn: st=False
        s.append(st)
    return pd.Series(s,index=c.index)
def prep(d,lb=55):
    d=d.copy(); d['atr']=atr(d); d['reg']=regime(d.c); d['hh']=d.h.rolling(lb).max().shift(1); d['ll20']=d.l.rolling(20).min().shift(1)
    d['n']=np.arange(len(d)); d['ret90']=d.c/d.c.shift(90)-1; d['ret30']=d.c/d.c.shift(30)-1
    d['vol']=(d.atr/d.c)
    d['dv']=(d.c*d.v).rolling(30).mean() if 'v' in d else np.nan
    return d
def universe(names=None):
    U={}
    for f in sorted(glob.glob('u/*_d.json')):
        n=os.path.basename(f)[:-7]
        if names and n not in names: continue
        U[n]=prep(load(f))
    U['eth']=prep(load('eth_d.json')) if (names is None or 'eth' in names) else None
    return {k:v for k,v in U.items() if v is not None}
def run(U, risk=0.05, max_open_risk=0.15, max_pos=3, stop_atr=3, tp1R=3, tp1_frac=0.5, start='2021-01-01', end='2026-12-31',
        btc_gate=False, rank='rs90', min_hist=250, slip_major=0.0005, slip_alt=0.003, rs_min=None, max_vol=None, alt_risk=None, top_dv=None, alt_lb=None, elig=None):
    D={a:d[start:end] for a,d in U.items()}
    btc=U['btc']; btc90=btc.ret90
    idx=sorted(set().union(*[set(x.index) for x in D.values()]))
    cash=1.0; pos={}; trades=[]; curve=[]
    for t in idx:
        for a in list(pos):
            d=D[a]
            if t not in d.index: continue
            r=d.loc[t]; p=pos[a]; ex=None; sl=p['slip']
            if r.l<=p['stop']: ex=min(r.o,p['stop'])*(1-sl); why='stop'
            else:
                if not p['tp1'] and r.h>=p['tp1px']:
                    q=p['u']*tp1_frac; v=q*p['tp1px']*(1-FEE_M); cash+=v; p['out']+=v; p['u']-=q; p['tp1']=True; p['stop']=max(p['stop'],p['e']*1.012)
                if p['tp1']: p['stop']=max(p['stop'],r.ll20)
                if not r.reg: ex=r.c*(1-sl); why='regime'
            if ex:
                v=p['u']*ex*(1-FEE_T); cash+=v; p['out']+=v
                trades.append({'a':a,'R':(p['out']-p['cost'])/p['riskamt'],'why':why,'d0':p['d0'],'d1':t,'pnl':p['out']-p['cost']})
                del pos[a]
        px_of=lambda a: D[a].c.asof(t)
        eqv=cash+sum(pos[a]['u']*px_of(a) for a in pos)
        open_risk=sum(max(0,p['u']*(p['e']-p['stop'])) for p in pos.values())/eqv
        cands=[]
        bt_ok = btc.reg.asof(t) if btc_gate else True
        for a,d in D.items():
            if a in pos or t not in d.index: continue
            r=d.loc[t]
            if r.n<min_hist or not r.reg or np.isnan(r.hh) or not r.c>r.hh: continue
            if a!='btc' and not bt_ok: continue
            rs=(r.ret90 - btc90.asof(t)) if a!='btc' else 0.0
            if rs_min is not None and a!='btc' and (np.isnan(rs) or rs<rs_min): continue
            if max_vol and r.vol>max_vol: continue
            score={'rs90':rs, 'ret30':r.ret30, 'brk':r.c/r.hh, 'lowvol':-r.vol, 'alpha':0, 'maj':(10 if a in MAJORS else 0)+(rs if not np.isnan(rs) else -1)}[rank]
            cands.append((score if not np.isnan(score) else -9, a, r))
        if top_dv:
            dvs=sorted((float(np.nan_to_num(D[a].dv.asof(t))) if 'dv' in D[a] else 0.0, a) for a in D if t in D[a].index)
            topset={a for _,a in dvs[-top_dv:]}
            cands=[x for x in cands if x[1] in topset or x[1] in MAJORS]
        if elig: cands=[x for x in cands if elig(x[1],t,trades)]
        cands.sort(key=lambda x:-x[0])
        for _,a,r in cands:
            if len(pos)>=max_pos: break
            sl=slip_major if a in MAJORS else slip_alt
            px=r.c*(1+sl); stop=px-stop_atr*r.atr
            if stop<=0: continue
            dist=(px-stop)/px+2*FEE_T
            rk=min(risk if (a in MAJORS or alt_risk is None) else alt_risk, max_open_risk-open_risk)
            if rk<0.01: break
            notional=min(eqv*rk/dist, cash*0.999)
            if notional<eqv*0.05: continue
            u=notional*(1-FEE_T)/px; cash-=notional
            pos[a]={'e':px,'stop':stop,'u':u,'cost':notional,'out':0.0,'tp1':False,'tp1px':px+tp1R*(px-stop),'riskamt':notional*dist,'d0':t,'slip':sl}
            open_risk+=notional*dist/eqv
        curve.append(cash+sum(pos[a]['u']*px_of(a) for a in pos))
    return pd.Series(curve,index=idx), pd.DataFrame(trades)
def stats(c,tr):
    yrs=(c.index[-1]-c.index[0]).days/365.25; cagr=c.iloc[-1]**(1/yrs)-1; dd=(c/c.cummax()-1).min()
    w=tr[tr.R>0]; l=tr[tr.R<=0]
    pf=w.pnl.sum()/-l.pnl.sum() if len(l) and l.pnl.sum() else np.inf
    return dict(cagr=round(cagr*100,1), dd=round(dd*100,1), mar=round(cagr/-dd,2), n=len(tr), win=round(len(w)/max(1,len(tr))*100), avgR=round(tr.R.mean(),2),
                avgW=round(w.R.mean(),2), avgL=round(l.R.mean(),2), pf=round(pf,2), final=round(c.iloc[-1],2))
