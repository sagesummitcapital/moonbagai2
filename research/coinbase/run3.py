from swing import *
pd.set_option('display.width',250)
def core(d, risk=0.10, start=None, end=None, fee=FEE_T):
    """Trend core: on regime BULL flip, buy; stop = 200D*0.97 (regime exit); size = min(risk/dist,1)."""
    d=d.copy(); d['reg']=regime(d,'200buf'); d['m']=d.c.rolling(200).mean()
    if start: d=d[start:end]
    eq=1.0; pos=None; curve=[]; trades=[]
    for i in range(1,len(d)):
        r=d.iloc[i]; p=d.iloc[i-1]
        if pos and not p.reg:  # exit at open after close-based regime flip
            px=r.o*(1-SLIP); cash=pos['u']*px*(1-fee); pnl=cash-pos['cost']; eq+=pnl
            trades.append({'ret':pnl/pos['cost'],'R':pnl/pos['risk']}); pos=None
        if not pos and p.reg:
            px=r.o*(1+SLIP); stop=p.m*0.97; dist=max((px-stop)/px,0.03)+2*fee
            notional=min(eq*risk/dist, eq); pos={'u':notional*(1-fee)/px,'cost':notional,'risk':notional*dist}
        curve.append(eq if not pos else eq-pos['cost']+pos['u']*r.c)
    return pd.Series(curve,index=d.index[1:]),trades
rows=[]
for a in ['btc','eth','sol']:
    d=load(a+'_d')
    pers=[('2016','2020'),('2021','2026'),('2016','2026')] if a!='sol' else [('2021','2026')]
    if a=='eth': pers=[('2017','2020'),('2021','2026'),('2017','2026')]
    for per in pers:
        dd=d[per[0]:per[1]]
        eq=dd.c/dd.c.iloc[0]; rows.append({**stats(eq,None,'hold'),'asset':a,'per':per[0]})
        for rk in [0.05,0.10,0.20]:
            eq,tr=core(d,rk,*per); rows.append({**stats(eq,tr,f'core r{int(rk*100)}'),'asset':a,'per':per[0]})
        for rk in [0.03,0.05,0.10]:
            for reg in ['200buf','none']:
                eq,tr=sim(d,e_breakout55,risk=rk,stop_atr=3,tp1R=3,trail='ll20',reg=reg,regime_exit=(reg!='none'),start=per[0],end=per[1])
                rows.append({**stats(eq,tr,f'swing55 r{int(rk*100)} {reg}'),'asset':a,'per':per[0]})
        # combo 50/50 core r10 + swing r5
        e1,t1=core(d,0.10,*per); e2,t2=sim(d,e_breakout55,risk=0.05,stop_atr=3,tp1R=3,trail='ll20',start=per[0],end=per[1])
        e=(0.5*e1+0.5*e2.reindex(e1.index).ffill()).dropna(); rows.append({**stats(e,None,'combo core10+swing5'),'asset':a,'per':per[0]})
R=pd.DataFrame(rows)
for (a,p),g in R.groupby(['asset','per'],sort=False):
    print('\n==',a,p); print(g.drop(columns=['asset','per']).to_string(index=False))
