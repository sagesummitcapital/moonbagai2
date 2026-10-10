from swing import *
def prep(d,lb=55):
    d=d.copy(); d['atr']=atr(d); d['reg']=regime(d,'200buf')
    d['hh55']=d.h.rolling(lb).max().shift(1); d['ll20']=d.l.rolling(20).min().shift(1)
    return d
def port(assets, risk=0.05, max_open_risk=0.15, max_notional=1.0, stop_atr=3, tp1R=3, tp1_frac=0.5, gate='own', start='2021', end='2026', fee=FEE_T, cash_apy=0.0, entry_mode='close', lb=55):
    D={a:prep(load(a+'_d'),lb)[start:end] for a in assets}
    btcreg=prep(load('btc_d'))['reg'][start:end]
    idx=sorted(set().union(*[set(x.index) for x in D.values()]))
    cash=1.0; pos={}; trades=[]; curve=[]
    for t in idx:
        # exits / management
        for a in list(pos):
            d=D[a]
            if t not in d.index: continue
            r=d.loc[t]; p=pos[a]
            exitpx=None
            if r.l<=p['stop']: exitpx=min(r.o,p['stop'])*(1-SLIP); why='stop'
            else:
                if not p['tp1'] and r.h>=p['tp1px']:
                    q=p['u']*tp1_frac; cash+=q*p['tp1px']*(1-FEE_M); p['out']+=q*p['tp1px']*(1-FEE_M); p['u']-=q; p['tp1']=True; p['stop']=max(p['stop'],p['e']*1.012)
                if p['tp1']: p['stop']=max(p['stop'],r.ll20)
                regok = r.reg if gate=='own' else (btcreg.get(t,True) if gate=='btc' else True)
                if gate!='none' and not regok: exitpx=r.c*(1-SLIP); why='regime'
            if exitpx:
                cash+=p['u']*exitpx*(1-fee); pnl=cash-p['cash0']  # not used
                ret=(p['realized']+p['u']*exitpx*(1-fee)) if False else None
                p['out']+=p['u']*exitpx*(1-fee)
                trades.append({'asset':a,'R':(p['out']-p['cost'])/p['riskamt'],'ret':p['out']/p['cost']-1,'why':why,'d0':p['d0'],'d1':t})
                del pos[a]
            else:
                pass
        # mark
        def mark():
            return cash+sum(pos[a]['u']*D[a].c.asof(t) for a in pos)
        eqv=mark()
        # entries
        open_risk=sum(max(0,(p['u']*(p['e']-p['stop'])))for p in pos.values())/eqv
        for a,d in D.items():
            if a in pos or t not in d.index: continue
            r=d.loc[t]
            regok = r.reg if gate=='own' else (btcreg.get(t,False) and r.reg if gate=='btc' else True)
            if not regok or np.isnan(r.hh55) or not (r.c>r.hh55): continue
            px=r.c*(1+SLIP); stop=px-stop_atr*r.atr; dist=(px-stop)/px+2*fee
            rk=min(risk, max_open_risk-open_risk)
            if rk<0.01: continue
            notional=min(eqv*rk/dist, cash*0.999, eqv*max_notional-sum(pos[x]['u']*D[x].c.asof(t) for x in pos))
            if notional<eqv*0.05: continue
            u=notional*(1-fee)/px; cash-=notional
            pos[a]={'e':px,'stop':stop,'u':u,'cost':notional,'out':0.0,'tp1':False,'tp1px':px+tp1R*(px-stop),'riskamt':notional*dist,'d0':t,'cash0':0}
            open_risk+=notional*dist/eqv
        # tp1 proceeds tracked into 'out'
        cash*= (1+cash_apy)**(1/365) if not pos else 1
        curve.append(mark())
    return pd.Series(curve,index=idx), trades
