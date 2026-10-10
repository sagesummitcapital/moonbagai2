from swing import *
import sys
rows=[]
assets={'btc':load('btc_d'),'eth':load('eth_d'),'sol':load('sol_d')}
rules={'brk20':e_breakout20,'brk55':e_breakout55,'pb21':e_pullback21,'pb21s':e_pullback_struct}
for a,d in assets.items():
    for rn,rule in rules.items():
        for trail in ['chand3','ll20']:
          for tp1R in [2.0,3.0]:
            for stop_atr in [2.0,3.0]:
              for per in [('2016','2020'),('2021','2026')]:
                if a=='sol' and per[0]=='2016': continue
                eq,tr=sim(d,rule,risk=0.05,stop_atr=stop_atr,tp1R=tp1R,trail=trail,start=per[0],end=per[1])
                r=stats(eq,tr,rn); r.update(dict(asset=a,trail=trail,tp1R=tp1R,stopATR=stop_atr,per=per[0]))
                rows.append(r)
R=pd.DataFrame(rows); R.to_csv('swing_grid.csv',index=False)
pd.set_option('display.width',250); pd.set_option('display.max_rows',500)
print(R.sort_values(['asset','per','mar'],ascending=[True,True,False]).groupby(['asset','per']).head(6).to_string(index=False))
