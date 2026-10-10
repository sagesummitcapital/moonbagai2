from port import *
import warnings; warnings.filterwarnings('ignore')
rows=[]
for lb in [40,55,70]:
  for sa in [2.5,3.0,3.5]:
    for tp in [2.0,3.0]:
      for A,per in [(['btc','eth'],('2017','2020')),(['btc','eth','sol'],('2021','2026'))]:
        eq,tr=port(A,risk=0.05,stop_atr=sa,tp1R=tp,lb=lb,start=per[0],end=per[1])
        rows.append({**stats(eq,tr,'+'.join(A)),'lb':lb,'stopATR':sa,'tp1R':tp,'per':per[0]})
R=pd.DataFrame(rows); pd.set_option('display.width',250); print(R.to_string(index=False))
eq,tr=port(['btc','eth','sol'],risk=0.05,start='2021',end='2026')
T=pd.DataFrame(tr); print(T.groupby('why').R.describe()); print(T.tail(12))
