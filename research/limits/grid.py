import json, sys, pandas as pd
from multiprocessing import Pool
import limits as L
DATA = None
def init():
    global DATA; DATA = {c: L.prep(c) for c in L.COINS}
def one(g):
    P = {**L.BASE, **g}
    T = pd.DataFrame([x for c in L.COINS for x in L.run(c, P, DATA[c])])
    if not len(T): return dict(cfg=json.dumps(g), n=0)
    split = pd.Timestamp('2026-05-20')
    r = dict(cfg=json.dumps(g), **L.stats(T))
    for lab, sub in (('H1', T[T.t < split]), ('H2', T[T.t >= split]), ('core', T[T.core]), ('alts', T[~T.core])):
        s = L.stats(sub); r[lab] = f"{s.get('n',0)}/{s.get('avgR','-')}"
    return r
if __name__ == '__main__':
    grid = json.load(open(sys.argv[1]))
    with Pool(8, initializer=init) as p: rows = p.map(one, grid)
    pd.set_option('display.width', 250); pd.set_option('display.max_colwidth', 80)
    df = pd.DataFrame(rows); print(df.to_string(index=False)); df.to_csv(sys.argv[1].replace('.json','.csv'), index=False)
