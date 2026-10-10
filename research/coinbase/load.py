import json,pandas as pd,numpy as np
def load(n):
    b=json.load(open(n+'.json'))['bars']
    df=pd.DataFrame({k:b[k] for k in ['t','o','h','l','c']})
    df['date']=pd.to_datetime(df.t,unit='s'); df=df.set_index('date').drop(columns='t')
    return df.astype(float)
