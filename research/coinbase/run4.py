from port import *
import warnings; warnings.filterwarnings('ignore')
pd.set_option('display.width',250)
rows=[]
for assets in [['btc'],['btc','eth'],['btc','eth','sol']]:
  for gate in ['own','btc']:
    for risk in [0.03,0.05,0.075,0.10]:
      for per in [('2017','2020'),('2021','2026'),('2017','2026')]:
        A=[a for a in assets if not (a=='sol' and per[0]=='2017')]
        if per[0]=='2017' and 'sol' in assets: continue
        eq,tr=port(A,risk=risk,gate=gate,start=per[0],end=per[1])
        rows.append({**stats(eq,tr,'+'.join(A)),'gate':gate,'risk':risk,'per':per[0]})
R=pd.DataFrame(rows)
print(R.to_string(index=False))
