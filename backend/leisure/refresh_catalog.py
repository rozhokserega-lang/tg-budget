#!/usr/bin/env python3
"""Scheduled worker for the existing host: one process, bounded downloads, no queue.
Region mapping is operator supplied; credentials are inherited through DATABASE_URL.
"""
import argparse, fcntl, json, os, subprocess, sys, time, urllib.request
from pathlib import Path
import psycopg

def main():
    p=argparse.ArgumentParser();p.add_argument('--sources',type=Path,required=True);p.add_argument('--cache',type=Path,required=True);a=p.parse_args()
    a.cache.mkdir(parents=True,exist_ok=True)
    with (a.cache/'worker.lock').open('w') as lock:
        try: fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
        except BlockingIOError: return
        sources=json.loads(a.sources.read_text())
        with psycopg.connect(os.environ['DATABASE_URL']) as conn:
            active=conn.execute("""select distinct c.id,c.region_code from leisure_cities c join leisure_preferences p on p.city_id=c.id
             left join leisure_imports i on i.city_id=c.id where (i.next_attempt is null or i.next_attempt<=now())
             and coalesce(i.failures,0)<5 and (i.lease_until is null or i.lease_until<now()) order by c.id""").fetchall()
        grouped={}
        for ident,region in active:
            source=sources.get(region)
            if not source:
                print(json.dumps({'city':ident,'error':'No regional extract mapping','region':region}),file=sys.stderr);continue
            if not isinstance(source,str) or not source.startswith('https://download.geofabrik.de/russia/') or not source.endswith('.osm.pbf'):
                raise ValueError('Only explicit Geofabrik Russia PBF sources are accepted')
            grouped.setdefault(source,[]).append(ident)
        for source,ids in grouped.items():
            import hashlib
            target=a.cache/(hashlib.sha256(source.encode()).hexdigest()[:20]+'.osm.pbf')
            state_path=target.with_suffix('.state.json')
            try: state=json.loads(state_path.read_text())
            except (OSError,ValueError): state={}
            if state.get('failures',0)>=5 or state.get('next_attempt',0)>time.time(): continue
            try:
                if not target.exists() or time.time()-target.stat().st_mtime>7*86400:
                    temp=target.with_suffix('.part')
                    try:
                        with urllib.request.urlopen(urllib.request.Request(source,headers={'User-Agent':'TG-Budget-Catalog/1.0'}),timeout=60) as resp,temp.open('wb') as out:
                            size=0
                            while chunk:=resp.read(1024*1024):
                                size+=len(chunk)
                                if size>2*1024**3: raise ValueError('Extract exceeds 2 GiB; choose a smaller region')
                                out.write(chunk)
                        temp.replace(target)
                    finally: temp.unlink(missing_ok=True)
                state_path.write_text('{}')
            except Exception as e:
                failures=state.get('failures',0)+1
                state_path.write_text(json.dumps({'failures':failures,'next_attempt':time.time()+min(7*86400,3600*2**min(failures-1,7)),'last_error':type(e).__name__}))
                print(json.dumps({'source':source,'error':type(e).__name__}),file=sys.stderr);continue
            for ident in ids:
                result=subprocess.run([sys.executable,str(Path(__file__).with_name('import_catalog.py')),'--city-id',str(ident),'--pbf',str(target),'--source-url',source],timeout=7000,check=False)
                if result.returncode: print(json.dumps({'city':ident,'error':'Import failed','exit':result.returncode}),file=sys.stderr)
if __name__=='__main__': main()
