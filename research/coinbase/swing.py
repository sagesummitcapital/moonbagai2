from bt import *
def atr(d,n=14):
    tr=pd.concat([d.h-d.l,(d.h-d.c.shift()).abs(),(d.l-d.c.shift()).abs()],axis=1).max(axis=1)
    return tr.rolling(n).mean()
def regime(d, kind='200buf'):
    c=d.c; m=c.rolling(200).mean()
    if kind=='none': return pd.Series(True,index=d.index)
    s=[];st=False
    for x,mm in zip(c,m):
        if np.isnan(mm): s.append(False);continue
        if not st and x>mm*1.02: st=True
        elif st and x<mm*0.97: st=False
        s.append(st)
    r=pd.Series(s,index=d.index)
    if kind=='200buf+20w':
        w=d.resample('W-SUN').agg({'c':'last'}); we=w.c.ewm(span=20,adjust=False).mean()
        r=r & (w.c>we).reindex(d.index,method='ffill').fillna(False)
    return r
def sim(d, entry_rule, risk=0.02, stop_atr=2.5, tp1R=2.0, tp1_frac=0.5, trail='chand3', reg='200buf', fee=FEE_T, maxpos=1.0, regime_exit=True, start=None, end=None):
    d=d.copy(); d['atr']=atr(d); d['reg']=regime(d,reg)
    d['hh20']=d.h.rolling(20).max().shift(1); d['ll10']=d.l.rolling(10).min().shift(1); d['ll20']=d.l.rolling(20).min().shift(1)
    d['ema21']=d.c.ewm(span=21,adjust=False).mean(); d['sma50']=d.c.rolling(50).mean(); d['sma200']=d.c.rolling(200).mean()
    d['hh55']=d.h.rolling(55).max().shift(1)
    if start: d=d[start:end]
    eq=1.0; curve=[]; pos=None; trades=[]
    for i in range(1,len(d)):
        row=d.iloc[i]; prev=d.iloc[i-1]
        if pos:
            # stop check intraday (gap aware)
            exitpx=None; reason=None
            if row.l<=pos['stop']:
                exitpx=min(row.o,pos['stop'])*(1-SLIP); reason='stop'
            else:
                if not pos['tp1done'] and row.h>=pos['tp1']:
                    q=pos['units']*tp1_frac; px=pos['tp1']
                    eq_cash=q*px*(1-FEE_M); pos['cash']+=eq_cash; pos['units']-=q; pos['tp1done']=True; pos['stop']=max(pos['stop'],pos['entry']*1.01)
                # trail on close
                if trail=='chand3': ts=d.h.iloc[max(0,i-22):i+1].max()-3*row.atr
                elif trail=='ll20': ts=row.ll20
                elif trail=='ll10': ts=row.ll10
                elif trail=='none': ts=-1
                if pos['tp1done'] or trail!='none': 
                    if pos['tp1done']: pos['stop']=max(pos['stop'],ts)
                if regime_exit and not row.reg: exitpx=row.c*(1-SLIP); reason='regime'
            if exitpx:
                pos['cash']+=pos['units']*exitpx*(1-fee)
                pnl=pos['cash']-pos['cost']
                R=pnl/pos['riskamt']; eq+=pnl
                trades.append({'ret':pnl/pos['cost'],'R':R,'reason':reason,'entry_date':pos['date'],'exit_date':d.index[i]})
                pos=None
        if not pos and row.reg:
            sig=entry_rule(d,i)
            if sig:
                px=row.c*(1+SLIP); stop=sig if isinstance(sig,float) else px-stop_atr*row.atr
                if stop>=px: stop=px-stop_atr*row.atr
                dist=(px-stop)/px
                notional=min(eq*risk/(dist+2*fee), eq*maxpos)
                units=notional*(1-fee)/px
                riskamt=notional*(dist+2*fee)
                pos={'entry':px,'stop':stop,'units':units,'cost':notional,'cash':0.0,'tp1':px+tp1R*(px-stop),'tp1done':False,'riskamt':riskamt,'date':d.index[i]}
        mark=eq if not pos else eq-pos['cost']+pos['cash']+pos['units']*row.c
        curve.append(mark)
    return pd.Series(curve,index=d.index[1:]), trades
# entry rules (decided at close i)
def e_breakout20(d,i): r=d.iloc[i]; return r.c>r.hh20
def e_breakout55(d,i): r=d.iloc[i]; return r.c>r.hh55
def e_pullback21(d,i):
    r=d.iloc[i]; p=d.iloc[i-1]
    return (r.c>r.sma50) and (r.l<=r.ema21*1.005) and (r.c>r.ema21) and (r.c>p.c)
def e_pullback_struct(d,i):
    r=d.iloc[i]; p=d.iloc[i-1]
    if (r.c>r.sma50) and (r.l<=r.ema21*1.005) and (r.c>r.ema21) and (r.c>p.c):
        return float(min(r.ll10, r.c-1.5*r.atr))
    return False
def e_reclaim200(d,i):
    r=d.iloc[i]; p=d.iloc[i-1]
    return (p.c<p.sma200*1.02) and (r.c>r.sma200*1.02)
