import json, sys, pandas as pd
from multiprocessing import Pool
import scalp as S
DATA = None
def init():
    global DATA; DATA = {c: S.prep(c) for c in S.COINS}
def one(g):
    cfg = {**S.BASE, **g}
    T = pd.DataFrame([x for c in S.COINS for x in S.simulate(c, DATA[c], cfg)])
    if not len(T): return dict(cfg=json.dumps(g), n=0)
    split = pd.Timestamp('2026-09-06')
    r = dict(cfg=json.dumps(g), **S.stats(T))
    for lab, sub in (('H1', T[T.t < split]), ('H2', T[T.t >= split]), ('BTC', T[T.coin == 'BTC']), ('ETH', T[T.coin == 'ETH']), ('SOL', T[T.coin == 'SOL'])):
        s = S.stats(sub); r[lab] = f"{s.get('n',0)}/{s.get('avgR','-')}"
    return r
if __name__ == '__main__':
    grid = json.load(open(sys.argv[1]))
    with Pool(2, initializer=init) as p: rows = p.map(one, grid)
    pd.set_option('display.width', 260); pd.set_option('display.max_colwidth', 95)
    df = pd.DataFrame(rows); print(df.to_string(index=False)); df.to_csv(sys.argv[1].replace('.json', '.csv'), index=False)
