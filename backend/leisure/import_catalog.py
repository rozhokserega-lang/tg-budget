#!/usr/bin/env python3
"""Offline OSM import; never sends end-user requests to a public geographic API.
Dependencies: see requirements.txt
DATABASE_URL is required only for writes. Downloads are deliberately operator-managed.
"""
import argparse, hashlib, json, math, os, re, uuid, zipfile
from pathlib import Path
from zoneinfo import ZoneInfo

CATEGORIES = {'cafe','restaurant','park','museum','theatre','cinema','sight','walk','active'}

def distance(a,b,c,d):
    a,b,c,d=map(math.radians,(a,b,c,d))
    return 6371.0088*2*math.asin(min(1,math.sqrt(math.sin((c-a)/2)**2+math.cos(a)*math.cos(c)*math.sin((d-b)/2)**2)))

def category(t):
    if t.get('disused')=='yes' or t.get('abandoned')=='yes' or t.get('access') in ('private','no') or t.get('construction'): return None
    if t.get('amenity') in ('cafe','restaurant','theatre','cinema'): return t['amenity']
    if t.get('tourism')=='museum': return 'museum'
    if t.get('leisure') in ('park','garden'): return 'park'
    if t.get('tourism') in ('attraction','viewpoint') or t.get('historic') in ('monument','memorial','castle','ruins'): return 'sight'
    if t.get('place')=='square' or t.get('leisure')=='promenade': return 'walk'
    if t.get('leisure') in ('sports_centre','fitness_centre','swimming_pool','ice_rink','water_park','climbing'): return 'active'
    return None

def cities(path,alternate_path=None):
    native_names={};scores={}
    if alternate_path:
        with zipfile.ZipFile(alternate_path) as names:
            for file in names.namelist():
                if not file.endswith('.txt'): continue
                for line in names.open(file):
                    n=line.decode('utf-8').rstrip('\n').split('\t')
                    if len(n)<8 or n[2]!='ru' or n[7]=='1' or n[5]=='1': continue
                    score=2*(n[4]=='1')+(n[6]!='1')
                    if score>scores.get(n[1],-1): native_names[n[1]]=n[3];scores[n[1]]=score
    def native(f):
        # Without language metadata do not guess the language from Cyrillic script.
        return native_names.get(f[0],f[1])
    with zipfile.ZipFile(path) as z:
        regions={}
        for line in z.open('RU.txt'):
            f=line.decode('utf-8').rstrip('\n').split('\t')
            if len(f)==19 and f[8]=='RU' and f[6]=='A' and f[7]=='ADM1':
                regions[f[10]]=native(f)
        for raw in z.open('RU.txt'):
            f=raw.decode('utf-8').rstrip('\n').split('\t')
            if len(f)!=19 or f[8]!='RU' or f[6]!='P' or f[7] not in ('PPL','PPLA','PPLA2','PPLA3','PPLA4','PPLC'): continue
            try: ZoneInfo(f[17])
            except Exception: continue
            # Native name, with a stable ID and administrative code for homonyms.
            native_name=native(f)
            yield dict(id=int(f[0]),name=native_name,region=regions.get(f[10],'RU-'+f[10]),region_code='RU-'+f[10],timezone=f[17],lat=float(f[4]),lon=float(f[5]))

def extract(path,city):
    import osmium
    from shapely.geometry import shape
    factory=osmium.geom.GeoJSONFactory()
    rows={}
    class Handler(osmium.SimpleHandler):
        def record(self,obj,typ,lat,lon,ident=None):
            t=dict(obj.tags); cat=category(t); name=(t.get('name:ru') or t.get('name') or '').strip()
            if not cat or not name or not math.isfinite(lat+lon) or distance(city['lat'],city['lon'],lat,lon)>30: return
            if t.get('addr:country','RU').upper() not in ('RU','RUSSIA','РОССИЯ'): return
            # Skip an explicitly different settlement inside the catchment.
            if t.get('addr:city') and t['addr:city'].casefold()!=city['name'].casefold(): return
            ident=ident or obj.id
            address=t.get('addr:full') or ', '.join(filter(None,[t.get('addr:street') or t.get('addr:place'), t.get('addr:housenumber')]))
            key=f'osm:{typ}:{ident}'
            rows[key]=dict(id=key,name=name[:300],category=cat,lat=lat,lon=lon,address=address[:500] or None,
                description=(t.get('description:ru') or t.get('description') or '')[:1000] or None,
                source_url=f'https://www.openstreetmap.org/{typ}/{ident}')
        def node(self,n):
            if category(dict(n.tags)) and n.location.valid(): self.record(n,'node',n.location.lat,n.location.lon)
        def way(self,w):
            if not category(dict(w.tags)): return
            try:
                p=shape(json.loads(factory.create_linestring(w))).centroid
                self.record(w,'way',p.y,p.x)
            except (RuntimeError,ValueError): pass
        def area(self,a):
            if not category(dict(a.tags)): return
            try:
                p=shape(json.loads(factory.create_multipolygon(a))).representative_point()
                self.record(a,'way' if a.from_way() else 'relation',p.y,p.x,a.orig_id())
            except (RuntimeError,ValueError): pass
    # libosmium filters before Python callbacks; disk-backed node locations bound RAM
    # for district-sized files. Location/area assembly still sees the full input.
    tags=['amenity','tourism','leisure','historic','place']
    stream=(osmium.FileProcessor(str(path)).with_locations('sparse_file_array')
            .with_areas(osmium.filter.KeyFilter(*tags))
            .with_filter(osmium.filter.KeyFilter(*tags)))
    handler=Handler()
    for obj in stream:
        if isinstance(obj,osmium.osm.Node): handler.node(obj)
        elif isinstance(obj,osmium.osm.Way): handler.way(obj)
        elif isinstance(obj,osmium.osm.Area): handler.area(obj)
    # Cross-OSM-element duplicates: same normalized name/category within 40m.
    out=[]; buckets={}
    for p in sorted(rows.values(),key=lambda p:p['id']):
        key=(p['category'],re.sub(r'\W','',p['name'].casefold()))
        if any(distance(p['lat'],p['lon'],x['lat'],x['lon'])<0.04 for x in buckets.get(key,[])): continue
        buckets.setdefault(key,[]).append(p);out.append(p)
    return out

def connect():
    import psycopg
    return psycopg.connect(os.environ['DATABASE_URL'],autocommit=True)

def save_city(conn,city,rows,source,token):
    # All replacements are atomic. On parsing/network/database errors keep old catalog.
    with conn.transaction():
        lock=conn.execute('select lease_token from leisure_imports where city_id=%s for update',(city['id'],)).fetchone()
        if not lock or str(lock[0])!=str(token): raise RuntimeError('Import lease lost')
        if not rows: raise RuntimeError('Empty import refused; review the source before deactivating a city')
        conn.execute('update leisure_city_places set active=false where city_id=%s',(city['id'],))
        for p in rows:
            conn.execute('''insert into leisure_places(id,name,category,lat,lon,address,description,source_url)
              values(%(id)s,%(name)s,%(category)s,%(lat)s,%(lon)s,%(address)s,%(description)s,%(source_url)s)
              on conflict(id) do update set name=excluded.name,category=excluded.category,lat=excluded.lat,lon=excluded.lon,
              address=excluded.address,description=excluded.description,source_url=excluded.source_url,updated_at=now()''',p)
            conn.execute('insert into leisure_city_places(city_id,place_id) values(%s,%s) on conflict(city_id,place_id) do update set active=true',(city['id'],p['id']))
        conn.execute('update leisure_cities set imported_at=now() where id=%s',(city['id'],))
        conn.execute("update leisure_imports set lease_until=null,lease_token=null,last_success=now(),next_attempt=now()+interval '7 days',failures=0,last_error=null,source=%s,row_count=%s where city_id=%s",(source,len(rows),city['id']))

def main():
    p=argparse.ArgumentParser();p.add_argument('--cities-zip',type=Path);p.add_argument('--cities-only',action='store_true');p.add_argument('--ru-names',type=Path)
    p.add_argument('--city-id',type=int);p.add_argument('--pbf',type=Path);p.add_argument('--source-url');p.add_argument('--dry-run',action='store_true');p.add_argument('--output',type=Path)
    a=p.parse_args()
    registry=list(cities(a.cities_zip,a.ru_names)) if a.cities_zip else []
    if a.cities_only:
        if not registry: p.error('--cities-zip required')
        if not a.dry_run and not a.ru_names: p.error('--ru-names (GeoNames alternatenames/RU.zip) required for Russian names')
        if a.dry_run: print(json.dumps({'settlements':len(registry),'sample':registry[:3]},ensure_ascii=False));return
        with connect() as conn,conn.transaction():
            with conn.cursor() as cur:
                cur.executemany('''insert into leisure_cities(id,name,region,region_code,timezone,lat,lon) values(%(id)s,%(name)s,%(region)s,%(region_code)s,%(timezone)s,%(lat)s,%(lon)s)
                on conflict(id) do update set name=excluded.name,region=excluded.region,region_code=excluded.region_code,timezone=excluded.timezone,lat=excluded.lat,lon=excluded.lon''',registry)
        return
    if not a.pbf or not a.city_id: p.error('--pbf and --city-id required')
    token=uuid.uuid4();conn=None
    if a.dry_run:
        city=next(c for c in registry if c['id']==a.city_id)
    else:
        from psycopg.rows import dict_row
        conn=connect()
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute('select * from leisure_cities where id=%s and exists(select 1 from leisure_preferences where city_id=%s)',(a.city_id,a.city_id));city=cur.fetchone()
        if not city: p.error('City must have at least one user preference')
        if not a.source_url or not re.fullmatch(r'https://download\.geofabrik\.de/russia/[a-z0-9/-]+\.osm\.pbf',a.source_url): p.error('Use a documented Geofabrik Russia extract URL')
        conn.execute('insert into leisure_imports(city_id) values(%s) on conflict do nothing',(a.city_id,))
        leased=conn.execute("""update leisure_imports set lease_until=now()+interval '2 hours',lease_token=%s
         where city_id=%s and (lease_until is null or lease_until<now()) and (next_attempt is null or next_attempt<=now()) and failures<5 returning city_id""",(token,a.city_id)).fetchone()
        if not leased: print('Import deferred: lease or refresh cooldown');return
    try:
        rows=extract(a.pbf,city)
        if a.output: a.output.write_text(json.dumps(rows,ensure_ascii=False),encoding='utf-8')
        if conn: save_city(conn,city,rows,a.source_url,token)
        print(json.dumps({'city':city['name'],'id':city['id'],'places':len(rows),'categories':sorted({r['category'] for r in rows}),'sha256':hashlib.file_digest(a.pbf.open('rb'),'sha256').hexdigest()},ensure_ascii=False))
    except Exception as e:
        if conn:
            conn.execute("""update leisure_imports set lease_until=null,lease_token=null,failures=failures+1,
             next_attempt=now()+least(interval '7 days',interval '1 hour'*power(2,least(failures,7))),last_error=%s
             where city_id=%s and lease_token=%s""",(type(e).__name__+': '+str(e)[:400],a.city_id,token))
        raise
    finally:
        if conn: conn.close()
if __name__=='__main__': main()
