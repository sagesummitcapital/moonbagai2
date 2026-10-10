from uni import *
U=universe()
print(len(U), sorted(U))
rows=[]
def go(name,UU,**k):
    c,t=run(UU,**k); s=stats(c,t); s['name']=name; rows.append(s); print(s, flush=True)
B={k:U[k] for k in ['btc','eth','sol']}
go('base3',B)
for mp in [3,5,8]:
    for gate in [False,True]:
        for rank in ['rs90','brk','lowvol']:
            go(f'all mp{mp} gate{int(gate)} {rank}',U,max_pos=mp,btc_gate=gate,rank=rank)
pd.DataFrame(rows).to_csv('g1.csv',index=False)
