from load import load
import numpy as np, pandas as pd
FEE_T=0.006; FEE_M=0.004; SLIP=0.0005
def stats(eq, trades=None, name=''):
    eq=eq.dropna(); yrs=(eq.index[-1]-eq.index[0]).days/365.25
    cagr=(eq.iloc[-1]/eq.iloc[0])**(1/yrs)-1
    dd=(eq/eq.cummax()-1).min()
    r={'name':name,'cagr%':round(100*cagr,1),'maxdd%':round(100*dd,1),'mar':round(cagr/abs(dd),2) if dd<0 else None,'x':round(eq.iloc[-1]/eq.iloc[0],1)}
    if trades is not None and len(trades):
        t=pd.DataFrame(trades); r.update({'n':len(t),'win%':round(100*(t.ret>0).mean()),'avg%':round(100*t.ret.mean(),1)})
        if 'R' in t: r.update({'avgR':round(t.R.mean(),2),'totR':round(t.R.sum(),1)})
    return r
def regime_bt(df, sig, fee=FEE_T, cash_yield=0.0):
    """sig: boolean series, decided on close of day i, acted at close (same price) of day i -> conservative: act next day's open"""
    s=sig.shift(1).fillna(False).astype(bool)  # position held on day i based on signal at close of i-1, filled at open i
    eq=[1.0]; pos=False; trades=[]; entry=None
    o=df.o.values; c=df.c.values; idx=df.index
    val=1.0
    for i in range(1,len(df)):
        want=s.iloc[i]
        if want and not pos:
            px=o[i]*(1+SLIP); val*=(1-fee); units=val/px; pos=True; entry=px
        elif not want and pos:
            px=o[i]*(1-SLIP); val=units*px*(1-fee); pos=False; trades.append({'ret':px/entry*(1-fee)**2-1})
        if pos: val_now=units*c[i]
        else:
            val*= (1+cash_yield)**(1/365); val_now=val
        eq.append(val_now)
    return pd.Series(eq,index=idx), trades
def dca(df, every=7, amount=1.0, fee=FEE_T, mask=None):
    units=0; spent=0; eq=[]; idx=df.index
    for i in range(len(df)):
        if i%every==0 and (mask is None or mask.iloc[i]):
            units+=amount*(1-fee)/df.c.iloc[i]; spent+=amount
        eq.append((units*df.c.iloc[i], spent))
    e=pd.DataFrame(eq,index=idx,columns=['val','spent'])
    return e
