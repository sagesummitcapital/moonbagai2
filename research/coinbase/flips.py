from swing import *
d=load('btc_d'); r=regime(d,'200buf'); r2=regime(d,'200buf+20w')
w=d.resample('W-SUN').agg({'c':'last'}); we=w.c.ewm(span=20,adjust=False).mean(); ws50=w.c.rolling(50).mean()
ch=r.astype(int).diff()
print('200D hysteresis flips since 2017:')
for dt,v in ch[ch!=0].dropna()['2017':].items():
    print(dt.date(),'BULL' if v>0 else 'BEAR', round(d.c[dt]), 'ATH so far', round(d.h[:dt].max()))
print('\nweekly close vs 20W EMA flips since 2021:')
x=(w.c>we).astype(int).diff()
for dt,v in x[x!=0].dropna()['2021':].items(): print(dt.date(),'up' if v>0 else 'down',round(w.c[dt]))
print('\nweekly close vs 50W SMA flips since 2021:')
x=(w.c>ws50).astype(int).diff()
for dt,v in x[x!=0].dropna()['2021':].items(): print(dt.date(),'up' if v>0 else 'down',round(w.c[dt]))
