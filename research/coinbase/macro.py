from load import load
import numpy as np, pandas as pd
d=load('btc_d'); w=load('btc_w')
c=d.c
d['sma50']=c.rolling(50).mean(); d['sma200']=c.rolling(200).mean(); d['ema21']=c.ewm(span=21).mean()
w['ema20']=w.c.ewm(span=20).mean(); w['sma50']=w.c.rolling(50).mean(); w['sma200']=w.c.rolling(200).mean(); w['ema21']=w.c.ewm(span=21).mean()
last=d.iloc[-1]; lw=w.iloc[-1]
ath=d.h.max(); athd=d.h.idxmax()
print('price',last.c,'ATH',ath,athd.date(),'dd',round(100*(last.c/ath-1),1))
print('since ATH days',(d.index[-1]-athd).days)
low=d.l[athd:].min(); lowd=d.l[athd:].idxmin(); print('cycle low',low,lowd.date(),'from ATH',round(100*(low/ath-1),1),'days ATH->low',(lowd-athd).days,'bounce',round(100*(last.c/low-1),1))
print('D sma50',round(last.sma50),'sma200',round(last.sma200),'mayer',round(last.c/last.sma200,2), 'sma200 slope 20d %',round(100*(d.sma200.iloc[-1]/d.sma200.iloc[-21]-1),2))
print('W ema20',round(lw.ema20),'ema21',round(lw.ema21),'sma50',round(lw.sma50),'sma200',round(lw.sma200))
# prior cycles
for peak,name in [('2017-12-17','2017'),('2021-11-10','2021')]:
    p=pd.Timestamp(peak); seg=d[p:p+pd.Timedelta(days=500)]
    pk=d.h[p-pd.Timedelta(days=5):p+pd.Timedelta(days=5)].max()
    lo=seg.l.idxmin(); print(name,'peak',pk,'low',seg.l.min(),lo.date(),'days',(lo-p).days,'dd',round(100*(seg.l.min()/pk-1),1))
    # rallies in bear: max bounce from interim low before final low, and where it topped vs 50W/200D
# Timeline: where was price ~ (days since ATH) in prior cycles
n=(d.index[-1]-athd).days
for peak in ['2017-12-17','2021-11-10']:
    p=pd.Timestamp(peak); pk=d.h[p-pd.Timedelta(days=5):p+pd.Timedelta(days=5)].max()
    x=d.c.asof(p+pd.Timedelta(days=n)); print('prior cycle at same day',peak, round(100*(x/pk-1),1))
# recent daily
print(d[['c','sma50','sma200']].iloc[-60::10].round(0))
print('weeks: last 12 closes',w.c.iloc[-12:].round(0).tolist())
# key levels: 2026 weekly highs/lows
y=d['2026-01-01':]
print('2026 high',y.h.max(),y.h.idxmax().date(),'2026 low',y.l.min(),y.l.idxmin().date())
# monthly closes since Oct 2025
print(d.c.resample('ME').last()['2025-09':].round(0))
