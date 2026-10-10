from port import *
from bt import regime_bt
import warnings; warnings.filterwarnings('ignore')
from swing import regime
rows=[]
for per,A in [(('2017','2020'),['btc','eth']),(('2021','2026'),['btc','eth','sol']),(('2017','2026'),['btc','eth'])]:
    d=load('btc_d')
    sw,_=port(A,risk=0.05,start=per[0],end=per[1])
    reg=regime(d,'200buf')[per[0]:per[1]]
    co,_=regime_bt(d[per[0]:per[1]],reg)
    hold=d.c[per[0]:per[1]]/d.c[per[0]:per[1]].iloc[0]
    for wc in [0,0.25,0.4,0.6]:
        e=(wc*co/co.iloc[0]+(1-wc)*sw.reindex(co.index).ffill()/sw.iloc[0]).dropna()
        rows.append({**stats(e,None,f'core{int(wc*100)}+swing'),'per':per[0]})
    rows.append({**stats(hold,None,'BTC hold'),'per':per[0]})
    # plain weekly DCA into BTC with same total money: IRR-ish -> report final value per $ contributed
print(pd.DataFrame(rows).to_string(index=False))
